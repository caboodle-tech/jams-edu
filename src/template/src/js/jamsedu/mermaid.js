// @jamsedu-version: 2.2.0
// @jamsedu-component: mermaid

import './dom-watcher.js';

/**
 * Loads Mermaid from jsDelivr and renders `.mermaid` blocks.
 *
 * @typedef {object} MermaidLoaderConfig
 * @property {string} mermaidVersion npm tag.
 * @property {string} theme Passed to `mermaid.initialize`. Prefer `default` (light); dark pages use CSS
 * `filter` in `jamsedu.css`.
 */

class MermaidLoader {

    static #loader = null;

    /** Set after first successful `start()`. */
    #bootStarted = false;

    /** @type {number | null} */
    #renderFrame = null;

    /** True after `mermaid.initialize` runs once. */
    #apiInitialized = false;

    /**
     * @param {Partial<MermaidLoaderConfig>} [options]
     */
    constructor(options = {}) {
        /** @type {MermaidLoaderConfig} */
        this.config = {
            mermaidVersion: 'latest',
            theme: 'default',
            ...options
        };
    }

    /**
     * @param {{
     *   useMutationObserver?: boolean,
     *   mermaidVersion?: string,
     *   version?: string,
     *   theme?: string
     * }} [options]
     */
    static start(options = {}) {
        const loader = MermaidLoader.#getLoader();
        loader.configure(options);
        loader.#boot(options);
    }

    /**
     * @param {{ mermaidVersion?: string, version?: string, theme?: string }} [options]
     */
    static autoInitialize(options) {
        MermaidLoader.start(options || {});
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

        document.addEventListener('mermaid-ready', () => {
            this.#renderDiagramElements();
        });

        void this.#loadWithVersionFallback()
            .then(() => {
                this.#signalReady();
            })
            .catch((err) => {
                console.error('[jamsedu/mermaid] Failed to load Mermaid:', err);
            });

        const bump = () => {
            this.#scheduleRender();
        };

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', bump, { once: true });
        } else {
            bump();
        }

        const w = window.DomWatcher;
        if (useMutationObserver && w && typeof MutationObserver !== 'undefined') {
            w.watch('.mermaid', bump, false);
        }
    }

    /**
     * @param {{ mermaidVersion?: string, version?: string, theme?: string }} [options]
     */
    static configure(options) {
        MermaidLoader.#getLoader().configure(options);
    }

    /**
     * @param {{ mermaidVersion?: string, version?: string, theme?: string }} [options]
     */
    configure(options) {
        if (!options) {
            return;
        }
        if (typeof options.version === 'string' && options.version.trim()) {
            this.config.mermaidVersion = options.version.trim();
        }
        if (typeof options.mermaidVersion === 'string' && options.mermaidVersion.trim()) {
            this.config.mermaidVersion = options.mermaidVersion.trim();
        }
        if (typeof options.theme === 'string') {
            this.config.theme = options.theme;
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
        const primary = this.#normalizeVersion(this.config.mermaidVersion);
        return new Promise((resolve, reject) => {
            const attempt = (version) => {
                this.#injectMermaid(
                    version,
                    () => {
                        if (typeof window.mermaid?.run === 'function') {
                            resolve();
                            return;
                        }
                        if (version === 'latest') {
                            reject(new Error('Mermaid API missing after load'));
                            return;
                        }
                        attempt('latest');
                    },
                    () => {
                        if (version === 'latest') {
                            reject(new Error('Mermaid script failed'));
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
    #injectMermaid(version, onSuccess, onError) {
        if (typeof window !== 'undefined' && typeof window.mermaid?.run === 'function') {
            onSuccess();
            return;
        }

        document.querySelectorAll('script[data-jamsedu-mermaid]').forEach((el) => {
            el.remove();
        });

        const base = `https://cdn.jsdelivr.net/npm/mermaid@${version}/dist/`;
        const script = document.createElement('script');
        script.src = `${base}mermaid.min.js`;
        script.async = true;
        script.dataset.jamseduMermaid = version;
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
            this.#renderDiagramElements();
        });
    }

    #signalReady() {
        document.dispatchEvent(new Event('mermaid-ready'));
    }

    static #getLoader() {
        if (MermaidLoader.#loader === null) {
            MermaidLoader.#loader = new MermaidLoader();
        }
        return MermaidLoader.#loader;
    }

    /** Runs `mermaid.run` on `.mermaid` nodes. */
    #renderDiagramElements() {
        if (typeof window.mermaid?.run !== 'function') {
            return;
        }
        if (!this.#apiInitialized) {
            window.mermaid.initialize({
                startOnLoad: false,
                theme: this.config.theme
            });
            this.#apiInitialized = true;
        }
        const result = window.mermaid.run({
            querySelector: '.mermaid'
        });
        if (result != null && typeof result.then === 'function') {
            result.catch(() => {
                /* bad diagram source stays plain text */
            });
        }
    }

}

export default MermaidLoader;
