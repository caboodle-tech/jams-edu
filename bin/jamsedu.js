#!/usr/bin/env node

import Fs from 'fs';
import Path from 'path';
import Process from 'process';
import JamsEdu from '../app/backend/je.js';
import ArgParser from '../app/backend/args-parser.js';

function findConfigFile(startDir) {
    let currentDir = startDir;
    // Search for the config file.
    while (currentDir !== null && currentDir !== Path.parse(currentDir).root) {
        const configFile = Path.join(currentDir, 'jamsedu.config');
        if (Fs.existsSync(configFile)) {
            return configFile;
        }
        // Climb to parent dir.
        currentDir = Path.dirname(currentDir);
    }
    // Config file not found.
    return null;
}

// Setup constants.
const ARGS = ArgParser.parse(Process.argv);
const BIN = Path.dirname(ARGS.executing);
const ROOT = Path.join(BIN, '../');

// Use JamsEDU's built in demo files as the project source if none is provided by the user.
let settings = {
    build: Path.join(ROOT, 'dist'),
    root: ROOT,
    source: Path.join(ROOT, 'www')
};

// Attempt to load the users settings.
const settingsFile = findConfigFile(ROOT);
if (Fs.existsSync(settingsFile)) {
    const ABS_PATH = Path.dirname(settingsFile);
    settings = JSON.parse(Fs.readFileSync(settingsFile, { encoding: 'utf8' }));
    if (settings.build) {
        settings.build = Path.join(ABS_PATH, settings.build);
    }
    if (settings.source) {
        settings.source = Path.join(ABS_PATH, settings.source);
    }
    // We should treat the location of the config file as the project root.
    settings.root = ABS_PATH;
}

// Run JamsEDU.
const jamsEdu = new JamsEdu(settings);
jamsEdu.run(ARGS);

// jamsEdu.processFilesFromDir(
//     jamsEdu.getSourceDir(),
//     [/\.map/, /\.css/, /\.scss/],
//     [(...args) => {
//         console.log(args);
//     }],
//     (...args) => {
//         console.log('No match', args);
//     }
// );
