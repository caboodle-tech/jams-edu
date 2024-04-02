import * as Sass from 'sass';
import Fs from 'fs';
import Path from 'path';
import Process from 'process';
import { parse as HTMLParser } from 'node-html-parser';
import { rollup as Rollup } from 'rollup';
import Behaviors from './behaviors/behaviors.js';
import JamsEduJsSource from '../frontend/rollup.config.js';
import JamsEduScssSource from '../frontend/scss.config.js';
import Print from './print.js';

class Builder {

    #defaultSlots = {};

    #dirs;

    #processObj = {
        processFileTypes: ['html'],
        processJs: [],
        processScss: []
    };

    #templates = {};

    constructor(dirs, processObj = {}) {
        this.#dirs = dirs;
        Object.values(processObj).forEach((value) => {
            if (!Array.isArray(value)) {
                Print.error('The Builder must be instantiated with a proper process object.');
                Process.exit();
            }
        });
        this.#processObj = processObj;
        this.#loadTemplates(dirs.templates);
    }

    build() {
        // Ensure JamsEdu JS bundle is in place first.
        const scriptSrc = Path.join(this.#dirs.jamsedu, 'frontend/dist/jamsedu.bundle.js');
        if (!Fs.existsSync(scriptSrc)) {
            Print.error('Could not locate JamsEdu script bundle! Try running `jamsedu build --edu` first.');
            Process.exit();
        }
        const scriptDest = Path.join(this.#dirs.js, 'jamsedu.bundle.js');
        const scriptContent = Fs.readFileSync(scriptSrc, { encoding: 'utf8' });
        this.outputFile(scriptDest, scriptContent);

        // Ensure JamsEdu CSS bundle is in place first.
        const styleSrc = Path.join(this.#dirs.jamsedu, 'frontend/dist/jamsedu.bundle.css');
        if (!Fs.existsSync(styleSrc)) {
            Print.error('Could not locate JamsEdu style bundle! Try running `jamsedu build --edu` first.');
            Process.exit();
        }
        const styleDest = Path.join(this.#dirs.css, 'jamsedu.bundle.css');
        const styleContent = Fs.readFileSync(styleSrc, { encoding: 'utf8' });
        this.outputFile(styleDest, styleContent);

        // Build the users SCSS and custom JS (rollup) files.
        this.buildUsersJs();
        this.buildUsersScss();

        // Recursively build the site.
        this.#build(this.#dirs.source);
    }

    #build(srcDir, level = 0) {
        const items = Fs.readdirSync(srcDir, { withFileTypes: true });

        items.forEach((item) => {
            const filePath = Path.join(srcDir, item.name);

            if (item.isDirectory()) {
                // Process subdirectory.
                this.#build(filePath, level + 1);
            } else {
                // Process individual file.
                this.#buildFile(filePath, level);
            }
        });
    }

    buildFile(filePath) {
        let level = this.countDirsInPath(filePath.replace(this.#dirs.source, '')) - 1;
        if (level < 0) {
            level = 0;
        }
        this.#buildFile(filePath, level);
    }

    #buildFile(filePath, level) {
        // Skip processing template files.
        if (filePath.includes(this.#dirs.templates)) {
            return;
        }

        // Skip processing SCSS files.
        if (this.containsDirectoryInPath(filePath, 'scss')) {
            return;
        }

        // Skip processing is this is a JS file meant to be part of a rollup bundle.
        if (
            (this.containsDirectoryInPath(filePath, 'rollup') || this.containsDirectoryInPath('bundle'))
            && this.containsDirectoryInPath(filePath, 'js')
        ) {
            return;
        }

        const dest = Path.normalize(Path.join(this.#dirs.output, filePath.replace(this.#dirs.source, '')));

        // If this file does not need to be compiled copy it to output.
        if (this.copyFileOnly(filePath, dest, this.getExt(filePath))) {
            return;
        }

        // Create relative path.
        const relativePath = Array(level + 1).join('../');

        // Get virtual DOM of file.
        const dom = HTMLParser.parse(Fs.readFileSync(filePath), { encoding: 'utf8' });

        // Merge any default slot values from the template files with what was found in the file.
        const slots = { ...this.#defaultSlots, ...this.#processSlots(dom, relativePath) };

        // Replace all templates in page.
        dom.querySelectorAll('template:not([ignore])').forEach((template) => {
            const key = this.#makeKey(template.innerText);

            if (key in this.#templates) {
                template.replaceWith(this.#templates[key].toString());
            } else {
                template.remove();
            }
        });

        // Add JamsEdu specific elements to the page.
        const head = dom.querySelector('head');
        if (head) {
            head.insertAdjacentHTML('afterbegin', '\n<slot>jamsedu_style_bundle</slot>');
            head.insertAdjacentHTML('afterbegin', '\n<slot>jamsedu_script_bundle</slot>');
        }

        // Replace all slots in the page.
        dom.querySelectorAll('slot:not([ignore])').forEach((slot) => {
            const key = this.#makeKey(slot.innerText);

            if (key in slots) {
                slot.replaceWith(slots[key]);
            } else {
                slot.remove();
            }
        });

        // Replace all shorthand attributes with their proper element behavior has attribute.
        Behaviors.apply(dom);

        // Correct relative links.
        this.#correctUrls(dom, relativePath);

        // Output file.
        this.outputFile(dest, dom.toString().trim());
    }

    async buildJamsEduJs() {
        try {
            await JamsEduJsSource.build();
            Print.success('Built JamsEdu JS bundle.');
        } catch (err) {
            Print.error(err);
        }
    }

    async buildJamsEduScss() {
        try {
            await JamsEduScssSource.build();
            Print.success('Built JamsEdu CSS bundle.');
        } catch (err) {
            Print.error(err);
        }
    }

    buildUsersJs() {
        this.#processObj.processJs.forEach(async (relPath) => {
            let src = Path.join(this.#dirs.source, relPath);

            if (!Fs.existsSync(src)) {
                Print.warn(`Skipped running none existent JS file: ${src.replace(this.#dirs.source, '.')}`);
                return;
            }

            if (Process.platform === 'win32') {
                src = `file:///${src.replace(/\\/g, '/')}`;
            }

            // Read the configuration file
            const rollupConfig = await import(src);

            // Create a Rollup bundle using the configuration
            const bundle = await Rollup(rollupConfig.default);

            // Generate output based on the configuration
            await bundle.write(rollupConfig.default.output);
        });
    }

    buildUsersScss() {
        this.#processObj.processScss.forEach((relPath) => {
            // Determine absolute paths.
            const dest = Path.join(this.#dirs.output, relPath.replace(/scss/g, 'css'));
            const src = Path.join(this.#dirs.source, relPath);

            if (!Fs.existsSync(src)) {
                Print.warn(`Skipped building none existent SCSS file: ${src.replace(this.#dirs.source, '.')}`);
                return;
            }

            // Compile the SCSS to CSS.
            const result = Sass.compile(src, { style: 'compressed' });

            // Create directories recursively if they don't exist.
            if (!Fs.existsSync(Path.dirname(dest))) {
                Fs.mkdirSync(Path.dirname(dest), { recursive: true });
            }

            // Output the results.
            Fs.writeFileSync(dest, result.css, { encoding: 'utf8' });
        });
    }

    containsDirectoryInPath(filePath, dir) {
        // Normalize the path separators and split the path
        const pathParts = Path.normalize(filePath).split(Path.sep);

        // Check if the target directory is in the path
        return pathParts.includes(dir);
    }

    convertPathToWindowsImport(absolutePath) {
        let urlPath = absolutePath.replace(/\\/g, '/');
        urlPath = urlPath.replace(/^[a-zA-Z]:\//, '/');
        return `file://${urlPath}`;
    }

    #copyFile(src, dest) {
        // Create directories if they don't exist.
        const destDir = Path.dirname(dest);
        if (!Fs.existsSync(destDir)) {
            Fs.mkdirSync(destDir, { recursive: true });
        }

        // Copy the file.
        Fs.copyFileSync(src, dest);
        Print.success(`Copied: ${dest.replace(this.#dirs.output, '.')}`);
    }

    copyFileOnly(src, dest, ext) {
        if (!this.#processObj.processFileTypes.includes(ext)) {
            this.#copyFile(src, dest);
            return true;
        }
        return false;
    }

    #correctUrls(dom, relativePath) {
        // Auto apply the correct-url flag to children of correct-all-url tagged elements.
        dom.querySelectorAll('[correct-all-urls]').forEach((elem) => {
            // Remove the correct-all-url attribute so its not in the output.
            elem.removeAttribute('correct-all-urls');

            elem.querySelectorAll('[href]').forEach((child) => {
                child.setAttribute('correct-url', '');
            });

            elem.querySelectorAll('[src]').forEach((child) => {
                child.setAttribute('correct-url', '');
            });
        });

        dom.querySelectorAll('[correct-url]').forEach((elem) => {
            // Remove the correct-url attribute so its not in the output.
            elem.removeAttribute('correct-url');

            // If this is a link:
            if (elem.getAttribute('href') !== undefined) {
                if (elem.getAttribute('ignore-url') !== undefined) {
                    return;
                }
                let href = elem.getAttribute('href');
                if (href.startsWith('../')) {
                    return;
                }
                if (href.startsWith('./')) {
                    href = href.substring(2);
                }
                elem.setAttribute('href', `${relativePath}${href}`);
                return;
            }

            // Any other element that has a src attribute:
            if (elem.getAttribute('src') !== undefined) {
                if (elem.getAttribute('ignore-url') !== undefined) {
                    return;
                }
                let src = elem.getAttribute('src');
                if (src.startsWith('../')) {
                    return;
                }
                if (src.startsWith('./')) {
                    src = src.substring(2);
                }
                elem.setAttribute('src', `${relativePath}${src}`);
            }
        });
    }

    countDirsInPath(inputPath) {
        // Normalize the path to use platform-specific separators
        const normalizedPath = Path.normalize(inputPath);

        // Use path.sep to split the path based on the platform-specific separator
        const dirs = normalizedPath.split(Path.sep);

        // Filter out empty strings (for cases like leading or trailing slashes)
        const nonEmptyDirs = dirs.filter((dir) => dir.trim() !== '');

        return nonEmptyDirs.length;
    }

    getExt(path) {
        const start = path.indexOf('.');
        if (start === -1) {
            return '';
        }
        return path.substring(start + 1);
    }

    /**
     * Loads the text content of the users template files into the Builder.
     *
     * @param {string} templateDir The absolute path to the root directory of the users templates.
     */
    #loadTemplates(templateDir) {
        /**
         * Use the relative template path and file name, minus extension, as the template key.
         * We need to replace dir separators with double underscores so the key name will be valid.
         */
        let base = this.#makeKey(templateDir.replace(this.#dirs.templates, ''));
        base += '__';

        // Recursively processes the template directory.
        const items = Fs.readdirSync(templateDir, { withFileTypes: true });
        items.forEach((item) => {
            const filePath = Path.join(templateDir, item.name);

            if (item.isDirectory()) {
                // Process subdirectory of templates.
                this.#loadTemplates(filePath);
            } else {
                // Process individual template file.
                let { name: key } = Path.parse(`${base}${item.name}`);
                key = this.#makeKey(key);
                const html = Fs.readFileSync(filePath, { encoding: 'utf8' });
                this.#templates[key] = html;
            }
        });

        // All template files have been loaded, now process them further.
        this.#preprocessTemplates();
    }

    #makeKey(str) {
        let key = str.trim().replace(/-| /g, '_');
        key = key.replace(/\\|\//g, '__');
        if (key.substring(0, 2) === '__') {
            key = key.substring(2);
        }
        return key;
    }

    #normalizeUrl(str) {
        const url = Path.normalize(str).replace(/\\/g, '/');
        if (url[0] === '/') {
            return url.substring(1);
        }
        return url;
    }

    outputFile(dest, content) {
        // Ensure the destination directory exists.
        const destDir = Path.dirname(dest);
        if (!Fs.existsSync(destDir)) {
            Fs.mkdirSync(destDir, { recursive: true });
        }

        // Write the content to the destination file
        Fs.writeFileSync(dest, content);
        Print.success(`Built: ${dest.replace(this.#dirs.output, '.')}`);
    }

    /**
     * Convert all template string into virtual DOMs we will use when building the site.
     */
    #preprocessTemplates() {
        // Convert all template strings into virtual DOMs.
        Object.keys(this.#templates).forEach((templateKey) => {
            const template = HTMLParser.parse(this.#templates[templateKey]);
            this.#templates[templateKey] = template;
        });

        // Check all templates for nested templates and elements that need to be ignored or removed.
        Object.keys(this.#templates).forEach((templateKey) => {
            const template = this.#templates[templateKey];

            // Find, record, and remove any default slots.
            const slotElements = template.querySelectorAll('slot[name]:not(template[ignore] slot[name])');
            slotElements.forEach((slot) => {
                const name = this.#makeKey(slot.getAttribute('name'));
                this.#defaultSlots[name] = slot.innerHTML;
                // Remove the slot from the template and speed up garbage collection.
                slot.remove();
                slot = null;
            });

            // Find and replace any nested templates.
            template.querySelectorAll('template').forEach((templateArea) => {
                // If the template element has the ignore flag ignore it.
                if (templateArea.getAttribute('ignore') !== undefined) {
                    // Make sure to mark any nested slot elements as ignored for the user.
                    templateArea.querySelectorAll('slot').forEach((slot) => {
                        slot.setAttribute('ignore', '');
                    });
                    return;
                }

                // Replace the template tag with its actual template or remove it (it may be invalid).
                const areaKey = templateArea.innerText;
                if (areaKey in this.#templates) {
                    templateArea.replaceWith(this.#templates[areaKey]);
                } else {
                    templateArea.remove();
                }
            });

            // Update the templates virtual DOM; not strictly necessary since this is already an object reference.
            // this.#templates[templateKey] = template;
        });
    }

    #processSlots(dom, relativePath) {
        const slots = {};

        // Get all the content for slot elements that are not inside a template tag with the attribute ignore.
        const slotElements = dom.querySelectorAll('slot[name]:not(template[ignore] slot[name])');
        slotElements.forEach((slot) => {
            const name = this.#makeKey(slot.getAttribute('name'));
            slots[name] = slot.innerHTML;
            // Remove the slot from the page and speed up garbage collection.
            slot.remove();
            slot = null;
        });

        // Add JamsEdu specific slots.
        const jamseduScript = `${relativePath}${this.#dirs.js.replace(this.#dirs.output, '')}/jamsedu.bundle.js`;
        const jamseduStyle = `${relativePath}${this.#dirs.css.replace(this.#dirs.output, '')}/jamsedu.bundle.css`;
        slots.jamsedu_script_bundle = `<script src="${this.#normalizeUrl(jamseduScript)}"></script>`;
        slots.jamsedu_style_bundle = `<link rel="stylesheet" href="${this.#normalizeUrl(jamseduStyle)}">`;

        // Replace any slots inside slots now.
        Object.keys(slots).forEach((key) => {
            const tmpDom = HTMLParser.parse(slots[key]);

            tmpDom.querySelectorAll('slot:not([ignore])').forEach((slot) => {
                const nestedKey = this.#makeKey(slot.innerText);

                if (nestedKey in slots) {
                    slot.replaceWith(slots[nestedKey]);
                } else {
                    slot.remove();
                }
            });

            slots[key] = tmpDom.toString();
        });

        return slots;
    }

    /**
     * Signal to this Builder that the templates are out of date and need to be rebuilt.
     */
    templatesHaveBeenModified() {
        Print.warn('Template modified, reloading templates.');
        this.#defaultSlots = {};
        this.#templates = {};
        this.#loadTemplates(this.#dirs.templates);
        this.build();
    }

}

export default Builder;
