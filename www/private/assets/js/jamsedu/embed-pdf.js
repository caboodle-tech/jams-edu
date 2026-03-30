// @jamsedu-version: 1.2.5
// @jamsedu-component: embed-pdf-js

import './dom-watcher.js';

/**
 * EmbedPDF Snippet loader: mounts viewers for `div[data-pdf]` and `embed[src$=".pdf"]`.
 * Loads `@embedpdf/snippet` from jsDelivr, maps `.embed-pdf-container` CSS variables into
 * `EmbedPDF.init({ theme })`, and defaults to fit-to-width zoom (see EmbedPDF `ZoomMode`).
 * Form editing and redaction UI are disabled by default. Document open/close, screenshot
 * capture, and password protect/lock UI are disabled; opening an encrypted PDF can still
 * prompt for a password (that flow is not the same as `document-protect` toolbar actions).
 * A placeholder fullscreen control is appended to `[data-epdf-i="right-group"]` (wiring TODO).
 *
 * Mount identity: the loader assigns `data-pdf-id` on each `.embed-pdf-container` (`embed-pdf-1`,
 * `embed-pdf-2`, ΓÇª). Do not set this on authored nodes; it is managed only here.
 *
 * Public API: `EmbedPdfLoader.shared.mountsById.get(id)` ΓåÆ `{ id, container, viewer, registry }`
 * (`registry` null until ready). Same order in `shared.viewers` / `shared.registries`. Each container
 * has `data-pdf-id`, `embedPdfId`, `embedPdfViewer`, and `embedPdfRegistry` (async).
 *
 * @see https://www.embedpdf.com/docs/snippet/getting-started
 * @see https://www.embedpdf.com/docs/snippet/plugins/plugin-zoom
 * @see https://www.embedpdf.com/docs/snippet/customizing-ui
 */

class EmbedPdfLoader {

