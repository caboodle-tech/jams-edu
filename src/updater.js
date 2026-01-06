/* eslint-disable max-len */
import Crypto from 'crypto';
import Fs from 'fs';
import Path from 'path';
import Print from './imports/print.js';
import PromptUser from 'prompt-sync';
import URL from 'url';

// Get an instance of the Prompt to simplify user input.
const Prompt = PromptUser({ sigint: true });

class Updater {

    static #header = `
==============================================
      JamsEdu Update Utility
==============================================
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

    static async update(cwd, jamseduWd, userConfig, force = false) {
        this.clearScreen();
        Print.notice(this.#header);

        // Read user's config to get srcDir (normalize to relative path)
        let srcDir = userConfig.srcDir || 'src';
        // Normalize srcDir to relative path for comparison
        if (Path.isAbsolute(srcDir)) {
            srcDir = Path.relative(cwd, srcDir).replace(/\\/g, '/');
        } else {
            srcDir = srcDir.replace(/\\/g, '/');
        }

        // Read manifest (declare once at top of function)
        const manifestPath = Path.join(cwd, '.jamsedu', 'manifest.json');
        if (!Fs.existsSync(manifestPath)) {
            Print.error('Manifest file not found. This project may not have been initialized with JamsEdu.');
            Print.info('Run `jamsedu --init` to initialize your project first.');
            return;
        }

        const manifest = JSON.parse(Fs.readFileSync(manifestPath, 'utf-8'));

        // Read package version from installed JamsEdu
        const packageJsonPath = Path.join(jamseduWd, 'package.json');
        const packageJson = JSON.parse(Fs.readFileSync(packageJsonPath, 'utf-8'));
        const currentPackageVersion = packageJson.version;

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

        const templateFiles = this.scanTemplateFiles(templateDir, srcDir);
        
        // Clean up and correct manifest (remove stale entries, add missing entries, fix component names)
        // This runs before scanning user files so we have a clean manifest to work with
        this.correctManifest(manifest, templateFiles, cwd, srcDir);
        
        // Save corrected manifest immediately
        Fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
        
        const userFiles = this.scanUserFiles(cwd, srcDir, manifest);

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
            // Save manifest if we updated userCustomized flags
            Fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
            return;
        }

        // Show available updates with interactive checklist
        const allUpdates = [...updates.available, ...updates.new];
        const selected = new Set();

        // Force mode: auto-select all and warn user
        if (force) {
            Print.out('\n⚠️  WARNING: Force mode enabled!');
            Print.out('This will overwrite ALL files, including your customizations.');
            Print.out('All files with hash differences will be updated, regardless of version.');
            Print.out('');
            Print.out('A backup will be automatically created before updating.');
            Print.out('You can restore or copy back any custom changes you want to keep from the backup.');
            Print.out('');
            const confirm = this.getResponse('Are you sure you want to continue? (yes/no) [no]', 'no');
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
            const backupPath = this.createBackup(cwd, updates);
            Print.success(`Backup created at: ${backupPath}`);
            Print.info('You can restore files from this backup using: jamsedu --restore-backup <timestamp>');
            Print.info('Or manually copy files from the backup directory to restore your custom changes.');
        } else {
            // Ask for backup first (only if there are actual updates to apply)
            if (hasRegularUpdates && allUpdates.length > 0) {
                Print.out('\n⚠️  IMPORTANT: Back up your project before updating!');
                const createBackup = this.getResponse('Create automatic backup? (y/n) [y]', 'y');
                let backupPath = null;
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
        let customizedSelected = [];
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
            
            Print.out('\x1b[36mShow customized files with updates? (y/N)\x1b[0m');
            const showCustomized = this.getResponse('> ', 'n');
            
            if (showCustomized.toLowerCase() === 'y') {
                Print.out('\nWhat would you like to do with each customized file?\n');
                for (let i = 0; i < updates.customizedWithUpdates.length; i++) {
                    const update = updates.customizedWithUpdates[i];
                    Print.out(`\n${i + 1}. ${update.component} (${update.file})`);
                    Print.out('   Options:');
                    Print.out('   1) Keep customized (skip update)');
                    Print.out('   2) Accept update (overwrite your changes)');
                    Print.out('   3) Skip for now');
                    const choice = this.getResponse('   Your choice (1-3) [1]: ', '1');
                    
                    if (choice === '2') {
                        customizedSelected.push(update);
                    }
                }
            }
        }

        // Only show selection prompt if there are regular updates and not in force mode
        if (hasRegularUpdates && !force) {
            Print.out('\n\x1b[36mEnter numbers separated by commas (e.g., "1,2,3" or "1-3,4,7-9"), "all" for everything:\x1b[0m');
            const input = this.getResponse('> ', '');
            
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
        const selectedUpdates = [
            ...Array.from(selected).map(i => allUpdates[i]),
            ...customizedSelected
        ];

        // Apply updates if any were selected
        if (selectedUpdates.length > 0) {
            this.applyUpdates(selectedUpdates, templateDir, cwd, srcDir, manifest, currentPackageVersion);
            Print.success('\n✅ Update complete!');
        } else {
            Print.info('\nNo updates selected.');
        }
        
        // Save manifest (in case userCustomized flags were updated)
        Fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    }

    static scanTemplateFiles(templateDir, userSrcDir) {
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
                    const content = Fs.readFileSync(fullPath, 'utf-8');
                    const version = this.parseVersionFromFile(content);
                    
                    // ONLY track files with version tags
                    if (!version) continue;
                    
                    const component = this.parseComponentFromFile(content);

                    // Map template path to user path (normalize to relative with forward slashes)
                    let userPath = relativePath;
                    if (relativePath.startsWith('src/')) {
                        userPath = relativePath.replace(/^src\//, `${userSrcDir}/`);
                    }
                    // Normalize path separators
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

    static scanUserFiles(cwd, srcDir, manifest) {
        const files = [];
        // Scan all directories that might contain tracked files
        const jamseduDirs = [
            Path.join(cwd, srcDir, 'js', 'jamsedu'),
            Path.join(cwd, srcDir, 'css', 'jamsedu'),
            Path.join(cwd, 'eslint'),
            Path.join(cwd, 'docs'),
            Path.join(cwd, '.vscode'),
            Path.join(cwd, srcDir, 'css') // For main.css
        ];
        
        // Also check root-level files that might be tracked (like eslint.config.js)
        const rootFiles = ['eslint.config.js'];
        for (const rootFile of rootFiles) {
            const fullPath = Path.join(cwd, rootFile);
            if (Fs.existsSync(fullPath)) {
                const content = Fs.readFileSync(fullPath, 'utf-8');
                const hash = Crypto.createHash('sha256').update(content).digest('hex');
                const version = this.parseVersionFromFile(content);
                const component = this.parseComponentFromFile(content);
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

        for (const dir of jamseduDirs) {
            if (Fs.existsSync(dir)) {
                const scanned = this.scanDirectory(dir, cwd);
                for (const filePath of scanned) {
                    // Normalize path to relative with forward slashes
                    const normalizedPath = filePath.replace(/\\/g, '/');
                    const fullPath = Path.join(cwd, normalizedPath);
                    if (Fs.existsSync(fullPath)) {
                        const content = Fs.readFileSync(fullPath, 'utf-8');
                        const hash = Crypto.createHash('sha256').update(content).digest('hex');
                        const version = this.parseVersionFromFile(content);
                        const component = this.parseComponentFromFile(content);
                        
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
            return normalized.includes('/js/jamsedu/') || normalized.includes('/css/jamsedu/');
        };

        for (const templateFile of templateFiles) {
            // Normalize paths for comparison
            const normalizedTemplatePath = templateFile.userPath.replace(/\\/g, '/');
            const userFile = userFiles.find(f => {
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
                    const hash = Crypto.createHash('sha256').update(content).digest('hex');
                    const version = this.parseVersionFromFile(content) || manifestEntry.version || templateFile.version || '1.0.0';
                    
                    // Use manifest entry as userFile equivalent
                    const userVer = manifestEntry.version || version || '1.0.0';
                    const templateVer = templateFile.version || '1.0.0';
                    const templateHash = Crypto.createHash('sha256').update(templateFile.content).digest('hex');
                    const userCustomized = manifestEntry.userCustomized || false;
                    const isTier1File = isTier1(normalizedTemplatePath);
                    const isDocFile = normalizedTemplatePath.startsWith('docs/');
                    
                    // With force: show if hash differs (bypass version check)
                    // Without force: only show if versions are different
                    if (force || userVer !== templateVer) {
                        if (isTier1File) {
                            available.push({
                                file: normalizedTemplatePath,
                                component: templateFile.component,
                                userVersion: userVer,
                                templateVersion: templateVer,
                                modified: userCustomized,
                                templateFile: templateFile,
                                userFile: { file: manifestEntry.file, hash: hash, version: version },
                                templateHash: templateHash
                            });
                        } else {
                            // Tier 2: With force, bypass userCustomized check
                            if (userCustomized && !force) {
                                // Skip customized non-docs (unless force)
                            } else {
                                available.push({
                                    file: normalizedTemplatePath,
                                    component: templateFile.component,
                                    userVersion: userVer,
                                    templateVersion: templateVer,
                                    modified: userCustomized,
                                    templateFile: templateFile,
                                    userFile: { file: manifestEntry.file, hash: hash, version: version },
                                    templateHash: templateHash
                                });
                            }
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
                const templateHash = Crypto.createHash('sha256').update(templateFile.content).digest('hex');
                
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
                            // File is customized, but check if template has updates
                            // VITAL for docs: Show update even if customized
                            if (isDocFile) {
                                // Only show update if versions are different (unless force)
                                if (force || userVer !== templateVer) {
                                    customizedWithUpdates.push({
                                        file: normalizedTemplatePath,
                                        component: templateFile.component,
                                        userVersion: userVer,
                                        templateVersion: templateVer,
                                        modified: true,
                                        templateFile: templateFile,
                                        userFile: userFile,
                                        templateHash: templateHash
                                    });
                                }
                            }
                            // For non-docs, skip silently (user customized it, unless force)
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

        return { available, new: newFiles, customizedWithUpdates };
    }

    static correctManifest(manifest, templateFiles, cwd, srcDir) {
        // Build a map of component name -> template file for quick lookup
        const templateMap = new Map();
        for (const templateFile of templateFiles) {
            if (templateFile.component) {
                templateMap.set(templateFile.component, templateFile);
            }
        }

        // Track which components we've seen (to identify stale entries)
        const seenComponents = new Set();

        // First pass: validate existing entries and mark as seen
        for (const [componentName, entry] of Object.entries(manifest.components)) {
            if (!entry || typeof entry !== 'object') {
                // Invalid entry, will be removed
                continue;
            }

            const filePath = entry.file;
            if (!filePath) {
                // Entry has no file path, remove it
                delete manifest.components[componentName];
                continue;
            }

            const fullPath = Path.join(cwd, filePath);
            const templateFile = templateMap.get(componentName);

            // Check if file exists
            if (!Fs.existsSync(fullPath)) {
                // File doesn't exist - but if there's a template file for it, keep the entry
                // so it can be restored during update. Only remove if it's truly stale.
                if (!templateFile) {
                    // No template file exists, this is a stale entry - remove it
                    delete manifest.components[componentName];
                    continue;
                }
                // Template file exists, keep the entry but update it with template info
                // so it can be restored
                manifest.components[componentName] = {
                    ...entry,
                    version: templateFile.version || entry.version || '1.0.0',
                    // Keep existing hash if present, will be updated when file is restored
                    hash: entry.hash || '',
                    modified: false,
                    userCustomized: false
                };
                seenComponents.add(componentName);
                continue;
            }

            // Check if component name matches template file's component name
            // (in case component name in file changed)
            if (templateFile) {
                // Verify the component name matches what's in the actual file
                try {
                    const content = Fs.readFileSync(fullPath, 'utf-8');
                    const actualComponent = this.parseComponentFromFile(content);
                    const fileVersion = this.parseVersionFromFile(content);
                    const fileHash = Crypto.createHash('sha256').update(content).digest('hex');
                    const templateHash = Crypto.createHash('sha256').update(templateFile.content).digest('hex');
                    
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
                    if (fileHash !== templateHash) {
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
                
                if (Fs.existsSync(fullUserPath)) {
                    // File exists, read it to get current hash and version
                    const content = Fs.readFileSync(fullUserPath, 'utf-8');
                    hash = Crypto.createHash('sha256').update(content).digest('hex');
                    version = this.parseVersionFromFile(content) || templateFile.version || '1.0.0';
                    
                    // Check if user customized (hash differs from template)
                    const templateHash = Crypto.createHash('sha256').update(templateFile.content).digest('hex');
                    const isCustomized = hash !== templateHash;
                    
                    manifest.components[templateFile.component] = {
                        file: userFilePath.replace(/\\/g, '/'),
                        version: version,
                        hash: hash,
                        modified: false,
                        userCustomized: isCustomized
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

    static applyUpdates(selectedUpdates, templateDir, cwd, srcDir, manifest, packageVersion) {
        for (const update of selectedUpdates) {
            // Ensure update.file is relative (not absolute)
            let filePath = update.file;
            if (Path.isAbsolute(filePath)) {
                // If absolute, make it relative to cwd
                filePath = Path.relative(cwd, filePath);
            }
            // Normalize to forward slashes for consistency
            filePath = filePath.replace(/\\/g, '/');
            
            const destPath = Path.resolve(cwd, filePath);
            const templatePath = update.templateFile?.fullTemplatePath || 
                Path.join(templateDir, update.templateFile?.templatePath || filePath);

            // Handle conflicts for modified files
            if (update.modified && Fs.existsSync(destPath)) {
                Print.warn(`\n⚠️  File has been modified: ${update.file}`);
                const choice = this.getResponse(
                    'What would you like to do?\n1) Overwrite\n2) Skip\n3) Backup & overwrite\n> ',
                    '3'
                );

                if (choice === '2' || choice.toLowerCase() === 'skip') {
                    Print.info(`Skipping ${update.file}`);
                    continue;
                }

                if (choice === '3' || choice.toLowerCase().includes('backup')) {
                    // Backup is already created, just overwrite
                }
            }

            // Ensure directory exists
            const destDir = Path.dirname(destPath);
            if (!Fs.existsSync(destDir)) {
                Fs.mkdirSync(destDir, { recursive: true });
            }

            // Read template file, strip version tags, then write to destination
            const templateContent = Fs.readFileSync(templatePath, 'utf-8');
            const cleanedContent = this.stripVersionTags(templateContent);
            Fs.writeFileSync(destPath, cleanedContent, 'utf-8');
            Print.success(`Updated ${update.file}`);

            // Update manifest with new file content
            const content = Fs.readFileSync(destPath, 'utf-8');
            const hash = Crypto.createHash('sha256').update(content).digest('hex');
            const updatedVersion = this.parseVersionFromFile(content) || update.templateVersion || update.version;
            
            manifest.components[update.component] = {
                file: filePath, // Use normalized filePath (relative with forward slashes)
                version: updatedVersion,
                hash: hash,
                modified: false,
                userCustomized: false // Reset to false since we just updated from template
            };
        }

        // Update manifest metadata
        manifest.jamseduPackageVersion = packageVersion;
        manifest.templateVersion = packageVersion;
        manifest.lastUpdated = new Date().toISOString();
        manifest.srcDir = srcDir;

        // Save manifest
        const manifestPath = Path.join(cwd, '.jamsedu', 'manifest.json');
        Fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
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

    static restoreBackup(cwd, timestamp) {
        const backupPath = Path.join(cwd, '.jamsedu', 'backups', timestamp);
        if (!Fs.existsSync(backupPath)) {
            Print.error(`Backup not found: ${timestamp}`);
            return;
        }

        Print.warn(`This will restore files from backup: ${timestamp}`);
        const confirm = this.getResponse('Are you sure? (yes/no) [no]', 'no');
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

    static stripVersionTags(content) {
        // Remove JavaScript comment format: // @jamsedu-version: 1.0.0
        content = content.replace(/\/\/\s*@jamsedu-version:\s*[\d.]+\s*\n?/g, '');
        // Remove JavaScript comment format: // @jamsedu-component: name
        content = content.replace(/\/\/\s*@jamsedu-component:\s*\S+\s*\n?/g, '');
        // Remove CSS comment format: /* @jamsedu-version: 1.0.0 */
        content = content.replace(/\/\*\s*@jamsedu-version:\s*[\d.]+\s*\*\//g, '');
        // Remove CSS comment format: /* @jamsedu-component: name */
        content = content.replace(/\/\*\s*@jamsedu-component:\s*\S+\s*\*\//g, '');
        // Remove HTML comment format (for markdown): <!-- @jamsedu-version: 1.0.0 -->
        content = content.replace(/<!--\s*@jamsedu-version:\s*[\d.]+\s*-->\s*\n?/g, '');
        // Remove HTML comment format: <!-- @jamsedu-component: name -->
        content = content.replace(/<!--\s*@jamsedu-component:\s*\S+\s*-->\s*\n?/g, '');
        return content;
    }

    static parseVersionFromFile(content) {
        // JavaScript comment format: // @jamsedu-version: 1.0.0
        const jsMatch = content.match(/\/\/\s*@jamsedu-version:\s*([\d.]+)/);
        if (jsMatch) {
            return jsMatch[1];
        }
        // CSS comment format: /* @jamsedu-version: 1.0.0 */
        const cssMatch = content.match(/\/\*\s*@jamsedu-version:\s*([\d.]+)\s*\*\//);
        if (cssMatch) {
            return cssMatch[1];
        }
        // HTML comment format (for markdown): <!-- @jamsedu-version: 1.0.0 -->
        const htmlMatch = content.match(/<!--\s*@jamsedu-version:\s*([\d.]+)\s*-->/);
        if (htmlMatch) {
            return htmlMatch[1];
        }
        return null;
    }

    static parseComponentFromFile(content) {
        // JavaScript comment format: // @jamsedu-component: component-name
        const jsMatch = content.match(/\/\/\s*@jamsedu-component:\s*(\S+)/);
        if (jsMatch) {
            return jsMatch[1];
        }
        // CSS comment format: /* @jamsedu-component: component-name */
        const cssMatch = content.match(/\/\*\s*@jamsedu-component:\s*(\S+)\s*\*\//);
        if (cssMatch) {
            return cssMatch[1];
        }
        // HTML comment format (for markdown): <!-- @jamsedu-component: component-name -->
        const htmlMatch = content.match(/<!--\s*@jamsedu-component:\s*(\S+)\s*-->/);
        if (htmlMatch) {
            return htmlMatch[1];
        }
        return null;
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

    static getResponse(question, defaultValue = null) {
        Print.out(question);
        const response = Prompt('> ');
        return response.trim() === '' && defaultValue !== null ? defaultValue : response.trim();
    }


}

export default Updater;

