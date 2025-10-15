#!/usr/bin/env node
import Fs from 'fs';
import Initializer from '../src/initializer.js';
import JamsEdu from '../src/jamsedu.js';
import JamsEduHooks from '../src/imports/jamsedu-hooks/hooks.js';
import MarkdownToTerminal from '../src/imports/md-to-terminal.js';
import Path from 'path';
import Print from '../src/imports/print.js';
import URL from 'url';
import { ArgParser, getRootPaths } from '../src/imports/helpers.js';
import { exit } from 'process';

// Parsing command line arguments.
const args = ArgParser.parse(process.argv);

// Getting the root paths.
const rootPaths = getRootPaths(import.meta.url);
const JAMSEDU_ROOT = Path.join(rootPaths.DIRNAME, '..');
const USERS_ROOT = args.cwd;

// Initializing a new JamsEdu project if the "--init" flag is provided.
if (args.init) {
    Initializer.init(USERS_ROOT, JAMSEDU_ROOT);
    exit();
}

// See if the user provided a config file path via command line arguments.
let configFile = args.config;

// Setting default config file path if not provided.
if (!configFile) {
    configFile = Path.join(USERS_ROOT, 'jamsedu.config.js');
}

// Checking if the config file path is valid.
if (!Fs.existsSync(configFile)) {
    Print.error(`JamsEdu config file does not exist at: ${configFile}`);
    Print.info('To create a new JamsEdu project open a terminal and run `jamsedu --init` at the root of your project.');
    exit();
}

let config = {};

try {
    // Loading the JamsEdu configuration file.
    config = await import(URL.pathToFileURL(configFile).href);
    config = config.default;
} catch (err) {
    // Handling errors while loading the configuration file.
    Print.error('JamsEdu configuration file would not load!');
    Print.error(err);
    exit();
}

// Helper function to resolve and sanitize user paths.
const resolveUserPath = (userRoot, relPath, defaultPath) => {
    // Remove leading slashes and normalize the path
    let safeRelPath = Path.normalize(relPath).replace(/^([\\/]+)/, '');
    // Prevent path traversal outside userRoot
    if (safeRelPath.startsWith('..')) safeRelPath = safeRelPath.replace(/^(\.\.[\\/]+)/, '');
    // Join and resolve to absolute path
    const absPath = Path.resolve(userRoot, safeRelPath);
    // Ensure the resolved path is within userRoot
    if (!absPath.startsWith(Path.resolve(userRoot))) {
        return Path.join(userRoot, defaultPath);
    }
    return absPath;
};

// Merging command line arguments with the loaded configuration.
config = { ...config, ...args };

// Resolving and sanitizing source and destination directory paths.
config.destDir = resolveUserPath(USERS_ROOT, config.destDir, 'www');
config.srcDir = resolveUserPath(USERS_ROOT, config.srcDir, 'src');

// Merge hooks from jamsedu-hooks package if not already defined in user config.
// eslint-disable-next-line no-extra-parens
config.pre = [...(JamsEduHooks.pre || []), ...(config.pre || [])];
// eslint-disable-next-line no-extra-parens
config.post = [...(JamsEduHooks.post || []), ...(config.post || [])];

// Creating a new instance of JamsEdu.
const jamsedu = new JamsEdu(config, USERS_ROOT);

if (args.watch) {
    // Watching for changes if "--watch" flag is provided.
    jamsedu.watch();
} else if (args.build) {
    // Building the project if "--build" flag is provided.
    await jamsedu.build();
} else {
    // Displaying the manual if no flags are provided.
    const manualFile = Path.join(JAMSEDU_ROOT, 'bin', 'man.md');
    const manual = Fs.readFileSync(manualFile, { encoding: 'utf8' });
    Print.out(MarkdownToTerminal.parse(manual));
}
