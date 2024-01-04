import Fs from 'fs';
import Path from 'path';
import Process from 'process';
import { fileURLToPath } from 'url';
import JamsEduJsSource from '../frontend/rollup.config.js';
import JamsEduScssSource from '../frontend/scss.config.js';
import Print from './print.js';

// eslint-disable-next-line no-underscore-dangle
const __dirname = Path.dirname(fileURLToPath(import.meta.url));
const ROOT = Path.join(__dirname, '../');

class JamsEdu {

    #appDir; // The root dir of the users project; where the jamsedu.config is at.

    #outDir; // The dir to output the built project to.

    #srcDir; // The dir to build; output sent to the #outDir location.

    #version = '1.0.0-rc';

    constructor(options) {
        this.#appDir = options.root || Process.cwd();
        this.setBuildDir(options.build);
        this.setSourceDir(options.source);
    }

    async #buildJamseduSourceFiles() {
        await JamsEduJsSource.build();
        await JamsEduScssSource.build();
    }

    getBuildDir() {
        return this.#outDir;
    }

    getExt(path) {
        const start = path.indexOf('.');
        if (start === -1) {
            return '';
        }
        return path.substring(start + 1);
    }

    getSourceDir() {
        return this.#srcDir;
    }

    /**
     * Helper method that  will recursively process a directory.
     *
     * @param {string} dir The directory to recursively search.
     * @param {array} patterns An array of RegExp or RegExp like patterns to check for in the source
     *                         files path.
     * @param {*} callbacks An array of callback functions to call when a match is found. The index
     *                      of the match will be used as the index of the callback function to call;
     *                      if you provide only 1 callback it will be duplicated to match the
     *                      pattern count.
     * @param {*} noMatchCallback Callback for files not matched by any patterns.
     */
    processFilesFromDir(dir, patterns = [/.*/], callbacks = [() => {}], noMatchCallback = () => {}) {
        // Verify all patterns are valid.
        patterns.forEach((pattern, i) => {
            if (this.whatIs(pattern) !== 'regexp') {
                const checkedPattern = this.makeRegex(pattern);
                if (!checkedPattern) {
                    Print.error(`Expected RegExp object or RegExp like string but received: ${pattern}`);
                    return;
                }
                patterns[i] = checkedPattern;
            }
        });

        // Verify correct amount of callbacks.
        if (patterns.length !== callbacks.length) {
            if (callbacks.length > 1) {
                Print.error('The processFilesFromDir method expects an equal amount of patterns to callbacks.');
                return;
            }
            const callback = callbacks[0];
            patterns.forEach((_, i) => {
                callbacks[i] = callback;
            });
        }

        this.#recurseDir(dir, patterns, callbacks, noMatchCallback);
    }

    run(args) {
        console.log(args);
        this.#buildJamseduSourceFiles();
    }

    /**
     * Method that actually performs recursion on a directory and sends all files found to a user
     * defined function for processing or to be used in some other process.
     *
     * @param {string} dir The directory to recursively search.
     * @param {array} patterns An array of RegExp or RegExp like patterns to check for in the source
     *                         files path.
     * @param {*} callbacks An array of callback functions to call when a match is found. The index
     *                      of the match will be used as the index of the callback function to call;
     *                      if you provide only 1 callback it will be duplicated to match the
     *                      pattern count.
     * @param {*} noMatchCallback Callback for files not matched by any patterns.
     * @returns
     */
    #recurseDir(dir, patterns, callbacks, noMatchCallback) {
        const items = Fs.readdirSync(dir, { withFileTypes: true });
        items.forEach((item) => {
            const src = Path.join(dir, item.name);
            if (item.isDirectory()) {
                this.#recurseDir(src, patterns, callbacks, noMatchCallback);
                return;
            }
            const ext = this.getExt(item.name);
            let matchFound = false;
            for (let i = 0; i < patterns.length; i++) {
                if (patterns[i].test(src)) {
                    callbacks[i](src, ext);
                    matchFound = true;
                    break;
                }
            }
            if (matchFound) { return; }
            noMatchCallback(src, ext);
        });
    }

    /**
     * Converts a regular expression (regex) string into an actual RegExp object.
     *
     * @param {string} pattern A string of text or a regex expressed as a string; don't forget to
     *                         escape characters that should be interpreted literally.
     * @return {RegExp|null} A RegExp object if the string could be converted, null otherwise.
     */
    makeRegex(pattern) {
        try {
            if (/\[|\]|\(|\)|\{|\}|\*|\$|\^/.test(pattern)) {
                return new RegExp(pattern);
            }
            if (pattern[0] === '/' && pattern[pattern.length - 1] === '/') {
                // eslint-disable-next-line no-param-reassign
                pattern = pattern.substring(1, pattern.length - 2);
            }
            return new RegExp(pattern);
        } catch (e) {
            return null;
        }
    }

    /**
     * Set JEs build (output) directory.
     *
     * @param {string} dir The absolute path for JEs build folder; default to process.cwd()
     * @returns void
     */
    setBuildDir(dir = null) {
        if (!dir) {
            this.#outDir = Path.join(process.cwd(), 'dist');
            return;
        }
        this.#outDir = dir;
    }

    /**
     * Set the source (input) directory for the users JE site.
     *
     * @param {string} dir The absolute path for JEs build folder; default to process.cwd()
     * @returns void
     */
    setSourceDir(dir = null) {
        if (!dir) {
            this.#srcDir = Path.join(process.cwd(), 'app');
            return;
        }
        this.#srcDir = dir;
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

export default JamsEdu;
