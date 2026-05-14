import Crypto from 'crypto';
import Fs from 'fs';
import Path from 'path';
import { templateSrcPathToUserPath } from './template-path-mapping.js';

/** Written at project root when the user accepts the favicon install offer during `jamsedu --update`. */
export const FAVICON_JAMSEDU_DOC_BASENAME = 'FAVICON-JAMSEDU.md';

/**
 * @param {string} absPath
 * @returns {string} Hex SHA-256 of file bytes
 */
export const sha256FileBuffer = (absPath) => {
    const buf = Fs.readFileSync(absPath);
    return Crypto.createHash('sha256').update(buf).digest('hex');
};

/**
 * Scans installed template `src/images/favicon/` for binary files to track on update.
 *
 * @param {string} templateDir Absolute path to package `src/template`
 * @param {string} userSrcDir Relative src root, forward slashes
 * @param {{ assetsDir?: string; templateDir?: string }} userConfig
 * @param {string} packageVersion JamsEdu package version for manifest rows
 * @param {{ sourceRepoMode?: boolean }} [options]
 * @returns {Array<{ templatePath: string; userPath: string; fullTemplatePath: string; version: string; component: string; content: string; binary: true }>}
 */
export const scanTemplateFaviconBinaryFiles = (templateDir, userSrcDir, userConfig, packageVersion, options = {}) => {
    const faviconDir = Path.join(templateDir, 'src', 'images', 'favicon');
    if (!Fs.existsSync(faviconDir)) {
        return [];
    }
    const normalizedSrc = String(userSrcDir || 'src').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    const out = [];
    let entries = [];
    try {
        entries = Fs.readdirSync(faviconDir, { withFileTypes: true });
    } catch {
        return [];
    }
    for (const ent of entries) {
        if (!ent.isFile()) {
            continue;
        }
        const { name } = ent;
        const relAfterSrc = `images/favicon/${name}`;
        const userPath = templateSrcPathToUserPath(normalizedSrc, relAfterSrc, userConfig).replace(/\\/g, '/');
        if (options.sourceRepoMode) {
            const norm = userPath.replace(/\\/g, '/').replace(/^\/+/, '');
            const srcNorm = normalizedSrc.replace(/\\/g, '/');
            if (norm !== srcNorm && !norm.startsWith(`${srcNorm}/`)) {
                continue;
            }
        }
        const safeComponent = `binary-favicon-${name.replace(/[^a-z0-9]+/giu, '-')}`.replace(/-+/gu, '-').replace(/^-|-$/gu, '');
        out.push({
            templatePath: `src/images/favicon/${name}`.replace(/\\/g, '/'),
            userPath,
            fullTemplatePath: Path.join(faviconDir, name),
            version: packageVersion,
            component: safeComponent || `binary-favicon-${name}`,
            content: '',
            binary: true
        });
    }
    return out;
};

/**
 * Ensures manifest rows exist for binary favicon files (buffer hashes only).
 *
 * @param {Record<string, unknown>} manifest
 * @param {ReturnType<typeof scanTemplateFaviconBinaryFiles>} binaryFiles
 * @param {string} cwd
 * @param {string} packageVersion
 * @returns {void}
 */
export const syncBinaryFaviconManifestEntries = (manifest, binaryFiles, cwd, packageVersion) => {
    if (!manifest.components || typeof manifest.components !== 'object') {
        manifest.components = {};
    }
    for (const t of binaryFiles) {
        const rel = t.userPath.replace(/\\/g, '/');
        const fullUser = Path.join(cwd, rel);
        let fileHash = '';
        if (Fs.existsSync(fullUser)) {
            try {
                fileHash = sha256FileBuffer(fullUser);
            } catch {
                fileHash = '';
            }
        }
        const userCustomized = false;
        manifest.components[t.component] = {
            file: rel,
            version: packageVersion,
            hash: fileHash,
            modified: false,
            userCustomized
        };
    }
};

/**
 * Copies template favicon directory into the user tree.
 *
 * @param {string} templateDir Absolute `src/template`
 * @param {string} cwd Project root
 * @param {string} userSrcDir Relative src
 * @param {{ assetsDir?: string; templateDir?: string }} userConfig
 * @returns {string} Relative path to favicon directory (forward slashes)
 */
export const copyTemplateFaviconDirectory = (templateDir, cwd, userSrcDir, userConfig) => {
    const srcDirNorm = String(userSrcDir || 'src').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    const destRel = templateSrcPathToUserPath(srcDirNorm, 'images/favicon', userConfig).replace(/\\/g, '/');
    const srcFav = Path.join(templateDir, 'src', 'images', 'favicon');
    const destAbs = Path.join(cwd, ...destRel.split('/').filter(Boolean));
    if (!Fs.existsSync(srcFav)) {
        return destRel;
    }
    Fs.mkdirSync(destAbs, { recursive: true });
    const names = Fs.readdirSync(srcFav, { withFileTypes: true });
    for (const ent of names) {
        if (!ent.isFile()) {
            continue;
        }
        const { name } = ent;
        Fs.copyFileSync(Path.join(srcFav, name), Path.join(destAbs, name));
    }
    return destRel;
};

/**
 * @param {string} cwd
 * @param {string} destRelDir Relative favicon directory (forward slashes)
 * @returns {void}
 */
export const writeFaviconJamseduMarkdown = (cwd, destRelDir) => {
    const lines = [
        '# Favicons (JamsEdu)',
        '',
        'JamsEdu installed the template favicon files under your source tree at:',
        '',
        `\`${destRelDir}/\``,
        '',
        'Published URLs (when using the default assets layout) are typically:',
        '',
        '- `/assets/images/favicon/favicon.ico`',
        '- `/assets/images/favicon/favicon.png`',
        '- `/assets/images/favicon/apple-touch-icon.png`',
        '',
        'Add the following inside your HTML `<head>` (for example in your `head.html` partial next to your other `<link>` tags):',
        '',
        '```html',
        '<link rel="icon" href="/assets/images/favicon/favicon.ico" sizes="any">',
        '<link rel="icon" href="/assets/images/favicon/favicon.png" type="image/png">',
        '<link rel="apple-touch-icon" href="/assets/images/favicon/apple-touch-icon.png">',
        '```',
        '',
        'If your `assetsDir` or `srcDir` layout differs, keep the **path after** your site root consistent with where these files were installed (see the folder path above).',
        ''
    ];
    Fs.writeFileSync(Path.join(cwd, FAVICON_JAMSEDU_DOC_BASENAME), `${lines.join('\n')}\n`, 'utf8');
};
