import * as sass from 'sass';
import Fs from 'fs';
import Path from 'path';
import { fileURLToPath } from 'url';

// eslint-disable-next-line no-underscore-dangle
const __dirname = Path.dirname(fileURLToPath(import.meta.url));

class JamsEduScssSource {

    static config = {
        style: 'compressed'
    };

    static srcFile = Path.join(__dirname, 'scss/je.scss');

    static outFile = Path.join(__dirname, 'dist/jamsedu.bundle.css');

    static async build() {
        const result = sass.compile(this.srcFile, this.config);
        Fs.writeFileSync(this.outFile, result.css, { encoding: 'utf8' });
    }

}

export default JamsEduScssSource;
