import Json from '@rollup/plugin-json';
import Terser from '@rollup/plugin-terser';
import { rollup as Rollup } from 'rollup';

const uncompressedRegex = /--?uncompressed/i;

// Funny multiline comment to be added to the top of compiled files
const funnyComment = `
/*
 * Why don't scientists trust atoms?
 * Because they make up everything!
 */
`;

export default async(src, dest, outputFormat, options) => {
    const bundleOptions = {
        input: src,
        plugins: [
            Json()
        ]
    };

    try {
        const bundle = await Rollup(bundleOptions);
        await bundle.write({
            file: dest,
            format: outputFormat,
            banner: funnyComment
        });
        return true;
    } catch (err) {
        if (isProgramInVerboseMode) {
            console.error(err);
        }
        return false;
    }
};
