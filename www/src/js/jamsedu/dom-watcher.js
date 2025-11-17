/**
 * @class DOMWatcher
 * Observes the DOM for elements matching CSS selectors
 *
 * Monitors the DOM tree for elements that match specified selectors, triggering
 * callbacks when matching elements are added. Handles both immediate detection
 * of existing elements and observation of future additions.
 *
 * @example
 * // Create a watcher instance
 * const watcher = new DOMWatcher();
 *
 * // Watch for elements (triggers once per element)
 * watcher.watch('.my-element', (element) => {
 *     console.log('Found element:', element);
 * });
 *
 * // Watch continuously (callback fires for every match)
 * watcher.watch('.my-element', (element) => {
 *     console.log('Found element:', element);
 * }, false);
 *
 * // Watch with timeout (auto-unwatch after 5 seconds)
 * watcher.watch('.my-element', (element) => {
 *     console.log('Found element:', element);
 * }, 5000);
 *
 * // Manual unwatching
 * const { unwatch } = watcher.watch('.my-element', callback);
 * unwatch(); // Stop watching
 *
 * // Clean up when done
 * watcher.disconnect();
 */
class DOMWatcher {

    constructor() {
        this.watchersBySelector = new Map();
        this.observedElements = new WeakSet(); // Track elements we've already processed
        this.observer = new MutationObserver(this.handleMutations.bind(this));
        this.observer.observe(document.documentElement, {
            childList: true,
            subtree: true
        });
    }

    checkNode(node) {
        if (!node.matches) return;

        this.watchersBySelector.forEach((callbacks, selector) => {
            // Check if the node itself matches
            if (node.matches(selector)) {
                callbacks.forEach((callback) => callback(node));
            } else {
                // If parent doesn't match, check for first matching child
                const matchingChild = node.querySelector(selector);
                if (matchingChild) {
                    callbacks.forEach((callback) => callback(matchingChild));
                }
            }
        });
    }

    disconnect() {
        this.observer.disconnect();
        this.watchersBySelector.clear();
    }

    handleMutations(mutations) {
        // Process all added nodes in a single batch
        const addedNodes = new Set();
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === 1) addedNodes.add(node);
            });
        });

        // Check each node against selectors
        addedNodes.forEach(this.checkNode.bind(this));
    }

    unwatch(selector, id) {
        const callbacks = this.watchersBySelector.get(selector);
        if (callbacks) {
            callbacks.delete(id);
            if (callbacks.size === 0) {
                this.watchersBySelector.delete(selector);
            }
        }
    }

    watch(selector, callback, once = true) {
        const watchId = Symbol();
        if (!this.watchersBySelector.has(selector)) {
            this.watchersBySelector.set(selector, new Map());
        }

        const callbacks = this.watchersBySelector.get(selector);

        const wrappedCallback = (element) => {
            // Skip if we've already processed this element
            if (this.observedElements.has(element)) {
                return;
            }

            // Mark as processed
            this.observedElements.add(element);

            // Call the callback
            callback(element);

            if (once) {
                this.unwatch(selector, watchId);
            }
        };

        // Register the callback
        callbacks.set(watchId, wrappedCallback);

        // Invoke for existing matches:
        if (once) {
            // If only once, call the first existing match (if any)
            const existingElement = document.querySelector(selector);
            if (existingElement) {
                wrappedCallback(existingElement);
            }
        } else {
            // If continuous, call all current matches
            document.querySelectorAll(selector).forEach((el) => wrappedCallback(el));
        }

        return { id: watchId, unwatch: () => this.unwatch(selector, watchId) };
    }

}

export default DOMWatcher;
