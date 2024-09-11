/* eslint-disable max-len */
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

        Print.clear();
        Print.notice(`${this.#header.replace('{{VERSION}}', packageVersion)}`);
        Prompt('');
        Print.clear();

        const srcDir = this.getResponse('Source Directory\n\nThe source directory is where your sites source files will reside. Please enter the name, including relative path if desired, for your projects source directory.\n\nPress [enter] without a response to accept the default: src', 'src');

        const tmpSrcDir = srcDir.endsWith('/') ? srcDir.slice(0, -1) : srcDir;

        const layoutDir = this.getResponse(`Layouts Directory\n\nThe layouts directory is where your sites layout and variable files will reside. This ideally should be nested within your source directory. Please enter the name, including relative path if desired, for your layouts directory.\n\nPress [enter] without a response to accept the default: ${tmpSrcDir}/layouts`, `${tmpSrcDir}/layouts`);

        const destDir = this.getResponse('Destination Directory\n\nThe destination directory is where your sites built files will be output to. Please enter the name, including relative path if desired, for your projects destination directory.\n\nPress [enter] without a response to accept the default: public', 'public');

        const websiteUrl = this.getResponse(`Website URL\n\nThe website URL is the base URL for your published website including the protocol (e.g., https://example.com). This is required if you want JamsEdu to automatically build your sitemap. Please enter the URL for your website.\n\nPress [enter] to accept the default: \x1b[3mempty\x1b[0m`, '');

        let cleanedWebsiteUrl = websiteUrl;
        if (cleanedWebsiteUrl.endsWith('/')) {
            cleanedWebsiteUrl = cleanedWebsiteUrl.slice(0, -1);
        }

        const config = `export default {
    destDir: '${destDir}',
    srcDir: '${srcDir}',
    layoutDir: '${layoutDir}'${cleanedWebsiteUrl ? `,\n    websiteUrl: '${cleanedWebsiteUrl}'` : ''}
};\n`;

        // Write out the configuration file.
        const configFilePath = Path.join(cwd, 'jamsedu.config.js');
        const configDir = Path.dirname(configFilePath);

        // Create the config directory if it doesn't exist
        if (!Fs.existsSync(configDir)) {
            Fs.mkdirSync(configDir, { recursive: true });
        }
        Fs.writeFileSync(configFilePath, config);

        const eslint = this.getResponse('ESLint\n\nESLint is a tool that helps developers find and fix common coding mistakes. It checks your code against a set of rules, provides suggestions or warnings, and can automatically fix some issues to improve code quality and consistency.\n\nWould you like to add ESLint to your project? (y/n)\n\nPress [enter] without a response to accept the default: y', 'y');

        if (!['y', 'ye', 'yes'].includes(eslint.trim().toLowerCase())) {
            this.printClosingPrompt();
            return;
        }

        const typescript = this.getResponse('TypeScript\n\nTypeScript is a superset of JavaScript that adds optional static types to the language. It is a powerful tool that can help you write more reliable and maintainable code.\n\nWould you like to add TypeScript to your project? (y/n)\n\nPress [enter] without a response to accept the default: n', 'n');

        const templates = this.getTemplateLocations(cwd, jamseduWd, ['y', 'ye', 'yes'].includes(typescript.trim().toLowerCase()));

        Object.keys(templates).forEach((key) => {
            const { src, dest } = templates[key];
            const destDir = Path.dirname(dest);
            if (!Fs.existsSync(destDir)) {
                Fs.mkdirSync(destDir, { recursive: true });
            }
            Fs.copyFileSync(src, dest);
        });

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
                    Print.clear();
                    // eslint-disable-next-line no-continue
                    continue;
                }
                response = response.trim() === '' ? defaultValue : response.trim();
                break;
            } catch (error) {
                Print.error(error.message);
            }
        }
        Print.clear();
        return response.trim();
    }

    static getTemplateLocations(cwd, jamseduWd, ts = false) {
        const templates = {
            eslint: {
                src: Path.join(jamseduWd, '/src/init-templates/eslint.js.js'),
                dest: Path.join(cwd, '/eslint.config.js')
            },
            package: {
                src: Path.join(jamseduWd, '/src/init-templates/package.js.json'),
                dest: Path.join(cwd, '/package.json')
            },
            rulesHtml: {
                src: Path.join(jamseduWd, '/src/imports/eslint/html-rules.js'),
                dest: Path.join(cwd, '/eslint/html-rules.js')
            },
            rulesJamsEdu: {
                src: Path.join(jamseduWd, '/src/imports/eslint/jamsedu-plugin.js'),
                dest: Path.join(cwd, '/eslint/jamsedu-plugin.js')
            },
            rulesJs: {
                src: Path.join(jamseduWd, '/src/imports/eslint/js-rules.js'),
                dest: Path.join(cwd, '/eslint/js-rules.js')
            },
            rulesJson: {
                src: Path.join(jamseduWd, '/src/imports/eslint/json-rules.js'),
                dest: Path.join(cwd, '/eslint/json-rules.js')
            },
            settings: {
                src: Path.join(jamseduWd, '/src/init-templates/settings.js.json'),
                dest: Path.join(cwd, '/.vscode/settings.json')
            }
        };

        if (ts) {
            templates.eslint.src = Path.join(jamseduWd, '/src/init-templates/eslint.ts.js');
            templates.package.src = Path.join(jamseduWd, '/src/init-templates/package.ts.json');
            templates.settings.src = Path.join(jamseduWd, '/src/init-templates/settings.ts.json');
            templates.rulesTs = {
                src: Path.join(jamseduWd, '/src/imports/eslint/ts-rules.js'),
                dest: Path.join(cwd, '/eslint/ts-rules.js')
            };
        }

        return templates;
    }

    static printClosingPrompt(installedForUser = false) {
        Print.clear();
        Print.success('Congratulations, your JamsEdu project has been successfully initialized!\n');
        Print.success(this.fitToLength('To start developing your project run the `jamsedu --help` command in your terminal or visit the online documentation for additional help: https://jamsedu.com/', 80));

        if (!installedForUser) {
            Print.out('');
            Print.warn(this.fitToLength('To get started with ESLint, you need to install it using a package manager like pnpm (preferred) or npm. We were unable to auto install this for you. If you do not have pnpm installed, you can install it by following their install instructions listed here: https://pnpm.io/installation\n\nAfter successfully installing pnpm or if you have npm already installed, run ONE of the following commands:', 80));
            Print.notice('\npnpm install\nnpm install\n');
            Print.out('');
            Print.warn(this.fitToLength('NOTE: You may need to restart your terminal for the above commands to work. You may also need to install the ESLint extension in your IDE of choice.', 80));
        }
    }

}

export default Initializer;
