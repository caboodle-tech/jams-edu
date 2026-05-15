/**
 * Rewrites bundled starter URL prefixes (/assets/css|js|images/) on copied user projects so href/src
 * match layout: flat css/js/images (no assetsDir), grouped default "assets", or a custom grouped folder.
 */

import Fs from 'fs';
import Path from 'path';

import Print from './print.js';

const REGEX = Object.freeze({
    /** Quoted attr or JS string: opening quote, assets prefix, bucket, trailing slash. */
    quotedAssetBucket: /(["'`])((?:\.\/|\/)?assets\/)(css|js|images)\//g,
    /** CSS url(...) with optional quotes before the path. */
    urlAssetBucket: /(url\(\s*["']?)((?:\.\/|\/)?assets\/)(css|js|images)\//g
});

const BUCKETS = new Set(['css', 'js', 'images']);

const TEXT_EXTENSIONS = new Set(['.jhp', '.html', '.htm', '.css', '.js', '.mjs', '.cjs', '.md']);

/**
 * Normalizes config.assetsDir to a single path segment for URL grouping, or '' when grouped layout is off.
 *
 * @param {unknown} assetsDir
 * @returns {string} '' or one non-empty segment (no slashes).
 */
export const normalizeGroupedAssetsDir = (assetsDir) => {
    const raw = typeof assetsDir === 'string' ? assetsDir.trim().replace(/\\/g, '/') : '';
    const stripped = raw.replace(/^\/+/, '').replace(/\/+$/, '');
    if (!stripped) {
        return '';
    }
    const seg = stripped.split('/').filter(Boolean)[0] || '';
    if (!seg || seg === '.' || seg === '..') {
        return '';
    }
    return seg;
};

/**
 * @param {string} rawPrefix Matched prefix before bucket.
 * @param {string} bucket css | js | images
 * @param {string} targetGroupedDir Destination folder (not empty, not 'assets' handled by caller).
 * @returns {string}
 */
const rewritePrefixForCustomGroupedLayout = (rawPrefix, bucket, targetGroupedDir) => {
    if (!BUCKETS.has(bucket)) {
        return `${rawPrefix}${bucket}/`;
    }

    if (rawPrefix.startsWith('/assets/')) {
        return `/${targetGroupedDir}/${bucket}/`;
    }
    if (rawPrefix.startsWith('./assets/')) {
        return `./${targetGroupedDir}/${bucket}/`;
    }
    if (rawPrefix.startsWith('assets/')) {
        return `${targetGroupedDir}/${bucket}/`;
    }
    return `${rawPrefix}${bucket}/`;
};

/**
 * @param {string} rawPrefix
 * @param {string} bucket
 * @returns {string}
 */
const rewritePrefixForNoAssetsLayout = (rawPrefix, bucket) => {
    if (!BUCKETS.has(bucket)) {
        return `${rawPrefix}${bucket}/`;
    }

    if (rawPrefix.startsWith('/assets/')) {
        return `/${bucket}/`;
    }
    if (rawPrefix.startsWith('./assets/')) {
        return `./${bucket}/`;
    }
    if (rawPrefix.startsWith('assets/')) {
        return `${bucket}/`;
    }
    return `${rawPrefix}${bucket}/`;
};

/**
 * Rewrites template /assets/{css|js|images}/ references in one text buffer.
 *
 * @param {string} content
 * @param {'no-assets' | string} mode no-assets, or grouped folder name (including 'assets' for identity).
 * @returns {string}
 */
export const rewriteStarterAssetReferencesInContent = (content, mode) => {
    if (mode === 'assets') {
        return content;
    }

    const useNoAssets = mode === 'no-assets';
    const targetDir = useNoAssets ? null : mode;

    const mapPrefix = (rawPrefix, bucket) => {
        if (useNoAssets) {
            return rewritePrefixForNoAssetsLayout(rawPrefix, bucket);
        }
        return rewritePrefixForCustomGroupedLayout(rawPrefix, bucket, targetDir);
    };

    let updated = content;

    updated = updated.replace(
        REGEX.quotedAssetBucket,
        (match, quote, prefix, bucket) => {
            return `${quote}${mapPrefix(prefix, bucket)}`;
        }
    );

    updated = updated.replace(
        REGEX.urlAssetBucket,
        (match, before, prefix, bucket) => {
            return `${before}${mapPrefix(prefix, bucket)}`;
        }
    );

    return updated;
};

/**
 * Walks srcDir under cwd and applies starter asset URL rewrites. Idempotent when URLs already match layout.
 *
 * @param {string} cwd Project root.
 * @param {string} srcDir Source dir relative to cwd (e.g. www/src).
 * @param {unknown} assetsDir Config assetsDir; ''/falsy means flat css/js/images layout.
 * @param {{ silent?: boolean }} [options] If silent, skip Print.info on success.
 */
export const syncStarterAssetUrlPrefixes = (cwd, srcDir, assetsDir, options = {}) => {
    const grouped = normalizeGroupedAssetsDir(assetsDir);
    const mode = grouped === '' ? 'no-assets' : grouped;

    if (mode !== 'no-assets' && mode === 'assets') {
        return;
    }

    const srcRoot = Path.join(cwd, ...srcDir.replace(/\\/g, '/').split('/').filter(Boolean));
    if (!Fs.existsSync(srcRoot)) {
        return;
    }

    const rewriteCount = { files: 0 };

    const walkAndPatch = (dir) => {
        const entries = Fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = Path.join(dir, entry.name);
            if (entry.isDirectory()) {
                walkAndPatch(fullPath);
                continue;
            }

            const ext = Path.extname(entry.name).toLowerCase();
            if (!TEXT_EXTENSIONS.has(ext)) {
                continue;
            }

            let original = '';
            try {
                original = Fs.readFileSync(fullPath, 'utf-8');
            } catch (err) {
                Print.warn(`Could not read ${fullPath}: ${err.message}`);
                continue;
            }

            const rewritten = rewriteStarterAssetReferencesInContent(original, mode);
            if (rewritten !== original) {
                Fs.writeFileSync(fullPath, rewritten, 'utf-8');
                rewriteCount.files += 1;
            }
        }
    };

    walkAndPatch(srcRoot);

    if (rewriteCount.files > 0 && !options.silent) {
        if (mode === 'no-assets') {
            Print.info(`Adjusted no-assets starter paths in ${rewriteCount.files} copied file(s).`);
        } else {
            Print.info(`Adjusted starter paths for assets folder "${mode}" in ${rewriteCount.files} file(s).`);
        }
    }
};
