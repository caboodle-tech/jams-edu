/* eslint-disable max-len */
import Crypto from 'crypto';
import Fs from 'fs';
import Path from 'path';
import Print from './imports/print.js';
import { promptLine } from './imports/readline-prompt.js';
import URL from 'url';
import { templateSrcPathToUserPath } from './imports/template-path-mapping.js';
import {
    normalizeContentForHash,
    parseComponentFromFile,
    parseVersionFromFile,
    stripJamseduComments
} from './imports/strip-jamsedu-comments.js';
import { siteAppearsToHaveFavicon } from './imports/favicon-path-probe.js';
import {
    copyTemplateFaviconDirectory,
    FAVICON_JAMSEDU_DOC_BASENAME,
    scanTemplateFaviconBinaryFiles,
    sha256FileBuffer,
    writeFaviconJamseduMarkdown
} from './imports/template-binary-assets.js';
import { syncStarterAssetUrlPrefixes } from './imports/starter-asset-url-rewrite.js';

class Updater {

    static #header = `
==============================================
      _                     _____    _       
     | | __ _ _ __ ___  ___| ____|__| |_   _ 
  _  | |/ _\` | '_ \` _ \\/ __|  _| / _\` | | | |
 | |_| | (_| | | | | | \\__ \\ |__| (_| | |_| |
  \\___/ \\__,_|_| |_| |_|___/_____\\__,_|\\__,_|
   
==============================================
Version {{VERSION}}

Merge template files from your installed JamsEdu package into this project. Follow the prompts.
    `;

    static clearScreen() {
        // Use ANSI escape codes for better cross-platform clearing
        process.stdout.write('\x1b[2J\x1b[0;0H');
        try {
            console.clear();
        } catch (err) {
            // Ignore errors if clear() fails
        }
    }

    /**
     * Detect if update is running in the JamsEdu source repository itself.
     * In that mode, only files under the configured srcDir should be managed.
     *
     * @param {string} cwd Project root.
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
            const hasUpdater = Fs.existsSync(Path.join(cwd, 'src', 'updater.js'));
            return Boolean(hasExpectedName && hasCli && hasTemplate && hasUpdater);
        } catch (err) {
            return false;
        }
    }

    /**
     * Whether a relative project path is inside srcDir.
     *
     * @param {string} filePath Relative path from project root.
     * @param {string} srcDir Relative srcDir from config.
     * @returns {boolean}
     */
    static isPathUnderSrcDir(filePath, srcDir) {
        const normalizedFile = String(filePath || '').replace(/\\/g, '/').replace(/^\/+/, '');
        const normalizedSrc = String(srcDir || 'src').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
        return normalizedFile === normalizedSrc || normalizedFile.startsWith(`${normalizedSrc}/`);
    }

    /**
     * In source-repo mode, allow updates only under srcDir and docs/.
     *
     * @param {string} filePath Relative path from project root.
     * @param {string} srcDir Relative srcDir from config.
     * @returns {boolean}
     */
    static isAllowedSourceRepoUpdatePath(filePath, srcDir) {
        const normalizedFile = String(filePath || '').replace(/\\/g, '/').replace(/^\/+/, '');
        return this.isPathUnderSrcDir(normalizedFile, srcDir) || normalizedFile === 'docs' || normalizedFile.startsWith('docs/');
    }

