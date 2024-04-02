#!/usr/bin/env node

import Fs from 'fs';
import Path from 'path';
import JamsEdu from '../app/backend/je.js';
import ArgParser from '../app/backend/args-parser.js';

// Create important constants.
const ARGS = ArgParser.parse();
const ROOT = Path.join(Path.dirname(ARGS.executing), '../');

// Use JamsEdu's built in demo files as the project source if none is provided by the user.
const settings = {
    jamseduDir: Path.join(ROOT, 'app'),
    outputCss: Path.join(ARGS.cwd, 'dist/css'),
    outputDir: Path.join(ARGS.cwd, 'dist'),
    outputJs: Path.join(ARGS.cwd, 'dist/js'),
    processFileTypes: ['html'],
    processJs: [Path.join(ARGS.cwd, 'src/js/main.js')],
    processScss: [Path.join(ARGS.cwd, 'src/scss/main.scss')],
    sourceDir: Path.join(ARGS.cwd, 'src'),
    templateDir: Path.join(ARGS.cwd, 'src/templates')
};

// Attempt to load the users settings.
const settingsFile = JamsEdu.findConfigFile(ARGS.cwd);

// Perform basic sanity checks on the users settings and overwrite defaults with their values.
if (Fs.existsSync(settingsFile)) {
    const ABS_PATH = Path.dirname(settingsFile);
    const userSettings = JSON.parse(Fs.readFileSync(settingsFile, { encoding: 'utf8' }));

    if (userSettings.outputDir) {
        settings.outputDir = Path.join(ABS_PATH, userSettings.outputDir);
    }

    if (userSettings.processFileTypes) {
        settings.processFileTypes = userSettings.processFileTypes;
    }

    if (userSettings.processJs) {
        settings.processJs = userSettings.processJs;
    }

    if (userSettings.processScss) {
        settings.processScss = userSettings.processScss;
    }

    if (userSettings.sourceDir) {
        settings.sourceDir = Path.join(ABS_PATH, userSettings.sourceDir);
    }

    if (userSettings.outputCss) {
        settings.outputCss = Path.join(ABS_PATH, userSettings.outputCss);
    } else if (userSettings.sourceDir) {
        // If no specific css directory was provided default to the css directory in the source directory.
        settings.outputCss = Path.join(ABS_PATH, userSettings.sourceDir, 'css');
    }

    if (userSettings.outputJs) {
        settings.outputJs = Path.join(ABS_PATH, userSettings.outputJs);
    } else if (userSettings.sourceDir) {
        // If no specific css directory was provided default to the css directory in the source directory.
        settings.outputJs = Path.join(ABS_PATH, userSettings.sourceDir, 'js');
    }

    if (userSettings.templateDir) {
        settings.templateDir = Path.join(ABS_PATH, userSettings.templateDir);
    } else if (userSettings.sourceDir) {
        // If no specific template directory was provided default to the templates directory in the source directory.
        settings.templateDir = Path.join(ABS_PATH, userSettings.sourceDir, 'templates');
    }
}

// Instantiate and run JamsEdu.
const jamsEdu = new JamsEdu(settings);
jamsEdu.run(ARGS);
