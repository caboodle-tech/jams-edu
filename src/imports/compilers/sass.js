import * as Sass from 'sass';
import Fs from 'fs';
import Path from 'path';
import { ManuallyRemoveJamsEduHeaderComment } from './jamsedu-comments.js';

const compileSass = (src, dest, options) => {
    try {
        let outputStyle = 'compressed';
        if (options.uncompressed) {
            outputStyle = 'expanded';
        }

        const result = Sass.compile(src, { style: outputStyle });

        writeFileAndCreateDirs(dest, ManuallyRemoveJamsEduHeaderComment(result.css));
        return true;
    } catch (err) {
        console.log('Err', err);
        return false;
    }
};

const writeFileAndCreateDirs = (dest, content) => {
    const dir = Path.dirname(dest);
    if (!Fs.existsSync(dir)) {
        Fs.mkdirSync(dir, { recursive: true });
    }
    Fs.writeFileSync(dest, content);
};

export default compileSass;
