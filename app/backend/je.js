import Fs from 'fs';
import Path from 'path';
import Process from 'process';
import NodeSimpleServer from '@caboodle-tech/node-simple-server';
import Builder from './builder.js';
import Print from './print.js';
import Watcher from './watcher.js';

class JamsEdu {

    #builder;

    #dirs = {
        css: '',
        cwd: Process.cwd(),
        jamsedu: '',
        js: '',
        output: '',
        source: '',
        templates: ''
    };

    #processFileTypes = ['html'];

    #processJs = [];

    #processScss = [];

    #version = '1.0.0-rc';

    constructor(settings) {
        // We must have a valid source directory.
        if (!settings.sourceDir || !Fs.existsSync(settings.sourceDir)) {
            Print.error(`Source directory does not exist:\n${settings.sourceDir}`);
            Process.exit();
        }

        // We must know where the JamsEdu application is installed.
        if (!settings.jamseduDir || !Fs.existsSync(settings.jamseduDir)) {
            Print.error(`Missing valid JamsEdu application root directory:\n${settings.jamseduDir}`);
            Process.exit();
        }

        // Loosely verify that we have the proper location of JamsEdu with a quick check.
        if (!Fs.existsSync(Path.join(settings.jamseduDir, 'backend'))
            || !Fs.existsSync(Path.join(settings.jamseduDir, 'frontend'))
        ) {
            Print.error(`Invalid JamsEdu application root directory:\n${settings.jamseduDir}`);
            Process.exit();
        }

        // Record file type(s) to process if any.
        if (settings.processFileTypes && this.whatIs(settings.processFileTypes) === 'array') {
            // Remove any leading dots, we need the extension name only.
            settings.processFileTypes.forEach((ext, index) => {
                if (ext[0] === '.') {
                    settings.processFileTypes[index] = ext.substring(1);
                }
            });
            this.#processFileTypes = settings.processFileTypes;
        }

        // Record JS files that should be bundled if any.
        if (settings.processJs && this.whatIs(settings.processJs) === 'array') {
            // Remove any leading dots, we need the extension name only.
            settings.processJs.forEach((ext, index) => {
                if (ext[0] === '.') {
                    settings.processJs[index] = ext.substring(1);
                }
            });
            this.#processJs = settings.processJs;
        }

        // Record SCSS files that should be built and bundled if any.
        if (settings.processScss && this.whatIs(settings.processScss) === 'array') {
            // Remove any leading dots, we need the extension name only.
            settings.processScss.forEach((ext, index) => {
                if (ext[0] === '.') {
                    settings.processScss[index] = ext.substring(1);
                }
            });
            this.#processScss = settings.processScss;
        }

        // Set core settings first.
        this.#dirs.jamsedu = settings.jamseduDir;
        this.setSourceDir(settings.sourceDir);

        // Set additional settings that will default to using parts of the previous settings if missing.
        this.setOutputDir(settings.outputDir);
        this.setCssDir(settings.outputCss);
        this.setJsDir(settings.outputJs);
        this.setTemplatesDir(settings.templateDir);

        // Insatiate the builder last; this.#dirs must be populated by the previous steps first.
        this.#builder = new Builder(
            this.#dirs,
            {
                processFileTypes: this.#processFileTypes,
                processJs: this.#processJs,
                processScss: this.#processScss
            }
        );
    }

    /**
     * Helper function to locate the nearest JamsEdu config file.
     *
     * @param {string} startDir The directory to start searching from.
     * @returns The absolute path to the JamsEdu config file or null.
     */
    static findConfigFile(startDir) {
        let currentDir = startDir;
        // Search for the config file.
        while (currentDir !== null && currentDir !== Path.parse(currentDir).root) {
            const configFile = Path.join(currentDir, 'jamsedu.config');
            if (Fs.existsSync(configFile)) {
                return configFile;
            }
            // Climb to parent dir.
            currentDir = Path.dirname(currentDir);
        }
        // Config file not found.
        return null;
    }

    /**
     * Get the configured CSS directory.
     *
     * @returns The absolute path to the users configured CSS directory.
     */
    getCssDir() {
        return this.#dirs.css;
    }

    /**
     * Get the configured output (build) directory.
     *
     * @returns The absolute path to the users configured output (build) directory.
     */
    getOutputDir() {
        return this.#dirs.output;
    }

    /**
     * Get the configured JamsEdu source directory.
     *
     * @returns The absolute path to the JamsEdu's source directory.
     */
    getJamseduSourceDir() {
        return this.#dirs.jamsedu;
    }

    /**
     * Get the configured JS directory.
     *
     * @returns The absolute path to the users configured JS directory.
     */
    getJsDir() {
        return this.#dirs.js;
    }

    /**
     * Get the configured CSS directory.
     *
     * @returns The absolute path to the users configured css directory.
     */
    getSourceDir() {
        return this.#dirs.source;
    }

    /**
     * Get the configured templates directory.
     *
     * @returns The absolute path to the users configured templates directory.
     */
    getTemplatesDir() {
        return this.#dirs.templates;
    }

    #initializeProject() {
        const config = {
            outputCss: './dist/css',
            outputDir: './dist',
            outputJs: './dist/js',
            process: ['html'],
            sourceDir: './src',
            templateDir: './src/templates'
        };

        const indexFile = Path.join(this.#dirs.cwd, config.sourceDir, 'index.html');
        const configFile = Path.join(this.#dirs.cwd, 'jamsedu.config');
        if (Fs.existsSync(configFile)) {
            Print.notice('JamsEdu config file already exists, skipped creating a new one.');
        } else {
            this.#builder.outputFile(configFile, JSON.stringify(config, null, 2));
        }

        delete config.process;
        delete config.outputDir;
        delete config.sourceDir;
        config.sourceCss = './src/scss';
        config.sourceJs = './src/js';

        Object.keys(config).forEach((key) => {
            const dir = config[key];
            if (!Fs.existsSync(dir)) {
                Fs.mkdirSync(dir, { recursive: true });
            }
        });

        if (!Fs.existsSync(indexFile)) {
            this.#builder.outputFile(indexFile, '');
        }

        this.#builder.build();
    }

    /**
     * Run the JamsEdu command the user requested.
     *
     * @param {array} args The process arguments that JamsEdu was called with.
     */
    async run(args) {
        // Show help page: jamsedu -h || jamsedu --help || jamsedu help
        if (args.h || args.help) {
            Print.warn('A help page is coming later!');
            return;
        }

        // Show the version number: jamsedu -v || jamsedu --version || jamsedu version
        if (args.v || args.version) {
            Print.notice(`JamsEdu v${this.#version}`);
            return;
        }

        // Initialize a new JamsEdu project.
        if (args.init || args.initialize) {
            this.#initializeProject();
            return;
        }

        // Build the users site: jamsedu build || jamsedu --build
        if (args.build && !args.edu) {
            this.#builder.build();
            return;
        }

        // Watch and build the users site: jamsedu watch || jamsedu --watch
        if (args.watch && !args.edu) {
            this.#watchAndBuild();
            return;
        }

        // Build JamsEdu and the users/demo site: jamsedu build --edu || jamsedu --build --edu
        if (args['build:edu'] || (args.build && args.edu)) {
            await this.#builder.buildJamsEduJs();
            await this.#builder.buildJamsEduScss();
            this.#builder.build();
            return;
        }

        // Watch JamsEdu and build the users/demo site: jamsedu watch --edu || jamsedu --watch --edu
        if (args['watch:edu'] || (args.watch && args.edu)) {
            this.#watchAndBuild(true);
            return;
        }

        // Warn the user no valid command was detected.
        Print.warn('Please enter a valid command or run `jamsedu --help` for instructions on using JamsEdu.');
    }

    /**
     * Set JamsEdu's css output directory.
     *
     * @param {string} dir The absolute path to the output css folder; defaults to this.getSourceDir()/css
     */
    setCssDir(dir = null) {
        if (!dir) {
            dir = Path.join(this.getSourceDir(), 'css');
        }
        this.#dirs.css = Path.join(dir, '');
    }

    /**
     * Set JamsEdu's output (build) directory.
     *
     * @param {string} dir The absolute path for JamsEdu's build folder; defaults to this.getSourceDir()/dist
     */
    setOutputDir(dir) {
        if (!dir) {
            dir = Path.join(this.getSourceDir(), 'dist');
        }
        this.#dirs.output = Path.join(dir, '');
    }

    /**
     * Set JamsEdu's js output directory.
     *
     * @param {string} dir The absolute path to the output js folder; defaults to this.getSourceDir()/js
     */
    setJsDir(dir) {
        if (!dir) {
            dir = Path.join(this.getSourceDir(), 'js');
        }
        this.#dirs.js = Path.join(dir, '');
    }

    /**
     * Set the source (input) directory for the users JamsEdu site.
     *
     * @param {string} dir The absolute path for JamsEdu's build folder; defaults to process.cwd()/www
     * @returns Boolean indicating if the new source directory was accepted.
     */
    setSourceDir(dir) {
        if (!dir || !Fs.existsSync(dir)) {
            Print.warn(`Refused to set source directory to nonexistent directory:\n${dir}`);
            return false;
        }
        this.#dirs.source = Path.join(dir, '');
        return true;
    }

    /**
     * Set the templates directory for the users JE site.
     *
     * @param {string} dir The absolute path for JamsEdu's template folder; defaults to this.getSourceDir()/templates

     */
    setTemplatesDir(dir) {
        if (!dir) {
            dir = Path.join(this.getSourceDir(), 'templates');
        }
        this.#dirs.templates = Path.join(dir, '');
    }

    /**
     * Start the Node Simple Server (NSS) for local development and auto reload the site when files change.
     *
     * @param {boolean} jamseduSourceAsWell Should JamsEdu source files be watched for changes too; default false.
     */
    #watchAndBuild(jamseduSourceAsWell = false) {
        // Setup NSS options.
        const serverOptions = {
            root: this.#dirs.output
        };

        // Get a new instance of NSS.
        const server = new NodeSimpleServer(serverOptions);

        // Start the server.
        server.start();

        // Configure what files in the project are watched for changes.
        const whatToWatch = [this.#dirs.source];
        if (jamseduSourceAsWell) {
            whatToWatch.push(Path.join(this.#dirs.jamsedu, 'frontend'));
        }

        // Get an instance of Watcher which actually handles responding to project changes.
        const watcher = new Watcher(this.#dirs, this.#builder);

        // Perform an initial build so the local development site works.
        Print.notice('Performing initial build.');
        Print.disable();
        this.#builder.build();
        Print.enable();

        // Start watching for project changes.
        Print.notice('Starting development server:\n');
        server.watch(whatToWatch, watcher.getWatcherOptions());
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
