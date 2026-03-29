/**
 * Shared mapping from template layout (under template `src/`) to the user's source tree.
 * Must stay in sync with JamsEdu build output mapping (jamsedu.js) and the update scanner (updater.js).
 */

/**
 * Top-level folders under the bundled `src/` that are static assets (CSS, JS, images only).
 * Everything else (e.g. `index.jhp`, `templates/`, `pages/`) is not prefixed with `assetsDir`.
 */
const ASSET_ROOT_FOLDERS = new Set(['css', 'js', 'images']);

/**
 * Map path after template `src/` (e.g. css/main.js, templates/head.html) to a path relative to project root.
 *
 * @param {string} userSrcDir Relative source root, forward slashes (e.g. www/src)
 * @param {string} pathAfterSrc Path after src/ with forward slashes
 * @param {{ assetsDir?: string, assetPaths?: Record<string, string> | null, templateDir?: string }} [userConfig]
 *        templateDir: project-relative folder where bundled `templates/*` partials are written; must match
 *        your `$include()` paths. Not related to `assetsDir` (css/js/images only).
 * @returns {string} Relative path from project root, forward slashes
 */
export const templateSrcPathToUserPath = (userSrcDir, pathAfterSrc, userConfig = {}) => {
    const normalizedRoot = String(userSrcDir || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    const normalized = String(pathAfterSrc || '').replace(/\\/g, '/').replace(/^\/+/, '');
    if (!normalized) {
        return normalizedRoot;
    }

    const parts = normalized.split('/').filter(Boolean);
    const first = parts[0];
    const rest = parts.slice(1);
    const restPath = rest.length ? rest.join('/') : '';

    const assetsDir = typeof userConfig.assetsDir === 'string' ?
        userConfig.assetsDir.replace(/\\/g, '/').replace(/^\/+/, '') :
        '';
    const assetPaths = userConfig.assetPaths && typeof userConfig.assetPaths === 'object' ?
        userConfig.assetPaths :
        null;

    // Site pages at bundle src root (e.g. index.jhp): never under assets/
    if (parts.length === 1 && first.endsWith('.jhp')) {
        return `${normalizedRoot}/${first}`.replace(/\\/g, '/');
    }

    // Nested pages (e.g. src/pages/foo.jhp in a future bundle)
    if (first === 'pages') {
        const segment = restPath ? `pages/${restPath}` : 'pages';
        return `${normalizedRoot}/${segment}`.replace(/\\/g, '/');
    }

    // JHP partials: bundle `templates/foo.html` → `templateDir/foo.html` (user-chosen path in config only)
    if (first === 'templates') {
        const templateDirRaw = typeof userConfig.templateDir === 'string' ?
            userConfig.templateDir.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '') :
            '';
        const base = templateDirRaw || `${normalizedRoot}/templates`;
        return restPath ? `${base}/${restPath}` : base;
    }

    // css, js, images only: map under assetsDir / assetPaths
    if (ASSET_ROOT_FOLDERS.has(first)) {
        const dirForType = assetPaths && typeof assetPaths[first] === 'string' ?
            assetPaths[first].replace(/\\/g, '/').replace(/^\/+/, '') :
            assetsDir ? `${assetsDir}/${first}` : first;
        const segment = restPath ? `${dirForType}/${restPath}` : dirForType;
        return `${normalizedRoot}/${segment}`.replace(/\\/g, '/');
    }

    // Any other bundle path stays under src root as-is
    return `${normalizedRoot}/${normalized}`.replace(/\\/g, '/');
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
