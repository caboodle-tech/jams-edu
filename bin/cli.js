#!/usr/bin/env node

import Fs from 'fs';
import Initializer from '../src/initializer.js';
import JamsEdu from '../src/jams-edu.js';
import MarkdownToTerminal from '../src/imports/markdown-to-terminal.js';
import Path from 'path';
import Print from '../src/imports/print.js';
import RootPaths from '../src/imports/paths.js';
import URL from 'url';
import { ArgParser } from '../src/imports/helpers.js';
import { exit } from 'process';

// Parsing command line arguments.
const args = ArgParser.parse(process.argv);

// Getting the root paths.
const rootPaths = RootPaths(import.meta.url);
const JAMSEDU_ROOT = Path.join(rootPaths.DIRNAME, '..');
const USERS_ROOT = args.cwd;

// Initializing a new JamsEdu project if the "--init" flag is provided.
if (args.init) {
    Initializer.init(USERS_ROOT, JAMSEDU_ROOT);
    exit();
}

let configFile = args.config;

// Setting default config file path if not provided.
if (!configFile) {
    configFile = Path.join(USERS_ROOT, 'jamsedu.config.js');
}

// Checking if the config file path is valid.
if (!configFile.endsWith('jamsedu.config.js')) {
    Print.error(`Bad JamsEdu config file path detected: ${configFile}`);
    exit();
} else if (!Fs.existsSync(configFile)) {
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

// Merging command line arguments with the loaded configuration.
config = { ...config, ...args };

// Setting the destination, source, and layout directories.
config.destDir = Path.join(USERS_ROOT, config.destDir);
config.srcDir = Path.join(USERS_ROOT, config.srcDir);
config.layoutDir = Path.join(USERS_ROOT, config.layoutDir);

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
