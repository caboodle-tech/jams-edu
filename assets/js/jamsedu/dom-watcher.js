/**
 * Watches the DOM for elements matching a CSS selector. Runs your callback for nodes that already
 * exist and for nodes added later (including inside inserted subtrees).
 */
class DomWatcher {

    #observer;
    #processedElementsBySelector = new Map();
    #selectorTimers = new Map();
    #watchersBySelector = new Map();

    constructor() {
        this.#observer = new MutationObserver(this.#handleMutations.bind(this));
        this.#observer.observe(document.documentElement, {
            childList: true,
            subtree: true
        });
    }

    #handleMutations(mutations) {
        const addedNodes = new Set();
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === 1) {
                    addedNodes.add(node);
                }
            });
        });
        addedNodes.forEach(this.#checkNode.bind(this));
    }

    /**
     * @param {string} selector CSS selector.
     * @param {(element: Element) => void} callback Called with each matching element.
     * @param {boolean|number} [mode] `true` (default): first callback per element then unwatches that registration.
     *   `false`: keep firing on every match. `number`: ms window then stop (min 100).
     * @returns {{ unwatch: () => void }} Call `unwatch()` to detach this registration early.
     */
    watch(selector, callback, mode = true) {
        const watchId = Symbol();

        let once = true;
        let continuous = false;
        let timeout = null;

        if (mode === false) {
            once = false;
            continuous = true;
        } else if (typeof mode === 'number') {
            let timeoutMs = mode;
            if (timeoutMs < 100) {
                console.warn(`DomWatcher: Timeout must be at least 100ms. Adjusting ${timeoutMs}ms to 100ms.`);
                timeoutMs = 100;
            }
            once = true;
            timeout = timeoutMs;
        } else if (mode === true) {
            once = true;
        }

        if (!this.#watchersBySelector.has(selector)) {
            this.#watchersBySelector.set(selector, new Map());
            this.#processedElementsBySelector.set(selector, new Set());
        }

        const watchers = this.#watchersBySelector.get(selector);
        const processedElements = this.#processedElementsBySelector.get(selector);

        const wrappedCallback = (element) => {
            if (!continuous) {
                if (processedElements.has(element)) {
                    return;
                }
                processedElements.add(element);
            }
            callback(element);
            if (once && timeout === null) {
                this.#unwatch(selector, watchId);
            }
        };

        watchers.set(watchId, wrappedCallback);

        if (timeout !== null && !this.#selectorTimers.has(selector)) {
            const timerId = setTimeout(() => {
                this.#unwatchSelector(selector);
                this.#selectorTimers.delete(selector);
            }, timeout);
            this.#selectorTimers.set(selector, timerId);
        }

        document.querySelectorAll(selector).forEach((element) => {
            wrappedCallback(element);
        });

        return {
            unwatch: () => {
                return this.#unwatch(selector, watchId);
            }
        };
    }

    #unwatch(selector, id) {
        const watchers = this.#watchersBySelector.get(selector);
        if (watchers) {
            watchers.delete(id);
            if (watchers.size === 0) {
                this.#unwatchSelector(selector);
            }
        }
    }

    #unwatchSelector(selector) {
        if (this.#selectorTimers.has(selector)) {
            clearTimeout(this.#selectorTimers.get(selector));
            this.#selectorTimers.delete(selector);
        }
        this.#watchersBySelector.delete(selector);
        this.#processedElementsBySelector.delete(selector);
    }

    #checkNode(node) {
        if (!node.matches) {
            return;
        }
        this.#watchersBySelector.forEach((watchers, selector) => {
            /** @type {Set<Element>} */
            const hits = new Set();
            try {
                if (node.matches(selector)) {
                    hits.add(node);
                }
                if (typeof node.querySelectorAll === 'function') {
                    node.querySelectorAll(selector).forEach((el) => {
                        hits.add(el);
                    });
                }
            } catch {
                return;
            }
            hits.forEach((el) => {
                watchers.forEach((cb) => {
                    return cb(el);
                });
            });
        });
    }

    disconnect() {
        this.#selectorTimers.forEach((timerId) => {
            clearTimeout(timerId);
        });
        this.#selectorTimers.clear();
        this.#observer.disconnect();
        this.#watchersBySelector.clear();
        this.#processedElementsBySelector.clear();
    }

}

/** Same instance as the default export from this module. */
window.DomWatcher = new DomWatcher();

export default window.DomWatcher;
