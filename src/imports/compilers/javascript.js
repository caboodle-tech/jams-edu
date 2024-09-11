import Json from '@rollup/plugin-json';
import RemoveJamsEduComment from './jamsedu-comments.js';
import Terser from '@rollup/plugin-terser';
import { rollup as Rollup } from 'rollup';

export default async(src, dest, options) => {
    const bundleOptions = {
        input: src,
        plugins: [
            RemoveJamsEduComment(),
            Json()
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
