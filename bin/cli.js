#!/usr/bin/env node
import Fs from 'fs';
import JamsEdu from '../src/jams-edu.js';
import MarkdownToTerminal from '../src/imports/markdown-to-terminal.js';
import Path from 'path';
import Print from '../src/imports/print.js';
import RootPaths from '../src/imports/paths.js';
import URL from 'url';
import { ArgParser } from '../src/imports/helpers.js';
import { exit } from 'process';

import Template from '../src/imports/templates.js';
import HtmlSom from '../src/imports/html-som.js';

import TEST from '../src/imports/test.js';

const args = ArgParser.parse(process.argv);
const rootPaths = RootPaths(import.meta.url);
const ROOT = Path.join(rootPaths.DIRNAME, '..');

if (args.init) {
    JamsEdu.initialize();
    exit();
}

let configFile = args.config;

if (!configFile) {
    configFile = Path.join(ROOT, 'jamsedu.config.js');
}

if (!configFile.endsWith('jamsedu.config.js')) {
    Print.error(`Bad JamsEdu config file path detected: ${configFile}`);
    exit();
} else if (!Fs.existsSync(configFile)) {
    Print.error(`JamsEdu config file does not exist at: ${configFile}`);
    // eslint-disable-next-line max-len
    Print.info('Open a terminal at the root of your project and run `jamsedu --init` to initialize a new JamsEdu project.');
    exit();
}

let config = {};

try {
    config = await import(URL.pathToFileURL(configFile).href);
    config = config.default;
} catch (err) {
    Print.error('JamsEdu configuration file would not load!');
    Print.error(err);
    exit();
}

config = { ...config, ...args };

config.destDir = Path.join(ROOT, config.destDir);
config.srcDir = Path.join(ROOT, config.srcDir);
config.templateDir = Path.join(ROOT, config.templateDir);

const jamsedu = new JamsEdu(config, ROOT);

if (args.test) {
    const content = Fs.readFileSync(Path.join(ROOT, 'test/templates/main.html')).toString();
    const htmlSom = new HtmlSom(content);
    // const htm = htmlSom.getStructure().som.get('html lang="en-us" N<1>').children.get('body id="page" N<2>');
    // console.log(htm);
    // console.log(htmlSom.getLines(htm.loc.start, htm.loc.end));
    // console.log(htmlSom.getNodeHtml(htm));
    const s = htmlSom.findAll('template!');
    console.log(s);
    // const h = s[0];
    // console.log(htmlSom.getNodeInnerHtml(h).trim());
    // console.log('DONE\n', s);
    // console.log(htmlSom.findAll('slot', main[0]));
    // const template = new Template();
    // const files = Fs.readdirSync(Path.join(ROOT, 'test/templates'));
    // files.forEach((file) => {
    //     console.log(file);
    //     const fullPath = Path.join(ROOT, 'test/templates', file);
    //     const stats = Fs.statSync(fullPath);
    //     if (!stats.isDirectory()) {
    //         const content = Fs.readFileSync(fullPath).toString();
    //         template.saveTemplate(file, content);
    //     }
    // });
    // console.log(template.templates);
    // console.log(template.variables);
} else if (args.watch) {
    jamsedu.watch();
} else if (args.build) {
    await jamsedu.build();
} else if (args.test2) {
    TEST();
} else {
    const manualFile = Path.join(ROOT, 'bin', 'man.md');
    const manual = Fs.readFileSync(manualFile, { encoding: 'utf8' });
    Print.out(MarkdownToTerminal.parse(manual));
}
