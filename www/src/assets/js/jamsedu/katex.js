/**
 * KaTeX loader: loads KaTeX from CDN on demand and renders .math elements when ready.
 *
 * Formula can be in a data-formula attribute or typed inline as the element's text.
 * Caches which pages need KaTeX so repeat visits load instantly.
 */
class KatexLoader {

    #loaded = false;

    static #loader = null;

    /** Macros built from .math.macro elements, passed to every .math render. */
    #macros = {};

    /** Max age for cache entries (14 days); stale entries are pruned in requestIdleCallback. */
    #maxAgeMs = 14 * 24 * 60 * 60 * 1000;

    #storageKey = 'katex-needed-cache';

    /**
     * @param {{ katexVersion?: string, maxCachedPages?: number }} [options]
     */
    constructor(options = {}) {
        this.config = { katexVersion: 'latest', maxCachedPages: 30, ...options };
        this.currentPage = typeof location !== 'undefined' ? location.pathname : '';
        this.cdnBase = '';
    }

    /**
     * Start the loader (load KaTeX when needed, render .math elements).
     * Optionally pass options to apply before running; same shape as configure().
     * @param {{ katexVersion?: string, maxCachedPages?: number }} [options]
     */
    static autoInitialize(options) {
        const loader = KatexLoader.#getLoader();
        if (options) {
            loader.configure(options);
        }
        loader.autoInitialize();
    }

