/* eslint-disable max-len */
import Crypto from 'crypto';
import Fs from 'fs';
import Path from 'path';
import Print from './imports/print.js';
import { promptLine } from './imports/readline-prompt.js';
import URL from 'url';
import { execSync } from 'child_process';
import { sanitizeAssetPaths, templateSrcPathToUserPath } from './imports/template-path-mapping.js';
import {
    isTextFileForStripping,
    normalizeContentForHash,
    parseComponentFromFile,
    parseVersionFromFile,
    stripJamseduComments
} from './imports/strip-jamsedu-comments.js';

class Initializer {

    static #header = `
==============================================
      _                     _____    _       
     | | __ _ _ __ ___  ___| ____|__| |_   _ 
  _  | |/ _\` | '_ \` _ \\/ __|  _| / _\` | | | |
 | |_| | (_| | | | | | \\__ \\ |__| (_| | |_| |
  \\___/ \\__,_|_| |_| |_|___/_____\\__,_|\\__,_|
   
==============================================
Version {{VERSION}}

This utility will walk you through creating a new JamsEdu project. Press [enter] to begin.
    `;

    static fitToLength(value, length) {
        if (value.length <= length) {
            return value;
        }

        let result = '';
        const lines = value.split('\n');

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            let currentLine = '';

            const words = line.split(' ');

            for (let j = 0; j < words.length; j++) {
                const word = words[j];

                if (currentLine.length + word.length <= length) {
                    currentLine += `${word} `;
                } else {
                    result += `${currentLine.trim()}\n`;
                    currentLine = `${word} `;
                }
            }

            result += `${currentLine.trim()}\n`;
        }

