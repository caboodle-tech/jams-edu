/* eslint-disable max-len */
import Crypto from 'crypto';
import Fs from 'fs';
import Path from 'path';
import Print from './imports/print.js';
import PromptUser from 'prompt-sync';
import { execSync } from 'child_process';

// Get an instance of the Prompt to simplify user input.
const Prompt = PromptUser({ sigint: true });

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

    static init(cwd, jamseduWd) {
        const packageJson = JSON.parse(Fs.readFileSync(Path.join(jamseduWd, 'package.json'), 'utf-8'));
        const packageVersion = packageJson.version;

        this.clearScreen();
        Print.notice(`${this.#header.replace('{{VERSION}}', packageVersion)}`);
        Prompt('');
        this.clearScreen();

        const srcDir = this.getResponse('Source Directory\n\nThe source directory is where your sites source files will reside. Please enter the name, including relative path if desired, for your projects source directory.\n\nPress [enter] without a response to accept the default: src', 'src');

        const tmpSrcDir = srcDir.endsWith('/') ? srcDir.slice(0, -1) : srcDir;

        const userTemplateDir = this.getResponse(`Templates Directory\n\nThe templates directory is where your sites template and variable files will reside. This ideally should be nested within your source directory. Please enter the name, including relative path if desired, for your templates directory.\n\nPress [enter] without a response to accept the default: ${tmpSrcDir}/templates`, `${tmpSrcDir}/templates`);

        const destDir = this.getResponse('Destination Directory\n\nThe destination directory is where your sites built files will be output to. Please enter the name, including relative path if desired, for your projects destination directory.\n\nPress [enter] without a response to accept the default: public', 'public');

        const websiteUrl = this.getResponse(`Website URL\n\nThe website URL is the base URL for your published website including the protocol (e.g., https://example.com). This is required if you want JamsEdu to automatically build your sitemap. Please enter the URL for your website.\n\nPress [enter] to accept the default: \x1b[3mempty\x1b[0m`, '');

        let cleanedWebsiteUrl = websiteUrl;
        if (cleanedWebsiteUrl.endsWith('/')) {
            cleanedWebsiteUrl = cleanedWebsiteUrl.slice(0, -1);
        }

        const config = `export default {
    destDir: '${destDir}',
    srcDir: '${srcDir}',
    templateDir: '${userTemplateDir}'${cleanedWebsiteUrl ? `,\n    websiteUrl: '${cleanedWebsiteUrl}'` : ''}
};\n`;

        // Check for existing files and handle conflicts (before generating config)
        const jamseduTemplateDir = Path.join(jamseduWd, 'src', 'template');
        if (!Fs.existsSync(jamseduTemplateDir)) {
            Print.error(`Template directory not found at: ${jamseduTemplateDir}`);
            Print.error('JamsEdu installation appears to be corrupted.');
            return;
        }

        const conflictResolution = this.handleFileConflicts(cwd, jamseduTemplateDir, srcDir);
        if (!conflictResolution) {
            Print.warn('Initialization cancelled by user.');
            return;
        }

        // Copy template files recursively (ESLint is included, no question needed)
        const skippedFiles = this.copyTemplateFiles(jamseduTemplateDir, cwd, conflictResolution, srcDir);

        // Ensure .gitignore includes destDir
        this.ensureGitignore(cwd, destDir);

        // Write out the configuration file AFTER copying (so it doesn't conflict)
        // Store config in .jamsedu/config.js
        const jamseduDir = Path.join(cwd, '.jamsedu');
        if (!Fs.existsSync(jamseduDir)) {
            Fs.mkdirSync(jamseduDir, { recursive: true });
        }
        const configFilePath = Path.join(jamseduDir, 'config.js');
        Fs.writeFileSync(configFilePath, config);

        // Create manifest for update system (pass skipped files to mark as customized)
        this.createManifest(cwd, srcDir, jamseduWd, packageVersion, skippedFiles);

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

    static getResponse(question, defaultValue = null) {
        let response;
        while (true) {
            try {
                Print.out(this.fitToLength(question, 80));
                response = Prompt('> ');
                if (response.trim() === '' && defaultValue === null) {
                    Print.warn('Response cannot be empty please try again! Press enter to continue.');
                    Prompt();
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

    static handleFileConflicts(cwd, templateDir, userSrcDir) {
        // Scan template directory to find what files would be copied to project root
        const filesToCopy = this.scanTemplateFilesForConflictCheck(templateDir, userSrcDir);
        
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
        Print.out('Conflicting files/directories: ' + conflictingFiles.slice(0, 5).join(', ') + (conflictingFiles.length > 5 ? '...' : ''));

        const response = this.getResponse('\nHow would you like to proceed?\n\n1) Overwrite - Replace existing files with template files\n2) Skip - Don\'t copy files that already exist, only copy new ones\n3) Fresh Install - Delete conflicting files first, then copy (⚠️  DESTRUCTIVE!)\n4) Cancel - Abort initialization\n\nEnter your choice (1-4)', '1');

        const choice = response.trim();

        if (choice === '4' || choice.toLowerCase() === 'cancel') {
            return null;
        }

        if (choice === '3' || choice.toLowerCase() === 'fresh install' || choice.toLowerCase() === 'fresh') {
            const confirm = this.getResponse('\n⚠️  WARNING: This will DELETE the conflicting files!\n\nAre you absolutely sure? Type "yes" to confirm, or anything else to cancel.', '');
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

    static scanTemplateFilesForConflictCheck(templateDir, userSrcDir) {
        const files = [];
        const normalizedSrcDir = userSrcDir.replace(/\\/g, '/');
        
        const scanDir = (dir) => {
            if (!Fs.existsSync(dir)) return;

            const entries = Fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = Path.join(dir, entry.name);
                const relativePath = Path.relative(templateDir, fullPath).replace(/\\/g, '/');

                // Skip config.js files - we generate config in .jamsedu/config.js separately
                if (entry.name === 'config.js' || entry.name === 'jamsedu.config.js') {
                    continue;
                }

                if (entry.isDirectory()) {
                    scanDir(fullPath);
                } else if (entry.isFile()) {
                    // Map template paths to user paths (same logic as copyTemplateFiles)
                    let destPath;
                    if (relativePath.startsWith('src/')) {
                        // Map src/... to userSrcDir/...
                        const pathAfterSrc = relativePath.replace(/^src\//, '');
                        const srcDirParts = normalizedSrcDir.split('/').filter(p => p);
                        destPath = Path.join(...srcDirParts, ...pathAfterSrc.split('/')).replace(/\\/g, '/');
                    } else {
                        // Root-level files go to project root
                        destPath = relativePath;
                    }
                    files.push(destPath);
                }
            }
        };

        scanDir(templateDir);
        return files;
    }

    static copyTemplateFiles(templateDir, cwd, conflictMode, userSrcDir) {
        Print.info('Copying template files...');
        const skippedFiles = [];

        // Normalize userSrcDir to relative path with forward slashes
        const normalizedSrcDir = userSrcDir.replace(/\\/g, '/');

        const copyRecursive = (src, templateBasePath = '') => {
            try {
                const entries = Fs.readdirSync(src, { withFileTypes: true });

                for (const entry of entries) {
                    const srcPath = Path.join(src, entry.name);
                    const relativePath = Path.relative(templateDir, srcPath).replace(/\\/g, '/');

                    // Skip config.js files - we generate config in .jamsedu/config.js separately
                    if (entry.name === 'config.js' || entry.name === 'jamsedu.config.js') {
                        continue;
                    }

                    // Map template paths to user paths
                    // Files under src/ in template should map to user's srcDir
                    let destPath;
                    if (relativePath.startsWith('src/')) {
                        // Map src/... to userSrcDir/...
                        const pathAfterSrc = relativePath.replace(/^src\//, '');
                        // Split normalizedSrcDir by / and join properly for cross-platform support
                        const srcDirParts = normalizedSrcDir.split('/').filter(p => p);
                        destPath = Path.join(cwd, ...srcDirParts, ...pathAfterSrc.split('/'));
                    } else {
                        // Root-level files (eslint/, docs/, etc.) go to project root
                        // Split relativePath by / for proper cross-platform joining
                        const pathParts = relativePath.split('/').filter(p => p);
                        destPath = Path.join(cwd, ...pathParts);
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

                        // Read template file, strip version tags, then write to destination
                        const templateContent = Fs.readFileSync(srcPath, 'utf-8');
                        const cleanedContent = this.stripVersionTags(templateContent);
                        Fs.writeFileSync(destPath, cleanedContent, 'utf-8');
                    }
                }
            } catch (err) {
                Print.warn(`Error copying from ${src}: ${err.message}`);
            }
        };

        copyRecursive(templateDir);
        Print.success('Template files copied successfully!');
        return skippedFiles;
    }

    static createManifest(cwd, srcDir, jamseduWd, packageVersion, skippedFiles = []) {
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
        const skippedSet = new Set(skippedFiles.map(f => f.replace(/\\/g, '/')));

        // Scan template directory to find all files with version tags (like updater does)
        const templateDir = Path.join(jamseduWd, 'src', 'template');
        const templateFiles = this.scanTemplateFilesForManifest(templateDir, normalizedSrcDir);

        // For each template file, check if it exists in user's project and track it
        for (const templateFile of templateFiles) {
            const userFilePath = templateFile.userPath;
            const fullUserPath = Path.join(cwd, userFilePath);

            if (Fs.existsSync(fullUserPath)) {
                const content = Fs.readFileSync(fullUserPath, 'utf-8');
                const hash = Crypto.createHash('sha256').update(content).digest('hex');
                const version = this.parseVersionFromFile(content) || templateFile.version;
                const component = this.parseComponentFromFile(content) || templateFile.component;

                // Check if this file was skipped (using template-relative path)
                const wasSkipped = skippedSet.has(templateFile.templatePath);

                manifest.components[component] = {
                    file: userFilePath.replace(/\\/g, '/'), // Normalize path
                    version: version || packageVersion,
                    hash: hash,
                    modified: false,
                    userCustomized: wasSkipped // Mark as customized if it was skipped
                };
            }
        }

        // Write manifest
        const manifestPath = Path.join(manifestDir, 'manifest.json');
        Fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    }

    static scanTemplateFilesForManifest(templateDir, userSrcDir) {
        const files = [];
        const scanDir = (dir) => {
            if (!Fs.existsSync(dir)) return;

            const entries = Fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = Path.join(dir, entry.name);
                const relativePath = Path.relative(templateDir, fullPath).replace(/\\/g, '/');

                // Skip config files - we don't track those
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
                        version: version,
                        component: component || Path.basename(relativePath, Path.extname(relativePath))
                    });
                }
            }
        };

        scanDir(templateDir);
        return files;
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
        // Try JavaScript comment format: // @jamsedu-version: 1.0.0
        const jsMatch = content.match(/\/\/\s*@jamsedu-version:\s*([\d.]+)/);
        if (jsMatch) {
            return jsMatch[1];
        }
        // Try CSS comment format: /* @jamsedu-version: 1.0.0 */
        const cssMatch = content.match(/\/\*\s*@jamsedu-version:\s*([\d.]+)\s*\*\//);
        if (cssMatch) {
            return cssMatch[1];
        }
        // Try HTML comment format (for markdown): <!-- @jamsedu-version: 1.0.0 -->
        const htmlMatch = content.match(/<!--\s*@jamsedu-version:\s*([\d.]+)\s*-->/);
        if (htmlMatch) {
            return htmlMatch[1];
        }
        return null;
    }

    static parseComponentFromFile(content) {
        // Try JavaScript comment format: // @jamsedu-component: tiny-doc
        const jsMatch = content.match(/\/\/\s*@jamsedu-component:\s*(\S+)/);
        if (jsMatch) {
            return jsMatch[1];
        }
        // Try CSS comment format: /* @jamsedu-component: tiny-document */
        const cssMatch = content.match(/\/\*\s*@jamsedu-component:\s*(\S+)\s*\*\//);
        if (cssMatch) {
            return cssMatch[1];
        }
        // Try HTML comment format (for markdown): <!-- @jamsedu-component: component-name -->
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
        const alreadyIgnored = lines.some(line => {
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