    /**
     * Run interactive template update against the user project.
     *
     * @param {string} cwd Project root (usersRoot).
     * @param {string} jamseduWd Installed JamsEdu package root (template + package.json).
     * @param {{ srcDir?: string, destDir?: string, templateDir?: string, assetsDir?: string }} userConfig
     *        Layout options from the user config (same semantics as .jamsedu/config.js); used for path mapping, not CLI flags.
     * @param {boolean} [force]
     */
    static async update(cwd, jamseduWd, userConfig, force = false) {
        this.clearScreen();

        const packageJsonPath = Path.join(jamseduWd, 'package.json');
        const packageJson = JSON.parse(Fs.readFileSync(packageJsonPath, 'utf-8'));
        const currentPackageVersion = packageJson.version;

        Print.notice(`${this.#header.replace('{{VERSION}}', currentPackageVersion)}`);

        // Read user's config to get srcDir (normalize to relative path)
        let srcDir = userConfig.srcDir || 'src';
        // Normalize srcDir to relative path for comparison
        if (Path.isAbsolute(srcDir)) {
            srcDir = Path.relative(cwd, srcDir).replace(/\\/g, '/');
        } else {
            srcDir = srcDir.replace(/\\/g, '/');
        }

        let templateDirMap = typeof userConfig.templateDir === 'string' ? userConfig.templateDir.trim() : '';
        if (templateDirMap) {
            if (Path.isAbsolute(templateDirMap)) {
                templateDirMap = Path.relative(cwd, templateDirMap).replace(/\\/g, '/');
            } else {
                templateDirMap = templateDirMap.replace(/\\/g, '/').replace(/^\/+/, '');
            }
        }
        const templatePathLayout = {
            assetsDir: userConfig.assetsDir,
            ...(templateDirMap ? { templateDir: templateDirMap } : {})
        };
        const sourceRepoMode = this.isSourceRepoMode(cwd);
        if (sourceRepoMode) {
            Print.info(`Source repo mode: limiting updates to ${srcDir}/`);
        }

        const manifestPath = Path.join(cwd, '.jamsedu', 'manifest.json');
        const manifestDir = Path.join(cwd, '.jamsedu');
        /** @type {object} */
        let manifest;

        if (!Fs.existsSync(manifestPath)) {
            Print.warn('Manifest not found. Rebuilding it from your config paths and the installed template.');
            Print.info(`Using srcDir (relative): ${srcDir}; assetsDir: ${typeof userConfig.assetsDir === 'string' ? userConfig.assetsDir : '(default)'}`);
            if (!Fs.existsSync(manifestDir)) {
                Fs.mkdirSync(manifestDir, { recursive: true });
            }
            manifest = {
                jamseduPackageVersion: currentPackageVersion,
                templateVersion: currentPackageVersion,
                installed: new Date().toISOString(),
                lastUpdated: null,
                srcDir,
                components: {}
            };
        } else {
            let raw;
            try {
                raw = Fs.readFileSync(manifestPath, 'utf-8');
                manifest = JSON.parse(raw);
            } catch {
                Print.warn('Manifest could not be parsed as JSON. Rebuilding from your config and the template scan.');
                manifest = {
                    jamseduPackageVersion: currentPackageVersion,
                    templateVersion: currentPackageVersion,
                    installed: new Date().toISOString(),
                    lastUpdated: null,
                    srcDir,
                    components: {}
                };
            }
            if (!manifest || typeof manifest !== 'object' || !manifest.components || typeof manifest.components !== 'object') {
                Print.warn('Manifest structure was invalid. Resetting component list; metadata will be refreshed from the template.');
                manifest = {
                    jamseduPackageVersion: currentPackageVersion,
                    templateVersion: currentPackageVersion,
                    installed: new Date().toISOString(),
                    lastUpdated: manifest && manifest.lastUpdated != null ? manifest.lastUpdated : null,
                    srcDir,
                    components: {}
                };
            }
        }

        // Update manifest srcDir if it changed (normalize manifest srcDir for comparison)
        const manifestSrcDir = manifest.srcDir ? manifest.srcDir.replace(/\\/g, '/') : 'src';
        if (manifestSrcDir !== srcDir) {
            manifest.srcDir = srcDir;
            // Only show message if paths are actually different (not just format difference)
            if (Path.resolve(cwd, manifestSrcDir) !== Path.resolve(cwd, srcDir)) {
                Print.info(`Updated manifest srcDir: ${manifestSrcDir} → ${srcDir}`);
            }
        }

        // Scan template files from installed package
        const templateDir = Path.join(jamseduWd, 'src', 'template');
        if (!Fs.existsSync(templateDir)) {
            Print.error(`Template directory not found at: ${templateDir}`);
            Print.error('JamsEdu installation appears to be corrupted.');
            return;
        }

        let binaryTemplateFiles = scanTemplateFaviconBinaryFiles(
            templateDir,
            srcDir,
            templatePathLayout,
            currentPackageVersion,
            { sourceRepoMode }
        );

        if (!sourceRepoMode && !siteAppearsToHaveFavicon(cwd, userConfig)) {
            Print.out(
                '\nNo common favicon files were found under your project root, source tree, or images or assets paths.'
            );
            const installFav = await this.getResponse(
                'Install the JamsEdu template favicon set under your configured layout? (y/n) [n]',
                'n'
            );
            if (['y', 'ye', 'yes'].includes(installFav.trim().toLowerCase())) {
                const destRel = copyTemplateFaviconDirectory(templateDir, cwd, srcDir, templatePathLayout);
                writeFaviconJamseduMarkdown(cwd, destRel);
                binaryTemplateFiles = scanTemplateFaviconBinaryFiles(
                    templateDir,
                    srcDir,
                    templatePathLayout,
                    currentPackageVersion,
                    { sourceRepoMode }
                );
                Print.success(
                    `Installed favicons under ${destRel}/ and wrote ${FAVICON_JAMSEDU_DOC_BASENAME} at project root.`
                );
            }
        }

        const textTemplateFiles = this.scanTemplateFiles(templateDir, srcDir, templatePathLayout, { sourceRepoMode });
        const templateFiles = [...textTemplateFiles, ...binaryTemplateFiles];

        // Clean up and correct manifest (remove stale entries, add missing entries, fix component names)
        // This runs before scanning user files so we have a clean manifest to work with
        const removedFromTemplate = this.correctManifest(manifest, templateFiles, cwd, srcDir, { sourceRepoMode });

        // Save corrected manifest immediately
        Fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

        // Ask user what to do with files that are no longer in the template (we already removed them from manifest)
        if (removedFromTemplate.length > 0) {
            Print.out('\n\x1b[33mThese files are no longer part of the JamsEdu template and have been removed from the manifest:\x1b[0m');
            for (const { componentName, filePath } of removedFromTemplate) {
                Print.out(`  • ${filePath} (${componentName})`);
            }
            const removeFiles = await this.getResponse('\nDo you want to remove them from your project? (y/n) [n]', 'n');
            if (['y', 'ye', 'yes'].includes(removeFiles.trim().toLowerCase())) {
                for (const { filePath } of removedFromTemplate) {
                    const fullPath = Path.join(cwd, filePath);
                    if (Fs.existsSync(fullPath)) {
                        Fs.unlinkSync(fullPath);
                        Print.success(`Removed ${filePath}`);
                    }
                }
            } else {
                Print.info('Files left in place. You can remove them yourself if you no longer need them.');
            }
        }

        const userFiles = this.scanUserFiles(cwd, srcDir, manifest, userConfig, { sourceRepoMode });

        // Compare files
        const updates = this.compareFiles(templateFiles, userFiles, manifest, cwd, force);

        // Check if package was updated
        if (manifest.jamseduPackageVersion !== currentPackageVersion) {
            Print.info(`JamsEdu package updated: ${manifest.jamseduPackageVersion} → ${currentPackageVersion}`);
        }

        // Check if there are any updates available (including customized files with updates)
        const hasRegularUpdates = updates.available.length > 0 || updates.new.length > 0;
        const hasCustomizedUpdates = updates.customizedWithUpdates && updates.customizedWithUpdates.length > 0;

        if (!hasRegularUpdates && !hasCustomizedUpdates) {
            Print.success('\n✅ All files are up to date!');
            if (manifest.jamseduPackageVersion === currentPackageVersion) {
                Print.info(`JamsEdu package version: ${currentPackageVersion}`);
            }
            const customizedCount = Object.values(manifest.components || {}).filter((e) => {
                return e && e.userCustomized;
            }).length;
            if (customizedCount > 0) {
                Print.info(`To replace ${customizedCount} customized file(s) with template versions, run: jamsedu --update --force`);
            }
            // Save manifest if we updated userCustomized flags
            Fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
            return;
        }

        // Show available updates with interactive checklist
        const allUpdates = [...updates.available, ...updates.new];
        const selected = new Set();
        let backupPath = null;

        // Force mode: auto-select all and warn user
        if (force) {
            Print.out('\n⚠️  WARNING: Force mode enabled!');
            Print.out('This will overwrite ALL files, including your customizations.');
            Print.out('All files with hash differences will be updated, regardless of version.');
            Print.out('');
            Print.out('A backup will be automatically created before updating.');
            Print.out('You can restore or copy back any custom changes you want to keep from the backup.');
            Print.out('');
            const confirm = await this.getResponse('Are you sure you want to continue? (yes/no) [no]', 'no');
            if (confirm.toLowerCase() !== 'yes') {
                Print.info('Force update cancelled.');
                return;
            }

            // Auto-select all updates
            for (let i = 0; i < allUpdates.length; i++) {
                selected.add(i);
            }

            // Also include customized files with updates
            if (updates.customizedWithUpdates) {
                for (const customized of updates.customizedWithUpdates) {
                    allUpdates.push(customized);
                    selected.add(allUpdates.length - 1);
                }
            }

            // Create backup automatically
            Print.out('\n⚠️  Creating automatic backup...');
            backupPath = this.createBackup(cwd, updates);
            Print.success(`Backup created at: ${backupPath}`);
            Print.info('You can restore files from this backup using: jamsedu --restore-backup <timestamp>');
            Print.info('Or manually copy files from the backup directory to restore your custom changes.');
        } else {
            // Ask for backup first (only if there are actual updates to apply)
            if (hasRegularUpdates && allUpdates.length > 0) {
                Print.out('\n⚠️  IMPORTANT: Back up your project before updating!');
                const createBackup = await this.getResponse('Create automatic backup? (y/n) [y]', 'y');
                if (['y', 'ye', 'yes'].includes(createBackup.trim().toLowerCase())) {
                    backupPath = this.createBackup(cwd, updates);
                    Print.success(`Backup created at: ${backupPath}`);
                }
            }
        }

        // Display regular updates
        if (hasRegularUpdates) {
            Print.out('\n\x1b[36mAvailable Updates:\x1b[0m\n');

            for (let i = 0; i < allUpdates.length; i++) {
                const update = allUpdates[i];
                const num = `\x1b[33m${i + 1}\x1b[0m`;

                let status = '';
                let versionInfo = '';
                if (update.modified) {
                    status = '\x1b[33m⚠️  MODIFIED\x1b[0m';
                    versionInfo = `\x1b[90m${update.userVersion || 'unknown'} → ${update.templateVersion || 'unknown'}\x1b[0m`;
                } else if (update.templateFile) {
                    status = '\x1b[32mUPDATE\x1b[0m';
                    versionInfo = `\x1b[90m${update.userVersion || 'unknown'} → ${update.templateVersion || 'unknown'}\x1b[0m`;
                } else {
                    status = '\x1b[36m[NEW]\x1b[0m';
                    versionInfo = `\x1b[90mv${update.version || '1.0.0'} - New component\x1b[0m`;
                }

                Print.out(`  ${num}. ${status} \x1b[1m${update.component}\x1b[0m`);
                Print.out(`     \x1b[90m${update.file}\x1b[0m`);
                if (versionInfo) {
                    Print.out(`     ${versionInfo}`);
                }
                Print.out('');
            }
        }

        // Handle customized files with updates (especially docs) - skip in force mode
        const customizedSelected = [];
        if (hasCustomizedUpdates && !force) {
            Print.out('\n\x1b[33m⚠️  Customized Files with Updates Available:\x1b[0m\n');
            Print.out('These files have been customized but newer versions are available.\n');

            for (let i = 0; i < updates.customizedWithUpdates.length; i++) {
                const update = updates.customizedWithUpdates[i];
                Print.out(`  ${i + 1}. \x1b[1m${update.component}\x1b[0m`);
                Print.out(`     \x1b[90m${update.file}\x1b[0m`);
                Print.out(`     \x1b[90mYour version: ${update.userVersion || 'unknown'} → Template version: ${update.templateVersion || 'unknown'}\x1b[0m`);
                Print.out('');
            }

            Print.out(
                `\n\x1b[36m${updates.customizedWithUpdates.length} customized file(s) have updates available. How should they be handled?\x1b[0m\n`
            );
            Print.out('   1) Review individually');
            Print.out('   2) Keep all customized (skip every update in this list)');
            Print.out('   3) Accept all template updates for this list (overwrite all)');
            Print.out('   4) Skip this section (do not update any of these now)');
            const bulk = await this.getResponse('   Your choice (1-4) [4]: ', '4');

            const pushAccepted = (u) => {
                customizedSelected.push({
                    ...u,
                    /** User already confirmed replacing customized content; skip applyUpdates overwrite prompt */
                    skipModifiedOverwritePrompt: true
                });
            };

            if (bulk === '3') {
                for (const update of updates.customizedWithUpdates) {
                    pushAccepted(update);
                }
            } else if (bulk === '1') {
                Print.out('\nPer-file choices:\n');
                for (let i = 0; i < updates.customizedWithUpdates.length; i++) {
                    const update = updates.customizedWithUpdates[i];
                    Print.out(`\n${i + 1}. ${update.component} (${update.file})`);
                    Print.out('   Options:');
                    Print.out('   1) Keep customized (skip update)');
                    Print.out('   2) Accept update (overwrite your changes)');
                    Print.out('   3) Skip for now');
                    const choice = await this.getResponse('   Your choice (1-3) [1]: ', '1');

                    if (choice === '2') {
                        pushAccepted(update);
                    }
                }
            }
        }

        // Only show selection prompt if there are regular updates and not in force mode
        if (hasRegularUpdates && !force) {
            Print.out('\n\x1b[36mEnter numbers separated by commas (e.g., "1,2,3" or "1-3,4,7-9"), "all" for everything:\x1b[0m');
            const input = await this.getResponse('> ', '');

            if (input.toLowerCase() === 'all') {
                for (let i = 0; i < allUpdates.length; i++) {
                    selected.add(i);
                }
            } else if (input.trim() !== '') {
                // Parse numbers and ranges
                const parts = input.split(',').map(p => p.trim());
                for (const part of parts) {
                    if (part.includes('-')) {
                        // Handle range like "1-3"
                        const [start, end] = part.split('-').map(n => parseInt(n.trim()) - 1);
                        if (!isNaN(start) && !isNaN(end) && start >= 0 && end < allUpdates.length && start <= end) {
                            for (let i = start; i <= end; i++) {
                                selected.add(i);
                            }
                        }
                    } else {
                        // Handle single number
                        const num = parseInt(part) - 1;
                        if (!isNaN(num) && num >= 0 && num < allUpdates.length) {
                            selected.add(num);
                        }
                    }
                }
            }
        }

        // Get selected updates (regular + customized)
        const selectedCoversFullList = !force && hasRegularUpdates && selected.size > 0 && selected.size === allUpdates.length;
        const selectedUpdates = [
            ...Array.from(selected).map((i) => {
                const u = allUpdates[i];
                if (selectedCoversFullList && u && u.modified) {
                    return { ...u, skipModifiedOverwritePrompt: true };
                }
                return u;
            }),
            ...customizedSelected
        ];

        // Apply updates if any were selected
        if (selectedUpdates.length > 0) {
            await this.applyUpdates(selectedUpdates, templateDir, cwd, srcDir, manifest, currentPackageVersion, backupPath, userConfig, force, { sourceRepoMode });
            Print.success('\n✅ Update complete!');
        } else {
            Print.info('\nNo updates selected.');
        }

        // Save manifest (in case userCustomized flags were updated)
        Fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    }

