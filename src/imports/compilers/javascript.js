import Json from '@rollup/plugin-json';
import Terser from '@rollup/plugin-terser';
import { rollup as Rollup } from 'rollup';

const uncompressedRegex = /--?uncompressed/i;

export default async(src, dest, outputFormat, options) => {
    const bundleOptions = {
        input: src,
        plugins: [
            Json()
        ]
    };

    if (!options.some((option) => uncompressedRegex.test(option))) {
        bundleOptions.plugins.push(Terser());
    }

    try {
        const bundle = await Rollup(bundleOptions);
        await bundle.write({
            file: dest,
            format: outputFormat
        });
        return true;
    } catch (err) {
        return false;
    }
};
