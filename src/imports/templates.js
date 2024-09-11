import Fs from 'fs';
import Hooks from './hooks/hooks.js';
import HtmlSom from './html-som.js';
import Path from 'path';
import Print from './print.js';
import { Ext, WhatIs } from './helpers.js';
import { ManuallyRemoveAllComments } from './compilers/jamsedu-comments.js';

class Templates {

    /**
     * Map to store the hook functions used during template processing.
     * @type {Map}
     * @private
     */
    #hooks = new Map();

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
        trimNewlines: /^\n+|\n+$/g,
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
    #layoutDir;

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
     * The time limit in milliseconds for the throttled function to prevent it from being called too frequently.
     * @type {int}
     * @private
     */
    #throttleLimit = 500;

    /**
     * Hang onto the original user provided hooks.
     *
     * NOTE: Currently unused because live reloading of hooks is not supported. This will be a massive
     * undertaking if it is ever introduced because we have to reload the config file.
     *
     * @type {object}
     * @private
     */
    #userHooks = {};

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
     * @param {string} layoutDir The absolute path to the directory where the template files are in the users project.
     * @param {boolean} verbose Should additional debugging output be printed to the console, default value is false.
     */
    constructor(layoutDir, userHooks = {}, verbose = false) {
        this.#layoutDir = layoutDir;
        this.#userHooks = userHooks;
        this.#verbose = verbose;
        this.#loadHooks();
        this.#loadTemplates();
    }

    #getAllZones(node) {
        let children = [];
        node.children.forEach((child) => {
            if (child.node.name === 'zone') {
                children.push(child);
            }
            if (child.children.size > 0) {
                children = [...children, ...this.#getAllZones(child)];
            }
        });
        return children;
    }

    /**
     * Get the time limit used to throttle the reloadTemplates function.
     *
     * @returns {int} The time limit used to throttle the reloadTemplates function.
     */
    getThrottleLimit() { return this.#throttleLimit; }

    /**
     * Register a new hook function to be used during the template processing.
     *
     * @param {object} hooks An object containing the hook functions to register.
     */
    #loadHooks(hooks = Hooks) {
        // Load default JamsEdu hooks first.
        Object.keys(hooks).forEach((key) => {
            this.#hooks.set(key, Hooks[key]);
        });

        // Load user provided hooks; allows overwriting of default hooks.
        Object.keys(this.#userHooks).forEach((key) => {
            const hook = this.#userHooks[key];
            if (WhatIs(hook) === 'function') {
                this.#hooks.set(key, hook);
            }
        });
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

                            // Remove any template specific comments from being rendered into the output.
                            const tmpSom = new HtmlSom(html);
                            let cleanedHtml = '';
                            tmpSom.getStructure().som.forEach((node) => {
                                cleanedHtml += tmpSom.getNodeHtml(node);
                            });
                            const som = new HtmlSom(cleanedHtml);