    static scanTemplateFiles(templateDir, userSrcDir, userConfig = {}, options = {}) {
        const files = [];
        const scanDir = (dir) => {
            if (!Fs.existsSync(dir)) return;

            const entries = Fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = Path.join(dir, entry.name);
                const relativePath = Path.relative(templateDir, fullPath).replace(/\\/g, '/');

                // Skip config files - we don't update those (config is in .jamsedu/config.js)
                if (entry.name === 'config.js' || entry.name === 'jamsedu.config.js') continue;

                if (entry.isDirectory()) {
                    scanDir(fullPath);
                } else if (entry.isFile()) {
                    if (options.sourceRepoMode && !relativePath.startsWith('src/') && !relativePath.startsWith('docs/')) {
                        continue;
                    }
                    const content = Fs.readFileSync(fullPath, 'utf-8');
                    const version = parseVersionFromFile(content);
                    
                    // ONLY track files with version tags
                    if (!version) continue;
                    
                    const component = parseComponentFromFile(content);

                    // Map template path to user path; apply assetsDir so source layout matches user choice
                    let userPath = relativePath;
                    if (relativePath.startsWith('src/')) {
                        const pathAfterSrc = relativePath.replace(/^src\//, '');
                        userPath = templateSrcPathToUserPath(userSrcDir, pathAfterSrc, userConfig);
                    }
                    userPath = userPath.replace(/\\/g, '/');

                    files.push({
                        templatePath: relativePath,
                        userPath: userPath,
                        fullTemplatePath: fullPath,
                        version: version,
                        component: component || Path.basename(relativePath, Path.extname(relativePath)),
                        content: content
                    });
                }
            }
        };

        scanDir(templateDir);
        return files;
    }

