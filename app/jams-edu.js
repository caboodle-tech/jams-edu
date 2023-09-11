import Fs from 'fs';
import Path from 'path';
import Print from './print.js';

class JamsEdu {

    #outDir;

    #srcDir;

    constructor(options = {}) {
        this.setBuildDir(options.build);
        this.setSourceDir(options.source);
    }

    /**
     * Helper method that  will recursively process a directory.
     *
     * @param {string} dir Absolute or relative to cwd path to recursively read for files.
     * @param {function} callback The function to send files to for processing.
     * @param {RegExp} pattern A RegExp object or string that the file's path must match to be
     *                         be considered from processing.
     * @returns void
     */
    processFilesFromDir(dir, callback, pattern = /.*/) {
        if (this.whatIs(pattern) !== 'regexp') {
            pattern = this.makeRegex(pattern);
            if (!pattern) {
                Print.error('The `pattern` parameter from `getFilesFromDir` must be a RegExp object or RegExp like string.');
                return;
            }
        }
        this.#recurseDir(dir, callback, pattern);
    }

    /**
     * Method that actually performs recursion on a directory and sends all files found to a user
     * defined function for processing or to be used in some process.
     *
     * @param {string} dir Absolute or relative to cwd path to recursively read for files.
     * @param {function} callback The function to send files to for processing.
     * @param {RegExp} pattern A RegExp object or string that the file's path must match to be
     *                         be considered from processing.
     */
    #recurseDir(dir, callback, pattern = /.*/) {
        const items = Fs.readdirSync(dir, { withFileTypes: true });
        items.forEach((item) => {
            const src = Path.join(dir, item.name);
            if (item.isDirectory()) {
                this.#recurseDir(src, callback, pattern);
                return;
            }
            if (!pattern.test(src)) {
                return;
            }
            let ext = Path.extname(item.name);
            if (ext && ext[0] === '.') {
                ext = ext.substring(1);
            }
            callback(src, ext);
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
                pattern = pattern.substr(1, pattern.length - 2);
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
            this.#outDir = Path.join(process.cwd(), 'build');
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
            this.#srcDir = process.cwd();
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
