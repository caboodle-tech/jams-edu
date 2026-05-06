/**
 * Shared mapping from template layout (under template `src/`) to the user's source tree.
 * Must stay in sync with the update scanner (updater.js) and `jamsedu --init` layout baking (initializer.js).
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
 * @param {{ assetsDir?: string, templateDir?: string }} [userConfig]
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

    // css, js, images only: map under assetsDir when set
    if (ASSET_ROOT_FOLDERS.has(first)) {
        const dirForType = assetsDir ? `${assetsDir}/${first}` : first;
        const segment = restPath ? `${dirForType}/${restPath}` : dirForType;
        return `${normalizedRoot}/${segment}`.replace(/\\/g, '/');
    }

    // Any other bundle path stays under src root as-is
    return `${normalizedRoot}/${normalized}`.replace(/\\/g, '/');
};