    autoInitialize() {
        if (this.#loaded) {
            return;
        }

        if (typeof document === 'undefined') {
            return;
        }

        this.cdnBase = `https://cdn.jsdelivr.net/npm/katex@${this.config.katexVersion}/dist/`;

        document.addEventListener('katex-ready', () => {
            this.#renderMathElements();
        });

        const cache = this.#getCache();
        const overLimit = Object.keys(cache.pages).length > this.config.maxCachedPages;
        if (this.#pageIsCached() || overLimit) {
            this.#loadKatex(() => {
                this.#dispatchKatexReady();
            });
        }

        document.addEventListener('DOMContentLoaded', () => {
            if (this.#pageNeedsKatex()) {
                this.#savePageToCache();
                this.#loadKatex(() => {
                    this.#dispatchKatexReady();
                });
            }
        });

        const whenIdle = typeof requestIdleCallback !== 'undefined' ? requestIdleCallback : (cb) => {
            setTimeout(cb, 1);
        };
        whenIdle(() => {
            this.#pruneStaleEntries();
        });
    }

    /**
     * Set options. Call before autoInitialize() to apply.
     * @param {{ katexVersion?: string, maxCachedPages?: number }} options
     */
    static configure(options) {
        KatexLoader.#getLoader().configure(options);
    }

    /**
     * Set options. Call synchronously after import to apply before auto-run.
     * @param {{ katexVersion?: string, maxCachedPages?: number }} options
     */
    configure(options) {
        if (options) {
            if (typeof options.katexVersion === 'string') {
                this.config.katexVersion = options.katexVersion;
            }
            if (typeof options.maxCachedPages === 'number') {
                this.config.maxCachedPages = options.maxCachedPages;
            }
        }
    }

    #dispatchKatexReady() {
        this.#loaded = true;
        document.dispatchEvent(new Event('katex-ready'));
    }

    /**
     * Returns cache for the current KaTeX version; resets if version mismatch. Sync read only; no prune.
     * @returns {object} Cache with version and pages (each value is a timestamp).
     */
    #getCache() {
        const cache = this.#safeReadCache();
        if (!cache || cache.version !== this.config.katexVersion) {
            return { version: this.config.katexVersion, pages: {} };
        }
        return cache;
    }

    static #getLoader() {
        if (KatexLoader.#loader === null) {
            KatexLoader.#loader = new KatexLoader();
        }
        return KatexLoader.#loader;
    }

    /**
     * Loads KaTeX CSS/JS from CDN if not already loaded, then invokes callback.
     * @param {() => void} callback Runs when KaTeX is ready.
     */
    #loadKatex(callback) {
        if (typeof window !== 'undefined' && window.katex?.render) {
            callback();
            return;
        }
        if (!document.querySelector('link[data-katex]')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = `${this.cdnBase}katex.min.css`;
            link.dataset.katex = 'true';
            document.head.appendChild(link);
        }
        const script = document.createElement('script');
        script.src = `${this.cdnBase}katex.min.js`;
        script.onload = callback;
        document.head.appendChild(script);
    }

    /**
     * Parses .math.macro content: lines like \f = #1f(#2) become {"\\f": "#1f(#2)"} and merge into macros.
     * @param {string} raw
     * @param {Record<string, string>} macros
     */
    #mergeMacrosFromContent(raw, macros) {
        const lines = (raw || '').split(/\r?\n/);
        const macroLine = /^\s*\\([a-zA-Z]+)\s*=\s*(.*)$/;
        for (const line of lines) {
            const withoutComment = line.replace(/%[^\n]*$/, '').trim();
            const m = withoutComment.match(macroLine);
            if (m) {
                const value = m[2].trim().replace(/;\s*$/, '');
                macros[`\\${m[1]}`] = value;
            }
        }
    }

    /**
     * Whether this page was previously marked as needing KaTeX.
     * @returns {boolean}
     */
    #pageIsCached() {
        const cache = this.#getCache();
        return Boolean(cache.pages[this.currentPage]);
    }

    /**
     * Whether the page has .math elements that need KaTeX.
     * @returns {boolean}
     */
    #pageNeedsKatex() {
        return document.querySelector('.math') !== null;
    }

    /**
     * Removes cache entries not used or updated in over 14 days and persists. Run when idle to avoid blocking.
     */
    #pruneStaleEntries() {
        const cache = this.#safeReadCache();
        if (!cache || cache.version !== this.config.katexVersion || !cache.pages) {
            return;
        }
        const now = Date.now();
        let pruned = false;
        for (const path in cache.pages) {
            if (now - (cache.pages[path] || 0) > this.#maxAgeMs) {
                delete cache.pages[path];
                pruned = true;
            }
        }
        if (pruned) {
            this.#safeWriteCache(cache);
        }
    }

    /**
     * Renders all .math with KaTeX. .math.macro: parse lines like \f = #1f(#2), pass as macros, remove element.
     */
    #renderMathElements() {
        if (typeof window.katex?.render !== 'function') {
            return;
        }
        document.querySelectorAll('.math').forEach((el) => {
            if (el.dataset.katexRendered) {
                return;
            }
            const raw = el.dataset.formula ?? el.textContent ?? '';
            if (el.classList.contains('macro')) {
                this.#mergeMacrosFromContent(raw, this.#macros);
                el.remove();
                return;
            }
            if (!raw) {
                return;
            }
            const formula = this.#sanitizeFormula(raw);
            window.katex.render(formula, el, {
                displayMode: true,
                macros: this.#macros,
                throwOnError: false
            });
            el.dataset.katexRendered = 'true';
        });
    }

    /**
     * Reads and parses the page cache from localStorage.
     * @returns {object | null} Parsed cache or null on error or missing.
     */
    #safeReadCache() {
        try {
            return JSON.parse(localStorage.getItem(this.#storageKey)) || null;
        } catch {
            return null;
        }
    }

    /**
     * Persists the cache object to localStorage.
     * @param {object} data Cache object to store.
     */
    #safeWriteCache(data) {
        try {
            localStorage.setItem(this.#storageKey, JSON.stringify(data));
        } catch {
            /* ignore */
        }
    }

    /**
     * Strips Unicode that KaTeX does not accept: zero-width chars removed, thin space (U+2009) → \,
     * @param {string} s
     * @returns {string}
     */
    #sanitizeFormula(s) {
        return s
            .replace(/\u2009/g, '\\,')
            .replace(/[\u200B\u200C\u200D\uFEFF]/g, '');
    }

    /** Records the current page as needing KaTeX in the cache. */
    #savePageToCache() {
        const cache = this.#getCache();
        cache.pages[this.currentPage] = Date.now();
        this.#safeWriteCache(cache);
    }

}

export default KatexLoader;