    static scanUserFiles(cwd, srcDir, manifest, userConfig = {}, options = {}) {
        const files = [];
        // Scan all directories that might contain tracked files (default layout)
        const jamseduDirs = options.sourceRepoMode ?
            [Path.join(cwd, srcDir), Path.join(cwd, 'docs')] :
            [
                Path.join(cwd, srcDir, 'js', 'jamsedu'),
                Path.join(cwd, srcDir, 'css', 'jamsedu'),
                Path.join(cwd, 'eslint'),
                Path.join(cwd, 'docs'),
                Path.join(cwd, '.vscode'),
                Path.join(cwd, srcDir, 'css') // For main.css
            ];
        // If user grouped assets under assetsDir, also scan that location under srcDir
        if (typeof userConfig.assetsDir === 'string' && userConfig.assetsDir) {
            jamseduDirs.push(Path.join(cwd, srcDir, userConfig.assetsDir));
        }

        // Also check root-level files that might be tracked (like eslint.config.js), unless source repo mode.
        if (!options.sourceRepoMode) {
            const rootFiles = ['eslint.config.js'];
            for (const rootFile of rootFiles) {
                const fullPath = Path.join(cwd, rootFile);
                if (Fs.existsSync(fullPath)) {
                    const content = Fs.readFileSync(fullPath, 'utf-8');
                    const hash = Crypto.createHash('sha256').update(normalizeContentForHash(content)).digest('hex');
                    const version = parseVersionFromFile(content);
                    const component = parseComponentFromFile(content);
                    const componentName = component || Path.basename(rootFile, Path.extname(rootFile));
                    const manifestEntry = manifest.components[componentName];
                    
                    files.push({
                        file: rootFile,
                        hash: hash,
                        version: version,
                        component: componentName,
                        manifestEntry: manifestEntry
                    });
                }
            }
        }

        for (const dir of jamseduDirs) {
            if (Fs.existsSync(dir)) {
                const scanned = this.scanDirectory(dir, cwd);
                for (const filePath of scanned) {
                    // Normalize path to relative with forward slashes
                    const normalizedPath = filePath.replace(/\\/g, '/');
                    const fullPath = Path.join(cwd, normalizedPath);
                    if (Fs.existsSync(fullPath)) {
                        const content = Fs.readFileSync(fullPath, 'utf-8');
                        const hash = Crypto.createHash('sha256').update(normalizeContentForHash(content)).digest('hex');
                        const version = parseVersionFromFile(content);
                        const component = parseComponentFromFile(content);
                        
                        // Use component name to find manifest entry
                        const componentName = component || Path.basename(normalizedPath, Path.extname(normalizedPath));
                        const manifestEntry = manifest.components[componentName];

                        files.push({
                            file: normalizedPath,
                            hash: hash,
                            version: version,
                            component: componentName,
                            manifestEntry: manifestEntry
                        });
                    }
                }
            }
        }

        return files;
    }

