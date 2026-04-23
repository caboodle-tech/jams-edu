import Fs from 'fs';
import JHP from '@caboodle-tech/jhp';
import NodeSimpleServer from '@caboodle-tech/node-simple-server';
import Path from 'path';
import Print from './imports/print.js';
import { exit } from 'process';
import { WhatIs } from './imports/helpers.js';
import { isTextFileForStripping, stripJamseduComments } from './imports/strip-jamsedu-comments.js';

/** Extension → asset type for assetsDir / assetPaths mapping. */
const ASSET_TYPE_BY_EXT = Object.freeze({
    css: ['css'],
    js: ['js', 'mjs'],
    images: ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico']
});

export default class JamsEdu {

    #assetsDir = '';

    #assetPaths = null;

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

    #watchDebounceMs = 80;

    #watchDebounceTimer = null;

    #pendingWatchEvents = [];

    /**
     * Absolute path to the folder where include-only partials live (.jhp or HTML used only via
     * `$include`). Build and watch skip these files so nothing under this path is copied or emitted
     * into destDir; they are only consumed while processing other .jhp pages. Empty string disables.
     */
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
        const templateDirRaw = typeof config.templateDir === 'string' ? config.templateDir.trim() : '';
        this.#templateDir = templateDirRaw ? Path.resolve(usersRoot, templateDirRaw) : '';
        this.#usersRoot = usersRoot;
        this.#verbose = config.verbose === true;

        // Optional: where to put CSS, JS, images. assetPaths overrides assetsDir per type.
        this.#assetsDir = typeof config.assetsDir === 'string' ? config.assetsDir : '';
        this.#assetPaths = WhatIs(config.assetPaths) === 'object' ? config.assetPaths : null;

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

