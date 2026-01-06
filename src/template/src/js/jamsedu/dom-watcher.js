// @jamsedu-version: 1.0.0
// @jamsedu-component: dom-watcher
/**
 * @class DOMWatcher
 * Observes the DOM for elements matching CSS selectors.
 *
 * Monitors the DOM tree for elements that match specified selectors, triggering
 * callbacks when matching elements are added. Handles both immediate detection
 * of existing elements and observation of future additions.
 */
class DOMWatcher {

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
        // Process all added nodes in a single batch
        const addedNodes = new Set();
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === 1) addedNodes.add(node);
            });
        });

        // Check each node against selectors
        addedNodes.forEach(this.#checkNode.bind(this));
    }

    watch(selector, callback, mode = true) {
        const watchId = Symbol();

        // Validate and normalize the mode parameter
        let once = true;
        let continuous = false;
        let timeout = null;

        if (mode === false) {
            // Continuous watching - fires for every mutation
            once = false;
            continuous = true;
        } else if (typeof mode === 'number') {
            // Timed watching with minimum 100ms
            if (mode < 100) {
                console.warn(`DOMWatcher: Timeout must be at least 100ms. Adjusting ${mode}ms to 100ms.`);
                mode = 100;
            }
            once = true;
            timeout = mode;
        } else if (mode === true) {
            // Single watch (default)
            once = true;
        }

        if (!this.#watchersBySelector.has(selector)) {
            this.#watchersBySelector.set(selector, new Map());
            this.#processedElementsBySelector.set(selector, new Set());
        }

        const watchers = this.#watchersBySelector.get(selector);
        const processedElements = this.#processedElementsBySelector.get(selector);

        const wrappedCallback = (element) => {
            // For continuous mode, always fire
            if (!continuous) {
                // For once mode, skip if already processed
                if (processedElements.has(element)) {
                    return;
                }
                // Mark as processed
                processedElements.add(element);
            }

            // Call the callback
            callback(element);

            // Only auto-unwatch if once is true AND no timeout is set
            if (once && timeout === null) {
                this.#unwatch(selector, watchId);
            }
        };

        watchers.set(watchId, wrappedCallback);

        // Set up timeout if specified and not already set for this selector
        if (timeout !== null && !this.#selectorTimers.has(selector)) {
            const timerId = setTimeout(() => {
                this.#unwatchSelector(selector);
                this.#selectorTimers.delete(selector);
            }, timeout);

            this.#selectorTimers.set(selector, timerId);
        }

        // Check existing elements - use querySelectorAll to get all matches
        const existingElements = document.querySelectorAll(selector);
        existingElements.forEach((element) => {
            wrappedCallback(element);
        });

        return {
            unwatch: () => { return this.#unwatch(selector, watchId); }
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
        // Clear timer if exists
        if (this.#selectorTimers.has(selector)) {
            clearTimeout(this.#selectorTimers.get(selector));
            this.#selectorTimers.delete(selector);
        }

        // Remove all watchers and processed elements for this selector
        this.#watchersBySelector.delete(selector);
        this.#processedElementsBySelector.delete(selector);
    }

    #checkNode(node) {
        if (!node.matches) return;

        this.#watchersBySelector.forEach((watchers, selector) => {
            // Only check if the node itself matches - don't search descendants
            if (node.matches(selector)) {
                watchers.forEach((callback) => { return callback(node); });
            }
        });
    }

    disconnect() {
        // Clear all active timers
        this.#selectorTimers.forEach((timerId) => {
            clearTimeout(timerId);
        });
        this.#selectorTimers.clear();

        this.#observer.disconnect();
        this.#watchersBySelector.clear();
        this.#processedElementsBySelector.clear();
    }

}

window.DomWatcher = new DOMWatcher();

export default window.DomWatcher;