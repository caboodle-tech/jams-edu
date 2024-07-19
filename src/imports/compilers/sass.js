import * as Sass from 'sass';
import Fs from 'fs';
import Path from 'path';

const uncompressedRegex = /--?uncompressed/i;

const compileSass = (src, dest, options) => {
    try {
        let outputStyle = 'expanded';
        if (!options.some((option) => uncompressedRegex.test(option))) {
            outputStyle = 'compressed';
        }

        const result = Sass.compile(src, { style: outputStyle });

        writeFileAndCreateDirs(dest, result.css);
        return true;
    } catch (err) {
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
