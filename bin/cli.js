#!/usr/bin/env node

import { fileURLToPath } from 'url';
import Path from 'path';
import JamsEdu from '../app/jams-edu.js';
import ArgParser from '../app/args-parser.js';

// eslint-disable-next-line no-underscore-dangle
const __filename = fileURLToPath(import.meta.url);
// eslint-disable-next-line no-underscore-dangle
const __dirname = Path.dirname(__filename);
const APP_ROOT = Path.join(__dirname, '../');

const args = ArgParser.parse(process.argv);

const jamsEdu = new JamsEdu();

jamsEdu.getFilesFromDir('.', (file, ext) => {
    console.log(file, ext);
}, '');
