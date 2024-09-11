import Json from '@rollup/plugin-json';
import RemoveJamsEduCOmment from './jamsedu-comments.js';
import Terser from '@rollup/plugin-terser';
import Typescript from '@rollup/plugin-typescript';
import { rollup as Rollup } from 'rollup';

export default async(src, dest, options) => {
    const bundleOptions = {
        input: src,
        plugins: [
            RemoveJamsEduCOmment(),
            Json(),
            Typescript({
                target: 'ES6', // Target modern JavaScript version (ES6+)
                module: 'ESNext', // Use ESNext module system
                resolveJsonModule: true, // Allow importing JSON files
                allowSyntheticDefaultImports: true // Enable synthetic default imports
            })
        ]
    };

    if (options.uncompressed !== true) {
        bundleOptions.plugins.push(Terser());
    }

    try {
        const bundle = await Rollup(bundleOptions);
        await bundle.write({
            file: dest,
            format: options.format || 'iife'
        });
        return true;
    } catch (err) {
        return false;
    }
};
