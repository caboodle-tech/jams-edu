/* eslint-disable no-unused-vars */
import Fs from 'fs';
import Path from 'path';
import Print from './print.js';

class Watcher {

    #builder;

    #dirs;

    constructor(dirs, builder) {
        this.#dirs = dirs;
        this.#builder = builder;
    }

    add(path, stats) {
        this.change(path, stats);
    }

    change(path, stats) {
        const { source, destination } = this.getAbsoluteSourceAndDestination(path);
        // If this is a JamsEdu source file we need to handle it differently
        if (this.#handleIfJamsEduSource(source)) {
            return;
        }
        // If this file does not need to be compiled copy it to output.
        if (this.#builder.copyFileOnly(source, destination, stats.ext)) {
            Print.success(`Copied: ${destination.replace(this.#dirs.output, '.')}`);
            return;
        }
        // If this file is in the template folder we must do a full rebuild.
        if (this.#handleIfTemplateFile(source)) {
            return;
        }
        // Only a single file needs building.
        this.#builder.buildFile(source);
    }

    #deleteDirRecursive(dirPath) {
        if (Fs.existsSync(dirPath)) {
            // Get all files and subdirectories in the directory.
            const files = Fs.readdirSync(dirPath);

            // Iterate through each file/subdirectory and remove them.
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const currentPath = Path.join(dirPath, file);

                // Check if it's a file or directory:
                if (Fs.lstatSync(currentPath).isDirectory()) {
                    // Recursively delete subdirectories
                    this.#deleteDirRecursive(currentPath);
                } else {
                    // Delete files
                    Fs.unlinkSync(currentPath);
                    Print.notice(`Deleted File: ${currentPath.replace(this.#dirs.output, '.')}`);
                }
            }

            // Remove the empty directory itself.
            Fs.rmdirSync(dirPath);
            Print.notice(`Deleted Directory: ${dirPath.replace(this.#dirs.output, '.')}`);
        }
    }

    error(err) {
        Print.error(err);
    }

    getAbsoluteSourceAndDestination(path) {
        const source = Path.normalize(Path.join(this.#dirs.source, path));
        let destination = source;
        if (destination.includes(this.#dirs.jamsedu)) {
            destination = Path.normalize(Path.join(this.#dirs.output, destination.replace(this.#dirs.jamsedu, '')));
        } else {
            destination = Path.normalize(Path.join(this.#dirs.output, destination.replace(this.#dirs.source, '')));
        }
        return { source, destination };
    }

    getExt(path) {
        const start = path.indexOf('.');
        if (start === -1) {
            return '';
        }
        return path.substring(start + 1);
    }

    getWatcherOptions() {
        const buildDir = Path.basename(Path.dirname(this.#dirs.output));

        /**
         * Ignore specific items:
         * > JamsEdu build directory
         * > Any bundle (rollup) directory inside the js directory
         * > Any build directories put in source directories
         * > Any rollup directories
         * > Any SCSS directories
         */
        const ignored = [
            `${this.#dirs.jamsedu.replace(/\\/g, '/')}/frontend/**dist**/`,
            `${this.#dirs.source.replace(/\\/g, '/')}/**js**/**bundle**/`,
            `${this.#dirs.source.replace(/\\/g, '/')}/**${buildDir}**/`,
            `${this.#dirs.source.replace(/\\/g, '/')}/**rollup**/`,
            `${this.#dirs.source.replace(/\\/g, '/')}/**scss**/`
        ];

        return {
            ignored,
            ignoreInitial: true,
            events: {
                add: this.add.bind(this),
                change: this.change.bind(this),
                error: this.error.bind(this),
                unlink: this.unlink.bind(this),
                unlinkDir: this.unlinkDir.bind(this)
            }
        };
    }

    #handleIfJamsEduSource(source) {
        if (!source.includes(this.#dirs.jamsedu)) {
            return false;
        }
        const ext = this.getExt(source);
        if (ext === 'js' || ext === 'config.js') {
            // JamsEduJsSource.build();
            this.#builder.buildJamsEduJs();
        }
        if (ext === 'scss') {
            // JamsEduScssSource.build();
            this.#builder.buildJamsEduScss();
        }
        return true;
    }

    #handleIfTemplateFile(source) {
        // If this file is in the template folder we must do a full rebuild.
        if (source.includes(this.#dirs.templates)) {
            this.#builder.templatesHaveBeenModified();
            return true;
        }
        return false;
    }

    unlink(path) {
        const { source, destination } = this.getAbsoluteSourceAndDestination(path);
        // If this is a JamsEdu source file we need to handle it differently.
        if (this.#handleIfJamsEduSource(source)) {
            return;
        }
        // If this file is in the template folder we must do a full rebuild.
        if (this.#handleIfTemplateFile(source)) {
            return;
        }
        if (Fs.existsSync(destination)) {
            Fs.unlinkSync(destination);
            Print.notice(`Deleted File: ${destination.replace(this.#dirs.output, '.')}`);
        }
    }

    unlinkDir(path) {
        const { source, destination } = this.getAbsoluteSourceAndDestination(path);
        // If this is a JamsEdu source file we need to handle it differently.
        if (this.#handleIfJamsEduSource(source)) {
            return;
        }
        // If this file is in the template folder we must do a full rebuild.
        if (this.#handleIfTemplateFile(source)) {
            return;
        }
        this.#deleteDirRecursive(destination);
    }

}

export default Watcher;
