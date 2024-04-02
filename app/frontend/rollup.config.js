import Fs from 'fs';
import Path from 'path';
import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import { fileURLToPath } from 'url';
import { rollup as Rollup } from 'rollup';

// eslint-disable-next-line no-underscore-dangle
const __dirname = Path.dirname(fileURLToPath(import.meta.url));

class JamsEduJsSource {

    static config = {
        input: Path.join(__dirname, './je.js'),
        output: {
            file: Path.join(__dirname, 'dist/jamsedu.bundle.js'),
            format: 'iife'
        },
        plugins: [
            resolve(),
            commonjs(),
            terser()
        ]
    };

    static async build() {
        // Create the JamsEDU Rollup bundle.
        const bundle = await Rollup(this.config);

        // Create directories recursively if they don't exist.
        if (!Fs.existsSync(Path.dirname(this.config.output.file))) {
            Fs.mkdirSync(Path.dirname(this.config.output.file), { recursive: true });
        }

        // Generate the bundle.
        await bundle.write(this.config.output);
    }

}

export default JamsEduJsSource;
