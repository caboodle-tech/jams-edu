/* eslint-disable no-case-declarations */
import Fs from 'fs';
import Path from 'path';
import Sass from 'sass';
import Server from '@caboodle-tech/node-simple-server';
import { fileURLToPath } from 'url';

import Log from './logger.js';

// eslint-disable-next-line no-underscore-dangle
const __filename = fileURLToPath(import.meta.url);
// eslint-disable-next-line no-underscore-dangle
const __dirname = Path.dirname(__filename);
const ROOT = Path.join(__dirname, '..');

class JamsEduCli {

    #server;

    constructor(...args) {
        if (!args || !args[0]) { return; }

        if (args[0].length < 3) {
            Log.error('JamsEduCli: You must specify a command to run.');
            return;
        }

        this.#run(args[0].splice(2));
    }

    #compileScss() {
        const cssSrc = Path.join(ROOT, 'scss', 'je-styles.scss');
        const cssDst = Path.join(ROOT, 'css', 'je-styles.css');
        const compiledScss = Sass.compile(cssSrc, { style: 'compressed' });
        this.#writeFile(cssDst, compiledScss.css);
    }

    #respondToFileChanges(evt, path) {
        console.log('RES', evt, path);
        if (evt === 'change') {
            this.#server.reloadSinglePage(path);
        }
    }

    #run(args) {
        switch (args[0].toUpperCase()) {
            case 'BUILD':
                this.#compileScss();
                break;
            case 'WATCH':
                const options = {
                    events: {
                        all: this.#respondToFileChanges.bind(this)
                    }
                };
                this.#server = new Server({ dirListing: true, root: Path.join(ROOT, 'app') });
                this.#server.start();
                this.#server.watch('app', options);
                break;
            default:
                Log.error('JamsEduCli: You specified an unknown command.');
        }
    }

    #writeFile(dst, content) {
        const dir = Path.dirname(dst);
        if (!Fs.existsSync(dst)) {
            Fs.mkdirSync(dir, { recursive: true });
        }
        Fs.writeFileSync(dst, content);
    }

}

// eslint-disable-next-line no-unused-vars
const cli = new JamsEduCli(process.argv);
