/**
 * Shared mapping from template layout (under template `src/`) to the user's source tree.
 * Must stay in sync with JamsEdu build output mapping (jamsedu.js) and the update scanner (updater.js).
 */

/**
 * Map path after template `src/` (e.g. css/jamsedu/foo.css, js/main.js) to a path relative to project root.
 *
 * @param {string} userSrcDir Relative source root, forward slashes (e.g. www/src)
 * @param {string} pathAfterSrc Path after src/ with forward slashes
 * @param {{ assetsDir?: string, assetPaths?: Record<string, string> | null }} [userConfig]
 * @returns {string} Relative path from project root, forward slashes
 */
export const templateSrcPathToUserPath = (userSrcDir, pathAfterSrc, userConfig = {}) => {
    const assetsDir = typeof userConfig.assetsDir === 'string' ? userConfig.assetsDir : '';
    const assetPaths = userConfig.assetPaths && typeof userConfig.assetPaths === 'object' ? userConfig.assetPaths : null;
    const parts = pathAfterSrc.split('/').filter(Boolean);
    const type = parts[0] || '';
    const rest = parts.slice(1).join('/');
    const dirForType = assetPaths && typeof assetPaths[type] === 'string' ?
        assetPaths[type] :
        assetsDir ? `${assetsDir}/${type}` : type;
    const segment = rest ? `${dirForType}/${rest}` : dirForType;
    return `${userSrcDir}/${segment}`.replace(/\\/g, '/');
};

/**
 * Keep only string values suitable for path segments; normalize slashes.
 *
 * @param {unknown} raw From user config `assetPaths`
 * @returns {Record<string, string> | null}
 */
export const sanitizeAssetPaths = (raw) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        return null;
    }
    const out = {};
    for (const [key, value] of Object.entries(raw)) {
        if (typeof value === 'string' && value.trim() !== '') {
            out[key] = value.trim().replace(/\\/g, '/').replace(/^\/+/, '');
        }
    }
    return Object.keys(out).length > 0 ? out : null;
};
