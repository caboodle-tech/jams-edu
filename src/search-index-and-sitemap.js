import Fs from 'fs';
import Path from 'path';
import { createHash } from 'node:crypto';
import { SimpleHtmlParser } from '@caboodle-tech/jhp/simple-html-parser';
import Print from './imports/print.js';

/**
 * @typedef {object} SearchIndexOptions
 * @property {string} usersRoot
 * @property {string} destDir
 * @property {string} [websiteUrl]
 * @property {string} [assetsDir]
 * @property {Record<string, string> | null} [assetPaths]
 * @property {string} [quartoAssetsDir]
 * @property {boolean} [verbose]
 */

const WEAK_DEFAULT_DESCRIPTION = 'JamsEdu static site generator for teaching and open content.';

const READ_CAP_BYTES = 3 * 1024 * 1024;

const SNIPPET_CAP = 520;

const MAX_HEADINGS = 48;

const MAX_HEADING_TEXT = 2200;

const collapseWhitespace = (text) => {
    return String(text || '').replace(/\s+/gu, ' ').trim();
};

/**
 * @param {string} destDir
 * @param {string} absHtmlPath
 * @returns {string} Site path with leading slash (POSIX).
 */
const destPathToSitePath = (destDir, absHtmlPath) => {
    const resolvedDest = Path.resolve(destDir);
    const resolvedFile = Path.resolve(absHtmlPath);
    const rel = Path.relative(resolvedDest, resolvedFile).replace(/\\/g, '/');
    const u = rel.startsWith('/') ? rel : `/${rel}`;
    return u.replace(/\/{2,}/g, '/');
};

/**
 * @param {string} relPosix Lowercase path relative to dest root, forward slashes, no leading slash.
 * @param {{ assetsDirNorm: string; assetPrefixNorms: string[]; quartoAssetsNorm: string }} skip
 * @returns {boolean}
 */
const shouldSkipRelativeHtml = (relPosix, skip) => {
    if (!relPosix || relPosix.includes('..')) {
        return true;
    }
    if (skip.assetsDirNorm && (relPosix === skip.assetsDirNorm || relPosix.startsWith(`${skip.assetsDirNorm}/`))) {
        return true;
    }
    for (const prefix of skip.assetPrefixNorms) {
        if (relPosix === prefix || relPosix.startsWith(`${prefix}/`)) {
            return true;
        }
    }
    const qn = skip.quartoAssetsNorm;
    if (qn && (relPosix === qn || relPosix.startsWith(`${qn}/`))) {
        return true;
    }
    return false;
};

/**
 * @param {string} dir
 * @param {string} destDir
 * @param {{ assetsDirNorm: string; assetPrefixNorms: string[]; quartoAssetsNorm: string }} skip
 * @param {string[]} out
 */
const collectHtmlPathsRecursive = (dir, destDir, skip, out) => {
    let entries;
    try {
        entries = Fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return;
    }
    for (const ent of entries) {
        const full = Path.join(dir, ent.name);
        if (ent.isDirectory()) {
            const relRaw = Path.relative(destDir, full).replace(/\\/g, '/');
            const relLower = relRaw.toLowerCase();
            if (!shouldSkipRelativeHtml(relLower, skip)) {
                collectHtmlPathsRecursive(full, destDir, skip, out);
            }
        } else if (ent.isFile() && ent.name.toLowerCase().endsWith('.html')) {
            const relLower = Path.relative(destDir, full).replace(/\\/g, '/').toLowerCase();
            if (!shouldSkipRelativeHtml(relLower, skip)) {
                out.push(full);
            }
        }
    }
};

/**
 * @param {string} p
 * @returns {string}
 */
const normalizeAssetPrefix = (p) => {
    if (!p || typeof p !== 'string') {
        return '';
    }
    return p.replace(/^\/+/u, '').replace(/\\/g, '/').toLowerCase().replace(/\/+$/u, '');
};

/**
 * @param {string} absPath
 * @returns {{ text: string; truncated: boolean }}
 */
const readHtmlForIndex = (absPath) => {
    const stat = Fs.statSync(absPath);
    if (stat.size > READ_CAP_BYTES) {
        const fd = Fs.openSync(absPath, 'r');
        try {
            const buf = Buffer.allocUnsafe(READ_CAP_BYTES);
            Fs.readSync(fd, buf, 0, READ_CAP_BYTES, 0);
            const text = buf.toString('utf8');
            Print.warn(
                `Search index: truncated read (${READ_CAP_BYTES} bytes) for oversized HTML: ${absPath}`
            );
            return { text, truncated: true };
        } finally {
            Fs.closeSync(fd);
        }
    }
    return { text: Fs.readFileSync(absPath, 'utf8'), truncated: false };
};

/**
 * @param {object} root Parsed HTML root node (`SimpleHtmlParser`).
 * @returns {number | null} Epoch ms from first parseable meta date in document order under `<head>`.
 */
