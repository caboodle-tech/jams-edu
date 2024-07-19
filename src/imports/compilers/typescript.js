import Json from '@rollup/plugin-json';
import Terser from '@rollup/plugin-terser';
import Typescript from '@rollup/plugin-typescript';
import { rollup as Rollup } from 'rollup';

const uncompressedRegex = /--?uncompressed/i;

export default async(src, dest, outputFormat, options) => {
    const bundleOptions = {
        input: src,
        plugins: [
            Json(),
            Typescript({
                target: 'ES6', // Target modern JavaScript version (ES6+)
                module: 'ESNext' // Use ESNext module system
            })
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
