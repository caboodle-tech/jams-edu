// @jamsedu-version: 1.0.0
// @jamsedu-component: mermaid

/**
 * Mermaid loader: loads Mermaid from CDN on demand and renders `.mermaid` blocks when ready.
 * Diagram definition text is the element's text content (standard `.mermaid` blocks).
 * Caches which pages need Mermaid so repeat visits load the script earlier.
 */
class MermaidLoader {

    #loaded = false;

    static #loader = null;

    /** Ensures `mermaid.initialize` runs only once per page load. */
    #apiInitialized = false;

    /** Max age for cache entries (14 days); stale entries are pruned in requestIdleCallback. */
    #maxAgeMs = 14 * 24 * 60 * 60 * 1000;

    #storageKey = 'mermaid-needed-cache';

    /**
     * @param {{ mermaidVersion?: string, maxCachedPages?: number, theme?: string }} [options]
     */
    constructor(options = {}) {
        this.config = {
            mermaidVersion: '11',
            maxCachedPages: 30,
            theme: 'default',
            ...options
        };
        this.currentPage = typeof location !== 'undefined' ? location.pathname : '';
        this.cdnBase = '';
    }

    /**
     * Start the loader (load Mermaid when needed, render `.mermaid` elements).
     * Optionally pass options to apply before running; same shape as configure().
     * @param {{ mermaidVersion?: string, maxCachedPages?: number, theme?: string }} [options]
     */
    static autoInitialize(options) {
        const loader = MermaidLoader.#getLoader();
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

        this.cdnBase = `https://cdn.jsdelivr.net/npm/mermaid@${this.config.mermaidVersion}/dist/`;

        document.addEventListener('mermaid-ready', () => {
            this.#renderDiagramElements();
        });

        const cache = this.#getCache();
        const overLimit = Object.keys(cache.pages).length > this.config.maxCachedPages;
        if (this.#pageIsCached() || overLimit) {
            this.#loadMermaid(() => {
                this.#dispatchMermaidReady();
            });
        }

        document.addEventListener('DOMContentLoaded', () => {
            if (this.#pageNeedsMermaid()) {
                this.#savePageToCache();
                this.#loadMermaid(() => {
                    this.#dispatchMermaidReady();
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
     * @param {{ mermaidVersion?: string, maxCachedPages?: number, theme?: string }} options
     */
    static configure(options) {
        MermaidLoader.#getLoader().configure(options);
    }

    /**
     * Set options. Call synchronously after import to apply before auto-run.
     * @param {{ mermaidVersion?: string, maxCachedPages?: number, theme?: string }} options
     */
    configure(options) {
        if (options) {
            if (typeof options.mermaidVersion === 'string') {
                this.config.mermaidVersion = options.mermaidVersion;
            }
            if (typeof options.maxCachedPages === 'number') {
                this.config.maxCachedPages = options.maxCachedPages;
            }
            if (typeof options.theme === 'string') {
                this.config.theme = options.theme;
            }
        }
    }

    #dispatchMermaidReady() {
        this.#loaded = true;
        document.dispatchEvent(new Event('mermaid-ready'));
    }

    /**
     * Returns cache for the current Mermaid version; resets if version mismatch. Sync read only; no prune.
     * @returns {object} Cache with version and pages (each value is a timestamp).
     */
    #getCache() {
        const cache = this.#safeReadCache();
        if (!cache || cache.version !== this.config.mermaidVersion) {
            return { version: this.config.mermaidVersion, pages: {} };
        }
        return cache;
    }

    static #getLoader() {
        if (MermaidLoader.#loader === null) {
            MermaidLoader.#loader = new MermaidLoader();
        }
        return MermaidLoader.#loader;
    }

    /**
     * Loads Mermaid JS from CDN if not already loaded, then invokes callback.
     * @param {() => void} callback Runs when Mermaid is ready to run.
     */
    #loadMermaid(callback) {
        if (typeof window !== 'undefined' && typeof window.mermaid?.run === 'function') {
            callback();
            return;
        }
        const existing = document.querySelector('script[data-jamsedu-mermaid]');
        if (existing) {
            if (typeof window.mermaid?.run === 'function') {
                callback();
            } else {
                existing.addEventListener('load', () => { return callback(); }, { once: true });
            }
            return;
        }
        const script = document.createElement('script');
        script.src = `${this.cdnBase}mermaid.min.js`;
        script.async = true;
        script.dataset.jamseduMermaid = 'true';
        script.onload = () => { return callback(); };
        document.head.appendChild(script);
    }

    /**
     * Whether this page was previously marked as needing Mermaid.
     * @returns {boolean}
     */
    #pageIsCached() {
        const cache = this.#getCache();
        return Boolean(cache.pages[this.currentPage]);
    }

    /**
     * Whether the page has `.mermaid` elements that need rendering.
     * @returns {boolean}
     */
    #pageNeedsMermaid() {
        return document.querySelector('.mermaid') !== null;
    }

    /**
     * Removes cache entries not used or updated in over 14 days and persists. Run when idle to avoid blocking.
     */
    #pruneStaleEntries() {
        const cache = this.#safeReadCache();
        if (!cache || cache.version !== this.config.mermaidVersion || !cache.pages) {
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
     * Initializes Mermaid once and runs all unprocessed `.mermaid` blocks.
     */
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
                /* ignore render errors; invalid diagrams stay as text */
            });
        }
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

    /** Records the current page as needing Mermaid in the cache. */
    #savePageToCache() {
        const cache = this.#getCache();
        cache.pages[this.currentPage] = Date.now();
        this.#safeWriteCache(cache);
    }

}

export default MermaidLoader;
