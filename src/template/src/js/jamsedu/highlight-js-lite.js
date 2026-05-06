// @jamsedu-version: 1.1.0
// @jamsedu-component: js-jamsedu-highlight-js-lite

/**
 * Loads [Highlight JS Lite](https://github.com/caboodle-tech/highlight-js-lite) from jsDelivr (GitHub).
 * Injects `window.hljslConfig` via an inline script in `document.head` before the CDN script so HLJSL reads it on load.
 *
 * @typedef {object} HighlightJsLiteLoaderConfig
 * @property {string} [hljslVersion] Git ref for jsDelivr (`latest`, `v4.0.0`, …). Same as `version`.
 */

/** Keys owned by this loader; not forwarded to `window.hljslConfig`. */
const RESERVED_OPTION_KEYS = new Set(['version', 'hljslVersion', 'useMutationObserver']);

class HighlightJsLiteLoader {

    static #loader = null;

    /** Set after first successful `start()`. */
    #bootStarted = false;

    /**
     * @param {Partial<HighlightJsLiteLoaderConfig & Record<string, unknown>>} [options]
     */
    constructor(options = {}) {
        /** @type {HighlightJsLiteLoaderConfig & Record<string, unknown>} */
        this.config = { hljslVersion: 'latest', ...options };
    }

    /**
     * @param {{
     *   useMutationObserver?: boolean,
     *   version?: string,
     *   hljslVersion?: string,
     *   [key: string]: unknown
     * }} [options]
     */
    static start(options = {}) {
        const loader = HighlightJsLiteLoader.#getLoader();
        loader.configure(options);
        loader.#boot();
    }

    /**
     * @param {Record<string, unknown>} [options]
     */
    static autoInitialize(options) {
        HighlightJsLiteLoader.start(options || {});
    }

    #boot() {
        if (this.#bootStarted) {
            return;
        }
        this.#bootStarted = true;

        void this.#loadWithVersionFallback().catch((err) => {
            console.error('[jamsedu/highlight-js-lite] Failed to load HLJSL:', err);
        });
    }

    /**
     * @param {Record<string, unknown>} [options]
     */
    static configure(options) {
        HighlightJsLiteLoader.#getLoader().configure(options);
    }

    /**
     * @param {Record<string, unknown>} [options]
     */
    configure(options) {
        if (!options) {
            return;
        }
        if (typeof options.version === 'string' && options.version.trim()) {
            this.config.hljslVersion = options.version.trim();
        }
        if (typeof options.hljslVersion === 'string' && options.hljslVersion.trim()) {
            this.config.hljslVersion = options.hljslVersion.trim();
        }
        for (const [key, value] of Object.entries(options)) {
            if (!RESERVED_OPTION_KEYS.has(key)) {
                this.config[key] = value;
            }
        }
    }

    /**
     * Options passed through to `window.hljslConfig` (JSON-serializable values only).
     *
     * @returns {Record<string, unknown>}
     */
    #hljslConfigFromConfig() {
        /** @type {Record<string, unknown>} */
        const out = {};
        for (const [key, value] of Object.entries(this.config)) {
            if (!RESERVED_OPTION_KEYS.has(key)) {
                out[key] = value;
            }
        }
        return out;
    }

    /** @param {string} v */
    #normalizeVersion(v) {
        if (typeof v !== 'string' || !v.trim()) {
            return 'latest';
        }
        return v.trim();
    }

    /** @returns {string} */
    #resolvedVersion() {
        const v = this.config.hljslVersion;
        return this.#normalizeVersion(typeof v === 'string' ? v : 'latest');
    }

    /**
     * @returns {Promise<void>}
     */
    #loadWithVersionFallback() {
        const primary = this.#resolvedVersion();
        return new Promise((resolve, reject) => {
            const bumpToLatestOrReject = (version, err) => {
                if (version === 'latest') {
                    reject(err);
                    return;
                }
                tryVersion('latest');
            };
            const tryVersion = (version) => {
                this.#injectHljsl(
                    version,
                    () => {
                        if (typeof window.hljsl?.getVersion === 'function') {
                            resolve();
                            return;
                        }
                        bumpToLatestOrReject(version, new Error('HLJSL API missing after load'));
                    },
                    () => {
                        bumpToLatestOrReject(version, new Error('HLJSL script failed'));
                    }
                );
            };
            tryVersion(primary);
        });
    }

    /**
     * @param {string} version
     * @param {() => void} onSuccess
     * @param {() => void} onError
     */
    #injectHljsl(version, onSuccess, onError) {
        if (typeof window.hljsl?.getVersion === 'function') {
            onSuccess();
            return;
        }

        window.hljsl?.disconnect?.();

        document.querySelectorAll('[data-jamsedu-hljsl]').forEach((el) => {
            el.remove();
        });

        const hljslConfig = this.#hljslConfigFromConfig();
        const configJson = JSON.stringify(hljslConfig);
        const inline = document.createElement('script');
        inline.dataset.jamseduHljsl = version;
        inline.textContent = `window.hljslConfig = Object.assign({}, window.hljslConfig || {}, ${configJson});`;
        document.head.appendChild(inline);

        const src = `https://cdn.jsdelivr.net/gh/caboodle-tech/highlight-js-lite@${version}/dist/hljsl.min.js`;
        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.dataset.jamseduHljsl = version;
        script.onload = () => {
            onSuccess();
        };
        script.onerror = () => {
            onError();
        };
        document.head.appendChild(script);
    }

    static #getLoader() {
        if (HighlightJsLiteLoader.#loader === null) {
            HighlightJsLiteLoader.#loader = new HighlightJsLiteLoader();
        }
        return HighlightJsLiteLoader.#loader;
    }

}

export default HighlightJsLiteLoader;
