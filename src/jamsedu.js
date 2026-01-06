import Fs from 'fs';
import JHP from '@caboodle-tech/jhp';
import NodeSimpleServer from '@caboodle-tech/node-simple-server';
import Path from 'path';
import Print from './imports/print.js';
import { exit } from 'process';
import { WhatIs } from './imports/helpers.js';

export default class JamsEdu {

    #destDir = '';

    #errorLimit = 2;

    #initialized = false;

    #JHP = null;

    #NSS = null;

    #PORT = 5000;

    #regex = {
        jhp: /\.jhp$/
    };

    #srcDir = '';

    #templateDir = '';

    #usersRoot = '';

    #verbose = false;

    constructor(config, usersRoot) {
        // Validating the config object.
        if (WhatIs(config) !== 'object') {
            Print.error('JamsEdu configuration is not a valid object!');
            return;
        }

        // Validating essential config properties.
        if (!config.destDir || WhatIs(config.destDir) !== 'string') {
            Print.error('JamsEdu configuration must have a valid "destDir" property!');
            return;
        }

        if (!config.srcDir || WhatIs(config.srcDir) !== 'string') {
            Print.error('JamsEdu configuration must have a valid "srcDir" property!');
            return;
        }

        // Keep a reference to important config values.
        this.#destDir = config.destDir;
        this.#srcDir = config.srcDir;
        this.#templateDir = Path.join(usersRoot, config.templateDir || '');
        this.#usersRoot = usersRoot;
        this.#verbose = config.verbose === true;

        // Initialize JHP and add the users processors if any.
        this.#JHP = new JHP();

        if (config.pre && WhatIs(config.pre) === 'array') {
            this.#JHP.addPreProcessor(config.pre);
        }

        if (config.post && WhatIs(config.post) === 'array') {
            this.#JHP.addPostProcessor(config.post);
        }

        // Mark as initialized.
        this.#initialized = true;
    }

    build() {
        if (!this.#requireInit()) {
            if (this.#verbose) {
                Print.warn('JamsEdu has not been initialized properly! Build aborted.');
            }
            return;
        }

        try {
            this.#clearDirectory(this.#destDir);
        } catch (err) {
            Print.error(`Failed to clean destination directory: ${this.#destDir}`);
            if (this.#verbose) {
                Print.error(err);
            }
            exit(1);
        }

        this.#processDir(this.#srcDir);
    }

    #clearDirectory(dir) {
        // Safety check: ensure directory path is valid
        if (!dir || typeof dir !== 'string') {
            throw new Error('Invalid directory path');
        }

        // If directory doesn't exist, nothing to clear
        if (!Fs.existsSync(dir)) {
            return;
        }

        const entries = Fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = Path.join(dir, entry.name);

            // CRITICAL: Skip symlinks - never follow or delete them
            if (entry.isSymbolicLink()) {
                // eslint-disable-next-line no-continue
                continue;
            }

            if (entry.isDirectory()) {
                this.#clearDirectory(fullPath);
                Fs.rmdirSync(fullPath); // Remove the now-empty directory
            } else {
                // Remove regular files
                Fs.unlinkSync(fullPath);
            }
        }
    }

    #copyFile(src, dest) {
        try {
            Fs.mkdirSync(Path.dirname(dest), { recursive: true });
            Fs.copyFileSync(src, dest);
        } catch (err) {
            Print.error(`Failed to copy file from ${src} to ${dest}`);
            if (this.#verbose) {
                Print.error(err);
            }
            this.#errorLimit -= 1;
            if (this.#errorLimit <= 0) {
                Print.error('Too many errors encountered. Processing was stopped.');
                exit(1);
            }
        }
    }

    #determineRelativePath(src) {
        const depth = Path.relative(this.#srcDir, Path.dirname(src))
            .split(Path.sep)
            .reduce((count, part) => count + (part ? 1 : 0), 0);
        return depth === 0 ? '' : '../'.repeat(depth);
    }

    pathContains(needle, haystack) {
        const n = needle.replace(/\\/g, '/').toLowerCase();
        const h = haystack.replace(/\\/g, '/').toLowerCase();
        return h.includes(n);
    }

    #processDir(src) {
        const entries = Fs.readdirSync(src, { withFileTypes: true });
        for (const entry of entries) {
            const srcPath = Path.join(src, entry.name);
            if (entry.isDirectory()) {
                this.#processDir(srcPath);
            } else if (entry.isFile()) {
                this.#processFile(srcPath);
            }
        }
    }

    #processFile(src) {
        // Skip files inside the template directory.
        if (this.pathContains(this.#templateDir, src)) {
            return;
        }

        let dest = src.replace(this.#srcDir, this.#destDir);

        if (src.endsWith('.jhp')) {
            const cwd = Path.dirname(src);
            const relPath = this.#determineRelativePath(src);
            const content = Fs.readFileSync(src, 'utf8');
            const processed = this.#JHP.process(content, { cwd, relPath });
            dest = dest.replace(this.#regex.jhp, '.html');
            this.#writeFile(dest, processed);
        } else {
            this.#copyFile(src, dest);
        }
    }

    #requireInit() {
        if (!this.#initialized) {
            if (this.#verbose) {
                Print.error('JamsEdu has not been initialized properly!');
            }
            return false;
        }
        return true;
    }

    watch() {
        if (!this.#requireInit()) {
            if (this.#verbose) {
                Print.warn('JamsEdu has not been initialized properly! Watch aborted.');
            }
            return;
        }

        // Perform an initial build.
        this.build();

        // Create an instance of Node Simple Server.
        this.#NSS = new NodeSimpleServer({
            root: this.#destDir
        });

        // Start the server.
        this.#NSS.start(this.#PORT, (result) => {
            if (!result) {
                Print.error('Possible upstream issue with Node Simple Server! Try again later.');
                exit(1);
            }
        }, false);

        // Watch the source directory for changes.
        this.#NSS.watch(this.#srcDir, {
            events: {
                all: this.#watcherCallback.bind(this)
            },
            followSymlinks: false,
            ignoreInitial: true,
            cwd: this.#srcDir
        });

        // Show some useful information to the user.
        Print.success('JamsEdu is now watching for changes and will reload automatically.');
        Print.warn('Press Ctrl+C to stop.');
        Print.info('Access your site at the following address(es):');
        const addresses = this.#NSS.getAddresses().filter((addr) =>
            addr.startsWith('http://localhost') || addr.startsWith('http://127.')
        );
        Print.info(`• ${addresses.join('\n• ')}`);
        Print.info('These addresses are meant for local network use only.');
    }

    #watcherCallback(event, path, statsOrDetails) {
        const { ext } = statsOrDetails;
        const src = Path.join(this.#srcDir, path);

        if (ext === 'css') {
            this.#processFile(src);
            this.#NSS.reloadAllStyles();
            return;
        }

        if (event === 'change' && src.startsWith(this.#templateDir)) {
            this.build();
            this.#NSS.reloadAllPages();
            return;
        }

        if (event === 'change' && ext === 'jhp') {
            this.#processFile(src);
            this.#NSS.reloadSinglePage(path.replace(this.#regex.jhp, '.html'));
            return;
        }
    }

    #writeFile(dest, content) {
        try {
            Fs.mkdirSync(Path.dirname(dest), { recursive: true });
            Fs.writeFileSync(dest, content, 'utf8');
        } catch (err) {
            Print.error(`Failed to write file to ${dest}`);
            if (this.#verbose) {
                Print.error(err);
            }
            this.#errorLimit -= 1;
            if (this.#errorLimit <= 0) {
                Print.error('Too many errors encountered. Processing was stopped.');
                exit(1);
            }
        }
    }

};