    static compareFiles(templateFiles, userFiles, manifest, cwd, force = false) {
        const available = [];
        const newFiles = [];
        const customizedWithUpdates = []; // For docs and other Tier 2 files

        // Helper to determine if file is Tier 1 (core framework) or Tier 2 (customizable)
        const isTier1 = (filePath) => {
            const normalized = filePath.replace(/\\/g, '/');
            return (
                normalized.includes('/js/jamsedu/')
                || normalized.includes('/css/jamsedu/')
                || normalized.includes('/css/vendor/jamsedu/')
            );
        };

        for (const templateFile of templateFiles) {
            const normalizedTemplatePath = templateFile.userPath.replace(/\\/g, '/');

            if (templateFile.binary) {
                const templateHash = sha256FileBuffer(templateFile.fullTemplatePath);
                const manifestEntry = manifest.components[templateFile.component];
                const primaryPath = Path.join(cwd, normalizedTemplatePath);
                let absUser = primaryPath;
                if (!Fs.existsSync(absUser) && manifestEntry?.file) {
                    const alt = Path.join(cwd, manifestEntry.file);
                    if (Fs.existsSync(alt)) {
                        absUser = alt;
                    }
                }
                const userExists = Fs.existsSync(absUser);
                const userHash = userExists ? sha256FileBuffer(absUser) : '';
                const manifestHash = manifestEntry?.hash;
                const userCustomized = manifestEntry?.userCustomized || false;
                const isCurrentlyCustomized = Boolean(manifestHash && userHash && userHash !== manifestHash);

                if (isCurrentlyCustomized && !userCustomized && manifestEntry) {
                    manifestEntry.userCustomized = true;
                }

                const userFile = userFiles.find((f) => {
                    const normalizedUserPath = f.file.replace(/\\/g, '/');
                    return normalizedUserPath === normalizedTemplatePath
                        || (manifestEntry?.file && normalizedUserPath === manifestEntry.file.replace(/\\/g, '/'));
                });

                if (!userExists) {
                    newFiles.push({
                        file: normalizedTemplatePath,
                        component: templateFile.component,
                        version: templateFile.version,
                        templateFile
                    });
                    continue;
                }

                if (userHash !== templateHash) {
                    const userVer = manifestEntry?.version || templateFile.version || '1.0.0';
                    const templateVer = templateFile.version || manifestEntry?.version || '1.0.0';
                    if (force || userVer !== templateVer) {
                        available.push({
                            file: normalizedTemplatePath,
                            component: templateFile.component,
                            userVersion: userVer,
                            templateVersion: templateVer,
                            modified: isCurrentlyCustomized || userCustomized,
                            templateFile,
                            userFile: userFile ? { ...userFile, hash: userHash } : {
                                file: normalizedTemplatePath,
                                hash: userHash,
                                version: manifestEntry?.version || templateFile.version
                            },
                            templateHash
                        });
                    }
                }
                continue;
            }

            const userFile = userFiles.find((f) => {
                const normalizedUserPath = f.file.replace(/\\/g, '/');
                return normalizedUserPath === normalizedTemplatePath;
            });

            if (!userFile) {
                // New file - not in user's project yet
                // But check if it actually exists in manifest (might just not be scanned)
                const manifestEntry = manifest.components[templateFile.component];
                
                // If file exists in manifest, it's not really "new" - treat as existing
                if (manifestEntry && Fs.existsSync(Path.join(cwd, manifestEntry.file))) {
                    // File exists but wasn't scanned - read it directly
                    const fullPath = Path.join(cwd, manifestEntry.file);
                    const content = Fs.readFileSync(fullPath, 'utf-8');
                    const hash = Crypto.createHash('sha256').update(normalizeContentForHash(content)).digest('hex');
                    const version = parseVersionFromFile(content) || manifestEntry.version || templateFile.version || '1.0.0';
                    
                    // Use manifest entry as userFile equivalent
                    const userVer = manifestEntry.version || version || '1.0.0';
                    const templateVer = templateFile.version || '1.0.0';
                    const templateHash = Crypto.createHash('sha256').update(normalizeContentForHash(templateFile.content)).digest('hex');
                    const userCustomized = manifestEntry.userCustomized || false;
                    const isTier1File = isTier1(normalizedTemplatePath);
                    const isDocFile = normalizedTemplatePath.startsWith('docs/');
                    
                    // With force: show if hash differs (bypass version check)
                    // Without force: only show if versions are different
                    if (force || userVer !== templateVer) {
                        const entry = {
                            file: normalizedTemplatePath,
                            component: templateFile.component,
                            userVersion: userVer,
                            templateVersion: templateVer,
                            modified: userCustomized,
                            templateFile: templateFile,
                            userFile: { file: manifestEntry.file, hash: hash, version: version },
                            templateHash: templateHash
                        };
                        if (isTier1File) {
                            available.push(entry);
                        } else if (!userCustomized || force || userVer !== templateVer) {
                            // Tier 2: show when not customized, or force, or template version newer
                            available.push(entry);
                        }
                    }
                } else {
                    // Truly new file - not in user's project yet
                    newFiles.push({
                        file: normalizedTemplatePath,
                        component: templateFile.component,
                        version: templateFile.version,
                        templateFile: templateFile
                    });
                }
            } else {
                // Existing file - check if update needed
                // Look up manifest entry by template component name (the manifest key)
                // This is more reliable than using userFile.manifestEntry which depends on component name matching
                const manifestEntry = manifest.components[templateFile.component];
                const manifestVersion = manifestEntry?.version;
                const manifestHash = manifestEntry?.hash;
                const userCustomized = manifestEntry?.userCustomized || false;
                
                // Calculate template file hash for comparison
                const templateHash = Crypto.createHash('sha256').update(normalizeContentForHash(templateFile.content)).digest('hex');
                
                // Check if user has customized the file (current hash differs from manifest hash)
                const isCurrentlyCustomized = manifestHash && userFile.hash !== manifestHash;
                
                // Auto-detect customization: if current hash differs from manifest, mark as customized
                if (isCurrentlyCustomized && !userCustomized) {
                    // Update manifest to mark as customized
                    if (manifestEntry) {
                        manifestEntry.userCustomized = true;
                    }
                }
                
                const isTier1File = isTier1(normalizedTemplatePath);
                const isDocFile = normalizedTemplatePath.startsWith('docs/');
                
                // Tier 1 files: Always update if template differs (ignore userCustomized)
                // Tier 2 files: Skip if userCustomized is true (unless it's a doc with special handling)
                if (isTier1File) {
                    // Tier 1: Always check for updates
                    if (userFile.hash !== templateHash) {
                        const userVer = manifestVersion || userFile.version || templateFile.version || '1.0.0';
                        const templateVer = templateFile.version || manifestVersion || '1.0.0';
                        // With force: show if hash differs (bypass version check)
                        // Without force: only show if versions are different
                        if (force || userVer !== templateVer) {
                            available.push({
                                file: normalizedTemplatePath,
                                component: templateFile.component,
                                userVersion: userVer,
                                templateVersion: templateVer,
                                modified: isCurrentlyCustomized,
                                templateFile: templateFile,
                                userFile: userFile,
                                templateHash: templateHash
                            });
                        }
                    }
                } else {
                    // Tier 2: Check userCustomized flag
                    // If userCustomized is true in manifest, skip for non-docs (manifest is source of truth)
                    // UNLESS force flag is set
                    if (userFile.hash !== templateHash) {
                        const userVer = manifestVersion || userFile.version || templateFile.version || '1.0.0';
                        const templateVer = templateFile.version || manifestVersion || '1.0.0';
                        
                        if (userCustomized && !force) {
                            // File is customized; still show update if template version is newer (or force)
                            if (force || userVer !== templateVer) {
                                const entry = {
                                    file: normalizedTemplatePath,
                                    component: templateFile.component,
                                    userVersion: userVer,
                                    templateVersion: templateVer,
                                    modified: true,
                                    templateFile: templateFile,
                                    userFile: userFile,
                                    templateHash: templateHash
                                };
                                if (isDocFile) {
                                    customizedWithUpdates.push(entry);
                                } else {
                                    // Tier 2 non-docs: offer when template version is newer
                                    available.push(entry);
                                }
                            }
                        } else {
                            // Not customized (or force is set), check for updates normally
                            // With force: show if hash differs (bypass version check)
                            // Without force: only show if versions are different
                            if (force || userVer !== templateVer) {
                                available.push({
                                    file: normalizedTemplatePath,
                                    component: templateFile.component,
                                    userVersion: userVer,
                                    templateVersion: templateVer,
                                    modified: isCurrentlyCustomized,
                                    templateFile: templateFile,
                                    userFile: userFile,
                                    templateHash: templateHash
                                });
                            }
                        }
                    }
                }
            }
        }

        // Safety pass: ensure every template file missing on disk is offered as new (catches new files from template)
        for (const templateFile of templateFiles) {
            if (!templateFile.component) continue;
            const normalizedUserPath = templateFile.userPath.replace(/\\/g, '/');
            const fullDest = Path.join(cwd, normalizedUserPath);
            if (Fs.existsSync(fullDest)) continue;
            const alreadyListed = available.some((a) => a.file === normalizedUserPath || a.component === templateFile.component)
                || newFiles.some((n) => n.file === normalizedUserPath || n.component === templateFile.component);
            if (!alreadyListed) {
                newFiles.push({
                    file: normalizedUserPath,
                    component: templateFile.component,
                    version: templateFile.version,
                    templateFile: templateFile
                });
            }
        }

        return { available, new: newFiles, customizedWithUpdates };
    }

