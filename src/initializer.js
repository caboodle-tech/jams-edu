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

        const conflictResolution = this.handleFileConflicts(cwd);
        if (!conflictResolution) {
            Print.warn('Initialization cancelled by user.');
            return;
        }

        // Copy template files recursively (ESLint is included, no question needed)
        this.copyTemplateFiles(jamseduTemplateDir, cwd, conflictResolution);

        // Write out the configuration file AFTER copying (so it doesn't conflict)
        const configFilePath = Path.join(cwd, 'jamsedu.config.js');
        const configDir = Path.dirname(configFilePath);

        // Create the config directory if it doesn't exist
        if (!Fs.existsSync(configDir)) {
            Fs.mkdirSync(configDir, { recursive: true });
        }
        Fs.writeFileSync(configFilePath, config);

        // Create manifest for update system
        this.createManifest(cwd, srcDir, jamseduWd, packageVersion);

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

    static handleFileConflicts(cwd) {
        // Check if project root has any files
        const existingFiles = [];
        if (Fs.existsSync(cwd)) {
            const entries = Fs.readdirSync(cwd, { withFileTypes: true });
            for (const entry of entries) {
                // Skip hidden directories like .git, .jamsedu, node_modules
                if (entry.name.startsWith('.') && entry.isDirectory()) {
                    continue;
                }
                if (entry.name === 'node_modules' && entry.isDirectory()) {
                    continue;
                }
                // Skip jamsedu.config.js - we generate this, not copy it
                if (entry.name === 'jamsedu.config.js') {
                    continue;
                }
                existingFiles.push(entry.name);
            }
        }

        if (existingFiles.length === 0) {
            return 'overwrite'; // No conflicts, safe to proceed
        }

        Print.warn(`\n⚠️  Found ${existingFiles.length} existing file(s) or directory(ies) in project root.`);
        Print.out('Files/directories found: ' + existingFiles.slice(0, 5).join(', ') + (existingFiles.length > 5 ? '...' : ''));

        const response = this.getResponse('\nHow would you like to proceed?\n\n1) Overwrite - Replace existing files with template files\n2) Skip - Don\'t copy files that already exist, only copy new ones\n3) Fresh Install - Delete all files in project root first, then copy (⚠️  DESTRUCTIVE!)\n4) Cancel - Abort initialization\n\nEnter your choice (1-4)', '1');

        const choice = response.trim();

        if (choice === '4' || choice.toLowerCase() === 'cancel') {
            return null;
        }

        if (choice === '3' || choice.toLowerCase() === 'fresh install' || choice.toLowerCase() === 'fresh') {
            const confirm = this.getResponse('\n⚠️  WARNING: This will DELETE all files in your project root!\n\nAre you absolutely sure? Type "yes" to confirm, or anything else to cancel.', '');
            if (confirm.toLowerCase() !== 'yes') {
                Print.warn('Fresh install cancelled.');
                return null;
            }

            // Delete all files and directories except hidden system files
            Print.warn('Deleting existing files...');
            for (const entry of existingFiles) {
                const fullPath = Path.join(cwd, entry);
                try {
                    if (Fs.statSync(fullPath).isDirectory()) {
                        Fs.rmSync(fullPath, { recursive: true, force: true });
                    } else {
                        Fs.unlinkSync(fullPath);
                    }
                } catch (err) {
                    Print.warn(`Could not delete ${entry}: ${err.message}`);
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

    static copyTemplateFiles(templateDir, destDir, conflictMode) {
        Print.info('Copying template files...');

        const copyRecursive = (src, dest) => {
            const entries = Fs.readdirSync(src, { withFileTypes: true });

            for (const entry of entries) {
                const srcPath = Path.join(src, entry.name);
                const destPath = Path.join(dest, entry.name);

                // Skip jamsedu.config.js - we generate this separately
                if (entry.name === 'jamsedu.config.js') {
                    continue;
                }

                if (entry.isDirectory()) {
                    // Create directory if it doesn't exist
                    if (!Fs.existsSync(destPath)) {
                        Fs.mkdirSync(destPath, { recursive: true });
                    }
                    copyRecursive(srcPath, destPath);
                } else if (entry.isFile()) {
                    // Handle file conflicts
                    if (Fs.existsSync(destPath)) {
                        if (conflictMode === 'skip') {
                            continue; // Skip existing files
                        }
                        // Overwrite mode - file will be replaced
                    }

                    // Ensure parent directory exists
                    const parentDir = Path.dirname(destPath);
                    if (!Fs.existsSync(parentDir)) {
                        Fs.mkdirSync(parentDir, { recursive: true });
                    }

                    Fs.copyFileSync(srcPath, destPath);
                }
            }
        };

        copyRecursive(templateDir, destDir);
        Print.success('Template files copied successfully!');
    }

    static createManifest(cwd, srcDir, jamseduWd, packageVersion) {
        const manifestDir = Path.join(cwd, '.jamsedu');
        if (!Fs.existsSync(manifestDir)) {
            Fs.mkdirSync(manifestDir, { recursive: true });
        }

        const manifest = {
            jamseduPackageVersion: packageVersion,
            templateVersion: packageVersion,
            installed: new Date().toISOString(),
            lastUpdated: null,
            srcDir: srcDir,
            components: {}
        };

        // JamsEdu file patterns to track
        const jamseduFiles = [
            // JavaScript files
            Path.join(srcDir, 'js', 'jamsedu', 'tiny-doc.js'),
            Path.join(srcDir, 'js', 'jamsedu', 'tiny-wysiwyg.js'),
            Path.join(srcDir, 'js', 'jamsedu', 'dom-watcher.js'),
            Path.join(srcDir, 'js', 'jamsedu', 'index.js'),
            // CSS files
            Path.join(srcDir, 'css', 'jamsedu', 'jamsedu.css'),
            Path.join(srcDir, 'css', 'jamsedu', 'tiny-document.css'),
            Path.join(srcDir, 'css', 'jamsedu', 'tiny-wysiwyg.css'),
            // ESLint files
            'eslint/html-rules.js',
            'eslint/js-rules.js',
            'eslint/json-rules.js',
            'eslint.config.js',
            // VS Code settings
            '.vscode/settings.json'
        ];

        // Scan and track each file
        for (const filePath of jamseduFiles) {
            const fullPath = Path.join(cwd, filePath);
            if (Fs.existsSync(fullPath)) {
                const content = Fs.readFileSync(fullPath, 'utf-8');
                const hash = Crypto.createHash('sha256').update(content).digest('hex');
                const version = this.parseVersionFromFile(content);
                const component = this.parseComponentFromFile(content);

                manifest.components[component || Path.basename(filePath, Path.extname(filePath))] = {
                    file: filePath,
                    version: version || packageVersion,
                    hash: hash,
                    modified: false
                };
            }
        }

        // Track docs directory files if they exist
        const docsDir = Path.join(cwd, 'docs');
        if (Fs.existsSync(docsDir)) {
            const docsFiles = this.scanDirectory(docsDir, cwd);
            for (const docFile of docsFiles) {
                const fullPath = Path.join(cwd, docFile);
                const content = Fs.readFileSync(fullPath, 'utf-8');
                const hash = Crypto.createHash('sha256').update(content).digest('hex');
                const component = `docs-${Path.basename(docFile, Path.extname(docFile))}`;

                manifest.components[component] = {
                    file: docFile,
                    version: packageVersion,
                    hash: hash,
                    modified: false
                };
            }
        }

        // Write manifest
        const manifestPath = Path.join(manifestDir, 'manifest.json');
        Fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
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

}

export default Initializer;
