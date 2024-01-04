// Import JamsEDU element behaviors.
import JeAnchors from './behaviors/je-anchor.js';
import JeSortable from './behaviors/je-sortable.js';
import JeStripedTable from './behaviors/je-striped-table.js';

// Import additional classes for JamsEDU.
import ElementBehaviors from './element-behaviors.js';
import JamsEduIcons from './je-icons.js';

class JamsEduApp {

    /**
     * A helper function that simplifies the process of creating HTML elements.
     *
     * @param {string} tag The HTML element you would like to create.
     * @param {object} [options={}] A settings object that allows you to alter or add to the element
     *                              after it has been created.
     * @param {object} [options.attrs] Any attributes and their values to add to the element.
     * @param {string} [options.classes] A string of classes to add to the element.
     * @param {string} [options.id] The id to add to the element.
     * @param {string} [options.innerHTML] Content to add to the elements innerHTML.
     * @param {array} [options.listeners] An array of listener arrays to add to the element where
     *                                    index 0 is the event type to listen to and index 1 is the
     *                                    callback to call when that event occurs.
     * @returns {HTMLElement} The requested HTML element with any requested options added to it.
     */
    createElement(tag, options = {}) {
        const { attrs } = options;
        const { classes } = options;
        const { id } = options;
        const { innerHTML } = options;
        const { listeners } = options;
        const elem = document.createElement(tag);
        if (attrs) {
            if (this.isObject(attrs)) {
                Object.keys(attrs).forEach((attr) => {
                    elem.setAttribute(attr, attrs[attr]);
                });
            }
        }
        if (classes) {
            const tokens = classes.replace(/,/g, ' ').replace(/\s\s+/g).trim();
            tokens.split(' ').forEach((token) => {
                elem.classList.add(token);
            });
        }
        if (id) {
            elem.id = id;
        }
        if (innerHTML) {
            elem.innerHTML = innerHTML;
        }
        if (listeners) {
            if (Array.isArray(listeners)) {
                listeners.forEach((listener) => {
                    elem.addEventListener(listener[0], listener[1]);
                });
            }
        }
        return elem;
    }

    /**
     * Test an unknown item or a possible object to see if it is an actual object.
     *
     * @param {*} item An item with a potentially unknown datatype.
     * @returns {boolean} True if item was actually an object, false otherwise.
     */
    isObject(item) {
        if (typeof item === 'object' && !Array.isArray(item) && item !== null) {
            return true;
        }
        return false;
    }

    /**
     * The fastest way to get the actual type of anything in JavaScript.
     *
     * {@link https://jsbench.me/ruks9jljcu/2 | See benchmarks}.
     *
     * @param {*} unknown Anything you wish to check the type of.
     * @return {string|undefined} The type in lowercase of the unknown value passed in or undefined.
     */
    whatIs(unknown) {
        try {
            return ({}).toString.call(unknown).match(/\s([^\]]+)/)[1].toLowerCase();
        } catch (e) { return undefined; }
    }

}

// Instantiate supporting classes first.
ElementBehaviors();
JamsEduIcons();

// Instantiate the JamsEDU app.
const JamsEdu = new JamsEduApp();
window.JamsEdu = JamsEdu;

// Load all element behaviors.
JeAnchors();
JeSortable();
JeStripedTable();