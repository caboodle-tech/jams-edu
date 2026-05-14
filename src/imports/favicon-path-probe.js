import Fs from 'fs';
import Path from 'path';
import { templateSrcPathToUserPath } from './template-path-mapping.js';

const FAVICON_NAMES = Object.freeze(['favicon.ico', 'favicon.svg', 'favicon.png', 'apple-touch-icon.png']);

/**
 * @param {string} dir
 * @returns {boolean}
 */
const dirHasFaviconLikeFile = (dir) => {
    try {
        if (!Fs.existsSync(dir)) {
            return false;
        }
        const st = Fs.statSync(dir);
        if (!st.isDirectory()) {
            return false;
        }
        const names = Fs.readdirSync(dir);
        return names.some((n) => {
            const lower = n.toLowerCase();
            if (lower === 'apple-touch-icon.png') {
                return true;
            }
            if (!lower.startsWith('favicon')) {
                return false;
            }
            return /\.(ico|png|svg)$/iu.test(lower);
        });
    } catch {
        return false;
    }
};

/**
 * @param {string} absPath
 * @returns {boolean}
 */
const isFile = (absPath) => {
    try {
        return Fs.existsSync(absPath) && Fs.statSync(absPath).isFile();
    } catch {
        return false;
    }
};

/**
 * True when common favicon artifacts exist under project root, source tree, images/assets, or dest root.
 *
 * @param {string} cwd Project root
 * @param {{ srcDir?: string; destDir?: string; assetsDir?: string; templateDir?: string }} userConfig
 * @returns {boolean}
 */
export const siteAppearsToHaveFavicon = (cwd, userConfig) => {
    const resolvedCwd = Path.resolve(cwd);
    const srcRaw = typeof userConfig.srcDir === 'string' && userConfig.srcDir.trim() ?
        userConfig.srcDir.trim() :
        'src';
    const resolvedSrc = Path.isAbsolute(srcRaw) ?
        Path.resolve(srcRaw) :
        Path.resolve(resolvedCwd, srcRaw.replace(/\\/g, '/'));
    /** Relative to cwd; required so templateSrcPathToUserPath never sees an absolute root (breaks images path join on Windows). */
    const srcRelForMapping = Path.isAbsolute(srcRaw) ?
        Path.relative(resolvedCwd, resolvedSrc).replace(/\\/g, '/') :
        srcRaw.replace(/\\/g, '/').replace(/^\/+|\/+$/gu, '');
    const srcRel = srcRelForMapping || 'src';

    for (const name of FAVICON_NAMES) {
        if (isFile(Path.join(resolvedCwd, name))) {
            return true;
        }
        if (isFile(Path.join(resolvedSrc, name))) {
            return true;
        }
    }

    const destRaw = typeof userConfig.destDir === 'string' ? userConfig.destDir.trim() : '';
    if (destRaw) {
        const resolvedDest = Path.isAbsolute(destRaw) ? Path.resolve(destRaw) : Path.resolve(resolvedCwd, destRaw);
        for (const name of FAVICON_NAMES) {
            if (isFile(Path.join(resolvedDest, name))) {
                return true;
            }
        }
    }

    const imagesRel = templateSrcPathToUserPath(srcRel, 'images', userConfig);
    const imagesAbs = Path.isAbsolute(imagesRel) ?
        Path.resolve(imagesRel) :
        Path.resolve(resolvedCwd, ...imagesRel.split('/').filter(Boolean));
    for (const name of FAVICON_NAMES) {
        if (isFile(Path.join(imagesAbs, name))) {
            return true;
        }
    }
    if (dirHasFaviconLikeFile(Path.join(imagesAbs, 'favicon'))) {
        return true;
    }
    if (dirHasFaviconLikeFile(Path.join(imagesAbs, 'icons'))) {
        return true;
    }

    return false;
};
