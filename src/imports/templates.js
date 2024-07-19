import Fs from 'fs';
import HtmlSom from './html-som.js';
import Path from 'path';
import Print from './print.js';
import { Ext } from './helpers.js';

class Templates {

    /**
     * Regular expressions used for template processing.
     * @type {Object}
     * @private
     */
    #regex = {
        htmlFileExtension: /\.html$/,
        pipeEntity: /&#124;/g,
        pipes: /\|/g,
        relativePaths: /\.\.|\.[\\/]{1}/g,
        spaces: /\s/g,
        windowsSeparators: /\\/g
    };

    /**
     * Map to store the loaded templates.
     * @type {Map}
     * @private
     */
    #templates = new Map();

    /**
     * The absolute path to the directory where the template files are in the user's project.
     * @type {string}
     * @private
     */
    #templateDir;

    /**
     * Map to store temporary variables during processing of the user's source files.
     * @type {Map}
     * @private
     */
    #temporaryVariables = new Map();

    /**
     * Throttled function reference used to reload the templates in a controlled manner.
     * @type {function}
     * @private
     */
    #throttledReloadTemplates = null;

    /**
     * Map to store the variables used in template processing.
     * @type {Map}
     * @private
     */
    #variables = new Map();

    /**
     * Flag to determine if additional debugging output should be printed to the console.
     * @type {boolean}
     * @private
     */
    #verbose = false;

    /**
     * Get a new instance of Templates that uses template files and variables to build source files
     * into their production versions.
     *
     * @param {string} templateDir The absolute path to the directory where the template files are in the users project.
     * @param {boolean} verbose Should additional debugging output be printed to the console, default value is false.
     */
    constructor(templateDir, verbose = false) {
        this.#templateDir = templateDir;
        this.#verbose = verbose;
        this.#loadTemplates();
    }

    /**
     * Load all template files and variables into memory in preparation for building source files.
     */
    #loadTemplates() {
        // Nested function to recursively process all template files.
        const loadAllTemplates = (dirPath) => {
            const files = Fs.readdirSync(dirPath);
            for (const file of files) {
                const filePath = Path.join(dirPath, file);
                const stats = Fs.statSync(filePath);
                if (stats.isDirectory()) {
                    loadAllTemplates(filePath);
                } else {
                    const ext = Ext(file);
                    try {
                        if (ext === 'html') {
                            const key = this.templatePathKey(filePath);
                            const html = Fs.readFileSync(filePath, { encoding: 'utf8' }).toString();
                            const som = new HtmlSom(html);
                            this.#templates.set(key, { html, som });
                            if (this.#verbose) {
                                Print.info(`Loaded template: ${key}`);
                            }
                        } else if (ext === 'json') {
                            const content = Fs.readFileSync(filePath, { encoding: 'utf8' }).toString();
                            const json = JSON.parse(content);
                            const keys = Object.keys(json);
                            keys.forEach((key) => {
                                this.#variables.set(key, json[key]);
                            });
                            if (this.#verbose) {
                                const len = keys.length;
                                Print.info(`Loaded ${len} variable${len === 1 ? '' : 's'} from: ${filePath}`);
                            }
                        }
                    } catch (e) {
                        Print.error(`Error loading template: ${filePath}\n${e}`);
                    }
                }
            }
        };

        /**
         * Nested function to recursively preprocess the loaded template files. There may be variables
         * to overwrite and templates may rely (call) on other template files.
         */
        const preprocessTemplates = () => {
            this.#templates.forEach((obj) => {
                let { html } = obj;
                const { som } = obj;

                som.findAll('slot[name]').forEach((node) => {
                    const key = node.value.attrsMap.get('name');
                    const html = som.getNodeInnerHtml(node);
                    this.#variables.set(key, html.trim());
                });

                som.findAll('template').forEach((node) => {
                    // TODO: Skip templates that should be left in the final output?
                    const key = som.getNodeInnerHtml(node);
                    const nodeHtml = som.getNodeHtml(node);
                    const templateObj = this.#templates.get(key);
                    html = html.replace(nodeHtml, templateObj.som.getHtml());
                });
                obj.html = html;
            });

            /**
             * Record the original HTML string so later when we need to build source files we can
             * immediately replace sections of the HTML without having to get the HTML back from the
             * SOM which would be an expensive process.
             */
            this.#templates.forEach((obj) => {
                const { html } = obj;
                obj.som = new HtmlSom(html);
            });
        };

        loadAllTemplates(this.#templateDir);
        preprocessTemplates();
    }

    /**
     * Build the provided file into its production version by applying the templates and variables
     * found in the files source code.
     *
     * @param {string} file The absolute path to the file that should be processed.
     * @returns {string} The content of the built file.
     */
    process(file) {
        // const key = this.templatePathKey(file);

        let html = Fs.readFileSync(file, { encoding: 'utf8' }).toString();
        let som = new HtmlSom(html);

        // Replace template tags first.
        som.findAll('template').forEach((node) => {
            // TODO: Skip templates that should be left in the final output?
            const key = som.getNodeInnerHtml(node);
            const nodeHtml = som.getNodeHtml(node);
            const templateObj = this.#templates.get(key);
            html = html.replace(nodeHtml, templateObj.som.getHtml());
        });

        // Create a new SOM based on the new HTML and now look for any variables (named slots).
        som = new HtmlSom(html);

        // We could have many variables (named slots) so build a single large regex instead.
        let patterns = '';
        som.findAll('slot[name]').forEach((node) => {
            const key = node.value.attrsMap.get('name');
            const outerHtml = som.getNodeHtml(node);
            const innerHtml = som.getNodeInnerHtml(node);
            // Add this variable (slot) to the temporary list.
            this.#temporaryVariables.set(key, innerHtml.trim());

            // Record this variable (slot) for removal from the HTML.
            patterns += `\\n?${outerHtml.replace(this.#regex.pipes, '&#124;')}\\n?|`;
        });
        // Remove all named slot tags from the HTML and replace any pipe symbols we had to encode.
        html = html.replace(new RegExp(patterns.slice(0, -1), 'g'), '');
        html = html.replace(this.#regex.pipeEntity, '|');

        // Now find and replace all variables (slots) in the HTML.
        som.findAll('slot:not([name])').forEach((node) => {
            // TODO: Skip slot tags that should be left in the final output?
            let merge = false;
            if (node.key.includes('merge')) {
                merge = true;
            }

            let ours = true;
            if (node.key.includes('theirs')) {
                ours = false;
            }

            // Get the variable (slot) name and value (outerHtml)
            const key = som.getNodeInnerHtml(node);
            const outerHtml = som.getNodeHtml(node);

            const tmpVarExists = this.#variables.has(key);
            const usrVarExists = this.#temporaryVariables.has(key);
            const tmpVarValue = this.#variables.get(key) || '';
            const usrVarValue = this.#temporaryVariables.get(key) || '';

            let replacement = '';

            if (merge && ours) {
                // Merge variable placing template variable first.
                if (tmpVarExists) {
                    replacement += `${tmpVarValue}\n`;
                }
                if (usrVarExists) {
                    replacement += `${usrVarValue}\n`;
                }
            } else if (merge) {
                // Merge variable placing user variable first.
                if (usrVarExists) {
                    replacement += `${usrVarValue}\n`;
                }
                if (tmpVarExists) {
                    replacement += `${tmpVarValue}\n`;
                }
            } else if (usrVarExists) {
                // Apply users variable.
                replacement = usrVarValue;
            } else if (tmpVarExists) {
                // Apply template variable.
                replacement = tmpVarValue;
            }

            html = html.replace(outerHtml, replacement.trim());
        });

        return html;
    }

    /**
     * Reloads all templates by clearing the template and variable maps, and then loading the templates again.
     *
     * Note that this function is throttled to prevent it from being called too frequently.
     */
    reloadTemplates() {
        // Check if the throttled function already exists.
        if (this.#throttledReloadTemplates) {
            // Call the throttled function.
            this.#throttledReloadTemplates();
        } else {
            // Create a new throttled function.
            this.#throttledReloadTemplates = this.#throttle(() => {
                // Clear the template and variable maps.
                this.#templates.clear();
                this.#variables.clear();
                // Load the templates again.
                this.#loadTemplates();
            }, 500);
            // Call the throttled function.
            this.#throttledReloadTemplates();
        }
    }

    /**
     * Returns the key for a given template file path.
     *
     * The key is derived by removing the template directory, replacing spaces with dashes,
     * removing relative paths, replacing Windows separators with forward slashes,
     * and removing the HTML file extension.
     *
     * @param {string} filePath The file path of the template.
     * @returns {string} The key for the template.
     */
    templatePathKey(filePath) {
        const key = filePath.replace(this.#templateDir, '')
            .replace(this.#regex.spaces, '-')
            .replace(this.#regex.relativePaths, '')
            .replace(this.#regex.windowsSeparators, '/')
            .replace(this.#regex.htmlFileExtension, '');
        if (key[0] === '/') {
            return key.substring(1);
        }
        return key;
    }

    /**
     * Wrap any provided function in a throttle to prevent it from being called too frequently.
     *
     * @param {function} func The callback function to run after the throttled time limit.
     * @param {int} limit How long to throttle the request for in milliseconds.
     * @returns {function} A throttled version of the provided function.
     */
    #throttle(func, limit) {
        let lastFunc;
        let lastRan;

        return (...args) => {
            const context = this;
            if (!lastRan) {
                func.apply(context, args);
                lastRan = Date.now();
            } else {
                clearTimeout(lastFunc);
                lastFunc = setTimeout(() => {
                    if ((Date.now() - lastRan) >= limit) {
                        func.apply(context, args);
                        lastRan = Date.now();
                    }
                }, Math.max(limit - (Date.now() - lastRan), 0));
            }
        };
    }

}

export default Templates;
