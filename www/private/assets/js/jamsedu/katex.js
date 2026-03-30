import './dom-watcher.js';

/**
 * Loads KaTeX from jsDelivr and renders `.math` blocks. Also handles `.math.macro` definitions.
 *
 * @typedef {object} KatexLoaderConfig
 * @property {string} [katexVersion] npm tag, default `latest`.
 */

class KatexLoader {

    static #loader = null;

    /** Set after first successful `start()`. */
    #bootStarted = false;

    /** @type {number | null} */
    #renderFrame = null;

    /** Macros gathered from `.math.macro` elements before normal `.math` runs. */
    #macros = {};

    /**
     * @param {Partial<KatexLoaderConfig>} [options]
     */
    constructor(options = {}) {
        /** @type {KatexLoaderConfig} */
        this.config = { katexVersion: 'latest', ...options };
    }

    /**
     * @param {{
     *   useMutationObserver?: boolean,
     *   katexVersion?: string,
     *   version?: string
     * }} [options]
     */
    static start(options = {}) {
        const loader = KatexLoader.#getLoader();
        loader.configure(options);
        loader.#boot(options);
    }

    /**
     * @param {{ katexVersion?: string, version?: string }} [options]
     */
    static autoInitialize(options) {
        KatexLoader.start(options || {});
    }

    /**
     * @param {{ useMutationObserver?: boolean }} options
     */
    #boot(options) {
        if (this.#bootStarted) {
            return;
        }
        this.#bootStarted = true;

        const useMutationObserver = options.useMutationObserver !== false;

        document.addEventListener('katex-ready', () => {
            this.#renderMathElements();
        });

        void this.#loadWithVersionFallback()
            .then(() => {
                this.#signalReady();
            })
            .catch((err) => {
                console.error('[jamsedu/katex] Failed to load KaTeX:', err);
            });

        const onDomOrLateMath = () => {
            this.#scheduleRender();
        };

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', onDomOrLateMath, { once: true });
        } else {
            onDomOrLateMath();
        }

        const w = window.DomWatcher;
        if (useMutationObserver && w && typeof MutationObserver !== 'undefined') {
            w.watch('.math', onDomOrLateMath, false);
        }
    }

    /**
     * @param {Partial<KatexLoaderConfig & { version?: string }>} [options]
     */
    static configure(options) {
        KatexLoader.#getLoader().configure(options);
    }

    /**
     * @param {Partial<KatexLoaderConfig & { version?: string }>} [options]
     */
    configure(options) {
        if (!options) {
            return;
        }
        if (typeof options.version === 'string' && options.version.trim()) {
            this.config.katexVersion = options.version.trim();
        }
        if (typeof options.katexVersion === 'string' && options.katexVersion.trim()) {
            this.config.katexVersion = options.katexVersion.trim();
        }
    }

    /** @param {string} v */
    #normalizeVersion(v) {
        if (typeof v !== 'string' || !v.trim()) {
            return 'latest';
        }
        return v.trim();
    }

    /**
     * @returns {Promise<void>}
     */
    #loadWithVersionFallback() {
        const primary = this.#normalizeVersion(this.config.katexVersion);
        return new Promise((resolve, reject) => {
            const attempt = (version) => {
                this.#injectKatex(
                    version,
                    () => {
                        if (typeof window.katex?.render === 'function') {
                            resolve();
                            return;
                        }
                        if (version === 'latest') {
                            reject(new Error('KaTeX API missing after load'));
                            return;
                        }
                        attempt('latest');
                    },
                    () => {
                        if (version === 'latest') {
                            reject(new Error('KaTeX script failed'));
                            return;
                        }
                        attempt('latest');
                    }
                );
            };
            attempt(primary);
        });
    }

    /**
     * @param {string} version
     * @param {() => void} onSuccess
     * @param {() => void} onError
     */
    #injectKatex(version, onSuccess, onError) {
        if (typeof window !== 'undefined' && typeof window.katex?.render === 'function') {
            onSuccess();
            return;
        }

        document.querySelectorAll('[data-jamsedu-katex]').forEach((el) => {
            el.remove();
        });

        const base = `https://cdn.jsdelivr.net/npm/katex@${version}/dist/`;

        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = `${base}katex.min.css`;
        link.dataset.jamseduKatex = version;
        document.head.appendChild(link);

        const script = document.createElement('script');
        script.src = `${base}katex.min.js`;
        script.async = true;
        script.dataset.jamseduKatex = version;
        script.onload = () => {
            onSuccess();
        };
        script.onerror = () => {
            onError();
        };
        document.head.appendChild(script);
    }

    #scheduleRender() {
        if (this.#renderFrame != null) {
            return;
        }
        this.#renderFrame = requestAnimationFrame(() => {
            this.#renderFrame = null;
            this.#renderMathElements();
        });
    }

    #signalReady() {
        document.dispatchEvent(new Event('katex-ready'));
    }

    static #getLoader() {
        if (KatexLoader.#loader === null) {
            KatexLoader.#loader = new KatexLoader();
        }
        return KatexLoader.#loader;
    }

    /** Renders every `.math` that is not yet marked rendered. */
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
     * @param {string} s
     * @returns {string}
     */
    #sanitizeFormula(s) {
        return s
            .replace(/\u2009/g, '\\,')
            .replace(/[\u200B\u200C\u200D\uFEFF]/g, '');
    }

}

export default KatexLoader;
