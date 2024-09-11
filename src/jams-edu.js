import Compilers from './imports/compilers.js';
import Fs from 'fs';
import NodeSimpleServer from '@caboodle-tech/node-simple-server';
import Path from 'path';
import Print from './imports/print.js';
import Templates from './imports/templates.js';
import { ArgParser, Ext, ExtendedExt, WhatIs } from './imports/helpers.js';
import { ManuallyRemoveJamsEduHeaderComment } from './imports/compilers/jamsedu-comments.js';

class JamsEdu {

    #compilers = {};

    // #CONST = {
    //     compiledJsPath: 1,
    //     compiledSassPath: 0,
    //     compiledTsPath: 1,
    //     jsAndTsCompileFormat: 0
    // };

    #destDir;

    #doNotCopy = ['js', 'json', 'md', 'sass', 'scss', 'ts'];

    #root;

    #server = null;

    #srcDir;

    #regex = {
        jamseduHeaderString: /@jamsedu.*/
        // quotedPathStrings: /\s(?=(?:[^'"]|'[^']*'|"[^"]*")*$)/g,
        // relativePaths: /\.\.|\.[\\/]{1}/g,
        // windowsPath: /\\/g
    };

    #templates;

    #layoutDir;

    #verbose = false;

    /**
     * Get a new instance of JamsEdu. This will fatally error out if key settings are not passed in
     * to the `config` parameter.
     *
     * @param {object} config A properly formatted JamsEdu configuration object; see the documentation
     *                        for the `jamsedu.config.js` file for more information.
     * @param {string} root The absolute path to the root directory of the users project.
     */
    constructor(config, root) {
        if (!root) {
            throw new Error('Could not locate the root directory of your project!');
        }
        this.#root = root;

        if (!config.destDir || WhatIs(config.destDir) !== 'string') {
            throw new Error('JamsEdu config object is missing the `dest` directory!');
        }
        this.#destDir = config.destDir;

        if (!config.srcDir || WhatIs(config.srcDir) !== 'string') {
            throw new Error('JamsEdu config object is missing the `src` directory!');
        }
        this.#srcDir = config.srcDir;

        let hooks = {};
        if (!config.hooks || WhatIs(config.hooks) !== 'object') {
            ({ hooks } = config);
        }

        if (!config.layoutDir || WhatIs(config.layoutDir) !== 'string') {
            throw new Error('JamsEdu config object is missing the `dest` directory!');
        }
        this.#layoutDir = config.layoutDir;

        if (config.doNotCopy && WhatIs(config.doNotCopy) === 'array') {
            this.#doNotCopy = config.doNotCopy.map((ext) => {
                // Remove any leading periods from the file extensions.
                if (ext.startsWith('.')) {
                    return ext.toLowerCase().substring(1);
                }
                return ext.toLowerCase();
            });
        }

        if (config.verbose && WhatIs(config.verbose) === 'boolean') {
            this.#verbose = config.verbose;
        }

        this.#setupCompilers(config.compilers);
        this.#templates = new Templates(this.#layoutDir, hooks, this.#verbose);
    }

    /**
     * Builds the `config.srcDir` (this.#srcDir) and outputs the result to `config.destDir` (this.#destDir).
     *
     * Keep in mind the build process relies heavily on a valid `config.layoutDir` (this.#layoutDir) that
     * includes valid template files.
     */
    async build() {
        const startTime = new Date().getTime();
        const files = this.#readDirectory(this.#srcDir);
        for (let i = 0; i < files.length; i++) {
            await this.#processFile(files[i]);
        }
        const endTime = new Date().getTime();
        const duration = endTime - startTime;
        Print.info(`Build process took ${duration} milliseconds.`);

        if (this.#server) {
            Print.out(''); // Add a little space between the build and server output.
            this.#server.printListeningAddresses();
        }
    }

    /**
     * Copies a file from one location to another creating any missing directory structure as needed.
     *
     * @param {string} file The absolute path to the source file.
     * @param {string} dest The absolute path to the destination file.
     */
    #copyFileToDest(file, dest) {
        // Ensure the destination directory exists.
        const destDir = Fs.lstatSync(file).isDirectory() ? dest : Path.dirname(dest);
        if (!Fs.existsSync(destDir)) {
            Fs.mkdirSync(destDir, { recursive: true });
            if (this.#verbose) {
                Print.info(`Created directory: ${destDir}`);
            }
        }

        // If source is a directory short circuit the function; we're done.
        if (Fs.lstatSync(file).isDirectory()) {
            if (this.#verbose) {
                Print.info(`Created: ${file} --> ${dest}`);
            }
            return;
        }

        // If source is a file, proceed with file copying.
        Fs.copyFileSync(file, dest);
        if (this.#verbose) {
            Print.info(`Copied: ${file} --> ${dest}`);
        }
    }

    /**
     * Compile a file by calling the appropriate compiler for the files language.
     *
     * @param {string} file The absolute path to the file to compile.
     * @returns {boolean} True if the file was successfully compiled or otherwise handled; false will
     *                    keep this file in the processing chain a little longer.
     */
    async #compileFile(ext, file, options) {
        if (!('dest' in options)) {
            Print.error(`Error: No destination path specified for ${file}`);
            // This file should have been compiled so pretend it was.
            return true;
        }

        const dest = this.getDestPath(options.dest);

        if (ext in this.#compilers) {
            await this.#compilers[ext](file, dest, options);

            if (this.#verbose) {
                Print.info(`Built: ${file} --> ${dest}`);
            }
        } else {
            Print.warn(`Build Skipped: No compiler for \`.${ext}\` files.`);
        }

        // Either the file was compiled or it should have been, so pretend it was to stop further processing.
        return true;
    }

    /**
     * Get a source files destination (output) location based on the options set in `config` object.
     *
     * @param {string} file The absolute path of the file in the `config.srcDir` (this.#srcDir).
     * @returns {string} What this files absolute path in the `config.destDir` (this.#destDir) should be.
     */
    getDestPath(file) {
        return Path.join(this.#destDir, file.replace(this.#srcDir, ''));
    }

    /**
     * Runs the guided initialization process for a new JamsEdu project to be created at the users
     * current file location.
     */
    static initialize() {
        Print.info('Starting initialization sequence!');
    }

    /**
     * Process a source file and output it to the build destination if the file is not in the list of
     * file types to block.
     *
     * @param {string} file The absolute path to the source file to process.
     * @returns Used only as a short circuit.
     */
    async #processFile(file) {
        const dest = this.getDestPath(file);
        const ext = Ext(file);
        const extendedExt = ExtendedExt(file);
        const header = this.#readFileHeader(file);

        let options = {};
        const matchedLine = header.match(this.#regex.jamseduHeaderString);
        if (matchedLine && matchedLine[0].length > 9) {
            // Pull the compiler options out of the file header.
            options = ArgParser.parse(header.replace('@jamsedu', ''));
        }

        /**
         * If this file is flagged to be kept (probably needed by another file being compiled) but
         * not compiled, handle that now and short circuit.
         */
        if (options.keep) {
            const copyToDest = options.dest || dest;

            try {
                let content = Fs.readFileSync(file, 'utf8');
                content = ManuallyRemoveJamsEduHeaderComment(content);
                this.#writeContentToDest(content, copyToDest);
            } catch (error) {
                Print.error(`Error keeping file: ${file}`);
                if (this.#verbose) {
                    Print.error(error);
                }
            }
            return;
        }

        // Attempt to compile this file if its extension is in the list of file types to compile.
        if ((ext in this.#compilers) && matchedLine && matchedLine[0].length > 9) {
            if (await this.#compileFile(ext, file, options)) {
                return;
            }
            /**
             * If we did not short circuit it means the file was not able to be compiled. This could
             * be expected, a script that needs to be set to the destination build as is, or it could
             * an accident where the user forgot to include the compile header comment in the file.
             */
        }

        if (this.#doNotCopy.includes(extendedExt)) {
            // Do not allow this file to be copied to the destination build.
            return;
        }

        // If this is an HTML file, process it with the templates.
        if (ext === 'html') {
            this.#writeContentToDest(this.#templates.process(file), dest);
            return;
        }

        // Copy file to destination.
        this.#copyFileToDest(file, dest);
    }

    /**
     * Recursively locate all files in a requested directory.
     *
     * @param {string} directory A directory to recursively locate all files from.
     * @returns {array} All files from the specified directory and its subdirectories.
     */
    #readDirectory(directory) {
        const files = [];
        if (directory.startsWith(this.#layoutDir)) {
            return files;
        }
        const entries = Fs.readdirSync(directory, { withFileTypes: true });
        entries.forEach((entry) => {
            const fullPath = Path.join(directory, entry.name);
            if (entry.isDirectory()) {
                const subFiles = this.#readDirectory(fullPath);
                files.push(...subFiles);
            } else {
                files.push(fullPath);
            }
        });
        return files;
    }

    /**
     * Finds and reads in the commands from JamsEdu file headers.
     *
     * Every file that the user wishes to compile should include a JamsEdu file header with basic
     * settings for the language specific compiler to use.
     *
     * @param {string} file The absolute path to the source file to pull the header from.
     * @param {int} numLines How many lines to grab from the start of the file in search of the file header.
     * @returns {array} An array of settings to use in compiling this file if any were found.
     */
    #readFileHeader(file, numLines = 5) {
        // TODO: I need to add else where the ability to remove these comments from the outputted file.
        const bufferSize = 1024;
        const buffer = Buffer.alloc(bufferSize);
        const fd = Fs.openSync(file, 'r');
        let bytesRead = 0;
        let lines = '';
        let lineCount = 0;

        try {
            while (lineCount < numLines && (bytesRead = Fs.readSync(fd, buffer, 0, bufferSize, null)) !== 0) {
                lines += buffer.toString('utf8', 0, bytesRead);
                lineCount = (lines.match(/\n/g) || []).length;
            }
        } finally {
            Fs.closeSync(fd);
        }

        return lines.split('\n').slice(0, numLines).join('\n');
    }

    #setupCompilers(compilers = {}) {
        Compilers.setVerboseMode(this.#verbose);
        this.#compilers = Compilers.defaultCompilers();

        Object.keys(compilers).forEach((key) => {
            if (this.#compilers[key] && WhatIs(compilers[key]).includes('function')) {
                this.#compilers[key] = Compilers.wrapUserCompiler(compilers[key]);
            }
        });
    }

    /**
     * Start a NodeSimpleServer (NSS) that watches the frontend and backend for changes during development.
     * Any changes can trigger automatic rebuilds of the project and automatically refreshes and project pages
     * currently open in the users web browser.
     */
    watch() {
        this.build();

        // Build a bare minimum server options object.
        const serverOptions = {
            dirListing: true,
            root: this.#destDir // The root directory of the web server.
        };

        // Get a new instance of NSS.
        const Server = new NodeSimpleServer(serverOptions);

        // Handles reloading the site (frontend) when changes are built.
        const frontendChanges = (event, path, stats) => {
            if (stats.ext === 'css') {
                Server.reloadAllStyles();
                return;
            }

            if (stats.ext === 'js' || event === 'unlink' || event === 'unlinkDir') {
                Server.reloadAllPages();
                return;
            }

            if (event === 'change') {
                Server.reloadSinglePage(path);
                return;
            }
        };

        const layoutDirFragment = Path.normalize(this.#layoutDir.replace(this.#root, '').substring(1));
        const modifiedSrcDir = this.#srcDir.split(Path.sep).slice(0, -1).join(Path.sep);

        // Handles watching the source files for changes and rebuilding as needed.
        const backendChanges = (event, path, stats) => {
            let sourceAbsPath = Path.join(modifiedSrcDir, path);
            if (path.startsWith('..')) {
                sourceAbsPath = Path.resolve(this.#srcDir, path);
            }

            if (event === 'addDir') {
                // The directory will be added once any files are added to it.
                return;
            }

            // Template files need to be handled differently, we have to rebuild the templates first!
            if (sourceAbsPath.includes(layoutDirFragment)) {
                /**
                 * Template rebuilding is throttled for performance reasons. We will wait twice the
                 * time to allow the templates to be rebuilt before we start the build process.
                 */
                this.#templates.reloadTemplates();
                setTimeout(() => {
                    this.build();
                }, Math.ceil(this.#templates.getThrottleLimit() * 2));
                return;
            }

            // We can skip checking for `add` events since the file will be processed on the next change.
            if (event === 'change') {
                this.#processFile(sourceAbsPath);
            }
        };

        // Watcher options for the frontend (compiled files).
        const watchFrontend = {
            events: {
                all: frontendChanges
            },
            ignoreInitial: true,
            interval: 500
        };

        // Watcher options for the backend (source files).
        const watchBackend = {
            events: {
                all: backendChanges
            },
            ignoreInitial: true,
            interval: 250
        };

        // Start the server.
        Server.start(null, null, false);

        // Watch the directories for changes.
        Server.watch(this.#srcDir, watchBackend);
        Server.watch(this.#destDir, watchFrontend);

        // Hang on to the server instance for later use.
        this.#server = Server;
    }

    /**
     * Writes the requested content to the specified file and creates any missing directories as needed.
     *
     * @param {string} content Content (data) to write to a file.
     * @param {string} dest The absolute path of the file to write this content to.
     */
    #writeContentToDest(content, dest) {
        const destPath = Path.dirname(dest);
        if (!Fs.existsSync(destPath)) {
            Fs.mkdirSync(destPath, { recursive: true });
        }
        Fs.writeFileSync(dest, content);

        if (this.#verbose) {
            Print.info(`Compiled: ${dest}`);
        }
    }

}

export default JamsEdu;