        return result.trim();
    }

    /**
     * Detect if init is running in the JamsEdu source repository itself.
     * This enables extra safety guards so maintainer files are not overwritten.
     *
     * @param {string} cwd Project root where init is being run.
     * @returns {boolean}
     */
    static isSourceRepoMode(cwd) {
        try {
            const packageJsonPath = Path.join(cwd, 'package.json');
            const packageJson = Fs.existsSync(packageJsonPath) ?
                JSON.parse(Fs.readFileSync(packageJsonPath, 'utf-8')) :
                null;
            const hasExpectedName = packageJson && packageJson.name === '@caboodle-tech/jamsedu';
            const hasCli = Fs.existsSync(Path.join(cwd, 'bin', 'cli.js'));
            const hasTemplate = Fs.existsSync(Path.join(cwd, 'src', 'template'));
            const hasInitializer = Fs.existsSync(Path.join(cwd, 'src', 'initializer.js'));
            return Boolean(hasExpectedName && hasCli && hasTemplate && hasInitializer);
        } catch (err) {
            return false;
        }
    }

    /**
     * In source-repo mode, only allow writing generated project files under these roots.
     * This prevents init from clobbering maintainer files in the repository root.
     *
     * @param {string} relPath Path relative to cwd, forward slashes.
     * @returns {boolean}
     */
    static isAllowedSourceRepoWritePath(relPath) {
        const normalized = String(relPath || '').replace(/\\/g, '/').replace(/^\/+/, '');
        return normalized.startsWith('www/')
            || normalized.startsWith('TEST/')
            || normalized.startsWith('.jamsedu/');
    }

    /**
     * Prefer `.jamsedu/config.js`, then legacy `jamsedu.config.js` at project root.
     * @param {string} cwd Project root
     * @returns {{ absPath: string, label: string } | null}
     */
    static findExistingUserConfig(cwd) {
        const primary = Path.join(cwd, '.jamsedu', 'config.js');
        const legacy = Path.join(cwd, 'jamsedu.config.js');
        if (Fs.existsSync(primary)) {
            return { absPath: primary, label: '.jamsedu/config.js' };
        }
        if (Fs.existsSync(legacy)) {
            return { absPath: legacy, label: 'jamsedu.config.js (legacy)' };
        }
        return null;
    }

    /**
     * Normalize a path from a user config file to a project-relative path with forward slashes.
     * @param {string} cwd Project root
     * @param {unknown} value Config value
     * @param {string} fallback If value is empty
     * @returns {string}
     */
    static resolveConfigRelPath(cwd, value, fallback) {
        const fb = fallback.replace(/\\/g, '/');
        if (value == null || String(value).trim() === '') {
            return fb;
        }
        const raw = String(value).trim();
        if (Path.isAbsolute(raw)) {
            const rel = Path.relative(cwd, raw).replace(/\\/g, '/');
            return rel || fb;
        }
        return raw.replace(/\\/g, '/').replace(/^\/+/, '');
    }

    static async init(cwd, jamseduWd) {
        const packageJson = JSON.parse(Fs.readFileSync(Path.join(jamseduWd, 'package.json'), 'utf-8'));
        const packageVersion = packageJson.version;

        this.clearScreen();
        Print.notice(`${this.#header.replace('{{VERSION}}', packageVersion)}`);
        await promptLine('');
        this.clearScreen();

        const sourceRepoMode = this.isSourceRepoMode(cwd);
        if (sourceRepoMode) {
            Print.warn('Source repo mode detected.');
            Print.info('Safety guards are enabled so init only writes inside allowed project paths (for example under www/).');
        }

        let srcDir;
        let destDir;
        let userTemplateDir;
        let cleanedWebsiteUrl = '';
        let assetsDir = '';
        /** @type {Record<string, string> | null} */
        let assetPaths = null;
        let useExistingConfig = false;

        const existingConfig = this.findExistingUserConfig(cwd);
        if (existingConfig) {
            Print.out(`\n\x1b[33mExisting JamsEdu configuration found:\x1b[0m\n  ${existingConfig.label}\n`);
            const reuse = await this.getResponse(
                `Use this configuration for paths (srcDir, destDir, templateDir, assets folder, website URL)?

Template files will still be copied or merged using the conflict step next. Your config file on disk will not be overwritten.

(y) use existing config  (n) run the full setup wizard and write a new .jamsedu/config.js

Your choice [y]`,
                'y'
            );
            const acceptReuse = reuse.trim() === '' || /^y(es)?$/i.test(reuse.trim());
            if (acceptReuse) {
                try {
                    const mod = await import(URL.pathToFileURL(existingConfig.absPath).href);
                    const cfg = mod.default;
                    if (cfg && typeof cfg === 'object') {
                        srcDir = this.resolveConfigRelPath(cwd, cfg.srcDir, 'src');
                        destDir = this.resolveConfigRelPath(cwd, cfg.destDir, 'public');
                        userTemplateDir = this.resolveConfigRelPath(cwd, cfg.templateDir, `${srcDir}/templates`);
                        assetsDir = typeof cfg.assetsDir === 'string' ? cfg.assetsDir.replace(/\\/g, '/').replace(/^\/+/, '') : '';
                        assetPaths = sanitizeAssetPaths(cfg.assetPaths);
                        if (typeof cfg.websiteUrl === 'string' && cfg.websiteUrl.trim() !== '') {
                            cleanedWebsiteUrl = cfg.websiteUrl.trim();
                            if (cleanedWebsiteUrl.endsWith('/')) {
                                cleanedWebsiteUrl = cleanedWebsiteUrl.slice(0, -1);
                            }
                        }
                        useExistingConfig = true;
                        Print.success(
                            `Using your existing configuration:
  srcDir: ${srcDir}
  destDir: ${destDir}
  templateDir: ${userTemplateDir}
  assetsDir: ${assetsDir || '(none)'}
${assetPaths ? `  assetPaths: ${JSON.stringify(assetPaths)}\n` : ''}${cleanedWebsiteUrl ? `  websiteUrl: ${cleanedWebsiteUrl}\n` : ''}`
                        );
                    }
                } catch (err) {
                    Print.error(`Could not load existing config: ${err.message}`);
                    Print.info('Continuing with the interactive setup wizard.\n');
                }
            }
        }

        if (!useExistingConfig) {
            srcDir = await this.getResponse('Source Directory\n\nThe source directory is where your sites source files will reside. Please enter the name, including relative path if desired, for your projects source directory.\n\nPress [enter] without a response to accept the default: src', 'src');

            const tmpSrcDir = srcDir.endsWith('/') ? srcDir.slice(0, -1) : srcDir;

            destDir = await this.getResponse('Destination Directory\n\nThe destination directory is where your sites built files will be output to. Please enter the name, including relative path if desired, for your projects destination directory.\n\nPress [enter] without a response to accept the default: public', 'public');

            const websiteUrl = await this.getResponse(`Website URL\n\nThe website URL is the base URL for your published website including the protocol (e.g., https://example.com). This is required if you want JamsEdu to automatically build your sitemap. Please enter the URL for your website.\n\nPress [enter] to accept the default: \x1b[3mempty\x1b[0m`, '');

            cleanedWebsiteUrl = websiteUrl;
            if (cleanedWebsiteUrl.endsWith('/')) {
                cleanedWebsiteUrl = cleanedWebsiteUrl.slice(0, -1);
            }

            const useAssetsFolder = await this.getResponse('Use an assets folder for CSS, JS, and images? (y/n) [y]', 'y');
            assetsDir = /^n(o)?$/i.test(useAssetsFolder.trim()) ? '' : 'assets';

            const templateDirDefault = `${tmpSrcDir}/templates`;
            userTemplateDir = await this.getResponse(`JHP partials directory\n\nReusable HTML partials (head, header, footer) are copied here. This path is saved as templateDir in .jamsedu/config.js; use the same path in your \$include() calls (e.g. ./templates/ from a page in src root). It is not part of the assets folder (css, js, images).\n\nPress [enter] to accept the default: ${templateDirDefault}`, templateDirDefault);
        }

        const layoutConfig = { assetsDir, assetPaths, templateDir: userTemplateDir };

        // Check for existing files and handle conflicts (before generating config)
        const jamseduTemplateDir = Path.join(jamseduWd, 'src', 'template');
        if (!Fs.existsSync(jamseduTemplateDir)) {
            Print.error(`Template directory not found at: ${jamseduTemplateDir}`);
            Print.error('JamsEdu installation appears to be corrupted.');
            return;
        }

        const conflictResolution = await this.handleFileConflicts(cwd, jamseduTemplateDir, srcDir, layoutConfig, { sourceRepoMode });
        if (!conflictResolution) {
            Print.warn('Initialization cancelled by user.');
            return;
        }

        // Copy template files recursively (structure matches user choice so updates and build respect it)
        const skippedFiles = this.copyTemplateFiles(jamseduTemplateDir, cwd, conflictResolution, srcDir, layoutConfig, { sourceRepoMode });

        // When using assets layout, remove old css/js/images under srcDir so only assets/ layout remains; ensure assets/images exists
        if (assetsDir) {
            this.removeOldAssetDirsUnderSrc(cwd, srcDir, assetsDir);
        } else {
            // Post-copy user-project patch only: rewrite starter references from assets/* to css|js|images/*
            this.rewriteCopiedAssetReferencesForNoAssetsLayout(cwd, srcDir);
        }

        // Ensure .gitignore includes destDir
        if (!sourceRepoMode) {
            this.ensureGitignore(cwd, destDir);
        }

        // Write out the configuration file AFTER copying (so it doesn't conflict)
        // Store config in .jamsedu/config.js
        const jamseduDir = Path.join(cwd, '.jamsedu');
        if (!Fs.existsSync(jamseduDir)) {
            Fs.mkdirSync(jamseduDir, { recursive: true });
        }
        const configFilePath = Path.join(jamseduDir, 'config.js');
        if (!useExistingConfig) {
            const configFileContent = `export default {
    destDir: '${destDir}',
    srcDir: '${srcDir}',
    templateDir: '${userTemplateDir}'${assetsDir ? `,\n    assetsDir: '${assetsDir}'` : ''}${cleanedWebsiteUrl ? `,\n    websiteUrl: '${cleanedWebsiteUrl}'` : ''}
};\n`;
            Fs.writeFileSync(configFilePath, configFileContent);
        } else if (existingConfig) {
            const rel = Path.relative(cwd, existingConfig.absPath).replace(/\\/g, '/');
            Print.info(`Left your config file unchanged (${rel || existingConfig.label}).`);
        }

        // Create manifest for update system (pass skipped files to mark as customized; use same path mapping as copy)
        this.createManifest(cwd, srcDir, jamseduWd, packageVersion, skippedFiles, layoutConfig);

        // Create template directory if it doesn't exist
        const userTemplateDirPath = Path.join(cwd, userTemplateDir);
        if (!Fs.existsSync(userTemplateDirPath)) {
            Fs.mkdirSync(userTemplateDirPath, { recursive: true });
            Print.info(`Created templates directory at: ${userTemplateDir}`);
        }

        let installedForUser = false;

        try {
            execSync('pnpm --version');
            Print.info('Installing ESLint and dependencies using pnpm, please wait...');
            execSync('pnpm install');
            installedForUser = true;
        } catch (err) {} // eslint-disable-line no-unused-vars

        try {
            if (!installedForUser) {
                execSync('npm --version');
                Print.info('Installing ESLint and dependencies using npm, please wait...');
                execSync('npm install');
                installedForUser = true;
            }
        } catch (err) {} // eslint-disable-line no-unused-vars

        this.printClosingPrompt(installedForUser);
    }

    static async getResponse(question, defaultValue = null) {
        let response;
        while (true) {
            try {
                Print.out(this.fitToLength(question, 80));
                response = await promptLine('> ');
                if (response.trim() === '' && defaultValue === null) {
                    Print.warn('Response cannot be empty please try again! Press enter to continue.');
                    await promptLine('');
                    this.clearScreen();
                    // eslint-disable-next-line no-continue
                    continue;
                }
                response = response.trim() === '' ? defaultValue : response.trim();
                break;
            } catch (error) {
                Print.error(error.message);
            }
        }
        this.clearScreen();
        return response.trim();
    }

    /**
     * @param {{ assetsDir?: string, assetPaths?: Record<string, string> | null }} userConfig Same layout keys as .jamsedu/config.js
     */
    static async handleFileConflicts(cwd, templateDir, userSrcDir, userConfig = {}, options = {}) {
        const filesToCopy = this.scanTemplateFilesForConflictCheck(templateDir, userSrcDir, userConfig, options);

        // Check which of these files actually exist in the project root
        const conflictingFiles = [];
        for (const filePath of filesToCopy) {
            const fullPath = Path.join(cwd, filePath);
            if (Fs.existsSync(fullPath)) {
                conflictingFiles.push(filePath);
            }
        }

        if (conflictingFiles.length === 0) {
            return 'overwrite'; // No conflicts, safe to proceed
        }

        Print.warn(`\n⚠️  Found ${conflictingFiles.length} existing file(s) or directory(ies) that would conflict with template files.`);
        Print.out(`Conflicting files/directories: ${conflictingFiles.slice(0, 5).join(', ')}${conflictingFiles.length > 5 ? '...' : ''}`);

        const conflictPrompt = options.sourceRepoMode ?
            '\nHow would you like to proceed?\n\n1) Overwrite - Replace existing files with template files\n2) Skip - Don\'t copy files that already exist, only copy new ones\n3) Cancel - Abort initialization\n\nEnter your choice (1-3)' :
            '\nHow would you like to proceed?\n\n1) Overwrite - Replace existing files with template files\n2) Skip - Don\'t copy files that already exist, only copy new ones\n3) Fresh Install - Delete conflicting files first, then copy (⚠️  DESTRUCTIVE!)\n4) Cancel - Abort initialization\n\nEnter your choice (1-4)';
        const response = await this.getResponse(conflictPrompt, '1');

        const choice = response.trim();

        if ((options.sourceRepoMode && choice === '3') || choice === '4' || choice.toLowerCase() === 'cancel') {
            return null;
        }

        if (!options.sourceRepoMode && (choice === '3' || choice.toLowerCase() === 'fresh install' || choice.toLowerCase() === 'fresh')) {
            const confirm = await this.getResponse('\n⚠️  WARNING: This will DELETE the conflicting files!\n\nAre you absolutely sure? Type "yes" to confirm, or anything else to cancel.', '');
            if (confirm.toLowerCase() !== 'yes') {
                Print.warn('Fresh install cancelled.');
                return null;
            }

            // Delete only the conflicting files
            Print.warn('Deleting conflicting files...');
            for (const filePath of conflictingFiles) {
                const fullPath = Path.join(cwd, filePath);
                try {
                    if (Fs.statSync(fullPath).isDirectory()) {
                        Fs.rmSync(fullPath, { recursive: true, force: true });
                    } else {
                        Fs.unlinkSync(fullPath);
                    }
                } catch (err) {
                    Print.warn(`Could not delete ${filePath}: ${err.message}`);
                }
            }
            return 'overwrite';
        }

        if (choice === '2' || choice.toLowerCase() === 'skip') {
            return 'skip';
        }

        // Default to overwrite
        return 'overwrite';
    }

    /**
     * @param {{ assetsDir?: string, assetPaths?: Record<string, string> | null, templateDir?: string }} userConfig
     */
    static scanTemplateFilesForConflictCheck(templateDir, userSrcDir, userConfig = {}, options = {}) {
        const files = [];
        const normalizedSrcDir = userSrcDir.replace(/\\/g, '/');

        const scanDir = (dir) => {
            if (!Fs.existsSync(dir)) return;

            const entries = Fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = Path.join(dir, entry.name);
                const relativePath = Path.relative(templateDir, fullPath).replace(/\\/g, '/');

                if (entry.name === 'config.js' || entry.name === 'jamsedu.config.js') {
                    continue;
                }

                if (entry.isDirectory()) {
                    scanDir(fullPath);
                } else if (entry.isFile()) {
                    if (options.sourceRepoMode && !relativePath.startsWith('src/')) {
                        continue;
                    }
                    let destPath;
                    if (relativePath.startsWith('src/')) {
                        const pathAfterSrc = relativePath.replace(/^src\//, '');
                        destPath = templateSrcPathToUserPath(normalizedSrcDir, pathAfterSrc, userConfig);
                    } else {
                        destPath = relativePath;
                    }
                    if (options.sourceRepoMode && !this.isAllowedSourceRepoWritePath(destPath)) {
                        continue;
                    }
                    files.push(destPath);
                }
            }
        };

        scanDir(templateDir);
        return files;
    }

    /**
     * @param {{ assetsDir?: string, assetPaths?: Record<string, string> | null, templateDir?: string }} userConfig
     */
    static copyTemplateFiles(templateDir, cwd, conflictMode, userSrcDir, userConfig = {}, options = {}) {
        Print.info('Copying template files...');
        const skippedFiles = [];

        const normalizedSrcDir = userSrcDir.replace(/\\/g, '/');

        const copyRecursive = (src, templateBasePath = '') => {
            try {
                const entries = Fs.readdirSync(src, { withFileTypes: true });

                for (const entry of entries) {
                    const srcPath = Path.join(src, entry.name);
                    const relativePath = Path.relative(templateDir, srcPath).replace(/\\/g, '/');

                    if (entry.name === 'config.js' || entry.name === 'jamsedu.config.js') {
                        continue;
                    }
                    if (options.sourceRepoMode && entry.isFile() && !relativePath.startsWith('src/')) {
                        continue;
                    }

                    let destPath;
                    if (relativePath.startsWith('src/')) {
                        const pathAfterSrc = relativePath.replace(/^src\//, '');
                        const userRel = templateSrcPathToUserPath(normalizedSrcDir, pathAfterSrc, userConfig);
                        destPath = Path.join(cwd, ...userRel.split('/').filter(Boolean));
                    } else {
                        const pathParts = relativePath.split('/').filter((p) => {
                            return p;
                        });
                        destPath = Path.join(cwd, ...pathParts);
                    }
                    const destPathRel = Path.relative(cwd, destPath).replace(/\\/g, '/');
                    if (options.sourceRepoMode && !this.isAllowedSourceRepoWritePath(destPathRel)) {
                        continue;
                    }

                    if (entry.isDirectory()) {
                        // Create directory if it doesn't exist
                        if (!Fs.existsSync(destPath)) {
                            Fs.mkdirSync(destPath, { recursive: true });
                        }
                        // Always recurse into directories, even if they already exist
                        // This ensures files inside existing directories still get copied
                        copyRecursive(srcPath, templateBasePath);
                    } else if (entry.isFile()) {
                        // Handle file conflicts
                        if (Fs.existsSync(destPath)) {
                            if (conflictMode === 'skip') {
                                // Track skipped files for manifest
                                skippedFiles.push(relativePath);
                                continue; // Skip existing files
                            }
                            // Overwrite mode - file will be replaced
                        }

                        // Ensure parent directory exists
                        const parentDir = Path.dirname(destPath);
                        if (!Fs.existsSync(parentDir)) {
                            Fs.mkdirSync(parentDir, { recursive: true });
                        }

                        // Text files have metadata comments stripped; binary files are copied byte-for-byte.
                        if (isTextFileForStripping(srcPath)) {
                            const templateContent = Fs.readFileSync(srcPath, 'utf-8');
                            const cleanedContent = stripJamseduComments(templateContent);
                            Fs.writeFileSync(destPath, cleanedContent, 'utf-8');
                        } else {
                            Fs.copyFileSync(srcPath, destPath);
                        }
                    }
                }
            } catch (err) {
                Print.warn(`Error copying from ${src}: ${err.message}`);
            }
        };

        copyRecursive(templateDir);

        const imagesRel = templateSrcPathToUserPath(normalizedSrcDir, 'images', userConfig);
        const imagesDir = Path.join(cwd, ...imagesRel.split('/').filter(Boolean));
        if (!Fs.existsSync(imagesDir)) {
            Fs.mkdirSync(imagesDir, { recursive: true });
        }

        Print.success('Template files copied successfully!');
        return skippedFiles;
    }

    /**
     * Recursively copy contents of sourceDir into targetDir (preserves user files), then remove sourceDir.
     * @param {string} sourceDir Absolute path to the directory to move from.
     * @param {string} targetDir Absolute path to the directory to move into.
     */
    static moveDirContentsInto(sourceDir, targetDir) {
        if (!Fs.existsSync(sourceDir)) {
            return;
        }
        const entries = Fs.readdirSync(sourceDir, { withFileTypes: true });
        for (const entry of entries) {
            const srcPath = Path.join(sourceDir, entry.name);
            const destPath = Path.join(targetDir, entry.name);
            if (entry.isDirectory()) {
                if (!Fs.existsSync(destPath)) {
                    Fs.mkdirSync(destPath, { recursive: true });
                }
                this.moveDirContentsInto(srcPath, destPath);
                try {
                    Fs.rmdirSync(srcPath);
                } catch (err) {
                    Print.warn(`Could not remove empty dir ${srcPath}: ${err.message}`);
                }
            } else {
                try {
                    Fs.mkdirSync(Path.dirname(destPath), { recursive: true });
                    Fs.copyFileSync(srcPath, destPath);
                    Fs.unlinkSync(srcPath);
                } catch (err) {
                    Print.warn(`Could not move ${srcPath} to ${destPath}: ${err.message}`);
                }
            }
        }
        try {
            Fs.rmdirSync(sourceDir);
        } catch (err) {
            // Ignore if not empty (e.g. symlinks left)
        }
    }

    /**
     * When using assetsDir, move old css/js/images dirs under srcDir into assets/ so user content is kept, then remove old dirs.
     * @param {string} cwd Project root.
     * @param {string} srcDir Source dir (e.g. 'www/src').
     * @param {string} assetsDir Assets dir name (e.g. 'assets').
     */
    static removeOldAssetDirsUnderSrc(cwd, srcDir, assetsDir) {
        const srcDirPath = Path.join(cwd, ...srcDir.replace(/\\/g, '/').split('/').filter(Boolean));
        const oldDirs = ['css', 'js', 'images'];
        for (const name of oldDirs) {
            const oldPath = Path.join(srcDirPath, name);
            const newPath = Path.join(srcDirPath, assetsDir, name);
            if (!Fs.existsSync(oldPath)) {
                continue;
            }
            if (!Fs.existsSync(newPath)) {
                Fs.mkdirSync(newPath, { recursive: true });
            }
            this.moveDirContentsInto(oldPath, newPath);
        }
    }

    /**
     * Rewrite copied user project references when assetsDir is disabled.
     * This runs only after template files are copied into the user's project.
     * It never edits bundled template source files inside the JamsEdu package.
     *
     * @param {string} cwd Project root.
     * @param {string} srcDir Source dir (e.g. 'src').
     */
    static rewriteCopiedAssetReferencesForNoAssetsLayout(cwd, srcDir) {
        const srcRoot = Path.join(cwd, ...srcDir.replace(/\\/g, '/').split('/').filter(Boolean));
        if (!Fs.existsSync(srcRoot)) {
            return;
        }

        const textExtensions = new Set(['.jhp', '.html', '.htm', '.css', '.js', '.mjs', '.cjs', '.md']);
        const rewriteCount = { files: 0 };

        const rewriteAssetsPrefix = (rawPrefix, bucket) => {
            if (!['css', 'js', 'images'].includes(bucket)) {
                return `${rawPrefix}${bucket}/`;
            }

            if (rawPrefix.startsWith('/assets/')) {
                return `/${bucket}/`;
            }
            if (rawPrefix.startsWith('./assets/')) {
                return `./${bucket}/`;
            }
            if (rawPrefix.startsWith('assets/')) {
                return `${bucket}/`;
            }
            return `${rawPrefix}${bucket}/`;
        };

        const rewriteContent = (content) => {
            let updated = content;

            // Handles href/src and JS string literals containing ./assets/*, /assets/*, or assets/*
            updated = updated.replace(
                /(["'`])((?:\.\/|\/)?assets\/)(css|js|images)\//g,
                (match, quote, prefix, bucket) => {
                    return `${quote}${rewriteAssetsPrefix(prefix, bucket)}`;
                }
            );

            // Handles CSS url(...) references with optional quotes
            updated = updated.replace(
                /(url\(\s*["']?)((?:\.\/|\/)?assets\/)(css|js|images)\//g,
                (match, before, prefix, bucket) => {
                    return `${before}${rewriteAssetsPrefix(prefix, bucket)}`;
                }
            );

            return updated;
        };

        const walkAndPatch = (dir) => {
            const entries = Fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = Path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    walkAndPatch(fullPath);
                    continue;
                }

                const ext = Path.extname(entry.name).toLowerCase();
                if (!textExtensions.has(ext)) {
                    continue;
                }

                let original = '';
                try {
                    original = Fs.readFileSync(fullPath, 'utf-8');
                } catch (err) {
                    Print.warn(`Could not read ${fullPath}: ${err.message}`);
                    continue;
                }

                const rewritten = rewriteContent(original);
                if (rewritten !== original) {
                    Fs.writeFileSync(fullPath, rewritten, 'utf-8');
                    rewriteCount.files += 1;
                }
            }
        };

        walkAndPatch(srcRoot);
        if (rewriteCount.files > 0) {
            Print.info(`Adjusted no-assets starter paths in ${rewriteCount.files} copied file(s).`);
        }
    }

    /**
     * @param {{ assetsDir?: string, assetPaths?: Record<string, string> | null, templateDir?: string }} userConfig
     */
    static createManifest(cwd, srcDir, jamseduWd, packageVersion, skippedFiles = [], userConfig = {}) {
        const manifestDir = Path.join(cwd, '.jamsedu');
        if (!Fs.existsSync(manifestDir)) {
            Fs.mkdirSync(manifestDir, { recursive: true });
        }

        // Normalize srcDir to relative path with forward slashes
        const normalizedSrcDir = srcDir.replace(/\\/g, '/');

        const manifest = {
            jamseduPackageVersion: packageVersion,
            templateVersion: packageVersion,
            installed: new Date().toISOString(),
            lastUpdated: null,
            srcDir: normalizedSrcDir,
            components: {}
        };

        // Create a set of skipped file paths for quick lookup (normalize to match template paths)
        const skippedSet = new Set(skippedFiles.map((f) => { return f.replace(/\\/g, '/'); }));

        // Scan template directory to find all files with version tags (same path mapping as copyTemplateFiles)
        const templateDir = Path.join(jamseduWd, 'src', 'template');
        const templateFiles = this.scanTemplateFilesForManifest(templateDir, normalizedSrcDir, userConfig);

        // For each template file, check if it exists in user's project and track it
        for (const templateFile of templateFiles) {
            const userFilePath = templateFile.userPath;
            const fullUserPath = Path.join(cwd, userFilePath);

            if (Fs.existsSync(fullUserPath)) {
                const content = Fs.readFileSync(fullUserPath, 'utf-8');
                const hash = Crypto.createHash('sha256').update(normalizeContentForHash(content)).digest('hex');
                const version = parseVersionFromFile(content) || templateFile.version;
                const component = parseComponentFromFile(content) || templateFile.component;

                // Check if this file was skipped (using template-relative path)
                const wasSkipped = skippedSet.has(templateFile.templatePath);

                manifest.components[component] = {
                    file: userFilePath.replace(/\\/g, '/'), // Normalize path
                    version: version || packageVersion,
                    hash,
                    modified: false,
                    userCustomized: wasSkipped // Mark as customized if it was skipped
                };
            }
        }

        // Write manifest
        const manifestPath = Path.join(manifestDir, 'manifest.json');
        Fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    }

    /**
     * @param {{ assetsDir?: string, assetPaths?: Record<string, string> | null, templateDir?: string }} userConfig
     */
    static scanTemplateFilesForManifest(templateDir, userSrcDir, userConfig = {}) {
        const files = [];
        const normalizedSrcDir = userSrcDir.replace(/\\/g, '/');
        const scanDir = (dir) => {
            if (!Fs.existsSync(dir)) return;

            const entries = Fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = Path.join(dir, entry.name);
                const relativePath = Path.relative(templateDir, fullPath).replace(/\\/g, '/');

                if (entry.name === 'config.js' || entry.name === 'jamsedu.config.js') continue;

                if (entry.isDirectory()) {
                    scanDir(fullPath);
                } else if (entry.isFile()) {
                    const content = Fs.readFileSync(fullPath, 'utf-8');
                    const version = parseVersionFromFile(content);

                    if (!version) continue;

                    const component = parseComponentFromFile(content);

                    let userPath = relativePath;
                    if (relativePath.startsWith('src/')) {
                        const pathAfterSrc = relativePath.replace(/^src\//, '');
                        userPath = templateSrcPathToUserPath(normalizedSrcDir, pathAfterSrc, userConfig);
                    }
                    userPath = userPath.replace(/\\/g, '/');

                    files.push({
                        templatePath: relativePath,
                        userPath,
                        version,
                        component: component || Path.basename(relativePath, Path.extname(relativePath))
                    });
                }
            }
        };

        scanDir(templateDir);
        return files;
    }

    static scanDirectory(dir, baseDir) {
        const files = [];
        if (!Fs.existsSync(dir)) {
            return files;
        }

        const entries = Fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = Path.join(dir, entry.name);
            const relativePath = Path.relative(baseDir, fullPath).replace(/\\/g, '/');

            if (entry.isDirectory()) {
                files.push(...this.scanDirectory(fullPath, baseDir));
            } else if (entry.isFile()) {
                files.push(relativePath);
            }
        }

        return files;
    }

    static printClosingPrompt(installedForUser = false) {
        this.clearScreen();
        Print.success('✅ JamsEdu project initialized successfully!\n');
        Print.out('');
        Print.info('📚 Documentation: See the `docs/` directory for guides on CSS, JavaScript API, and JHP templates.');
        Print.out('');
        Print.out('Run `jamsedu --build` to build your site or `jamsedu --watch` to start the dev server.');

        if (!installedForUser) {
            Print.out('');
            Print.warn(this.fitToLength('To get started with ESLint, you need to install it using a package manager like pnpm (preferred) or npm. We were unable to auto install this for you. If you do not have pnpm installed, you can install it by following their install instructions listed here: https://pnpm.io/installation\n\nAfter successfully installing pnpm or if you have npm already installed, run ONE of the following commands:', 80));
            Print.notice('\npnpm install\nnpm install\n');
            Print.out('');
            Print.warn(this.fitToLength('NOTE: You may need to restart your terminal for the above commands to work. You may also need to install the ESLint extension in your IDE of choice.', 80));
        }
    }

    static clearScreen() {
        // Use ANSI escape codes for better cross-platform clearing
        // \x1b[2J - Clear entire screen
        // \x1b[0;0H - Move cursor to top-left
        // \x1b[3J - Clear scrollback buffer (if supported)
        process.stdout.write('\x1b[2J\x1b[0;0H');
        // Fallback to console.clear() if needed
        try {
            console.clear();
        } catch (err) {
            // Ignore errors if clear() fails
        }
    }

    static ensureGitignore(cwd, destDir) {
        const gitignorePath = Path.join(cwd, '.gitignore');
        let content = '';

        // Read existing .gitignore if it exists - preserve all existing content
        if (Fs.existsSync(gitignorePath)) {
            content = Fs.readFileSync(gitignorePath, 'utf-8');
        }

        // Normalize destDir path for .gitignore (use forward slashes)
        const destDirNormalized = destDir.replace(/\\/g, '/');

        // Check if destDir is already in .gitignore
        const lines = content.split('\n');
        const destDirPattern = new RegExp(`^${destDirNormalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/?$`);
        const alreadyIgnored = lines.some((line) => {
            const trimmed = line.trim();
            return trimmed && (trimmed === destDirNormalized || trimmed === `${destDirNormalized}/` || destDirPattern.test(trimmed));
        });

        // Add destDir if not already present - append only, never overwrite existing content
        if (!alreadyIgnored) {
            // Preserve existing content exactly as-is, just append the new entry
            if (content && !content.endsWith('\n')) {
                content += '\n';
            }
            content += `${destDirNormalized}/\n`;
            Fs.writeFileSync(gitignorePath, content, 'utf-8');
            Print.info(`Added ${destDirNormalized}/ to .gitignore`);
        }
    }

}

export default Initializer;