const parseMetaDateMsFromHead = (root) => {
    const head = root.querySelector('head');
    const scope = head ?? root;
    const metas = scope.querySelectorAll('meta');
    const tryContent = (node) => {
        const raw = node?.attributes?.content;
        if (typeof raw !== 'string' || !raw.trim()) {
            return null;
        }
        const ms = Date.parse(raw.trim());
        return Number.isNaN(ms) ? null : ms;
    };
    for (const meta of metas) {
        const name = typeof meta.attributes?.name === 'string' ? meta.attributes.name.toLowerCase() : '';
        const prop = typeof meta.attributes?.property === 'string' ? meta.attributes.property.toLowerCase() : '';
        const itemprop = typeof meta.attributes?.itemprop === 'string' ? meta.attributes.itemprop.toLowerCase() : '';
        let candidate = false;
        if (name === 'date' || name === 'dcterms.date') {
            candidate = true;
        }
        if (prop === 'article:published_time' || prop === 'og:updated_time') {
            candidate = true;
        }
        if (itemprop === 'datepublished') {
            candidate = true;
        }
        if (candidate) {
            const ms = tryContent(meta);
            if (ms !== null) {
                return ms;
            }
        }
    }
    return null;
};

/**
 * @param {object} root Parsed HTML root node (`SimpleHtmlParser`).
 * @returns {string[]}
 */
const collectHeadingsInOrder = (root) => {
    const nodes = root.querySelectorAll('h1,h2,h3,h4,h5,h6');
    const out = [];
    let total = 0;
    for (const node of nodes) {
        if (out.length >= MAX_HEADINGS) {
            break;
        }
        const txt = collapseWhitespace(node.innerText || '');
        if (txt) {
            if (total + txt.length > MAX_HEADING_TEXT) {
                const slice = txt.slice(0, Math.max(0, MAX_HEADING_TEXT - total));
                if (slice) {
                    out.push(slice);
                }
                break;
            }
            out.push(txt);
            total += txt.length + 1;
        }
    }
    return out;
};

/**
 * @param {object} root Parsed HTML root node (`SimpleHtmlParser`).
 * @param {string} description
 * @returns {string}
 */
const buildSnippet = (root, description) => {
    const weak = !description || description === WEAK_DEFAULT_DESCRIPTION;
    let sourceText = '';
    if (weak) {
        const main = root.querySelector('main');
        const body = root.querySelector('body');
        sourceText = collapseWhitespace((main?.innerText || body?.innerText || '').trim());
    } else {
        sourceText = collapseWhitespace(description);
    }
    if (!sourceText) {
        return '';
    }
    return sourceText.length > SNIPPET_CAP ? `${sourceText.slice(0, SNIPPET_CAP)}…` : sourceText;
};

/**
 * @param {string} text
 * @returns {string}
 */
const sha256HexUtf8 = (text) => {
    return createHash('sha256').update(text, 'utf8').digest('hex');
};

/**
 * @param {string} targetPath
 * @param {string} body
 */
const writeFileAtomic = (targetPath, body) => {
    const dir = Path.dirname(targetPath);
    Fs.mkdirSync(dir, { recursive: true });
    const tmp = `${targetPath}.tmp`;
    Fs.writeFileSync(tmp, body, 'utf8');
    try {
        if (Fs.existsSync(targetPath)) {
            Fs.unlinkSync(targetPath);
        }
        Fs.renameSync(tmp, targetPath);
    } catch {
        Fs.copyFileSync(tmp, targetPath);
        try {
            Fs.unlinkSync(tmp);
        } catch {
            /* ignore */
        }
    }
};

/**
 * @param {string} s
 * @returns {string}
 */
