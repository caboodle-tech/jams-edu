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

// Handle --version command (doesn't need config)
if (args.version || args.v) {
    const packageJson = JSON.parse(Fs.readFileSync(Path.join(JAMSEDU_ROOT, 'package.json'), 'utf-8'));
    Print.out(packageJson.version);
    exit();
}

// Handle --help command (doesn't need config)
if (args.help || args.h || args.man) {
    const manualFile = Path.join(JAMSEDU_ROOT, 'bin', 'man.md');
    const manual = Fs.readFileSync(manualFile, { encoding: 'utf8' });
    Print.out(MarkdownToTerminal.parse(manual));
    exit();
}

// Handle --where command (doesn't need config)
if (args.where) {
    Print.out(Path.resolve(JAMSEDU_ROOT));
    exit();
}

// Handle restore command (clears ports) - doesn't need config
// Can be called as: jamsedu --restore 5000 5001 OR jamsedu 5000 5001 (if no other args)
const numericArgs = process.argv.slice(2).filter(arg => !arg.startsWith('--') && !isNaN(Number(arg)) && Number(arg) > 0);
const hasRestoreFlag = args.restore;
const hasOnlyNumericArgs = numericArgs.length > 0 && process.argv.slice(2).every(arg => arg.startsWith('--') || (!isNaN(Number(arg)) && Number(arg) > 0));

if (hasRestoreFlag || (hasOnlyNumericArgs && !args.init && !args.update && !args.watch && !args.build && !args.config && !args['restore-backup'] && !args.restoreBackup && !args.where)) {
    // Import restore dynamically
    const PortKiller = (await import('../src/restore.js')).default;
    
    // Extract ports from args - either after --restore flag or as standalone numbers
    let ports = [];
    if (hasRestoreFlag) {
        // If --restore flag is used, get ports after it
        const restoreIndex = process.argv.indexOf('--restore');
        ports = process.argv.slice(restoreIndex + 1).filter(arg => !arg.startsWith('--') && !isNaN(Number(arg)) && Number(arg) > 0).map(Number);
    } else {
        // If no --restore flag, get all numeric args (for jamsedu 5000 5001 syntax)
        ports = numericArgs.map(Number);
    }
    
    if (ports.length === 0) {
        Print.error('Usage: jamsedu --restore <port1> <port2> ...');
        Print.info('Example: jamsedu --restore 5000 5001');
        Print.info('Or: jamsedu 5000 5001');
        exit(1);
    }
    
    await PortKiller.restore(ports);
    exit();
}

// See if the user provided a config file path via command line arguments.
let configFile = args.config;

// Setting default config file path if not provided.
// Config is now in .jamsedu/config.js (fallback to old location for migration)
if (!configFile) {
    const newConfigPath = Path.join(USERS_ROOT, '.jamsedu', 'config.js');
    const oldConfigPath = Path.join(USERS_ROOT, 'jamsedu.config.js');
    
    // Try new location first, then fall back to old location
    if (Fs.existsSync(newConfigPath)) {
        configFile = newConfigPath;
    } else if (Fs.existsSync(oldConfigPath)) {
        configFile = oldConfigPath;
    } else {
        configFile = newConfigPath; // Use new path for error message
    }
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

// Handle update command (requires config file to know srcDir)
if (args.update) {
    // Import updater dynamically to avoid circular dependencies
    const Updater = (await import('../src/updater.js')).default;
    await Updater.update(USERS_ROOT, JAMSEDU_ROOT, config, args.force || false);
    exit();
}

// Handle restore-backup command (requires config file)
if (args['restore-backup'] || args.restoreBackup) {
    // Import updater dynamically
    const Updater = (await import('../src/updater.js')).default;
    const timestamp = args['restore-backup'] || args.restoreBackup;
    Updater.restoreBackup(USERS_ROOT, timestamp);
    exit();
}

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