    #icons = {
        // eslint-disable-next-line max-len
        exitFullscreen: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" role="img" class="h-6 w-6"><path stroke="none" d="M0 0h24v24H0z" fill="none"></path><path d="M4 8v-2c0 -.551 .223 -1.05 .584 -1.412"></path><path d="M4 16v2a2 2 0 0 0 2 2h2"></path><path d="M16 4h2a2 2 0 0 1 2 2v2"></path><path d="M16 20h2c.545 0 1.04 -.218 1.4 -.572"></path><path d="M3 3l18 18"></path></svg>`,
        // eslint-disable-next-line max-len
        fullscreen: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" role="img" class="h-6 w-6"><path stroke="none" d="M0 0h24v24H0z" fill="none"></path><path d="M4 8v-2a2 2 0 0 1 2 -2h2"></path><path d="M4 16v2a2 2 0 0 0 2 2h2"></path><path d="M16 4h2a2 2 0 0 1 2 2v2"></path><path d="M16 20h2a2 2 0 0 0 2 -2v-2"></path></svg>`
    };

    #started = false;

    #importPromise = null;

    /** @type {number | null} */
    #mountRaf = null;

    #autoMountSeq = 0;

    static #loader = null;

    /**
     * Return values from `EmbedPDF.init()`, in mount order (public; not private fields).
     * @type {unknown[]}
     */
    viewers = [];

    /**
     * Plugin registries from `await viewer.registry`, same indices as {@link EmbedPdfLoader#viewers};
     * `null` until that viewerΓÇÖs registry promise settles (public).
     * @type {unknown[]}
     */
    registries = [];

    /**
     * Lookup by loader-assigned `data-pdf-id`. Values are plain objects; `registry` is null until ready.
     * @type {Map<string, { id: string, container: HTMLElement, viewer: unknown, registry: unknown | null }>}
     */
    mountsById = new Map();

    /**
     * @param {{
     *   snippetVersion?: string,
     *   minZoom?: number,
     *   maxZoom?: number,
     *   scrollPageGap?: number,
     *   disabledCategories?: string[],
     *   fullscreenProxy?: boolean
     * }} [options]
     */
    constructor(options = {}) {
        this.config = {
            snippetVersion: '2',
            minZoom: 0.5,
            maxZoom: 3,
            scrollPageGap: 12,
            disabledCategories: [
                'form',
                'redaction',
                'document-open',
                'document-close',
                'document-capture',
                'document-protect',
                'capture'
            ],
            fullscreenProxy: true,
            ...options
        };
    }

    /**
     * @param {{
     *   snippetVersion?: string,
     *   minZoom?: number,
     *   maxZoom?: number,
     *   scrollPageGap?: number,
     *   disabledCategories?: string[],
     *   fullscreenProxy?: boolean
     * }} [options]
     */
    static autoInitialize(options) {
        const loader = EmbedPdfLoader.#getLoader();
        if (options) {
            loader.configure(options);
        }
        loader.#registerBoot(true);
    }

    /**
     * @param {Record<string, unknown>} [options] Pass `useMutationObserver: false` to skip `DomWatcher`.
     */
    static start(options = {}) {
        const loader = EmbedPdfLoader.#getLoader();
        const useMutationObserver = options.useMutationObserver !== false;
        /** @type {Record<string, unknown>} */
        const cfg = { ...options };
        delete cfg.useMutationObserver;
        loader.configure(cfg);
        loader.#registerBoot(useMutationObserver);
    }

    /**
     * @param {{
     *   snippetVersion?: string,
     *   minZoom?: number,
     *   maxZoom?: number,
     *   scrollPageGap?: number,
     *   disabledCategories?: string[],
     *   fullscreenProxy?: boolean
     * }} options
     */
    static configure(options) {
        EmbedPdfLoader.#getLoader().configure(options);
    }

    /**
     * Singleton used by `autoInitialize` / `configure`. Prefer `shared.mountsById.get(id)`; also
     * `shared.viewers` / `shared.registries` and per-container `embedPdfId`, `embedPdfViewer`,
     * `embedPdfRegistry` for `commands`, `ui.mergeSchema`, etc.
     *
     * @returns {EmbedPdfLoader}
     */
    static get shared() {
        return EmbedPdfLoader.#getLoader();
    }

    autoInitialize() {
        this.#registerBoot(true);
    }

    /**
     * @param {boolean} useMutationObserver
     */
    #registerBoot(useMutationObserver) {
        if (this.#started) {
            return;
        }
        if (typeof document === 'undefined') {
            return;
        }
        this.#started = true;

        const run = () => {
            this.#scheduleMount();
        };
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', run, { once: true });
        } else {
            run();
        }

        const w = window.DomWatcher;
        if (useMutationObserver && w && typeof MutationObserver !== 'undefined') {
            w.watch('[data-pdf]:not(.embed-pdf-container)', run, false);
            w.watch('embed[src*=".pdf"]', run, false);
        }
    }

    #scheduleMount() {
        if (this.#mountRaf != null) {
            cancelAnimationFrame(this.#mountRaf);
        }
        this.#mountRaf = requestAnimationFrame(() => {
            this.#mountRaf = null;
            void this.#mountAllIfNeeded();
        });
    }

    /**
     * @param {{
     *   snippetVersion?: string,
     *   minZoom?: number,
     *   maxZoom?: number,
     *   scrollPageGap?: number,
     *   disabledCategories?: string[],
     *   fullscreenProxy?: boolean
     * }} options
     */
    configure(options) {
        if (!options) {
            return;
        }
        if (typeof options.version === 'string' && options.version.trim()) {
            this.config.snippetVersion = options.version.trim();
        }
        if (typeof options.snippetVersion === 'string') {
            this.config.snippetVersion = options.snippetVersion.trim() ?
                options.snippetVersion.trim() :
                this.config.snippetVersion;
        }
        if (typeof options.minZoom === 'number') {
            this.config.minZoom = options.minZoom;
        }
        if (typeof options.maxZoom === 'number') {
            this.config.maxZoom = options.maxZoom;
        }
        if (typeof options.scrollPageGap === 'number') {
            this.config.scrollPageGap = options.scrollPageGap;
        }
        if (Array.isArray(options.disabledCategories)) {
            this.config.disabledCategories = options.disabledCategories;
        }
        if (typeof options.fullscreenProxy === 'boolean') {
            this.config.fullscreenProxy = options.fullscreenProxy;
        }
    }

    static #getLoader() {
        if (EmbedPdfLoader.#loader === null) {
            EmbedPdfLoader.#loader = new EmbedPdfLoader();
        }
        return EmbedPdfLoader.#loader;
    }

    /**
     * @returns {string}
     */
    #nextMountId() {
        this.#autoMountSeq += 1;
        return `embed-pdf-${this.#autoMountSeq}`;
    }

    /**
     * @returns {Promise<{ default: function, ZoomMode?: Record<string, unknown> }>}
     */
    #loadSnippetModule() {
        if (this.#importPromise) {
            return this.#importPromise;
        }
        const url = `https://cdn.jsdelivr.net/npm/@embedpdf/snippet@${this.config.snippetVersion}/dist/embedpdf.js`;
        this.#importPromise = import(/* webpackIgnore: true */ url);
        return this.#importPromise;
    }

    /**
     * Sets `type="application/pdf"` on PDF `<embed>` elements so native viewers can take over if the snippet fails.
     */
    #ensurePdfEmbedsTyped() {
        document.querySelectorAll('embed').forEach((el) => {
            const src = el.getAttribute('src')?.trim();
            if (!src || !/\.pdf(\?|#|$)/i.test(src)) {
                return;
            }
            const type = el.getAttribute('type')?.trim().toLowerCase();
            if (!type || type === 'application/pdf') {
                el.setAttribute('type', 'application/pdf');
            }
        });
    }

    /**
     * @returns {Array<{ node: Element, src: string, kind: 'data-pdf' | 'embed' }>}
     */
    #collectMounts() {
        /** @type {Array<{ node: Element, src: string, kind: 'data-pdf' | 'embed' }>} */
        const mounts = [];

        document.querySelectorAll('[data-pdf]').forEach((el) => {
            if (!(el instanceof HTMLElement)) {
                return;
            }
            if (el.classList.contains('embed-pdf-container')) {
                return;
            }
            const raw = el.getAttribute('data-pdf')?.trim();
            if (!raw) {
                return;
            }
            mounts.push({ node: el, src: raw, kind: 'data-pdf' });
        });

        document.querySelectorAll('embed').forEach((el) => {
            const src = el.getAttribute('src')?.trim();
            if (!src || !/\.pdf(\?|#|$)/i.test(src)) {
                return;
            }
            const type = el.getAttribute('type')?.trim().toLowerCase();
            if (type && type !== 'application/pdf') {
                return;
            }
            mounts.push({ node: el, src, kind: 'embed' });
        });

        return mounts;
    }

    /**
     * @param {string} src
     * @returns {string}
     */
    #resolveUrl(src) {
        try {
            return new URL(src, document.baseURI).href;
        } catch {
            return src;
        }
    }

    /**
     * @returns {'light' | 'dark' | 'system'}
     */
    #resolveThemePreference() {
        const root = document.documentElement;
        if (root.classList.contains('light') || root.classList.contains('light-mode')) {
            return 'light';
        }
        if (root.classList.contains('dark') || root.classList.contains('dark-mode')) {
            return 'dark';
        }
        return 'system';
    }

    /**
     * @param {CSSStyleDeclaration} style
     * @param {string} name
     * @returns {string | undefined}
     */
    #var(style, name) {
        const v = style.getPropertyValue(name).trim();
        return v || undefined;
    }

    /**
     * Reads semantic `--_*` tokens from a mounted `.embed-pdf-container` for EmbedPDF `theme`.
     *
     * @param {Element} el
     * @returns {Record<string, unknown>}
     */
    #themeFragmentFromElement(el) {
        const style = getComputedStyle(el);
        const accent = {
            primary: this.#var(style, '--_accent-primary'),
            primaryHover: this.#var(style, '--_accent-primary-hover'),
            primaryActive: this.#var(style, '--_accent-primary-active'),
            primaryLight: this.#var(style, '--_accent-primary-light'),
            primaryForeground: this.#var(style, '--_accent-primary-foreground')
        };
        const background = {
            app: this.#var(style, '--_background-app'),
            surface: this.#var(style, '--_background-surface'),
            surfaceAlt: this.#var(style, '--_background-surface-alt'),
            elevated: this.#var(style, '--_background-elevated'),
            overlay: this.#var(style, '--_background-overlay'),
            input: this.#var(style, '--_background-input')
        };
        const foreground = {
            primary: this.#var(style, '--_foreground-primary'),
            secondary: this.#var(style, '--_foreground-secondary'),
            muted: this.#var(style, '--_foreground-muted'),
            disabled: this.#var(style, '--_foreground-disabled'),
            onAccent: this.#var(style, '--_foreground-on-accent')
        };
        const interactive = {
            hover: this.#var(style, '--_interactive-hover'),
            active: this.#var(style, '--_interactive-active'),
            selected: this.#var(style, '--_interactive-selected'),
            focus: this.#var(style, '--_interactive-focus')
        };
        const border = {
            default: this.#var(style, '--_border-default'),
            subtle: this.#var(style, '--_border-subtle'),
            strong: this.#var(style, '--_border-strong')
        };
        const state = {
            error: this.#var(style, '--_state-error'),
            errorLight: this.#var(style, '--_state-error-light'),
            warning: this.#var(style, '--_state-warning'),
            warningLight: this.#var(style, '--_state-warning-light'),
            success: this.#var(style, '--_state-success'),
            successLight: this.#var(style, '--_state-success-light'),
            info: this.#var(style, '--_state-info'),
            infoLight: this.#var(style, '--_state-info-light')
        };
        return this.#pruneDeep({
            accent,
            background,
            foreground,
            interactive,
            border,
            state
        });
    }

    /**
     * @param {Record<string, unknown>} obj
     * @returns {Record<string, unknown>}
     */
    #pruneDeep(obj) {
        /** @type {Record<string, unknown>} */
        const out = {};
        for (const [key, value] of Object.entries(obj)) {
            if (value && typeof value === 'object' && !Array.isArray(value)) {
                /** @type {Record<string, unknown>} */
                const nested = value;
                const inner = this.#pruneDeep(nested);
                if (Object.keys(inner).length > 0) {
                    out[key] = inner;
                }
            } else if (value != null && value !== '') {
                out[key] = value;
            }
        }
        return out;
    }

    /**
     * @param {Element} node
     * @param {string} mountId
     * @returns {HTMLDivElement}
     */
    #wrapMountTarget(node, mountId) {
        const wrap = document.createElement('div');
        wrap.className = 'embed-pdf-container';
        wrap.setAttribute('data-pdf-id', mountId);
        if (node.id) {
            wrap.id = node.id;
            node.removeAttribute('id');
        }
        node.classList.forEach((c) => {
            if (c && c !== 'embed-pdf-container') {
                wrap.classList.add(c);
            }
        });
        node.replaceWith(wrap);
        return wrap;
    }

    /**
     * Restores a native PDF `<embed>` after a failed snippet init (same `src` as authored).
     *
     * @param {HTMLElement} container
     * @param {string} src
     */
    #restoreNativePdfEmbed(container, src) {
        const embed = document.createElement('embed');
        embed.setAttribute('src', src);
        embed.setAttribute('type', 'application/pdf');
        if (container.id) {
            embed.id = container.id;
        }
        container.classList.forEach((c) => {
            if (c && c !== 'embed-pdf-container') {
                embed.classList.add(c);
            }
        });
        container.replaceWith(embed);
    }

    /**
     * Restores a `div[data-pdf]` placeholder after a failed snippet init.
     *
     * @param {HTMLElement} container
     * @param {string} src
     */
    #restoreDataPdfPlaceholder(container, src) {
        const div = document.createElement('div');
        div.setAttribute('data-pdf', src);
        if (container.id) {
            div.id = container.id;
        }
        container.classList.forEach((c) => {
            if (c && c !== 'embed-pdf-container') {
                div.classList.add(c);
            }
        });
        container.replaceWith(div);
    }

    /**
     * @returns {Element | null}
     */
    #fullscreenElement() {
        return document.fullscreenElement || document.webkitFullscreenElement || null;
    }

    /**
     * Toolbar fullscreen proxy: uses your `#icons`; opens the document menu if needed, clicks the
     * real `document:fullscreen` control, then closes the menu. Icons follow `fullscreenchange`
     * for this mountΓÇÖs container.
     *
     * @param {HTMLElement} container
     */
    async #attachFullscreenProxy(container) {
        if (this.config.fullscreenProxy === false) {
            return;
        }
        const marker = 'jamsedu-fullscreen-toolbar';
        const skipProxy = `[data-epdf-i="${marker}"]`;

        /**
         * @param {(el: Element) => boolean} pred
         * @returns {HTMLElement | null}
         */
        const deepFirst = (pred) => {
            /** @type {(Element | ShadowRoot)[]} */
            const q = [container];
            while (q.length) {
                const n = q.shift();
                if (n instanceof Element) {
                    try {
                        if (pred(n)) {
                            return n instanceof HTMLElement ? n : null;
                        }
                    } catch {
                        /* ignore */
                    }
                    if (n.shadowRoot) {
                        q.push(n.shadowRoot);
                    }
                    for (let i = 0; i < n.children.length; i++) {
                        q.push(n.children[i]);
                    }
                } else if (n instanceof ShadowRoot) {
                    for (let i = 0; i < n.children.length; i++) {
                        q.push(n.children[i]);
                    }
                }
            }
            return null;
        };

        /**
         * @param {string} epdfId
         * @returns {HTMLElement | null}
         */
        const byEpdf = (epdfId) => {
            return deepFirst((el) => {
                return el instanceof HTMLElement && el.getAttribute('data-epdf-i') === epdfId;
            });
        };

        const fullscreenClickTarget = () => {
            const el = deepFirst((e) => {
                if (!(e instanceof HTMLElement) || e.closest(skipProxy)) {
                    return false;
                }
                return e.getAttribute('data-epdf-i') === 'document:fullscreen';
            });
            if (!(el instanceof HTMLElement)) {
                return null;
            }
            const inner = el.querySelector('button');
            return inner instanceof HTMLElement ? inner : el;
        };

        const documentMenuButton = () => {
            const wrap = byEpdf('document-menu-button');
            if (!(wrap instanceof HTMLElement)) {
                return null;
            }
            const inner = wrap.querySelector('button');
            return inner instanceof HTMLElement ? inner : wrap;
        };

        const deadline = Date.now() + 8000;
        while (Date.now() < deadline) {
            if (byEpdf(marker)) {
                return;
            }
            const rightGroup = byEpdf('right-group');
            if (rightGroup instanceof HTMLElement) {
                const wrap = document.createElement('div');
                wrap.setAttribute('data-epdf-i', marker);
                wrap.setAttribute('data-epdf-cat', 'document document-fullscreen');

                const btn = document.createElement('button');
                btn.type = 'button';
                btn.setAttribute('aria-label', 'Fullscreen');
                btn.className = [
                    'flex', 'h-[32px]', 'w-auto', 'min-w-[32px]', 'items-center', 'justify-center',
                    'rounded-md', 'p-[5px]', 'transition-colors', 'hover:bg-interactive-hover',
                    'hover:ring-accent', 'hover:ring', 'cursor-pointer', 'p-1'
                ].join(' ');
                const syncProxyIcon = () => {
                    if (!container.isConnected) {
                        return;
                    }
                    const fs = this.#fullscreenElement();
                    const inside = Boolean(
                        fs && (fs === container || container.contains(fs))
                    );
                    btn.innerHTML = inside ? this.#icons.exitFullscreen : this.#icons.fullscreen;
                    btn.setAttribute('aria-label', inside ? 'Exit fullscreen' : 'Fullscreen');
                };

                const closeDocumentMenuIfOpen = (menuBtn) => {
                    if (!(menuBtn instanceof HTMLElement) || !menuBtn.isConnected) {
                        return;
                    }
                    if (menuBtn.getAttribute('aria-expanded') === 'true') {
                        menuBtn.click();
                    }
                };

                const nudgeMenuClosed = (menuBtn) => {
                    if (!(menuBtn instanceof HTMLElement)) {
                        return;
                    }
                    requestAnimationFrame(() => {
                        closeDocumentMenuIfOpen(menuBtn);
                    });
                    setTimeout(() => {
                        closeDocumentMenuIfOpen(menuBtn);
                        if (menuBtn.isConnected && menuBtn.getAttribute('aria-expanded') === 'true') {
                            document.dispatchEvent(new KeyboardEvent('keydown', {
                                key: 'Escape',
                                code: 'Escape',
                                keyCode: 27,
                                bubbles: true,
                                cancelable: true
                            }));
                        }
                    }, 120);
                    setTimeout(() => {
                        closeDocumentMenuIfOpen(menuBtn);
                    }, 280);
                };

                btn.innerHTML = this.#icons.fullscreen;

                wrap.appendChild(btn);
                rightGroup.appendChild(wrap);

                // Keep a reference to the previous sibling button
                const previousBtn = wrap.previousElementSibling;

                const onFullscreenChange = () => {
                    if (!container.isConnected) {
                        document.removeEventListener('fullscreenchange', onFullscreenChange);
                        document.removeEventListener('webkitfullscreenchange', onFullscreenChange);
                        return;
                    }
                    syncProxyIcon();
                };
                document.addEventListener('fullscreenchange', onFullscreenChange);
                document.addEventListener('webkitfullscreenchange', onFullscreenChange);
                syncProxyIcon();

                btn.addEventListener('mouseenter', () => {
                    const siblingTooltip = previousBtn.querySelector('[role="tooltip"]');
                    if (!siblingTooltip) {
                        return;
                    }

                    // Clone the sibling tooltip and add it to the current button
                    const tooltip = siblingTooltip.cloneNode(true);
                    tooltip.childNodes[0].textContent = 'Toggle Fullscreen';
                    btn.before(tooltip);

                    // Show the tooltip
                    tooltip.style.transform = 'translateX(-25px)';
                    const tooltipArrow = tooltip.querySelector('div');
                    if (tooltipArrow instanceof HTMLElement) {
                        tooltipArrow.style.left = '80%';
                    }
                    tooltip.style.borderColor = 'transparent';
                    tooltip.classList.remove('opacity-0');
                    tooltip.classList.add('opacity-100');
                    tooltip.style.visibility = 'visible';
                });

                btn.addEventListener('mouseleave', () => {
                    btn.parentElement.querySelector('[role="tooltip"]')?.remove();
                });

                btn.addEventListener('click', (ev) => {
                    ev.preventDefault();
                    ev.stopPropagation();
                    const direct = fullscreenClickTarget();
                    if (direct) {
                        direct.click();
                        return;
                    }
                    const menu = documentMenuButton();
                    if (!menu) {
                        return;
                    }
                    menu.click();
                    let done = false;
                    const tryClick = () => {
                        if (done) {
                            return;
                        }
                        const t = fullscreenClickTarget();
                        if (!t) {
                            return;
                        }
                        done = true;
                        t.click();
                        nudgeMenuClosed(menu);
                    };
                    [0, 16, 48, 100, 200].forEach((ms) => {
                        setTimeout(tryClick, ms);
                    });
                });
                return;
            }
            await new Promise((r) => {
                requestAnimationFrame(r);
            });
        }
    }

    async #mountAllIfNeeded() {
        this.#ensurePdfEmbedsTyped();
        const mounts = this.#collectMounts();
        if (mounts.length === 0) {
            return;
        }

        let mod;
        try {
            mod = await this.#loadSnippetModule();
        } catch (err) {
            console.error('[jamsedu/embed-pdf] Failed to load @embedpdf/snippet:', err);
            return;
        }

        const { default: EmbedPDF, ZoomMode } = mod;
        const fitWidth = ZoomMode && typeof ZoomMode === 'object' && 'FitWidth' in ZoomMode ?
            ZoomMode.FitWidth :
            undefined;

        if (fitWidth === undefined) {
            console.warn('[jamsedu/embed-pdf] ZoomMode.FitWidth missing; using viewer default zoom');
        }

        const disabled = this.config.disabledCategories;

        for (const { node, src, kind } of mounts) {
            const absolute = this.#resolveUrl(src);
            const mountId = this.#nextMountId();
            const container = this.#wrapMountTarget(node, mountId);
            const fragment = this.#themeFragmentFromElement(container);
            const preference = this.#resolveThemePreference();
            /** @type {Record<string, unknown>} */
            const theme = { preference };
            if (Object.keys(fragment).length > 0) {
                theme.light = fragment;
                theme.dark = fragment;
            }

            const zoomExtra = fitWidth !== undefined ? { defaultZoomLevel: fitWidth } : {};

            /** @type {Record<string, unknown>} */
            const initOptions = {
                type: 'container',
                target: container,
                src: absolute,
                theme,
                scroll: {
                    defaultStrategy: 'vertical',
                    defaultPageGap: this.config.scrollPageGap
                },
                zoom: {
                    minZoom: this.config.minZoom,
                    maxZoom: this.config.maxZoom,
                    ...zoomExtra
                }
            };
            if (disabled && disabled.length > 0) {
                initOptions.disabledCategories = [...disabled];
            }

            try {
                const viewer = EmbedPDF.init(initOptions);
                const slot = this.viewers.length;
                this.viewers.push(viewer);
                this.registries.push(null);

                /** @type {{ id: string, container: HTMLElement, viewer: unknown, registry: unknown | null }} */
                const entry = { id: mountId, container, viewer, registry: null };
                this.mountsById.set(mountId, entry);

                /** @type {HTMLElement & { embedPdfId?: string, embedPdfViewer?: unknown,
                 *   embedPdfRegistry?: unknown }} */
                const host = container;
                host.embedPdfId = mountId;
                host.embedPdfViewer = viewer;

                viewer.registry.then((registry) => {
                    this.registries[slot] = registry;
                    entry.registry = registry;
                    host.embedPdfRegistry = registry;
                }).catch((regErr) => {
                    console.error('[jamsedu/embed-pdf] viewer.registry failed:', regErr);
                });

                void this.#attachFullscreenProxy(container);
            } catch (err) {
                console.error('[jamsedu/embed-pdf] EmbedPDF.init failed:', err);
                if (kind === 'embed') {
                    this.#restoreNativePdfEmbed(container, src);
                } else {
                    this.#restoreDataPdfPlaceholder(container, src);
                }
            }
        }
    }

}

export default EmbedPdfLoader;