const escapeXmlText = (s) => {
    return String(s)
        .replace(/&/gu, '&amp;')
        .replace(/</gu, '&lt;')
        .replace(/>/gu, '&gt;')
        .replace(/"/gu, '&quot;');
};

/**
 * Writes `sitemap.json`, updates `.jamsedu/search-output-fingerprints.json`, and optionally `sitemap.xml`.
 *
 * @param {SearchIndexOptions} opts
 * @returns {Promise<void>}
 */
export const writeSearchIndexAndSitemap = async(opts) => {
    const destDir = Path.resolve(opts.destDir);
    const usersRoot = Path.resolve(opts.usersRoot);
    const jamseduDir = Path.join(usersRoot, '.jamsedu');
    const mtimeJsonPath = Path.join(jamseduDir, 'build-source-mtimes.json');
    const fingerprintPath = Path.join(jamseduDir, 'search-output-fingerprints.json');
    const websiteUrlRaw = typeof opts.websiteUrl === 'string' ? opts.websiteUrl.trim().replace(/\/+$/u, '') : '';
    const assetsDirNorm = normalizeAssetPrefix(opts.assetsDir || '');
    const assetPrefixNorms = [];
    if (opts.assetPaths && typeof opts.assetPaths === 'object') {
        for (const v of Object.values(opts.assetPaths)) {
            const n = normalizeAssetPrefix(String(v || ''));
            if (n) {
                assetPrefixNorms.push(n);
            }
        }
    }
    const quartoAssetsNorm = normalizeAssetPrefix(opts.quartoAssetsDir || 'quarto-assets') || 'quarto-assets';
    const skip = { assetsDirNorm, assetPrefixNorms, quartoAssetsNorm };
    const verbose = opts.verbose === true;

    /** @type {Record<string, number>} */
    let sourceMtimes = {};
    if (Fs.existsSync(mtimeJsonPath)) {
        try {
            const parsed = JSON.parse(Fs.readFileSync(mtimeJsonPath, 'utf8'));
            if (parsed && typeof parsed.paths === 'object' && parsed.paths !== null) {
                sourceMtimes = parsed.paths;
            }
        } catch {
            Print.warn(`Search index: could not read ${mtimeJsonPath}; source mtimes map is empty.`);
        }
    } else if (verbose) {
        Print.info(`Search index: missing ${mtimeJsonPath}; using destination mtimes for base times.`);
    }

    /** @type {Record<string, string>} */
    let storedDigests = {};
    if (Fs.existsSync(fingerprintPath)) {
        try {
            const parsed = JSON.parse(Fs.readFileSync(fingerprintPath, 'utf8'));
            if (parsed && typeof parsed.urls === 'object' && parsed.urls !== null) {
                storedDigests = parsed.urls;
            }
        } catch {
            Print.warn(`Search index: could not read ${fingerprintPath}; starting fingerprints fresh.`);
        }
    }

    const buildTimeMs = Date.now();
    const generatedAt = new Date(buildTimeMs).toISOString();
    const htmlPaths = [];
    collectHtmlPathsRecursive(destDir, destDir, skip, htmlPaths);
    htmlPaths.sort((a, b) => {
        return destPathToSitePath(destDir, a).localeCompare(destPathToSitePath(destDir, b));
    });

    const pages = [];
    const nextFingerprints = {};

    const processOne = (absPath) => {
        const parser = new SimpleHtmlParser();
        const u = destPathToSitePath(destDir, absPath);
        const { text: html } = readHtmlForIndex(absPath);
        const digest = sha256HexUtf8(html);
        let root;
        try {
            root = parser.parse(html);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            Print.warn(`Search index: parse failed for ${u}: ${msg}`);
            return;
        }

        const title = collapseWhitespace(root.querySelector('title')?.innerText || '');
        const descNode = root.querySelector('meta[name="description"]');
        const description = typeof descNode?.attributes?.content === 'string' ?
            collapseWhitespace(descNode.attributes.content) :
            '';
        const kwNode = root.querySelector('meta[name="keywords"]');
        const keywords = typeof kwNode?.attributes?.content === 'string' ?
            collapseWhitespace(kwNode.attributes.content) :
            '';

        const headingTexts = collectHeadingsInOrder(root);
        let hList = [...headingTexts];
        if (title) {
            const titleLower = title.toLowerCase();
            hList = hList.filter((hx, ih) => {
                return !(ih === 0 && hx.toLowerCase() === titleLower);
            });
            hList = [title, ...hList];
        }
        const h = hList;
        const s = buildSnippet(root, description);
        const metaMs = parseMetaDateMsFromHead(root);

        let mBase = metaMs;
        if (mBase === null) {
            const fromBuild = sourceMtimes[u];
            if (typeof fromBuild === 'number' && Number.isFinite(fromBuild)) {
                mBase = fromBuild;
            } else {
                try {
                    mBase = Math.floor(Fs.statSync(absPath).mtimeMs);
                } catch {
                    mBase = buildTimeMs;
                }
                Print.warn(
                    `Search index: missing build source mtime for ${u}; using destination HTML mtime for mBase.`
                );
            }
        }

        const prev = storedDigests[u];
        let m = mBase;
        if (!prev) {
            m = mBase;
        } else if (digest !== prev) {
            m = Math.max(mBase, buildTimeMs);
        } else {
            m = mBase;
        }
        nextFingerprints[u] = digest;

        pages.push({
            u,
            t: title,
            d: description,
            k: keywords,
            h,
            s,
            m
        });
    };

    for (const absPath of htmlPaths) {
        processOne(absPath);
    }

    const sitemapPayload = {
        generatedAt,
        p: pages
    };
    writeFileAtomic(Path.join(destDir, 'sitemap.json'), `${JSON.stringify(sitemapPayload)}\n`);
    writeFileAtomic(fingerprintPath, `${JSON.stringify({ version: 1, urls: nextFingerprints })}\n`);

    if (websiteUrlRaw) {
        const lines = [
            `<?xml version="1.0" encoding="UTF-8"?>`,
            `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`
        ];
        for (const row of pages) {
            const pathPart = row.u.startsWith('/') ? row.u : `/${row.u}`;
            const loc = `${websiteUrlRaw}${pathPart}`;
            const lastmod = new Date(row.m).toISOString();
            lines.push(
                `<url><loc>${escapeXmlText(loc)}</loc><lastmod>${escapeXmlText(lastmod)}</lastmod></url>`
            );
        }
        lines.push('</urlset>');
        writeFileAtomic(Path.join(destDir, 'sitemap.xml'), `${lines.join('\n')}\n`);
    }

    if (verbose) {
        const xmlNote = websiteUrlRaw ? ' and sitemap.xml' : '';
        Print.info(`Search index: wrote ${pages.length} page(s) to sitemap.json${xmlNote}.`);
    }
};
