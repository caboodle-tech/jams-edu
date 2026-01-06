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

    static async update(cwd, jamseduWd, userConfig) {
        this.clearScreen();
        Print.notice(this.#header);

        // Read user's config to get srcDir
        const srcDir = userConfig.srcDir || 'src';

        // Read manifest
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

        // Update manifest srcDir if it changed
        if (manifest.srcDir !== srcDir) {
            manifest.srcDir = srcDir;
            Print.info(`Updated manifest srcDir: ${manifest.srcDir} → ${srcDir}`);
        }

        // Scan template files from installed package
        const templateDir = Path.join(jamseduWd, 'src', 'template');
        if (!Fs.existsSync(templateDir)) {
            Print.error(`Template directory not found at: ${templateDir}`);
            Print.error('JamsEdu installation appears to be corrupted.');
            return;
        }

        const templateFiles = this.scanTemplateFiles(templateDir, srcDir);
        const userFiles = this.scanUserFiles(cwd, srcDir, manifest);

        // Compare files
        const updates = this.compareFiles(templateFiles, userFiles, manifest, cwd);

        // Check if package was updated
        if (manifest.jamseduPackageVersion !== currentPackageVersion) {
            Print.info(`JamsEdu package updated: ${manifest.jamseduPackageVersion} → ${currentPackageVersion}`);
        }

        // Check if there are any updates available
        if (updates.available.length === 0 && updates.new.length === 0) {
            Print.success('\n✅ All files are up to date!');
            if (manifest.jamseduPackageVersion === currentPackageVersion) {
                Print.info(`JamsEdu package version: ${currentPackageVersion}`);
            }
            return;
        }

        // Show available updates with interactive checklist
        const allUpdates = [...updates.available, ...updates.new];
        const selected = new Set();

        // Ask for backup first
        Print.out('\n⚠️  IMPORTANT: Back up your project before updating!');
        const createBackup = this.getResponse('Create automatic backup? (y/n) [y]', 'y');
        let backupPath = null;
        if (['y', 'ye', 'yes'].includes(createBackup.trim().toLowerCase())) {
            backupPath = this.createBackup(cwd, updates);
            Print.success(`Backup created at: ${backupPath}`);
        }

        // Display checklist with numbers
        Print.out('\n\x1b[36mAvailable Updates:\x1b[0m\n');

        for (let i = 0; i < allUpdates.length; i++) {
            const update = allUpdates[i];
            const num = `\x1b[33m${i + 1}\x1b[0m`;
            
            let status = '';
            let versionInfo = '';
            if (update.modified) {
                status = '\x1b[33m⚠️  MODIFIED\x1b[0m';
                versionInfo = `\x1b[90m${update.userVersion} → ${update.templateVersion}\x1b[0m`;
            } else if (update.templateFile) {
                status = '\x1b[32mUPDATE\x1b[0m';
                versionInfo = `\x1b[90m${update.userVersion} → ${update.templateVersion}\x1b[0m`;
            } else {
                status = '\x1b[36m[NEW]\x1b[0m';
                versionInfo = `\x1b[90mv${update.version} - New component\x1b[0m`;
            }

            Print.out(`  ${num}. ${status} \x1b[1m${update.component}\x1b[0m`);
            Print.out(`     \x1b[90m${update.file}\x1b[0m`);
            if (versionInfo) {
                Print.out(`     ${versionInfo}`);
            }
            Print.out('');
        }

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


        // Get selected updates
        const selectedUpdates = Array.from(selected).map(i => allUpdates[i]);

        // Apply updates
        this.applyUpdates(selectedUpdates, templateDir, cwd, srcDir, manifest, currentPackageVersion);

        Print.success('\n✅ Update complete!');
        if (backupPath) {
            Print.info(`Backup available at: ${backupPath}`);
        }
    }

    static scanTemplateFiles(templateDir, userSrcDir) {
        const files = [];
        const scanDir = (dir, basePath = '') => {
            if (!Fs.existsSync(dir)) return;

            const entries = Fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = Path.join(dir, entry.name);
                const relativePath = Path.relative(templateDir, fullPath).replace(/\\/g, '/');

                // Skip jamsedu.config.js - we don't update that
                if (entry.name === 'jamsedu.config.js') continue;

                if (entry.isDirectory()) {
                    scanDir(fullPath, relativePath);
                } else if (entry.isFile()) {
                    const content = Fs.readFileSync(fullPath, 'utf-8');
                    const version = this.parseVersionFromFile(content);
                    const component = this.parseComponentFromFile(content);

                    // Map template path to user path
                    let userPath = relativePath;
                    if (relativePath.startsWith('src/')) {
                        userPath = relativePath.replace(/^src\//, `${userSrcDir}/`);
                    }

                    files.push({
                        templatePath: relativePath,
                        userPath: userPath,
                        fullTemplatePath: fullPath,
                        version: version || '1.0.0',
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
        const jamseduDirs = [
            Path.join(cwd, srcDir, 'js', 'jamsedu'),
            Path.join(cwd, srcDir, 'css', 'jamsedu'),
            Path.join(cwd, 'eslint'),
            Path.join(cwd, 'docs'),
            Path.join(cwd, '.vscode')
        ];

        for (const dir of jamseduDirs) {
            if (Fs.existsSync(dir)) {
                const scanned = this.scanDirectory(dir, cwd);
                for (const filePath of scanned) {
                    const fullPath = Path.join(cwd, filePath);
                    if (Fs.existsSync(fullPath)) {
                        const content = Fs.readFileSync(fullPath, 'utf-8');
                        const hash = Crypto.createHash('sha256').update(content).digest('hex');
                        const version = this.parseVersionFromFile(content);
                        const component = this.parseComponentFromFile(content);

                        files.push({
                            file: filePath,
                            hash: hash,
                            version: version,
                            component: component || Path.basename(filePath, Path.extname(filePath)),
                            manifestEntry: manifest.components[component || Path.basename(filePath, Path.extname(filePath))]
                        });
                    }
                }
            }
        }

        return files;
    }

    static compareFiles(templateFiles, userFiles, manifest, cwd) {
        const available = [];
        const newFiles = [];

        for (const templateFile of templateFiles) {
            const userFile = userFiles.find(f => f.file === templateFile.userPath);

            if (!userFile) {
                // New file
                newFiles.push({
                    file: templateFile.userPath,
                    component: templateFile.component,
                    version: templateFile.version,
                    templateFile: templateFile
                });
            } else {
                // Existing file - check if update needed
                // Use manifest version as source of truth (it's updated after each update)
                const manifestVersion = userFile.manifestEntry?.version;
                const userVersion = manifestVersion || userFile.version || '1.0.0';
                const manifestHash = userFile.manifestEntry?.hash;
                
                // File is modified if current hash differs from manifest hash
                // But only consider it modified if versions also match (user changed file without version bump)
                const isModified = manifestHash && userFile.hash !== manifestHash && userVersion === manifestVersion;
                
                // Only show as needing update if version actually differs
                // If versions match, we're up to date (even if hash differs, that's a user modification)
                if (userVersion !== templateFile.version) {
                    available.push({
                        file: templateFile.userPath,
                        component: templateFile.component,
                        userVersion: userVersion,
                        templateVersion: templateFile.version,
                        modified: isModified,
                        templateFile: templateFile,
                        userFile: userFile
                    });
                }
            }
        }

        return { available, new: newFiles };
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

            // Copy file
            Fs.copyFileSync(templatePath, destPath);
            Print.success(`Updated ${update.file}`);

            // Update manifest with new file content
            const content = Fs.readFileSync(destPath, 'utf-8');
            const hash = Crypto.createHash('sha256').update(content).digest('hex');
            const updatedVersion = this.parseVersionFromFile(content) || update.templateVersion || update.version;
            
            manifest.components[update.component] = {
                file: filePath, // Use normalized filePath, not update.file
                version: updatedVersion,
                hash: hash,
                modified: false
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

    static parseVersionFromFile(content) {
        const jsMatch = content.match(/\/\/\s*@jamsedu-version:\s*([\d.]+)/);
        if (jsMatch) {
            return jsMatch[1];
        }
        const cssMatch = content.match(/\/\*\s*@jamsedu-version:\s*([\d.]+)\s*\*\//);
        if (cssMatch) {
            return cssMatch[1];
        }
        return null;
    }

    static parseComponentFromFile(content) {
        const jsMatch = content.match(/\/\/\s*@jamsedu-component:\s*(\S+)/);
        if (jsMatch) {
            return jsMatch[1];
        }
        const cssMatch = content.match(/\/\*\s*@jamsedu-component:\s*(\S+)\s*\*\//);
        if (cssMatch) {
            return cssMatch[1];
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

