/* eslint-disable no-param-reassign */
import * as HtmlParser2 from 'htmlparser2';

/**
 * The Structured Object Model (SOM) for HTML.
 */
class HtmlSom {

    /**
     * Regular expressions used for parsing HTML attributes.
     * @private
     * @type {Object}
     */
    #regex = {
        classes: /(\.[\w-]+)/g,
        data: /(\[([^\]]+).*?\])/g,
        id: /(#[\w-]+)/,
        quotes: /'|"/g
    };

    /**
     * Represents the structure of the JamsEdu's Structured Object Model (SOM)
     * for an HTML document or fragment.
     *
     * @private
     * @type {Object}
     * @property {null} som The actual som for this HTML document or fragment; Map of Maps.
     * @property {string} src The original HTML that was parsed to create this SOM.
     * @property {null} tail A convenience property to quickly access the last node in the SOM.
     */
    #struct = {
        som: null,
        src: '',
        tail: null
    };

    /**
     * Get a new instance of the HtmlSom.
     *
     * @param {string} [htmlStr=''] The HTML string to parse into a DOM like object.
     */
    constructor(htmlStr = '') {
        this.parse(htmlStr);
    }

    /**
     * Search the SOM and find the first node that matches the requested pattern.
     *
     * @param {string} str The pattern to search for; similar to querySelector.
     * @returns {object} The object for the first matching node or an empty object.
     */
    find(str, startingNode = this.#struct.som) {
        // Add the short circuit flag for the user just in case.
        const matches = this.findAll(`${str} !`, startingNode);
        if (matches.length > 0) {
            return matches[0];
        }
        return {};
    }

    /**
     * Search the SOM and find all the nodes that match the requested pattern.
     *
     * @param {string} str The pattern to search for; similar to querySelectorAll.
     * @returns {array} An array of matching node objects or an empty array.
     */
    findAll(str, startingNode = this.#struct.som) {
        // If som is missing the user specifically tried an empty object or never set the source.
        if (!startingNode) {
            return [];
        }

        // If the user is starting from a node in the som we need to wrap it in a Map to work.
        if (!(startingNode instanceof Map)) {
            if (!startingNode.key || !startingNode.value) {
                return [];
            }
            const { key } = startingNode;
            const { value } = startingNode;
            startingNode = new Map();
            startingNode.set(key, value);
        }

        // Allow to short circuit the search.
        const index = str.indexOf('!');
        if (index > -1) {
            str = `${str.substring(0, index).trim()} !`;
        }

        // The search string is querySelector like so break it into it's parts (levels).
        const parts = str.trim().split(' ');

        // Start the initial search at the root of the SOM.
        let search = startingNode;

        // Allow short circuiting the search.
        const negate = {
            matches: false,
            shortCircuit: false
        };

        // Search down the SOM until no matches are found or we reach the end of the SOM.
        parts.forEach((part, i) => {
            // Do not recurse further and end here.
            if (part === '!') {
                return;
            }

            // If the next part is a stop flag register that now.
            if (parts[i + 1]) {
                if (parts[i + 1] === '!') {
                    negate.shortCircuit = true;
                }
            }

            const { element, selectors } = this.#getSelectorParts(part);
            const matches = new Map();
            this.#findAll(search, element, selectors, matches, negate);

            // If we found matches treat them as the new SOM and keep recursing.
            if (matches.size > 0) {
                search = matches;
            } else {
                search = startingNode;
            }
        });

        // If search is not equal to the original SOM that means we found match(s).
        if (search !== startingNode) {
            return Array.from(search.entries()).map(([key, value]) => ({ key, value }));
        }
        return [];
    }

    /**
     * @private
     * Search for all the matches at the provided SOM level.
     *
     * @param {object} som The current SOM to search for matches.
     * @param {string} element The string that represents this element (tag).
     * @param {object} selectors An object or arrays for this elements id, classes, and data attributes.
     * @param {array} matches An array to append matches to.
     */
    #findAll(som, element, selectors, matches, negate) {
        const regex = this.#makeRegex(element);

        som.forEach((node, key) => {
            if (regex.some((rx) => rx.test(key))) {
                let record = true;
                let notCounter = 0;

                // Check classes.
                if (selectors.classes.length > 0) {
                    const check = node.attrsMap.get('class') || '';
                    selectors.classes.forEach((className) => {
                        if (!check.includes(className)) {
                            record = false;
                        }
                    });
                }

                // Check not classes.
                if (selectors.notClasses.length > 0) {
                    const check = node.attrsMap.get('class') || '';
                    selectors.notClasses.forEach((className) => {
                        if (check.includes(className)) {
                            notCounter += 1;
                        }
                    });
                }

                // Check data.
                if (selectors.data.length > 0) {
                    selectors.data.forEach((dataObj) => {
                        if (!node.attrsMap.has(dataObj.key)) {
                            record = false;
                            return;
                        }

                        if (dataObj.value) {
                            if (!node.attrsMap.get(dataObj.key).includes(dataObj.value)) {
                                record = false;
                            }
                        }
                    });
                }

                // Check not data.
                if (selectors.notData.length > 0) {
                    selectors.notData.forEach((dataObj) => {
                        if (node.attrsMap.has(dataObj.key)) {
                            notCounter += 1;
                            return;
                        }

                        if (dataObj.value) {
                            if (node.attrsMap.get(dataObj.key).includes(dataObj.value)) {
                                notCounter += 1;
                            }
                        }
                    });
                }

                // Check ids.
                if (selectors.id) {
                    const check = node.attrsMap.get('id') || '';
                    if (!check.includes(selectors.id)) {
                        record = false;
                    }
                }

                // Check not ids.
                if (selectors.notId) {
                    const check = node.attrsMap.get('id') || '';
                    if (check.includes(selectors.notId)) {
                        notCounter += 1;
                    }
                }

                if (record && (selectors.notCount === 0 || selectors.notCount !== notCounter)) {
                    negate.matches = true;
                    matches.set(key, node);
                }
            }

            // If this element has children search them as well.
            if (node.children && node.children.size > 0) {
                // Short circuit the search if we found a match and the user requested it (!).
                if (negate.shortCircuit && negate.matches) {
                    return;
                }
                this.#findAll(node.children, element, selectors, matches, negate);
            }
        });
    }

    /**
     * Get the SOM created from the parsed HTML.
     */
    get som() {
        return this.#struct.som || null;
    }

    /**
     * Get the source code that was parsed to create the current SOM.
     */
    get src() {
        return this.#struct.src || '';
    }

    /**
     * Get the HTML string for the current SOM.
     *
     * @returns {string} The HTML string for the current SOM.
     */
    getHtml() {
        if (this.#struct.som?.size === 0 || !this.#struct.tail) {
            return '';
        }

        const { end } = this.#struct.som.get(this.#struct.tail).loc;

        return this.getLines(0, end);
    }

    /**
     * Get a portion of the original source file.
     *
     * @param {int} start The line to start at.
     * @param {int} end The line to end at.
     * @returns {string} The portion of the source file requested.
     */
    getLines(start, end) {
        if (!this.#struct.src) {
            return '';
        }

        // Add 1 to end because substring is not inclusive of the end index and we need it to be.
        end += 1;

        // Handle position errors.
        if (start > this.#struct.src.length) {
            return '';
        }
        if (end > this.#struct.src.length) {
            end = this.#struct.src.length;
        }

        return this.#struct.src.substring(start, end);
    }

    /**
     * Get the inner source code (innerHTML) of a node.
     *
     * @param {object} somNode The SOM node object to get the source code from.
     * @returns {string} The requested portion of code or an empty string.
     */
    getNodeInnerHtml = (somNode) => {
        let children = [];

        if (somNode.key && somNode.value) {
            // Wrapped SOM node returned from searching the SOM map.
            ({ children } = somNode.value.node);
        } else if (somNode.node && somNode.loc) {
            // Unwrapped SOM value returned from searching the SOM map.
            ({ children } = somNode.node);
        } else if (somNode.startIndex && somNode.endIndex) {
            // Actual SOM node (Element) pulled from the SOM map.
            ({ children } = somNode);
        }

        if (children.length > 0) {
            // Get the start and end indices of the first and last children respectively.
            const start = children[0].startIndex || -1;
            const end = this.#getLastChildIndex(children);
            if (start > -1 && end > -1) {
                return this.getLines(start, end);
            }
        }
        return '';
    };

    /**
     * Determine the last child index in an array of children nodes. Since we allow nonstandard
     * nesting of elements we can not grab the first last child we encounter, we must check the
     * last child's children attribute as well until we truly reach the end node.
     *
     * @param {array} children An array of HtmlParser2 node elements.
     * @returns {int} A positive number indicating where the last child end index is or -1 if none was found.
     */
    #getLastChildIndex(children) {
        if (children.length === 1) {
            return children[0].endIndex || -1;
        }

        const lastChild = children[children.length - 1];
        if (lastChild.children) {
            return this.#getLastChildIndex(lastChild.children);
        }

        return lastChild.endIndex || -1;
    }

    /**
     * Get the source code (HTML) of a node.
     *
     * @param {object} somNode The SOM node object to get the source code from.
     * @returns {string} The requested portion of code or an empty string.
     */
    getNodeHtml = (somNode) => {
        let start = -1;
        let end = -1;

        if (somNode.key && somNode.value) {
            // Wrapped SOM node returned from searching the SOM map.
            ({ start, end } = somNode.value.loc);
        } else if (somNode.node && somNode.loc) {
            // Unwrapped SOM value returned from searching the SOM map.
            ({ start, end } = somNode.loc);
        } else if (somNode.startIndex && somNode.endIndex) {
            // Actual SOM node (Element) pulled from the SOM map.
            start = somNode.startIndex;
            end = somNode.endIndex;
        }

        if (start > -1 && end > -1) {
            return this.getLines(start, end);
        }
        return '';
    };

    /**
     * @private
     * Convert a string representing an html element into the tag (element) itself with attributes
     * removed and recorded in a separate object.
     *
     * @param {string} part The string that makes up the opening tag of an html element.
     * @returns {object<element, selectors>}
     */
    #getSelectorParts(part) {
        let element = part;
        const selectors = {
            classes: [],
            data: [],
            id: null,
            notCount: 0,
            notClasses: [],
            notData: [],
            notId: null
        };

        // Split the part on ':not'
        const notParts = part.match(/:not\(([^)]+)\)/g);
        if (notParts) {
            notParts.forEach((notPart) => {
                // Clean the notPart.
                const cleanNotPart = notPart.replace(/:not\(|\)$/g, '');

                // Check for any not classes.
                let notMatches = cleanNotPart.matchAll(this.#regex.classes) || [];
                for (const match of notMatches) {
                    selectors.notClasses.push(match[1].substring(1));
                    selectors.notCount += 1;
                }

                // Check for any not data blocks.
                notMatches = cleanNotPart.matchAll(this.#regex.data) || [];
                for (const match of notMatches) {
                    const parts = match[2].split('=');
                    const key = parts[0];
                    let value = parts[1] || null;
                    if (value) {
                        value = value.replace(this.#regex.quotes, '');
                    }
                    selectors.notData.push({ key, value });
                    selectors.notCount += 1;
                }

                // Check for a not id.
                notMatches = cleanNotPart.match(this.#regex.id) || [];
                if (notMatches.length > 0) {
                    selectors.notId = notMatches[0].substring(1);
                    selectors.notCount += 1;
                }

                // Remove the :not part from the main element.
                element = element.replace(notPart, '');
            });
        }

        /**
         * Now process the remaining element for regular selectors.
         */

        // Check for any classes.
        let matches = element.matchAll(this.#regex.classes) || [];
        for (const match of matches) {
            element = element.replace(match[0], '');
            selectors.classes.push(match[1].substring(1));
        }

        // Check for any data blocks.
        matches = element.matchAll(this.#regex.data) || [];
        for (const match of matches) {
            const parts = match[2].split('=');
            const key = parts[0];
            let value = parts[1] || null;
            if (value) {
                value = value.replace(this.#regex.quotes, '');
            }
            element = element.replace(match[0], '');
            selectors.data.push({ key, value });
        }

        // Check for an id.
        matches = element.match(this.#regex.id) || [];
        if (matches.length > 0) {
            element = element.replace(matches[0], '');
            selectors.id = matches[0].substring(1);
        }

        return { element, selectors };
    }

    /**
     * Get the SOM object.
     *
     * @returns {object} The SOM object.
     */
    getStructure() {
        return { ...this.#struct };
    }

    /**
     * @private
     * Build RegExp objects that can find if a string contains our pattern.
     *
     * @param {string} str The search string (pattern) we need want to look for.
     * @returns {array} An array of RegExp objects that can find if a string contains our pattern.
     */
    #makeRegex(str = '.*') {
        /**
         * NOTE: No other complex regular expressions have been needed, maybe we can move away from
         * returning an array of regex objects and just return a single regex object.
         */
        const regex = [
            new RegExp(`^${str}$|\\s+${str}$|^${str}\\s+|\\s+${str}\\s+`)
        ];
        return regex;
    }

    /**
     * Parses the given HTML string and returns the structure of the parsed DOM tree; we refer to
     * this structure as the Structured Object Model (SOM) since its DOM like but not quite.
     *
     * @param {string} htmlStr The HTML string to parse.
     * @returns {Object} The structure of the parsed DOM tree.
     */
    parse(htmlStr = '') {
        if (!htmlStr) {
            return;
        }
        // Hang on to the original source code.
        this.#struct.src = htmlStr;

        // Parse the HTML string into a DOM like tree.
        const options = {
            withStartIndices: true, // We need starting line numbers.
            withEndIndices: true,   // We need ending line numbers.
            xmlMode: true,          // Treat all HTML as tags and not text, even malformed HTML.
            lowerCaseTags: true     // Reverse this setting to the standard that xmlMode disables.
        };
        const dom = HtmlParser2.parseDocument(htmlStr, options);
        const walkerObj = this.#walk(dom.childNodes);
        this.#struct.som = walkerObj.children;

        return this.getStructure();
    }

    /**
     * @private
     * Walk the "DOM" returned by HtmlParser2 and convert it into our HTML SOM; we refer to
     * this structure as the Structured Object Model (SOM) since its DOM like but not quite.
     *
     * @param {array} nodes An array of all child Nodes at the current level in the "DOM" tree.
     * @param {int} nodeCount How many nodes have been processed; used as a unique id number for keys.
     * @returns {children<Map>, nodeCount<int>} A walker object of the current levels SOM (JS Map)
     *                                          and processed node count.
     */
    #walk(nodes, nodeCount = 0) {
        const maps = new Map();

        nodes.forEach((node) => {
            /**
             * Ignore nodes with no official tag name (usually comments and text elements) and no
             * children attribute (text elements). These elements are still reachable through their
             * parent nodes but are not directly recorded in the SOM.
             */
            if (!node.tagName || !node.children) {
                return;
            }

            // Increment the node count for a unique key.
            nodeCount += 1;
            // Hang on to the current number so our SOM nodes are numbers by order of appearance in SOM.
            const nodeNumber = nodeCount;

            // Build this nodes attribute string but also keep a separate map of the attribute key value pairs.
            const attrsMap = new Map();
            let attributes = '';
            if (node.attribs) {
                Object.keys(node.attribs).forEach((name) => {
                    attrsMap.set(name, node.attribs[name]);
                    attributes += `${name}="${node.attribs[name]}" `;
                });
            }
            attributes = ` ${attributes}`;

            // Recurse down the "DOM" tree and process child nodes.
            let children = null;
            if (node.children.length > 0) {
                ({ children, nodeCount } = this.#walk(node.children, nodeCount));
            }

            // Convert the indices to a location object for easier retrieval.
            const loc = {
                start: node.startIndex,
                end: node.endIndex
            };

            // Record the completed node to the map for the level we are currently processing.
            const key = `${node.tagName}${attributes.trimEnd()} N<${nodeNumber}>`;
            maps.set(key, {
                attrsMap, children, node, loc
            });

            // Track the last node processed for quick access; used by `getHtml`.
            this.#struct.tail = key;
        });

        return { children: maps, nodeCount };
    }

}

export default HtmlSom;