    /**
     * Returns asset type for an extension, or null. Used for assetsDir / assetPaths mapping.
     * @param {string} ext Extension without dot (e.g. 'css', 'png').
     * @returns {string|null} 'css' | 'js' | 'images' | null.
     */
    #getAssetType(ext) {
        if (!ext || typeof ext !== 'string') {
            return null;
        }
        const lower = ext.toLowerCase();
        for (const [type, exts] of Object.entries(ASSET_TYPE_BY_EXT)) {
            if (exts.includes(lower)) {
                return type;
            }
        }
        return null;
    }

    /**
     * Computes destination path from a path relative to srcDir. Applies .jhp→.html and assetsDir/assetPaths.
     * @param {string} relativePath Path relative to srcDir.
     * @param {boolean} isJhp Whether the source is a .jhp file.
     * @param {string} [ext] Extension without dot (for non-jhp asset mapping).
     * @returns {string} Absolute destination path.
     */
    #getDestPathFromRelative(relativePath, isJhp, ext = '') {
        const normalized = Path.normalize(relativePath.replace(/\//g, Path.sep));
        if (normalized.startsWith('..') || Path.isAbsolute(normalized)) {
            return Path.join(this.#destDir, normalized);
        }
        if (isJhp) {
            const withHtml = normalized.replace(this.#regex.jhp, '.html');
            return Path.join(this.#destDir, withHtml);
        }
        const assetType = this.#getAssetType(ext);
        const hasPerType = this.#assetPaths && assetType && typeof this.#assetPaths[assetType] === 'string';
        const useCatchAll = this.#assetsDir && assetType;
        if (hasPerType) {
            return Path.join(this.#destDir, this.#assetPaths[assetType], normalized);
        }
        if (useCatchAll) {
            // Source may already be under assets (e.g. src/assets/css/...) so avoid double-prepending
            const assetsPrefix = `${this.#assetsDir}${Path.sep}`;
            const assetsPrefixSlash = `${this.#assetsDir}/`;
            if (normalized.startsWith(assetsPrefix) || normalized.startsWith(assetsPrefixSlash)) {
                return Path.join(this.#destDir, normalized);
            }
            return Path.join(this.#destDir, this.#assetsDir, normalized);
        }
        return Path.join(this.#destDir, normalized);
    }

    /**
     * Resolves a watched path (relative to srcDir) to a destination path under destDir.
     * Uses same mapping as build (assetsDir/assetPaths, .jhp→.html). Returns null if outside destDir.
     * @param {string} relativePath Path relative to srcDir (forward slashes from watcher).
     * @param {boolean} wasJhp Whether the source was a .jhp file (so output is .html).
     * @param {string} [ext] Extension without dot (for asset mapping on unlink).
     * @returns {string|null} Absolute dest path or null if outside destDir.
     */
    #resolveDestPath(relativePath, wasJhp = false, ext = '') {
        const destPath = this.#getDestPathFromRelative(relativePath, wasJhp, ext);
        const resolved = Path.resolve(destPath);
        const destDirResolved = Path.resolve(this.#destDir);
        const rel = Path.relative(destDirResolved, resolved);
        if (rel.startsWith('..') || Path.isAbsolute(rel)) {
            return null;
        }
        return resolved;
    }

    /**
     * Removes a file or directory at the given dest path. Used to keep output in sync on unlink/unlinkDir.
     * @param {string} destPath Absolute path under destDir.
     */
    #removeDestPath(destPath) {
        if (!destPath || !Fs.existsSync(destPath)) {
            return;
        }
        const stat = Fs.statSync(destPath);
        if (stat.isDirectory()) {
            this.#clearDirectory(destPath);
            Fs.rmdirSync(destPath);
        } else {
            Fs.unlinkSync(destPath);
        }
    }

    #copyFile(src, dest) {
        try {
            Fs.mkdirSync(Path.dirname(dest), { recursive: true });
            if (isTextFileForStripping(src)) {
                const content = Fs.readFileSync(src, 'utf8');
                const cleaned = stripJamseduComments(content);
                Fs.writeFileSync(dest, cleaned, 'utf8');
            } else {
                Fs.copyFileSync(src, dest);
            }
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
            .reduce((count, part) => {
                return count + (part ? 1 : 0);
            }, 0);
        return depth === 0 ? '' : '../'.repeat(depth);
    }

    /**
     * Ordered roots for JHP 3.9+ built-in `$include` resolution (see `includeSearchRoots` in @caboodle-tech/jhp).
     * Tries `templateDir` (partials) before `srcDir` when both differ.
     *
     * @returns {string[]} Non-empty list of absolute directory paths
     */
    #getIncludeSearchRoots() {
        const src = Path.resolve(this.#srcDir);
        const roots = [];
        if (this.#templateDir) {
            const t = Path.resolve(this.#templateDir);
            if (t !== src) {
                roots.push(t);
            }
        }
        roots.push(src);
        return roots;
    }

    /**
     * @param {string} absoluteFilePath
     * @returns {boolean}
     */
    #isUnderTemplateDir(absoluteFilePath) {
        if (!this.#templateDir) {
            return false;
        }
        const file = Path.resolve(absoluteFilePath);
        const root = Path.resolve(this.#templateDir);
        const rel = Path.relative(root, file);
        return rel !== '' && !rel.startsWith('..') && !Path.isAbsolute(rel);
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
        if (this.#isUnderTemplateDir(src)) {
            return;
        }

        const relativePath = Path.relative(this.#srcDir, src);
        const isJhp = src.endsWith('.jhp');
        const ext = Path.extname(src).replace('.', '');
        const dest = this.#getDestPathFromRelative(relativePath, isJhp, ext);

        if (isJhp) {
            const cwd = Path.dirname(src);
            const relPath = this.#determineRelativePath(src);
            const content = Fs.readFileSync(src, 'utf8');
            const processed = this.#JHP.process(content, {
                cwd,
                relPath,
                includeSearchRoots: this.#getIncludeSearchRoots()
            });
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

        // Watch the source directory for changes; debounced so renames and rapid edits batch.
        this.#NSS.watch(this.#srcDir, {
            events: {
                all: this.#watcherCallbackDebounced.bind(this)
            },
            followSymlinks: false,
            ignoreInitial: true,
            cwd: this.#srcDir
            // unlink/unlinkDir are delivered via 'all' so output stays in sync when src is deleted/renamed.
        });

        // Show some useful information to the user.
        Print.success('JamsEdu is now watching for changes and will reload automatically.');
        Print.warn('Press Ctrl+C to stop.');
        Print.info('Access your site at the following address(es):');
        const addresses = this.#NSS.getAddresses().filter((addr) => {
            return addr.startsWith('http://localhost') || addr.startsWith('http://127.');
        });
        Print.info(`• ${addresses.join('\n• ')}`);
        Print.info('These addresses are meant for local network use only.');
    }

    /**
     * Debounced entry for watch events; batches rapid events (e.g. rename = unlink + add).
     */
    #watcherCallbackDebounced(event, path, statsOrDetails = {}) {
        this.#pendingWatchEvents.push({ event, path, statsOrDetails });
        if (this.#watchDebounceTimer !== null) {
            clearTimeout(this.#watchDebounceTimer);
        }
        this.#watchDebounceTimer = setTimeout(() => {
            this.#watchDebounceTimer = null;
            this.#processPendingWatchEvents();
        }, this.#watchDebounceMs);
    }

    /**
     * Processes batched watch events: unlink/unlinkDir first (sync output), then change/add (build), then reload.
     */
    #processPendingWatchEvents() {
        const pending = this.#pendingWatchEvents.splice(0, this.#pendingWatchEvents.length);
        if (pending.length === 0) {
            return;
        }

        let reloadAll = false;
        const pagesToReload = new Set();
        let reloadStyles = false;

        // Process unlink/unlinkDir first so output matches src (and renames don't leave stale files).
        for (const { event, path } of pending) {
            if (event === 'unlink') {
                const wasJhp = path.toLowerCase().endsWith('.jhp');
                const ext = Path.extname(path).replace('.', '');
                const destPath = this.#resolveDestPath(path, wasJhp, ext);
                if (destPath) {
                    this.#removeDestPath(destPath);
                }
                reloadAll = true;
            } else if (event === 'unlinkDir') {
                const destPath = this.#resolveDestPath(path, false, '');
                if (destPath) {
                    this.#removeDestPath(destPath);
                }
                reloadAll = true;
            }
        }

        // Then process change/add (build step).
        for (const { event, path, statsOrDetails } of pending) {
            if (event !== 'change' && event !== 'add') {
                continue;
            }
            const ext = statsOrDetails?.ext ?? Path.extname(path).replace('.', '');
            const src = Path.join(this.#srcDir, path);

            if (ext === 'css') {
                this.#processFile(src);
                reloadStyles = true;
                continue;
            }
            if (this.#isUnderTemplateDir(src)) {
                this.build();
                reloadAll = true;
                continue;
            }
            if (ext === 'jhp') {
                this.#processFile(src);
                pagesToReload.add(path.replace(this.#regex.jhp, '.html'));
                continue;
            }
            // Remaining files (js, images, fonts, etc.) are copied like a full build; browsers cache
            // scripts, so reload all pages (same idea as NSS watch examples for .js).
            this.#processFile(src);
            reloadAll = true;
        }

        if (reloadAll) {
            this.#NSS.reloadAllPages();
        } else {
            if (reloadStyles) {
                this.#NSS.reloadAllStyles();
            }
            for (const pagePath of pagesToReload) {
                this.#NSS.reloadSinglePage(pagePath);
            }
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