                            this.#templates.set(key, { html, som });
                            if (this.#verbose) {
                                Print.info(`Loaded template: ${key}`);
                            }
                        } else if (ext === 'json') {
                            const content = Fs.readFileSync(filePath, { encoding: 'utf8' }).toString();
                            const json = JSON.parse(ManuallyRemoveAllComments(content));
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
         * Nested function to recursively preprocess the loaded template files:
         *
         * - Overwrite variables loaded by JSON but changed via a var.
         * - Replace template parts in templates; templates can rely on other templates.
         * - Remove named vars from the template HTML.
         */
        const preprocessTemplates = () => {
            this.#templates.forEach((obj) => {
                let { html } = obj;
                const { som } = obj;

                // We could have many variables (named vars) so build a single large regex instead.
                // let patterns = '';
                som.findAll('var[name]').forEach((node) => {
                    const key = node.value.attrsMap.get('name');
                    const outerHtml = som.getNodeHtml(node);
                    const innerHtml = som.getNodeInnerHtml(node);
                    this.#variables.set(key, innerHtml.replace(this.#regex.trimNewlines, ''));

                    html = html.replace(outerHtml, '');
                    // Record this variable (var) for removal from the HTML.
                    // patterns += `\\n?${outerHtml.replace(this.#regex.pipes, '&#124;')}\\n?|`;
                });
                // Remove all named var tags from the HTML and replace any pipe symbols we had to encode.
                // html = html.replace(new RegExp(patterns.slice(0, -1), 'g'), '');
                // html = html.replace(this.#regex.pipeEntity, '|');

                som.findAll('template').forEach((node) => {
                    // TODO: Skip templates that should be left in the final output?
                    const key = som.getNodeInnerHtml(node);
                    const nodeHtml = som.getNodeHtml(node);
                    let replacement = '';
                    if (this.#templates.has(key)) {
                        replacement = this.#templates.get(key).som.getHtml().trim();
                    }
                    html = html.replace(nodeHtml, replacement);
                });

                /**
                 * Record the original HTML string so later when we need to build source files we can
                 * immediately replace sections of the HTML without having to get the HTML back from
                 * the SOM which would be an expensive process.
                 */
                obj.html = html;
                obj.som = new HtmlSom(html);
            });
        };

        loadAllTemplates(this.#layoutDir);
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
        let html = Fs.readFileSync(file, { encoding: 'utf8' }).toString();
        let som = new HtmlSom(html);

        // Files can be empty.
        if (!html) {
            return '';
        }

        // Replace template tags first.
        som.findAll('template').forEach((node) => {
            if (node.key.includes('use=')) {
                const nodeHtml = som.getNodeHtml(node);
                const rep = this.#processTemplateWithZones(som, node);
                html = html.replace(nodeHtml, rep);
                return;
            }

            const key = som.getNodeInnerHtml(node).trim();
            const nodeHtml = som.getNodeHtml(node);
            const templateObj = this.#templates.get(key);

            if (!templateObj) {
                html = html.replace(nodeHtml, '');
                if (this.#verbose) {
                    Print.warn('Template Unprocessed: An invalid template tag was encountered and left unprocessed.');
                }
                return;
            }

            html = html.replace(nodeHtml, templateObj.som.getHtml());
        });

        // Catch corrupted or empty files after initial template processing.
        let tmpSom = '';
        try {
            tmpSom = new HtmlSom(html);
        } catch (err) {
            if (this.#verbose) {
                Print.error(`Error processing template: ${file}\n${err}`);
            }
            return '';
        }

        // Remove any template specific comments from being rendered into the output.
        let cleanedHtml = '';
        tmpSom.getStructure().som.forEach((node) => {
            cleanedHtml += tmpSom.getNodeHtml(node);
        });
        html = cleanedHtml;

        // Create a new SOM based on the new HTML and now look for any variables (named vars).
        som = new HtmlSom(html);

        // We could have many variables (named vars) so build a single large regex instead.
        // let patterns = '';
        som.findAll('var[name]').forEach((node) => {
            const key = node.value.attrsMap.get('name');
            const outerHtml = som.getNodeHtml(node);
            const innerHtml = som.getNodeInnerHtml(node);
            // Add this variable (var) to the temporary list.
            this.#temporaryVariables.set(key, innerHtml.replace(this.#regex.trimNewlines, ''));

            html = html.replace(outerHtml, '');
            // Record this variable (var) for removal from the HTML.
            // patterns += `\\n?${outerHtml.replace(this.#regex.pipes, '&#124;')}\\n?|`;
        });
        // Remove all named var tags from the HTML and replace any pipe symbols we had to encode.
        // html = html.replace(new RegExp(patterns.slice(0, -1), 'g'), '');
        // html = html.replace(this.#regex.pipeEntity, '|');

        // console.log('Built-in Variables:', this.#variables);
        // console.log('User Variables:', this.#temporaryVariables);

        // Now find and replace all variables (vars) in the HTML.
        som.findAll('var:not([name])').forEach((node) => {
            // TODO: Skip var tags that should be left in the final output?
            let merge = false;
            if (node.key.includes('merge')) {
                merge = true;
            }

            let ours = true;
            if (node.key.includes('theirs')) {
                ours = false;
            }

            // Get the variable (var) name and value (outerHtml)
            const key = som.getNodeInnerHtml(node);
            const outerHtml = som.getNodeHtml(node);

            const templateVarExists = this.#variables.has(key);
            const templateVarValue = this.#variables.get(key) || '';
            const userVarExists = this.#temporaryVariables.has(key);
            const userVarValue = this.#temporaryVariables.get(key) || '';

            let replacement = '';

            if (merge && ours) {
                // Merge variable placing template variable first.
                if (userVarExists) {
                    replacement += `${userVarValue}\n`;
                }
                if (templateVarExists) {
                    replacement += `${templateVarValue}\n`;
                }
            } else if (merge) {
                // Merge variable placing user variable first.
                if (templateVarExists) {
                    replacement += `${templateVarValue}\n`;
                }
                if (userVarExists) {
                    replacement += `${userVarValue}\n`;
                }
            } else if (userVarExists) {
                // Apply users variable.
                replacement = userVarValue;
            } else if (templateVarExists) {
                // Apply template variable.
                replacement = templateVarValue;
            }

            html = html.replace(outerHtml, replacement.trim());
        });

        // Clear the temporary variables.
        this.#temporaryVariables.clear();

        // Replace any hooks in the HTML.
        this.#hooks.forEach((hook) => {
            const modifiedHtml = hook(html, som);
            // A basic check to ensure the hook returned a string.
            // NOTE: We could check in the future that the string len is within a certain range.
            if (modifiedHtml && WhatIs(modifiedHtml) === 'string') {
                html = modifiedHtml;
            }
        });

        return html.trim();
    }

    #processTemplateWithZones(nodeSom, node) {
        if (!node.value.attrsMap.has('use')) {
            return '<!-- Invalid template with zones. -->';
        }

        const key = this.templatePathKey(node.value.attrsMap.get('use'));

        if (!this.#templates.has(key)) {
            return '<!-- Missing template. -->';
        }

        const zones = this.#getAllZones(node.value);
        const zoneValues = {};
        zones.forEach((zone) => {
            if (!zone.attrsMap.has('name')) {
                return;
            }

            const name = zone.attrsMap.get('name');
            zoneValues[name] = nodeSom.getNodeInnerHtml(zone).trim();
        });

        // console.log(zoneValues);

        const templateObj = this.#templates.get(key);
        let templateHtml = templateObj.html;
        const zoneAreas = templateObj.som.findAll('zone');
        zoneAreas.forEach((zoneArea) => {
            const zoneHtml = templateObj.som.getNodeHtml(zoneArea);
            const key = templateObj.som.getNodeInnerHtml(zoneArea).trim();
            if (!(key in zoneValues)) {
                templateHtml = templateHtml.replace(zoneHtml, '<!-- Zone not found. -->');
                return;
            }
            templateHtml = templateHtml.replace(zoneHtml, zoneValues[key]);
        });
        return templateHtml;
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
            }, this.#throttleLimit);
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
        const key = filePath.replace(this.#layoutDir, '')
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