    /**
     * Finds all files under rootDir with the given basename. Returns paths relative to rootDir (forward slashes).
     * @param {string} rootDir Absolute path to search under.
     * @param {string} basename Filename to match.
     * @returns {string[]} Relative paths to matching files.
     */
    static findFilesWithBasename(rootDir, basename) {
        const matches = [];
        const scan = (dir) => {
            if (!Fs.existsSync(dir)) {
                return;
            }
            const entries = Fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = Path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    scan(fullPath);
                } else if (entry.isFile() && entry.name === basename) {
                    const rel = Path.relative(rootDir, fullPath).replace(/\\/g, '/');
                    matches.push(rel);
                }
            }
        };
        scan(rootDir);
        return matches;
    }

    static correctManifest(manifest, templateFiles, cwd, srcDir, options = {}) {
        // Build a map of component name -> template file for quick lookup
        const templateMap = new Map();
        for (const templateFile of templateFiles) {
            if (templateFile.component) {
                templateMap.set(templateFile.component, templateFile);
            }
        }

        // Track which components we've seen (to identify stale entries)
        const seenComponents = new Set();
        /** Files no longer in template; we removed from manifest; prompt user to delete from project or do it themselves */
        const removedFromTemplate = [];

        // First pass: validate existing entries and mark as seen
        for (const [componentName, entry] of Object.entries(manifest.components)) {
            if (!entry || typeof entry !== 'object') {
                // Invalid entry, will be removed
                continue;
            }

            let filePath = entry.file;
            if (!filePath) {
                // Entry has no file path, remove it
                delete manifest.components[componentName];
                continue;
            }

            let fullPath = Path.join(cwd, filePath);
            const templateFile = templateMap.get(componentName);

            // Component no longer in template: remove from manifest and optionally offer to delete file
            if (!templateFile) {
                if (options.sourceRepoMode && !this.isAllowedSourceRepoUpdatePath(filePath, srcDir)) {
                    seenComponents.add(componentName);
                    continue;
                }
                if (Fs.existsSync(fullPath)) {
                    removedFromTemplate.push({ componentName, filePath });
                }
                delete manifest.components[componentName];
                continue;
            }

            // File missing at recorded path: try to self-heal by finding same basename under srcDir
            if (!Fs.existsSync(fullPath)) {
                const srcRoot = Path.join(cwd, srcDir);
                const found = this.findFilesWithBasename(srcRoot, Path.basename(filePath));
                if (found.length === 1) {
                    entry.file = Path.relative(cwd, Path.join(srcRoot, found[0])).replace(/\\/g, '/');
                    fullPath = Path.join(cwd, entry.file);
                } else {
                    // Keep the entry so it can be restored during update
                    manifest.components[componentName] = {
                        ...entry,
                        version: templateFile.version || entry.version || '1.0.0',
                        hash: entry.hash || '',
                        modified: false,
                        userCustomized: false
                    };
                    seenComponents.add(componentName);
                    continue;
                }
            }

            // Check if component name matches template file's component name
            // (in case component name in file changed)
            if (templateFile) {
                // Verify the component name matches what's in the actual file
                try {
                    if (templateFile.binary) {
                        const prevHash = typeof entry.hash === 'string' && entry.hash.length > 0 ? entry.hash : '';
                        let fileHash = '';
                        try {
                            fileHash = sha256FileBuffer(fullPath);
                        } catch {
                            // leave empty when unreadable
                        }
                        if (prevHash && fileHash !== prevHash) {
                            entry.userCustomized = true;
                        }
                        entry.hash = fileHash;
                        if (!entry.version || entry.version === 'unknown') {
                            entry.version = templateFile.version || '1.0.0';
                        }
                        seenComponents.add(componentName);
                        continue;
                    }

                    const content = Fs.readFileSync(fullPath, 'utf-8');
                    const actualComponent = parseComponentFromFile(content);
                    const fileVersion = parseVersionFromFile(content);
                    const fileHash = Crypto.createHash('sha256').update(normalizeContentForHash(content)).digest('hex');
                    const prevHash = typeof entry.hash === 'string' && entry.hash.length > 0 ? entry.hash : '';

                    if (actualComponent && actualComponent !== componentName) {
                        // Component name changed - update the manifest entry key
                        manifest.components[actualComponent] = {
                            ...entry,
                            version: fileVersion || entry.version || templateFile.version || '1.0.0',
                            hash: fileHash
                        };
                        delete manifest.components[componentName];
                        seenComponents.add(actualComponent);
                        continue;
                    }
                    
                    // Update version if missing or unknown, and check if user customized
                    if (fileVersion && (!entry.version || entry.version === 'unknown')) {
                        entry.version = fileVersion;
                    } else if (!entry.version || entry.version === 'unknown') {
                        entry.version = templateFile.version || '1.0.0';
                    }
                    if (prevHash && fileHash !== prevHash) {
                        entry.userCustomized = true;
                    }
                    entry.hash = fileHash;
                } catch (err) {
                    // File read error, skip validation
                }
            }

            seenComponents.add(componentName);
        }

        // Second pass: add missing entries for template files that exist but aren't in manifest
        for (const templateFile of templateFiles) {
            if (!templateFile.component) continue;

            // Skip if we already have this component
            if (seenComponents.has(templateFile.component)) continue;

            const userFilePath = templateFile.userPath;

            const fullUserPath = Path.join(cwd, userFilePath);

            // Add entry whether file exists or not - if it doesn't exist, it will be restored during update
            try {
                let hash = '';
                let version = templateFile.version || '1.0.0';

                if (templateFile.binary) {
                    if (Fs.existsSync(fullUserPath)) {
                        hash = sha256FileBuffer(fullUserPath);
                        version = templateFile.version || '1.0.0';
                        manifest.components[templateFile.component] = {
                            file: userFilePath.replace(/\\/g, '/'),
                            version,
                            hash,
                            modified: false,
                            userCustomized: false
                        };
                    } else {
                        manifest.components[templateFile.component] = {
                            file: userFilePath.replace(/\\/g, '/'),
                            version: templateFile.version || '1.0.0',
                            hash,
                            modified: false,
                            userCustomized: false
                        };
                    }
                } else if (Fs.existsSync(fullUserPath)) {
                    // File exists, read it to get current hash and version
                    const content = Fs.readFileSync(fullUserPath, 'utf-8');
                    hash = Crypto.createHash('sha256').update(normalizeContentForHash(content)).digest('hex');
                    version = parseVersionFromFile(content) || templateFile.version || '1.0.0';

                    manifest.components[templateFile.component] = {
                        file: userFilePath.replace(/\\/g, '/'),
                        version: version,
                        hash: hash,
                        modified: false,
                        userCustomized: false
                    };
                } else {
                    // If file doesn't exist, hash will be empty and it will be treated as needing update
                    manifest.components[templateFile.component] = {
                        file: userFilePath.replace(/\\/g, '/'),
                        version: templateFile.version || '1.0.0',
                        hash: hash,
                        modified: false,
                        userCustomized: false
                    };
                }
            } catch (err) {
                // File read error, skip adding
            }
        }

        return removedFromTemplate;
    }

    static parseSelection(selection, updates) {
        const selected = [];
        const all = selection.trim().toLowerCase() === 'all';

        if (all) {
            return [...updates.available, ...updates.new];
        }

        const parts = selection.split(',').map(s => s.trim());
        for (const part of parts) {
            const update = [...updates.available, ...updates.new].find(u => 
                u.component === part || u.file.includes(part)
            );
            if (update) {
                selected.push(update);
            }
        }

        return selected;
    }

    static async applyUpdates(selectedUpdates, templateDir, cwd, srcDir, manifest, packageVersion, initialBackupPath = null, userConfig = {}, force = false, options = {}) {
        let backupPath = initialBackupPath;

        // When using assets layout, move old css/js/images into assets/ first so user content is kept; then overwrites below apply fresh template
        const assetsDir = typeof userConfig.assetsDir === 'string' ? userConfig.assetsDir : '';
        if (assetsDir) {
            this.removeOldAssetDirsUnderSrc(cwd, srcDir, assetsDir);
        }

        for (const update of selectedUpdates) {
            // Ensure update.file is relative (not absolute)
            let filePath = update.file;
            if (Path.isAbsolute(filePath)) {
                // If absolute, make it relative to cwd
                filePath = Path.relative(cwd, filePath);
            }
            // Normalize to forward slashes for consistency
            filePath = filePath.replace(/\\/g, '/');
            if (options.sourceRepoMode && !this.isAllowedSourceRepoUpdatePath(filePath, srcDir)) {
                Print.warn(`Skipping non-srcDir file in source repo mode: ${filePath}`);
                continue;
            }
            
            const destPath = Path.resolve(cwd, filePath);
            const templatePath = update.templateFile?.fullTemplatePath || 
                Path.join(templateDir, update.templateFile?.templatePath || filePath);

            // In force mode skip the overwrite prompt; otherwise prompt for modified files.
            // Customized docs: user already chose "Accept update" (or bulk accept); do not prompt again.
            if (!force && update.modified && Fs.existsSync(destPath) && !update.skipModifiedOverwritePrompt && !initialBackupPath) {
                Print.warn(`\n⚠️  File has been modified: ${update.file}`);
                const overwriteLabel = backupPath ? '1) Overwrite (backup made)' : '1) Overwrite';
                const backupOption = backupPath ? '' : '  3) Backup & overwrite';
                const choice = await this.getResponse(
                    `${overwriteLabel}  2) Skip${backupOption} [1]: `,
                    '1'
                );

                if (choice === '2' || choice.toLowerCase() === 'skip') {
                    Print.info(`Skipping ${update.file}`);
                    continue;
                }
                if (!backupPath && (choice === '3' || choice.toLowerCase().includes('backup'))) {
                    backupPath = this.ensureBackupAndAddFile(cwd, backupPath, filePath);
                    if (backupPath) {
                        Print.info(`Backed up to same session: ${update.file}`);
                    }
                }
            }

            // Ensure directory exists
            const destDir = Path.dirname(destPath);
            if (!Fs.existsSync(destDir)) {
                Fs.mkdirSync(destDir, { recursive: true });
            }

            if (update.templateFile?.binary) {
                Fs.copyFileSync(templatePath, destPath);
                Print.success(`Updated ${update.file}`);
                const hash = sha256FileBuffer(destPath);
                manifest.components[update.component] = {
                    file: filePath,
                    version: packageVersion,
                    hash,
                    modified: false,
                    userCustomized: false
                };
                continue;
            }

            // Read template file, strip version tags, then write to destination
            const templateContent = Fs.readFileSync(templatePath, 'utf-8');
            const cleanedContent = stripJamseduComments(templateContent);
            Fs.writeFileSync(destPath, cleanedContent, 'utf-8');
            Print.success(`Updated ${update.file}`);

            // Update manifest with new file content
            const content = Fs.readFileSync(destPath, 'utf-8');
            const hash = Crypto.createHash('sha256').update(normalizeContentForHash(content)).digest('hex');
            const updatedVersion = parseVersionFromFile(content) || update.templateVersion || update.version;
            
            manifest.components[update.component] = {
                file: filePath, // Use normalized filePath (relative with forward slashes)
                version: updatedVersion,
                hash: hash,
                modified: false,
                userCustomized: false // Reset to false since we just updated from template
            };
        }

        syncStarterAssetUrlPrefixes(cwd, srcDir, assetsDir);

        // Update manifest metadata
        manifest.jamseduPackageVersion = packageVersion;
        manifest.templateVersion = packageVersion;
        manifest.lastUpdated = new Date().toISOString();
        manifest.srcDir = srcDir;

        // Save manifest
        const manifestPath = Path.join(cwd, '.jamsedu', 'manifest.json');
        Fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
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
            // Ignore if not empty
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

    static createBackup(cwd, updates) {
        const backupDir = Path.join(cwd, '.jamsedu', 'backups');
        if (!Fs.existsSync(backupDir)) {
            Fs.mkdirSync(backupDir, { recursive: true });
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const backupPath = Path.join(backupDir, timestamp);
        Fs.mkdirSync(backupPath, { recursive: true });

        // Backup files that will be updated
        for (const update of [...updates.available, ...updates.new]) {
            const sourcePath = Path.join(cwd, update.file);
            if (Fs.existsSync(sourcePath)) {
                const destPath = Path.join(backupPath, update.file);
                const destDir = Path.dirname(destPath);
                if (!Fs.existsSync(destDir)) {
                    Fs.mkdirSync(destDir, { recursive: true });
                }
                Fs.copyFileSync(sourcePath, destPath);
            }
        }

        return backupPath;
    }

    /**
     * Ensure a backup dir exists for this run; add the given file to it. Uses existing path if provided.
     * @param {string} cwd - Project root.
     * @param {string|null} existingBackupPath - Path to existing backup dir from start of run, or null.
     * @param {string} relativeFilePath - File path relative to cwd to copy into backup.
     * @returns {string|null} Backup dir path (existing or newly created).
     */
    static ensureBackupAndAddFile(cwd, existingBackupPath, relativeFilePath) {
        const backupDir = Path.join(cwd, '.jamsedu', 'backups');
        if (!Fs.existsSync(backupDir)) {
            Fs.mkdirSync(backupDir, { recursive: true });
        }
        let backupPath = existingBackupPath;
        if (!backupPath) {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            backupPath = Path.join(backupDir, timestamp);
            Fs.mkdirSync(backupPath, { recursive: true });
        }
        const sourcePath = Path.join(cwd, relativeFilePath);
        if (Fs.existsSync(sourcePath)) {
            const destPath = Path.join(backupPath, relativeFilePath);
            const destDir = Path.dirname(destPath);
            if (!Fs.existsSync(destDir)) {
                Fs.mkdirSync(destDir, { recursive: true });
            }
            Fs.copyFileSync(sourcePath, destPath);
        }
        return backupPath;
    }

    static async restoreBackup(cwd, timestamp) {
        const backupPath = Path.join(cwd, '.jamsedu', 'backups', timestamp);
        if (!Fs.existsSync(backupPath)) {
            Print.error(`Backup not found: ${timestamp}`);
            return;
        }

        Print.warn(`This will restore files from backup: ${timestamp}`);
        const confirm = await this.getResponse('Are you sure? (yes/no) [no]', 'no');
        if (confirm.toLowerCase() !== 'yes') {
            Print.info('Restore cancelled.');
            return;
        }

        // Restore files
        const restoreDir = (dir, basePath = '') => {
            const entries = Fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = Path.join(dir, entry.name);
                const relativePath = Path.relative(backupPath, fullPath).replace(/\\/g, '/');

                if (entry.isDirectory()) {
                    restoreDir(fullPath, relativePath);
                } else if (entry.isFile()) {
                    const destPath = Path.join(cwd, relativePath);
                    const destDir = Path.dirname(destPath);
                    if (!Fs.existsSync(destDir)) {
                        Fs.mkdirSync(destDir, { recursive: true });
                    }
                    Fs.copyFileSync(fullPath, destPath);
                    Print.success(`Restored ${relativePath}`);
                }
            }
        };

        restoreDir(backupPath);
        Print.success('Backup restored successfully!');
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

    static async getResponse(question, defaultValue = null) {
        Print.out(question);
        const response = await promptLine('> ');
        return response.trim() === '' && defaultValue !== null ? defaultValue : response.trim();
    }


}

export default Updater;

