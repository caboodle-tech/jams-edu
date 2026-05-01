import Fs from 'fs';
import JHP from '@caboodle-tech/jhp';
import NodeSimpleServer from '@caboodle-tech/node-simple-server';
import Path from 'path';
import Print from './imports/print.js';
import Process from 'child_process';
import { WhatIs } from './imports/helpers.js';
import { dump as dumpYaml, load as parseYaml } from 'js-yaml';
import { exit } from 'process';
import { fileURLToPath } from 'url';
import { isTextFileForStripping, stripJamseduComments } from './imports/strip-jamsedu-comments.js';
import { writeSearchIndexAndSitemap } from './search-index-and-sitemap.js';

const Spawn = Process.spawn;

// Extension suffixes mapped to bundled asset dirs (CSS, JS, images, etc.).
const ASSET_TYPE_BY_EXT = Object.freeze({
    css: ['css'],
    js: ['js', 'mjs'],
    images: ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico']
});

/**
 * Absolute path to this package's root (the directory that contains `jamsedu.js`).
 *
 * Why it exists: shortcode and project YAML for Quarto are stored under `extensions/jamsedu/` in the same
 * directory as this file. When your site is built, that folder is copied into the working Quarto project
 * at `.quarto/_extensions/jamsedu/` because Quarto only loads extensions from paths named `_extensions/`.
 * See `#ensureManagedQuartoExtension` for the copy step.
 */
const JAMSEDU_MODULE_DIR = Path.dirname(fileURLToPath(import.meta.url));

const DEFAULT_DENY_COPY_EXTENSIONS = Object.freeze([
    'json',
    'md',
    'qmd',
    'sass',
    'scss',
    'ts'
]);

const REGEX = Object.freeze({
    /**
     * HTML entity decoding for `#sanitizeHtmlFragmentForJhp`. Decode `&amp;` last, then escape `& <>`
     * for JHP. `nbsp` stays as `\u00a0`.
     */
    entityAmpDecoded: /&amp;/g,
    entityDecCp: /&#(\d{1,7});/g,
    entityGt: /&gt;/g,
    entityHexCp: /&#x([0-9a-f]{1,6});/gi,
    entityLt: /&lt;/g,
    entityNamedApos: /&apos;/g,
    entityNbsp: /&nbsp;/g,
    entityNumDecimalQuote: /&#39;/g,
    entityQuot: /&quot;/g,
    // Split Markdown while preserving single-backtick `` `inline code` `` spans from math rewriting.
    markdownFenceLine: /^\s*```/,
    markdownFencedCodeBlock: /(```[\s\S]*?```)/g,
    markdownFencedDivClose: /^\s*:::\s*$/,
    markdownFencedDivOpen: /^\s*:::\s*\{([^}]*)\}\s*$/,
    markdownInlineCodeSegment: /(`[^`\n]*`)/g,
    // Markdown and math (applied before Pandoc where applicable).
    markdownMathBlock: /\$\$([\s\S]*?)\$\$/g,
    markdownMathInline: /\$([^$\n\r]+?)\$/g,
    // All other regexes:
    collapseSlashes: /\/+/g,
    dotPrefix: /^\./,
    escapeAmp: /&/g,
    escapeDoubleQuote: /"/g,
    escapeGt: />/g,
    escapeLt: /</g,
    frontmatter: /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/,
    frontmatterEndLine: /^---\s*$/,
    frontmatterRequiredStandaloneKeys: /(^|\n)\s*(title|description|author)\s*:/i,
    frontmatterStart: /^(?:\uFEFF)?---\r?\n/,
    htmlLeadingWhitespaceNewlines: /^(\s*\r?\n)+/,
    htmlPageSourceExt: /\.(jhp|qmd)$/i,
    htmlTagSplitChunks: /(<[^>]+\/?>)/g,
    htmlWholeTagLineLoose: /^\s*<[^>]+>\s*$/,
    httpUrlScheme: /^https?:\/\//u,
    includeShortcode: /^\s*\{\{<\s*include\s+["']?([^"'>\s]+)["']?\s*>}}\s*$/gm,
    jhpExt: /\.jhp$/i,
    leadingBom: /^\uFEFF/u,
    leadingDotSlash: /^\.\//,
    newline: /\r?\n/g,
    qmdExt: /\.qmd$/i,
    quartoHtmlSrcRelativeFiles: /(src=["'])([^"']*_files(?:\/|\\)[^"']*)(["'])/gi,
    quartoMarkdownImage: /!\[[^\]]*]\(([^)"']+)\)/gi,
    quartoMarkdownLinkRelativeFiles: /(!?\[[^\]]*]\()([^)"']*_files(?:\/|\\)[^)"']*)(\))/g,
    quartoWrappedSourceDivPreCode: new RegExp(
        '<div\\b([^>]*\\bsourceCode\\b[^>]*)>\\s*<pre\\b([^>]*)>\\s*<code\\b([^>]*)>([\\s\\S]*?)' +
            '<\\/code>\\s*<\\/pre>\\s*<\\/div>',
        'gi'
    ),
    htmlOpeningCodeTagCaseInsensitive: /<code\b/i,
    htmlPreBareInner: /<pre\b([^>]*)>([\s\S]*?)<\/pre>/gi,
    htmlPreWrappedCodeInner: /<pre\b([^>]*)>\s*<code\b([^>]*)>([\s\S]*?)<\/code>\s*<\/pre>/gi,
    lineEndingsCrlf: /\r\n/g,
    quartoFeaturesPathFromDot: /\]\(\.(?:\\|\/)features(?:\\|\/)*([^)]*)\)/gi,
    quartoFilesDirSuffix: /_files$/u,
    scriptOpenNoAttributes: /<script\s*>/gi,
    slash: /\//g,
    trimEdgeForwardSlashes: /^\/+|\/+$/g,
    trimEdgeSlashes: /^[/\\]+|[/\\]+$/g,
    trimLeadingForwardSlashes: /^\/+/,
    unicodeNbsp: /\u00a0/g,
    windowsSlash: /\\/g
});

/**
 * Temporary stand-in while Quarto Markdown + Pandoc run; restored to `\` after HTML fragment emits.
 * (Pandoc would otherwise treat `\frac` etc. as Markdown escapes.) BMP private-use, not Unicode noncharacters.
 */
const TEX_BACKSLASH_SENTINEL = '\uE000';

export default class JamsEdu {

    #assetsDir = '';

    #assetPaths = null;

    #destDir = '';

    #errorLimit = 2;

    #initialized = false;

    #JHP = null;

    #copyRules = {
        allowExt: new Set(),
        allowSuffix: new Set(),
        denyExt: new Set(DEFAULT_DENY_COPY_EXTENSIONS),
        denySuffix: new Set()
    };

    #NSS = null;

    #PORT = 5000;

    #srcDir = '';

    #watchDebounceMs = 80;

    #watchDebounceTimer = null;

    #pendingWatchEvents = [];

    /** Collected during builds when qmd renders are flushed in parallel after the directory walk. */
    #pendingQmdRenders = [];

    /** Max concurrent Quarto renders when draining `#pendingQmdRenders`. */
    #qmdRenderConcurrency = 3;

    #watchReloadThrottleMs = 550;

    #watchReloadLastFlushMs = 0;

    #watchReloadFlushTimer = null;

    #watchReloadQueued = {
        reloadAll: false,
        reloadStyles: false,
        pages: new Set()
    };

    /** When true, Quarto renders must never be skipped (`--build`). */
    #buildUsesCleanSweep = false;

    /**
     * Absolute path to the folder where include-only partials live (.jhp or HTML used only via
     * `$include`). Build and watch skip these files so nothing under this path is copied or emitted
     * into destDir; they are only consumed while processing other .jhp pages. Empty string disables.
     */
    #templateDir = '';

    #quarto = {
        assetsDir: 'quarto-assets',
        checked: false,
        command: null,
        checkedCandidates: [],
        rootDir: '',
        templatePath: ''
    };

    #usersRoot = '';

    #verbose = false;

    /** Optional public site origin for `sitemap.xml` `<loc>` values (no trailing slash). */
    #websiteUrl = '';

    /** During `clean` builds only: site path `u` (leading slash) to primary source `mtimeMs`. */
    #pageSourceMtimes = new Map();

    /** Relative qmd paths already warned for missing required frontmatter keys. */
    #qmdNearMissWarned = new Set();

    #bundledQuartoExtensionPayloads = null;

    constructor(config, usersRoot) {
        // Validating the config object.
        if (WhatIs(config) !== 'object') {
            Print.error('JamsEdu configuration is not a valid object!');
            return;
        }

        // Validating essential config properties.
        if (!config.destDir || WhatIs(config.destDir) !== 'string') {
            Print.error('JamsEdu configuration must have a valid "destDir" property!');
            return;
        }

        if (!config.srcDir || WhatIs(config.srcDir) !== 'string') {
            Print.error('JamsEdu configuration must have a valid "srcDir" property!');
            return;
        }

        // Keep a reference to important config values.
        this.#destDir = config.destDir;
        this.#srcDir = config.srcDir;
        const templateDirRaw = typeof config.templateDir === 'string' ? config.templateDir.trim() : '';
        this.#templateDir = templateDirRaw ? Path.resolve(usersRoot, templateDirRaw) : '';
        this.#usersRoot = usersRoot;
        this.#verbose = config.verbose === true;
        if (typeof config.websiteUrl === 'string') {
            const rawSite = config.websiteUrl.trim().replace(REGEX.trimEdgeForwardSlashes, '');
            this.#websiteUrl = rawSite.replace(/\/+$/u, '');
        } else {
            this.#websiteUrl = '';
        }

        // Optional: where to put CSS, JS, images. assetPaths overrides assetsDir per type.
        this.#assetsDir = typeof config.assetsDir === 'string' ? config.assetsDir : '';
        this.#assetPaths = WhatIs(config.assetPaths) === 'object' ? config.assetPaths : null;

        // Copy safety rules.
        this.#initializeCopyRules(config);

        // Quarto configuration.
        this.#initializeQuartoConfig(config);

        // Initialize JHP and add the users processors if any.
        this.#JHP = new JHP();

        if (config.pre && WhatIs(config.pre) === 'array') {
            this.#JHP.addPreProcessor(config.pre);
        }

        if (config.post && WhatIs(config.post) === 'array') {
            this.#JHP.addPostProcessor(config.post);
        }

        // Mark as initialized.
        this.#initialized = true;
    }

    /**
     * Builds the site. Full clean wipes `dest`; watch uses `clean: false`.
     *
     * @param {{ clean?: boolean }} [options]
     * @returns {Promise<void>}
     */
    async build(options = {}) {
        if (!this.#requireInit()) {
            if (this.#verbose) {
                Print.warn('JamsEdu has not been initialized properly! Build aborted.');
            }
            return;
        }

        const clean = options.clean !== false;
        this.#buildUsesCleanSweep = clean;
        try {
            if (clean) {
                this.#pageSourceMtimes.clear();
                try {
                    this.#clearDirectory(this.#destDir);
                } catch (err) {
                    Print.error(`Failed to clean destination directory: ${this.#destDir}`);
                    if (this.#verbose) {
                        Print.error(err);
                    }
                    exit(1);
                }
                this.#removeAllStraySrcQuartoCaches(this.#srcDir);
                this.#removeQuartoRootMarkdownArtifacts();
            }

            this.#pendingQmdRenders = [];
            this.#processDir(this.#srcDir, { deferQmd: true });
            this.#ensureManagedQuartoExtension();
            await this.#flushPendingQmdRenders();

            if (!clean && Fs.existsSync(this.#destDir)) {
                this.#reconcileDestWithSrcArtifacts();
            }

            this.#pruneStaleQuartoStagingFilesDirs();
            this.#pruneStaleStagedMarkdownTreesUnderQuartoRoot();

            if (clean && Fs.existsSync(this.#destDir)) {
                this.#persistBuildSourceMtimes();
                await writeSearchIndexAndSitemap({
                    assetPaths: this.#assetPaths,
                    assetsDir: this.#assetsDir,
                    destDir: this.#destDir,
                    quartoAssetsDir: this.#quarto.assetsDir,
                    usersRoot: this.#usersRoot,
                    verbose: this.#verbose,
                    websiteUrl: this.#websiteUrl
                });
            }
        } finally {
            this.#buildUsesCleanSweep = false;
        }
    }

    /**
     * Writes `.jamsedu/build-source-mtimes.json` for the post-build search indexer (`u` to source `mtimeMs`).
     */
    #persistBuildSourceMtimes() {
        const dir = Path.join(this.#usersRoot, '.jamsedu');
        Fs.mkdirSync(dir, { recursive: true });
        const paths = Object.fromEntries(
            [...this.#pageSourceMtimes.entries()].sort((a, b) => {
                return a[0].localeCompare(b[0]);
            })
        );
        const outPath = Path.join(dir, 'build-source-mtimes.json');
        Fs.writeFileSync(outPath, `${JSON.stringify({ version: 1, paths })}\n`, 'utf8');
    }

    /**
     * @param {string} destHtml Absolute destination `.html` path.
     * @returns {string} Site path with leading slash (POSIX).
     */
    #destHtmlToSitePath(destHtml) {
        const rel = Path.relative(this.#destDir, destHtml).replace(REGEX.windowsSlash, '/');
        const u = rel.startsWith('/') ? rel : `/${rel}`;
        return u.replace(/\/+/g, '/');
    }

    /**
     * Records primary source `mtimeMs` for a built HTML page during clean builds only.
     *
     * @param {string} destHtml
     * @param {string} sourceFile
     */
    #recordPageSourceMtime(destHtml, sourceFile) {
        if (!this.#buildUsesCleanSweep) {
            return;
        }
        if (!destHtml.toLowerCase().endsWith('.html')) {
            return;
        }
        try {
            const u = this.#destHtmlToSitePath(destHtml);
            const st = Fs.statSync(sourceFile);
            this.#pageSourceMtimes.set(u, Math.floor(st.mtimeMs));
        } catch {
            /* ignore missing stat */
        }
    }

    #removeAllStraySrcQuartoCaches(startDir) {
        if (!Fs.existsSync(startDir)) {
            return;
        }
        const entries = Fs.readdirSync(startDir, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.isDirectory()) {
                const entryPath = Path.join(startDir, entry.name);
                if (entry.name === '.quarto') {
                    Fs.rmSync(entryPath, { recursive: true, force: true });
                } else {
                    this.#removeAllStraySrcQuartoCaches(entryPath);
                }
            }
        }
    }

    #clearDirectory(dir) {
        // Safety check: ensure directory path is valid
        if (!dir || typeof dir !== 'string') {
            throw new Error('Invalid directory path');
        }

        // If directory doesn't exist, nothing to clear
        if (!Fs.existsSync(dir)) {
            return;
        }

        const entries = Fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = Path.join(dir, entry.name);

            // CRITICAL: Skip symlinks - never follow or delete them
            if (entry.isSymbolicLink()) {
                // eslint-disable-next-line no-continue
                continue;
            }

            if (entry.isDirectory()) {
                this.#clearDirectory(fullPath);
                Fs.rmdirSync(fullPath); // Remove the now-empty directory
            } else {
                // Remove regular files
                Fs.unlinkSync(fullPath);
            }
        }
    }

    /**
     * Resolves a local Quarto line `{{< include ... >}}` target to an absolute path, or null for remote /
     * missing files.
     *
     * @param {string} includePathRaw Captured shortcode argument.
     * @param {string} absoluteParentQmdPath Source `.qmd` hosting the shortcode line.
     * @returns {string|null}
     */
    #resolveLocalQuartoIncludePath(includePathRaw, absoluteParentQmdPath) {
        const raw = typeof includePathRaw === 'string' ? includePathRaw.trim() : '';
        if (!raw || REGEX.httpUrlScheme.test(raw)) {
            return null;
        }
        try {
            const resolvedPath = raw.startsWith('/') ?
                Path.resolve(this.#srcDir, raw.replace(REGEX.trimEdgeForwardSlashes, '')) :
                Path.resolve(Path.dirname(absoluteParentQmdPath), raw);
            return Fs.existsSync(resolvedPath) ? resolvedPath : null;
        } catch {
            return null;
        }
    }

    /**
     * Lists absolute paths whose mtimes invalidate a `.qmd` output when skipping stale renders.
     *
     * @param {string} absoluteQmdSrc
     */
    #getQuartoStaleSkipInvalidationPaths(absoluteQmdSrc) {
        const bundled = Path.join(JAMSEDU_MODULE_DIR, 'extensions', 'jamsedu');
        const extras = [];
        extras.push(Path.join(bundled, 'extension.yml'));
        extras.push(Path.join(bundled, 'jamsedu.lua'));
        extras.push(Path.join(bundled, 'jamsedu-blocks.lua'));
        extras.push(Path.join(bundled, 'project.yml'));
        if (this.#quarto.templatePath) {
            extras.push(Path.resolve(this.#quarto.templatePath));
        }
        try {
            const body = Fs.readFileSync(absoluteQmdSrc, 'utf8');
            const matches = body.matchAll(REGEX.includeShortcode);
            for (const match of matches) {
                const resolvedPath = this.#resolveLocalQuartoIncludePath(
                    typeof match[1] === 'string' ? match[1] : '',
                    absoluteQmdSrc
                );
                if (resolvedPath) {
                    extras.push(resolvedPath);
                }
            }
        } catch {
            // Conservative: omit includes if unreadable; stale skip will not apply.
        }
        return [...new Set(extras)];
    }

    /**
     * @returns {Promise<string>}
     */
    #runCommandAsync(command, args, options = {}) {
        const envOverrides = WhatIs(options.env) === 'object' ? options.env : {};
        return new Promise((resolve, reject) => {
            const child = Spawn(command, args, {
                cwd: options.cwd || this.#usersRoot,
                env: {
                    ...process.env,
                    ...envOverrides
                },
                windowsHide: true,
                stdio: typeof options.input === 'string' ? ['pipe', 'pipe', 'pipe'] : ['ignore', 'pipe', 'pipe']
            });
            let stdout = '';
            let stderr = '';
            child.stdout?.setEncoding('utf8');
            child.stderr?.setEncoding('utf8');
            child.stdout?.on('data', (chunk) => {
                stdout += chunk;
            });
            child.stderr?.on('data', (chunk) => {
                stderr += chunk;
            });
            child.on('error', (err) => {
                reject(err);
            });
            child.on('close', (code) => {
                if (code !== 0) {
                    const errorText = [
                        `Command failed: ${command} ${args.join(' ')}`,
                        stdout ? `stdout:\n${stdout}` : '',
                        stderr ? `stderr:\n${stderr}` : ''
                    ].filter(Boolean).join('\n');
                    reject(new Error(errorText));
                    return;
                }
                resolve(stdout || '');
            });
            if (typeof options.input === 'string') {
                child.stdin.write(options.input, 'utf8');
                child.stdin.end();
            }
        });
    }

    /**
     * Drops `basename_files` dirs under Quarto staging when no matching `.qmd` exists under `srcDir`.
     */
    #pruneStaleQuartoStagingFilesDirs() {
        const root = this.#quarto.rootDir;
        if (!Fs.existsSync(root)) {
            return;
        }
        const walk = (dir) => {
            let entries = [];
            try {
                entries = Fs.readdirSync(dir, { withFileTypes: true });
            } catch {
                return;
            }
            for (const entry of entries) {
                const fullPath = Path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    if (REGEX.quartoFilesDirSuffix.test(entry.name)) {
                        const relFromQuarto = Path.relative(root, Path.dirname(fullPath));
                        const posixRel = relFromQuarto.replace(REGEX.windowsSlash, '/');
                        const normalizedRel = posixRel === '' ? '.' : posixRel.replace(REGEX.windowsSlash, '/');
                        const baseStem = Path.parse(entry.name).name.replace(REGEX.quartoFilesDirSuffix, '');
                        const qmdRel = Path.join(normalizedRel, `${baseStem}.qmd`)
                            .replace(REGEX.leadingDotSlash, '')
                            .replace(REGEX.windowsSlash, Path.sep);
                        const srcMustExist = normalizedRel === '.' || normalizedRel === '' ?
                            Path.join(this.#srcDir, `${baseStem}.qmd`) :
                            Path.join(this.#srcDir, qmdRel);
                        const srcNorm = Path.resolve(srcMustExist);
                        if (
                            !srcNorm.startsWith(Path.resolve(this.#srcDir)) ||
                            !Fs.existsSync(srcNorm) ||
                            Path.extname(srcNorm).toLowerCase() !== '.qmd'
                        ) {
                            Fs.rmSync(fullPath, { recursive: true, force: true });
                        }
                        continue;
                    }
                    walk(fullPath);
                }
            }
        };
        walk(root);
    }

    /**
     * Removes staged `.md`/`.qmd` leaves under the managed Quarto dir when the site no longer has that source.
     */
    #pruneStaleStagedMarkdownTreesUnderQuartoRoot() {
        const root = this.#quarto.rootDir;
        if (!Fs.existsSync(root)) {
            return;
        }
        /** @param {string} dir */
        const walk = (dir) => {
            let entries = [];
            try {
                entries = Fs.readdirSync(dir, { withFileTypes: true });
            } catch {
                return;
            }
            for (const entry of entries) {
                const abs = Path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    if (
                        entry.name === '_extensions' ||
                        entry.name === '.quarto'
                    ) {
                        continue;
                    }
                    walk(abs);
                } else if (entry.isFile()) {
                    const rel = Path.relative(root, abs).replace(REGEX.windowsSlash, Path.sep);
                    const lowerName = entry.name.toLowerCase();
                    let srcExpected;
                    if (lowerName.endsWith('.md')) {
                        const dirPart = Path.dirname(rel);
                        const stem = Path.parse(entry.name).name;
                        srcExpected = Path.join(
                            this.#srcDir,
                            dirPart === '.' ? '' : dirPart,
                            `${stem}.qmd`
                        );
                    } else if (lowerName.endsWith('.qmd')) {
                        srcExpected = Path.join(this.#srcDir, rel);
                    } else {
                        continue;
                    }
                    if (
                        !Fs.existsSync(srcExpected) ||
                        Path.extname(srcExpected).toLowerCase() !== '.qmd'
                    ) {
                        try {
                            Fs.unlinkSync(abs);
                        } catch {
                            /* leave */
                        }
                    }
                }
            }
        };
        walk(root);
    }

    /**
     * Recursively collects paths that `watch`/`build` publishes from `walkDir`; drives reconciliation.
     * @returns {{ htmlPaths:Set<string>; copiedPaths:Set<string>; quartoDirs:Set<string>; }}
     */
    #collectExpectedArtifactsFromWalk(walkDir) {
        const htmlPaths = new Set();
        const copiedPaths = new Set();
        const quartoDirs = new Set();

        const visit = (dir) => {
            let entries = [];
            try {
                entries = Fs.readdirSync(dir, { withFileTypes: true });
            } catch {
                return;
            }

            for (const entry of entries) {
                if (entry.name === '.quarto') {
                    continue;
                }
                const srcPath = Path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    visit(srcPath);
                } else if (entry.isFile()) {
                    if (this.#isUnderTemplateDir(srcPath)) {
                        continue;
                    }
                    const relativePath = Path.relative(this.#srcDir, srcPath);
                    const normalizedRelPosix = relativePath.replace(REGEX.windowsSlash, '/');
                    const lower = normalizedRelPosix.toLowerCase();
                    if (REGEX.jhpExt.test(lower)) {
                        htmlPaths.add(
                            Path.resolve(this.#getDestPathFromRelative(relativePath, true, ''))
                        );
                    } else if (REGEX.qmdExt.test(lower)) {
                        if (this.#isQmdPartialPath(relativePath)) {
                            continue;
                        }
                        const frontmatter = this.#qmdHasRequiredFrontmatterKeyFast(srcPath);
                        if (!frontmatter.hasRequired) {
                            continue;
                        }
                        htmlPaths.add(
                            Path.resolve(this.#getDestPathFromRelative(relativePath, true, ''))
                        );
                        const dirPart = Path.posix.dirname(normalizedRelPosix);
                        const sourcePrefix =
                            dirPart === '.' ? '' : dirPart.replace(REGEX.windowsSlash, Path.sep);
                        const quartoNested = Path.join(
                            Path.resolve(this.#destDir),
                            this.#quarto.assetsDir,
                            sourcePrefix,
                            `${Path.parse(normalizedRelPosix).name}_files`
                        );
                        quartoDirs.add(quartoNested);
                    } else {
                        const ext = Path.extname(srcPath).slice(1);
                        if (!this.#shouldCopyFile(normalizedRelPosix, ext)) {
                            continue;
                        }
                        copiedPaths.add(
                            Path.resolve(this.#getDestPathFromRelative(relativePath, false, ext))
                        );
                    }
                }
            }
        };

        visit(walkDir);
        return { htmlPaths, copiedPaths, quartoDirs };
    }

    /**
     * Generated search/sitemap files sit only under `destDir`; reconcile must not unlink them as orphans.
     *
     * @param {string} absFile
     * @param {string} destRootResolved
     * @returns {boolean}
     */
    #shouldPreserveReconcileDestArtifact(absFile, destRootResolved) {
        const resolved = Path.resolve(absFile);
        if (Path.dirname(resolved) !== destRootResolved) {
            return false;
        }
        const base = Path.basename(resolved).toLowerCase();
        return base === 'sitemap.json' || base === 'sitemap.xml';
    }

    /**
     * Removes publish outputs under `destDir` with no counterpart in current `srcDir` (pages, copied assets,
     * obsolete `*_files` trees).
     */
    #reconcileDestWithSrcArtifacts() {
        if (!Fs.existsSync(this.#destDir) || !Fs.existsSync(this.#srcDir)) {
            return;
        }

        const { htmlPaths, copiedPaths, quartoDirs } = this.#collectExpectedArtifactsFromWalk(
            this.#srcDir
        );
        const destRoot = Path.resolve(this.#destDir);
        const expectedFiles = new Set([...htmlPaths, ...copiedPaths]);
        const quartoKeeps = [...quartoDirs].map((dirPath) => { return Path.resolve(dirPath); });

        /**
         * @param {string} absResolved Absolute file path already normalized.
         * @returns {boolean}
         */
        const liesInsideKnownQuartoDir = (absResolved) => {
            const normalized = Path.resolve(absResolved);
            return quartoKeeps.some((q) => { return normalized === q || normalized.startsWith(`${q}${Path.sep}`); });
        };

        /** Drop orphan Quarto `_files` directories under quarto asset output when no `.qmd` maps there. */
        const pruneStaleQuartoFileDirs = () => {
            const assetsRoot = Path.join(destRoot, this.#quarto.assetsDir);
            if (!Fs.existsSync(assetsRoot)) {
                return;
            }
            /** @param {string} dir */
            const walk = (dir) => {
                let entries = [];
                try {
                    entries = Fs.readdirSync(dir, { withFileTypes: true });
                } catch {
                    return;
                }
                for (const entry of entries) {
                    const childAbs = Path.join(dir, entry.name);
                    if (!entry.isDirectory() || entry.isSymbolicLink()) {
                        continue;
                    }
                    if (REGEX.quartoFilesDirSuffix.test(entry.name)) {
                        const resolved = Path.resolve(childAbs);
                        if (!quartoKeeps.includes(resolved)) {
                            Fs.rmSync(resolved, { recursive: true, force: true });
                        }
                    } else {
                        walk(childAbs);
                    }
                }
            };
            walk(assetsRoot);
        };

        /**
         */
        const pruneStaleLeafFilesThenEmptyDirs = () => {
            /**
             * @param {string} dir
             */
            const walkLeaves = (dir) => {
                let entries = [];
                try {
                    entries = Fs.readdirSync(dir, { withFileTypes: true });
                } catch {
                    return;
                }
                const absHere = Path.resolve(dir);
                for (const entry of entries) {
                    const fullAbs = Path.join(absHere, entry.name);
                    if (entry.isSymbolicLink()) {
                        continue;
                    }
                    if (entry.isDirectory()) {
                        walkLeaves(fullAbs);
                    } else if (entry.isFile()) {
                        const resolved = Path.resolve(fullAbs);
                        if (expectedFiles.has(resolved)) {
                            continue;
                        }
                        if (liesInsideKnownQuartoDir(resolved)) {
                            continue;
                        }
                        if (this.#shouldPreserveReconcileDestArtifact(resolved, destRoot)) {
                            continue;
                        }
                        try {
                            Fs.unlinkSync(resolved);
                        } catch {
                            /* leave */
                        }
                    }
                }
            };
            walkLeaves(destRoot);

            /**
             */
            const walkEmpty = (dir) => {
                let entries = [];
                try {
                    entries = Fs.readdirSync(dir, { withFileTypes: true });
                } catch {
                    return;
                }
                const absHere = Path.resolve(dir);
                for (const entry of entries) {
                    if (entry.isDirectory() && !entry.isSymbolicLink()) {
                        walkEmpty(Path.join(absHere, entry.name));
                    }
                }
                try {
                    if (
                        Fs.readdirSync(absHere).length === 0 &&
                        Path.resolve(absHere) !== destRoot
                    ) {
                        Fs.rmdirSync(absHere);
                    }
                } catch {
                    /* leave */
                }
            };
            walkEmpty(destRoot);
        };

        pruneStaleQuartoFileDirs();
        pruneStaleLeafFilesThenEmptyDirs();
    }

    /**
     * Runs pending `.qmd` renders after a deferred directory walk (`deferQmd: true`).
     */
    async #flushPendingQmdRenders() {
        const pending = [...this.#pendingQmdRenders];
        this.#pendingQmdRenders = [];
        const cap = Math.max(1, this.#qmdRenderConcurrency);
        for (let i = 0; i < pending.length; i += cap) {
            const chunk = pending.slice(i, i + cap);
            await Promise.all(chunk.map((task) => {
                return this.#processQmdFileAsync(task.src, task.relativePath, task.dest);
            }));
        }
    }

    /**
     * Returns asset type for an extension, or null. Used for assetsDir / assetPaths mapping.
     * @param {string} ext Extension without dot (e.g. 'css', 'png').
     * @returns {string|null} 'css' | 'js' | 'images' | null.
     */
    #getAssetType(ext) {
        if (!ext || typeof ext !== 'string') {
            return null;
        }
        const lower = ext.toLowerCase();
        for (const [type, exts] of Object.entries(ASSET_TYPE_BY_EXT)) {
            if (exts.includes(lower)) {
                return type;
            }
        }
        return null;
    }

    /**
     * Computes destination path from a path relative to srcDir. Applies page-source→.html and assets mapping.
     * @param {string} relativePath Path relative to srcDir.
     * @param {boolean} isCompiledPage Whether the source compiles to an HTML page.
     * @param {string} [ext] Extension without dot (for non-jhp asset mapping).
     * @returns {string} Absolute destination path.
     */
    #getDestPathFromRelative(relativePath, isCompiledPage, ext = '') {
        const normalized = Path.normalize(relativePath.replace(REGEX.slash, Path.sep));
        if (normalized.startsWith('..') || Path.isAbsolute(normalized)) {
            return Path.join(this.#destDir, normalized);
        }
        if (isCompiledPage) {
            const withHtml = normalized.replace(REGEX.htmlPageSourceExt, '.html');
            return Path.join(this.#destDir, withHtml);
        }
        const assetType = this.#getAssetType(ext);
        const hasPerType = this.#assetPaths && assetType && typeof this.#assetPaths[assetType] === 'string';
        const useCatchAll = this.#assetsDir && assetType;
        if (hasPerType) {
            return Path.join(this.#destDir, this.#assetPaths[assetType], normalized);
        }
        if (useCatchAll) {
            // Source may already be under assets (e.g. src/assets/css/...) so avoid double-prepending
            const assetsPrefix = `${this.#assetsDir}${Path.sep}`;
            const assetsPrefixSlash = `${this.#assetsDir}/`;
            if (normalized.startsWith(assetsPrefix) || normalized.startsWith(assetsPrefixSlash)) {
                return Path.join(this.#destDir, normalized);
            }
            return Path.join(this.#destDir, this.#assetsDir, normalized);
        }
        return Path.join(this.#destDir, normalized);
    }

    /**
     * Resolves a watched path (relative to srcDir) to a destination path under destDir.
     * Uses same mapping as build (assetsDir/assetPaths, page-source→.html). Returns null if outside destDir.
     * @param {string} relativePath Path relative to srcDir (forward slashes from watcher).
     * @param {boolean} wasCompiledPage Whether the source compiles to .html.
     * @param {string} [ext] Extension without dot (for asset mapping on unlink).
     * @returns {string|null} Absolute dest path or null if outside destDir.
     */
    #resolveDestPath(relativePath, wasCompiledPage = false, ext = '') {
        const destPath = this.#getDestPathFromRelative(relativePath, wasCompiledPage, ext);
        const resolved = Path.resolve(destPath);
        const destDirResolved = Path.resolve(this.#destDir);
        const rel = Path.relative(destDirResolved, resolved);
        if (rel.startsWith('..') || Path.isAbsolute(rel)) {
            return null;
        }
        return resolved;
    }

    /**
     * Removes a file or directory at the given dest path. Used to keep output in sync on unlink/unlinkDir.
     * @param {string} destPath Absolute path under destDir.
     */
    #removeDestPath(destPath) {
        if (!destPath || !Fs.existsSync(destPath)) {
            return;
        }
        const stat = Fs.statSync(destPath);
        if (stat.isDirectory()) {
            this.#clearDirectory(destPath);
            Fs.rmdirSync(destPath);
        } else {
            Fs.unlinkSync(destPath);
        }
    }

    #copyFile(src, dest) {
        try {
            Fs.mkdirSync(Path.dirname(dest), { recursive: true });
            if (isTextFileForStripping(src)) {
                const content = Fs.readFileSync(src, 'utf8');
                const cleaned = stripJamseduComments(content);
                Fs.writeFileSync(dest, cleaned, 'utf8');
            } else {
                Fs.copyFileSync(src, dest);
            }
            if (this.#buildUsesCleanSweep && dest.toLowerCase().endsWith('.html')) {
                this.#recordPageSourceMtime(dest, src);
            }
        } catch (err) {
            Print.error(`Failed to copy file from ${src} to ${dest}`);
            if (this.#verbose) {
                Print.error(err);
            }
            this.#errorLimit -= 1;
            if (this.#errorLimit <= 0) {
                Print.error('Too many errors encountered. Processing was stopped.');
                exit(1);
            }
        }
    }

    #copyDirectory(srcDir, destDir) {
        const entries = Fs.readdirSync(srcDir, { withFileTypes: true });
        for (const entry of entries) {
            const srcPath = Path.join(srcDir, entry.name);
            const destPath = Path.join(destDir, entry.name);
            if (entry.isDirectory()) {
                Fs.mkdirSync(destPath, { recursive: true });
                this.#copyDirectory(srcPath, destPath);
            } else if (entry.isFile()) {
                this.#copyFile(srcPath, destPath);
            }
        }
    }

    #determineRelativePath(src) {
        const depth = Path.relative(this.#srcDir, Path.dirname(src))
            .split(Path.sep)
            .reduce((count, part) => {
                return count + (part ? 1 : 0);
            }, 0);
        return depth === 0 ? '' : '../'.repeat(depth);
    }

    /**
     * Ordered roots for JHP built-in `$include` resolution (see `includeSearchRoots` in @caboodle-tech/jhp).
     * Tries `templateDir` (partials) before `srcDir` when both differ.
     *
     * @returns {string[]} Non-empty list of absolute directory paths
     */
    #getIncludeSearchRoots() {
        const src = Path.resolve(this.#srcDir);
        const roots = [];
        if (this.#templateDir) {
            const t = Path.resolve(this.#templateDir);
            if (t !== src) {
                roots.push(t);
            }
        }
        roots.push(src);
        return roots;
    }

    /**
     * @param {string} absoluteFilePath
     * @returns {boolean}
     */
    #isUnderTemplateDir(absoluteFilePath) {
        if (!this.#templateDir) {
            return false;
        }
        const file = Path.resolve(absoluteFilePath);
        const root = Path.resolve(this.#templateDir);
        const rel = Path.relative(root, file);
        return rel !== '' && !rel.startsWith('..') && !Path.isAbsolute(rel);
    }

    #normalizeConfigStringArray(value) {
        if (!Array.isArray(value)) {
            return [];
        }
        return value
            .filter((item) => {
                return typeof item === 'string';
            })
            .map((item) => {
                return item.trim().toLowerCase();
            })
            .filter((item) => {
                return item !== '';
            });
    }

    #isPathOutside(basePath, targetPath) {
        const rel = Path.relative(Path.resolve(basePath), Path.resolve(targetPath));
        return rel.startsWith('..') || Path.isAbsolute(rel);
    }

    #initializeCopyRules(config) {
        const legacyDoNotCopy = this.#normalizeConfigStringArray(config.doNotCopy);
        for (const token of legacyDoNotCopy) {
            this.#copyRules.denyExt.add(token.replace(REGEX.dotPrefix, ''));
        }

        const rules = WhatIs(config.copyRules) === 'object' ? config.copyRules : {};
        const allowExt = this.#normalizeConfigStringArray(rules.allowExtensions);
        const allowSuffix = this.#normalizeConfigStringArray(rules.allowSuffixes);
        const denyExt = this.#normalizeConfigStringArray(rules.denyExtensions);
        const denySuffix = this.#normalizeConfigStringArray(rules.denySuffixes);

        for (const token of allowExt) {
            this.#copyRules.allowExt.add(token.replace(REGEX.dotPrefix, ''));
        }
        for (const token of allowSuffix) {
            this.#copyRules.allowSuffix.add(token.replace(REGEX.dotPrefix, ''));
        }
        for (const token of denyExt) {
            this.#copyRules.denyExt.add(token.replace(REGEX.dotPrefix, ''));
        }
        for (const token of denySuffix) {
            this.#copyRules.denySuffix.add(token.replace(REGEX.dotPrefix, ''));
        }
    }

    #initializeQuartoConfig(config) {
        const quartoConfig = WhatIs(config.quarto) === 'object' ? config.quarto : {};
        this.#quarto.assetsDir = typeof quartoConfig.assetsDir === 'string' && quartoConfig.assetsDir.trim() ?
            quartoConfig.assetsDir.trim().replace(REGEX.trimEdgeSlashes, '') :
            'quarto-assets';
        const quartoDir = typeof quartoConfig.workingDir === 'string' && quartoConfig.workingDir.trim() ?
            quartoConfig.workingDir.trim() :
            '.quarto';
        this.#quarto.rootDir = Path.resolve(this.#usersRoot, quartoDir);
        this.#quarto.templatePath = this.#resolveQuartoTemplatePath(config, quartoConfig);
    }

    #resolveQuartoTemplatePath(config, quartoConfig) {
        const candidates = [];
        if (typeof quartoConfig.template === 'string' && quartoConfig.template.trim() !== '') {
            candidates.push(Path.resolve(this.#usersRoot, quartoConfig.template.trim()));
        }
        if (this.#templateDir) {
            candidates.push(Path.join(this.#templateDir, 'quarto.jhp'));
            candidates.push(Path.join(this.#templateDir, 'quarto.html'));
        }
        for (const candidate of candidates) {
            if (Fs.existsSync(candidate)) {
                return candidate;
            }
        }
        return '';
    }

    #shouldCopyFile(relativePath, ext) {
        const normalizedRel = relativePath.replace(REGEX.windowsSlash, '/').toLowerCase();
        if (normalizedRel.split('/').includes('.quarto')) {
            return false;
        }
        const normalizedExt = (ext || '').toLowerCase();
        const basename = Path.basename(normalizedRel);
        const normalizedAssetsDir = this.#assetsDir.replace(REGEX.windowsSlash, '/')
            .toLowerCase()
            .replace(REGEX.trimEdgeForwardSlashes, '');
        const assetsPrefix = this.#assetsDir ? `${normalizedAssetsDir}/` : '';

        // Keep existing asset-directory behavior stable; source assets should copy unless explicitly denied by suffix.
        if (assetsPrefix && normalizedRel.startsWith(assetsPrefix)) {
            for (const denied of this.#copyRules.denySuffix) {
                if (basename === denied || basename.endsWith(`.${denied}`)) {
                    return false;
                }
            }
            return true;
        }

        for (const allowed of this.#copyRules.allowSuffix) {
            if (basename === allowed || basename.endsWith(`.${allowed}`)) {
                return true;
            }
        }
        if (this.#copyRules.allowExt.has(normalizedExt)) {
            return true;
        }

        for (const denied of this.#copyRules.denySuffix) {
            if (basename === denied || basename.endsWith(`.${denied}`)) {
                return false;
            }
        }
        if (this.#copyRules.denyExt.has(normalizedExt)) {
            return false;
        }
        return true;
    }

    #runCommand(command, args, options = {}) {
        const envOverrides = WhatIs(options.env) === 'object' ? options.env : {};
        const result = Process.spawnSync(command, args, {
            cwd: options.cwd || this.#usersRoot,
            encoding: 'utf8',
            env: {
                ...process.env,
                ...envOverrides
            },
            input: options.input,
            windowsHide: true,
            maxBuffer: 10 * 1024 * 1024
        });

        if (result.error) {
            throw result.error;
        }
        if (result.status !== 0) {
            const errorText = [
                `Command failed: ${command} ${args.join(' ')}`,
                result.stdout ? `stdout:\n${result.stdout}` : '',
                result.stderr ? `stderr:\n${result.stderr}` : ''
            ].filter(Boolean).join('\n');
            throw new Error(errorText);
        }
        return result.stdout || '';
    }

    /**
     * Ensure srcDir never keeps Quarto cache folders; they cause watch loops.
     *
     * @param {string} sourcePath Absolute path to source `.qmd` (or its directory).
     */
    #removeStraySrcQuartoCache(sourcePath) {
        const sourceDir = Fs.statSync(sourcePath).isDirectory() ? sourcePath : Path.dirname(sourcePath);
        const sourceWithinSrc = !this.#isPathOutside(this.#srcDir, sourceDir);
        if (!sourceWithinSrc) {
            return;
        }
        const nestedCachePath = Path.join(sourceDir, '.quarto');
        if (Fs.existsSync(nestedCachePath)) {
            Fs.rmSync(nestedCachePath, { recursive: true, force: true });
        }
    }

    #removeQuartoSessionTempDirs() {
        const quartoInternalDir = Path.join(this.#quarto.rootDir, '.quarto');
        if (!Fs.existsSync(quartoInternalDir)) {
            return;
        }
        const entries = Fs.readdirSync(quartoInternalDir, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.isDirectory() && entry.name.startsWith('quarto-session-temp')) {
                Fs.rmSync(Path.join(quartoInternalDir, entry.name), { recursive: true, force: true });
            }
        }
    }

    #removeQuartoRootMarkdownArtifacts() {
        if (!Fs.existsSync(this.#quarto.rootDir)) {
            return;
        }
        const entries = Fs.readdirSync(this.#quarto.rootDir, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.isFile() && (entry.name.endsWith('.md') || entry.name.endsWith('.qmd'))) {
                Fs.rmSync(Path.join(this.#quarto.rootDir, entry.name), { force: true });
            }
        }
    }

    #getQuartoCommandCandidates() {
        const candidates = ['quarto'];
        const envQuartoPath = typeof process.env.QUARTO_PATH === 'string' ?
            process.env.QUARTO_PATH.trim() :
            '';
        if (envQuartoPath) {
            candidates.push(envQuartoPath);
        }

        if (process.platform === 'win32') {
            const localAppData = process.env.LOCALAPPDATA;
            const programFiles = process.env.ProgramFiles;
            const programFilesX86 = process.env['ProgramFiles(x86)'];
            if (localAppData) {
                candidates.push(Path.join(localAppData, 'Programs', 'Quarto', 'bin', 'quarto.exe'));
            }
            if (programFiles) {
                candidates.push(Path.join(programFiles, 'Quarto', 'bin', 'quarto.exe'));
            }
            if (programFilesX86) {
                candidates.push(Path.join(programFilesX86, 'Quarto', 'bin', 'quarto.exe'));
            }
        } else {
            candidates.push('/usr/local/bin/quarto', '/opt/homebrew/bin/quarto', '/usr/bin/quarto');
        }

        return [...new Set(candidates)];
    }

    #resolveQuartoCommand() {
        if (this.#quarto.checked) {
            return this.#quarto.command;
        }
        this.#quarto.checked = true;

        const candidates = this.#getQuartoCommandCandidates();
        this.#quarto.checkedCandidates = candidates;

        for (const candidate of candidates) {
            const result = Process.spawnSync(candidate, ['--version'], {
                cwd: this.#usersRoot,
                encoding: 'utf8',
                windowsHide: true
            });
            if (!result.error && result.status === 0) {
                this.#quarto.command = candidate;
                return candidate;
            }
        }

        this.#quarto.command = null;
        return null;
    }

    #isQuartoAvailable() {
        return this.#resolveQuartoCommand() !== null;
    }

    #writeTextFileIfChanged(targetPath, content) {
        const next = String(content).replace(REGEX.lineEndingsCrlf, '\n');
        if (Fs.existsSync(targetPath)) {
            const current = Fs.readFileSync(targetPath, 'utf8').replace(REGEX.lineEndingsCrlf, '\n');
            if (current === next) {
                return;
            }
        }
        Fs.mkdirSync(Path.dirname(targetPath), { recursive: true });
        Fs.writeFileSync(targetPath, next, 'utf8');
    }

    #getBundledQuartoExtensionPayloads() {
        if (this.#bundledQuartoExtensionPayloads !== null) {
            return this.#bundledQuartoExtensionPayloads;
        }
        const bundled = Path.join(JAMSEDU_MODULE_DIR, 'extensions', 'jamsedu');
        this.#bundledQuartoExtensionPayloads = Object.freeze({
            extensionYml: Fs.readFileSync(Path.join(bundled, 'extension.yml'), 'utf8'),
            jamseduLua: Fs.readFileSync(Path.join(bundled, 'jamsedu.lua'), 'utf8'),
            jamseduBlocksLua: Fs.readFileSync(Path.join(bundled, 'jamsedu-blocks.lua'), 'utf8'),
            projectYml: Fs.readFileSync(Path.join(bundled, 'project.yml'), 'utf8')
        });
        return this.#bundledQuartoExtensionPayloads;
    }

    /**
     * Deep-merge YAML objects: same keys use `builtin` values; nested mappings merge recursively;
     * arrays from `builtin` replace the whole array (keeps Jams filters authoritative).
     * @param {unknown} userBranch
     * @param {unknown} builtinBranch
     * @returns {Record<string, unknown>}
     */
    #deepMergeQuartoYamlBuiltinWins(userBranch, builtinBranch) {
        const u =
            WhatIs(userBranch) === 'object' && userBranch !== null && !Array.isArray(userBranch) ?
                userBranch :
                {};
        const b =
            WhatIs(builtinBranch) === 'object' &&
            builtinBranch !== null &&
            !Array.isArray(builtinBranch) ?
                builtinBranch :
                {};
        const out = { ...u };
        for (const key of Object.keys(b)) {
            const bv = b[key];
            const uv = out[key];
            if (Array.isArray(bv)) {
                out[key] = bv;
            } else if (
                bv !== null &&
                WhatIs(bv) === 'object' &&
                !Array.isArray(bv) &&
                uv !== null &&
                WhatIs(uv) === 'object' &&
                !Array.isArray(uv)
            ) {
                out[key] = this.#deepMergeQuartoYamlBuiltinWins(uv, bv);
            } else {
                out[key] = bv;
            }
        }
        return out;
    }

    /**
     * Optional Quarto-ish project YAML beside `config.js`, first match wins: `quarto.yml`, `_quarto.yml`,
     * `quarto-project.yml`.
     * @returns {string} Absolute path, or '' when none exist.
     */
    #resolveOptionalJamseduQuartoUserYamlPath() {
        const dir = Path.join(this.#usersRoot, '.jamsedu');
        const names = ['quarto.yml', '_quarto.yml', 'quarto-project.yml'];
        for (const name of names) {
            const full = Path.join(dir, name);
            if (Fs.existsSync(full)) {
                return full;
            }
        }
        return '';
    }

    /**
     * Bundled Quarto `_quarto.yml`, optionally merged with YAML from `#resolveOptionalJamseduQuartoUserYamlPath`.
     * Jams-managed keys (`project`, `engine`, `filters`, etc.) always win on conflict so the pipeline stays stable.
     * @returns {string}
     */
    #buildManagedQuartoProjectYml() {
        const payloads = this.#getBundledQuartoExtensionPayloads();
        let builtin;
        try {
            builtin = parseYaml(payloads.projectYml);
        } catch {
            Print.warn('[Quarto] Bundled project.yml parse failed; using empty built-in YAML.');
            builtin = {};
        }
        if (WhatIs(builtin) !== 'object' || builtin === null || Array.isArray(builtin)) {
            builtin = {};
        }
        const userPath = this.#resolveOptionalJamseduQuartoUserYamlPath();
        if (!userPath) {
            return payloads.projectYml.replace(REGEX.lineEndingsCrlf, '\n');
        }
        const label = Path.relative(this.#usersRoot, userPath).replace(REGEX.windowsSlash, '/') || Path.basename(userPath);
        let userObj;
        try {
            userObj = parseYaml(Fs.readFileSync(userPath, 'utf8'));
        } catch (err) {
            const hint = typeof err.message === 'string' ? err.message : String(err);
            Print.warn(`[Quarto] Ignoring unreadable ${label} (${hint}); using built-in project YAML only.`);
            return payloads.projectYml.replace(REGEX.lineEndingsCrlf, '\n');
        }
        if (WhatIs(userObj) !== 'object' || userObj === null || Array.isArray(userObj)) {
            Print.warn(`[Quarto] ${label} must be a YAML mapping; using built-in project YAML only.`);
            return payloads.projectYml.replace(REGEX.lineEndingsCrlf, '\n');
        }
        const merged = this.#deepMergeQuartoYamlBuiltinWins(userObj, builtin);
        return `${dumpYaml(merged).trimEnd()}\n`;
    }

    /**
     * Quarto only auto-discovers `_extensions` for `.qmd` files in the same directory as `_extensions`.
     * Nested pages need an explicit `shortcodes` entry pointing at this path (POSIX, relative to the `.qmd`).
     *
     * @param {string} markdown
     * @param {string} relativePath Path of the staged `.qmd` relative to `quarto.rootDir`.
     * @returns {string}
     */
    #mergeJamseduShortcodeIntoFrontmatter(markdown, relativePath) {
        const normalizedRel = relativePath.replace(REGEX.windowsSlash, '/');
        /* Include fragments under snippets/ should not carry their own shortcodes entry; Quarto merges
           included YAML into the parent and would mix multiple relative paths. */
        if (normalizedRel.includes('/snippets/') || normalizedRel.startsWith('snippets/')) {
            return markdown;
        }

        const bundledLuaPath = Path.join(this.#quarto.rootDir, '_extensions', 'jamsedu', 'jamsedu.lua');
        /* Quarto aggregates shortcodes paths from every .qmd under the project directory;
           per-dir relative paths (../ vs ../../) break sibling renders. */
        const absLua = Path.resolve(bundledLuaPath).replace(REGEX.windowsSlash, '/');
        const match = markdown.match(REGEX.frontmatter);
        if (!match) {
            return `---\n${dumpYaml({ shortcodes: [absLua] }).trimEnd()}\n---\n\n${markdown}`;
        }
        try {
            const parsed = parseYaml(match[1]);
            if (WhatIs(parsed) !== 'object' || parsed === null) {
                throw new Error('invalid frontmatter object');
            }
            let tokenList = [];
            if (Array.isArray(parsed.shortcodes)) {
                tokenList = parsed.shortcodes.map((item) => {
                    return String(item);
                });
            } else if (typeof parsed.shortcodes !== 'undefined') {
                tokenList = [String(parsed.shortcodes)];
            }
            if (!tokenList.includes(absLua)) {
                tokenList.push(absLua);
            }
            parsed.shortcodes = tokenList;
            return `---\n${dumpYaml(parsed).trimEnd()}\n---\n${markdown.slice(match[0].length)}`;
        } catch {
            Print.warn('[Quarto] Could not merge Jams shortcode path into YAML; skipping frontmatter injection.');
            return markdown;
        }
    }

    #ensureManagedQuartoExtension() {
        /* Quarto only loads extension metadata from project-local paths with its required names. */
        const extensionDir = Path.join(this.#quarto.rootDir, '_extensions', 'jamsedu');
        const extensionYmlPath = Path.join(extensionDir, '_extension.yml');
        const extensionLuaPath = Path.join(extensionDir, 'jamsedu.lua');
        const extensionBlocksLuaPath = Path.join(extensionDir, 'jamsedu-blocks.lua');
        const projectYmlPath = Path.join(this.#quarto.rootDir, '_quarto.yml');
        const payloads = this.#getBundledQuartoExtensionPayloads();
        this.#writeTextFileIfChanged(extensionYmlPath, payloads.extensionYml);
        this.#writeTextFileIfChanged(extensionLuaPath, payloads.jamseduLua);
        this.#writeTextFileIfChanged(extensionBlocksLuaPath, payloads.jamseduBlocksLua);
        this.#writeTextFileIfChanged(projectYmlPath, this.#buildManagedQuartoProjectYml());
    }

    #splitFrontmatter(markdown) {
        const match = markdown.match(REGEX.frontmatter);
        if (!match) {
            return { frontmatter: '', body: markdown };
        }
        const frontmatter = match[1];
        const body = markdown.slice(match[0].length);
        return { frontmatter, body };
    }

    /**
     * Rewrites Quarto `$…$` / `$$…$$` in the Markdown body **before** `quarto render`, so prose examples are not mangled by
     * Quarto's own math pass before Jams converts the emitted `.md`. YAML frontmatter is left untouched (`REGEX.frontmatter`).
     *
     * @param {string} qmdPayload
     * @returns {string}
     */
    #applyDollarMathRewriteBeforeQuarto(qmdPayload) {
        const text = String(qmdPayload || '');
        const match = text.match(REGEX.frontmatter);
        if (!match) {
            return this.#convertMarkdownMathToJamsHtml(text);
        }
        const headLen = match[0].length;
        return text.slice(0, headLen) + this.#convertMarkdownMathToJamsHtml(text.slice(headLen));
    }

    #extractQmdMeta(frontmatter) {
        if (!frontmatter) {
            return {};
        }
        try {
            const parsed = parseYaml(frontmatter);
            if (WhatIs(parsed) !== 'object') {
                return {};
            }
            return parsed;
        } catch {
            return {};
        }
    }

    /**
     * Quarto YAML `keywords` may be a string or a list of strings; normalize for JHP context and meta tags.
     * @param {unknown} value
     * @returns {string|null}
     */
    #normalizeQmdKeywords(value) {
        if (value == null || value === '') {
            return null;
        }
        if (Array.isArray(value)) {
            const parts = value
                .map((item) => {
                    return typeof item === 'string' ? item.trim() : '';
                })
                .filter((item) => {
                    return item !== '';
                });
            return parts.length > 0 ? parts.join(', ') : null;
        }
        if (typeof value === 'string') {
            const t = value.trim();
            return t !== '' ? t : null;
        }
        return null;
    }

    #rewriteQuartoFilesPathSegment(pathPart, assetsPrefix) {
        if (pathPart.startsWith('/') || pathPart.startsWith('http://') || pathPart.startsWith('https://')) {
            return null;
        }
        const normalized = pathPart.replace(REGEX.windowsSlash, '/');
        const cleaned = normalized.replace(REGEX.leadingDotSlash, '');
        return `${assetsPrefix}${cleaned}`;
    }

    /**
     * @param {string} maybePath
     * @returns {string}
     */
    #toPosixPath(maybePath) {
        return String(maybePath || '').replace(REGEX.windowsSlash, '/');
    }

    #stageQmdPartialForQuarto(srcPath, relativePath) {
        const sourceContent = Fs.readFileSync(srcPath, 'utf8');
        const normalizedContent = this.#normalizeQuartoIncludesForRender(srcPath, sourceContent);
        const rewrittenBlocks = this.#rewriteJamsFencedBlocksForQuartoRender(normalizedContent);
        const stagedPayload = this.#applyDollarMathRewriteBeforeQuarto(rewrittenBlocks);
        const stagedQmdPath = Path.join(this.#quarto.rootDir, relativePath);
        Fs.mkdirSync(Path.dirname(stagedQmdPath), { recursive: true });
        Fs.writeFileSync(stagedQmdPath, stagedPayload, 'utf8');
    }

    #isQmdPartialPath(relativePath) {
        const normalizedRel = this.#toPosixPath(relativePath).toLowerCase();
        return normalizedRel.includes('/snippets/') ||
            normalizedRel.startsWith('snippets/') ||
            normalizedRel.includes('/_partials/') ||
            normalizedRel.startsWith('_partials/');
    }

    #qmdHasRequiredFrontmatterKeyFast(srcPath) {
        let handle;
        try {
            handle = Fs.openSync(srcPath, 'r');
            const buffer = Buffer.alloc(8192);
            const bytesRead = Fs.readSync(handle, buffer, 0, buffer.length, 0);
            const prefix = buffer.toString('utf8', 0, bytesRead).replace(REGEX.leadingBom, '');
            const lines = prefix.split(/\r?\n/u);
            let firstMeaningfulIndex = -1;
            for (let i = 0; i < lines.length; i += 1) {
                if (lines[i].trim() !== '') {
                    firstMeaningfulIndex = i;
                    break;
                }
            }
            if (firstMeaningfulIndex === -1 || lines[firstMeaningfulIndex].trim() !== '---') {
                return { hasYaml: false, hasRequired: false };
            }
            let endIdx = -1;
            for (let i = firstMeaningfulIndex + 1; i < lines.length; i += 1) {
                if (REGEX.frontmatterEndLine.test(lines[i].trim())) {
                    endIdx = i;
                    break;
                }
            }
            if (endIdx < 0) {
                return { hasYaml: true, hasRequired: false };
            }
            const header = lines.slice(firstMeaningfulIndex + 1, endIdx).join('\n');
            const hasRequired = REGEX.frontmatterRequiredStandaloneKeys.test(header);
            return { hasYaml: true, hasRequired };
        } catch {
            return { hasYaml: false, hasRequired: false };
        } finally {
            if (typeof handle === 'number') {
                try {
                    Fs.closeSync(handle);
                } catch {
                    // Ignore close failure.
                }
            }
        }
    }

    #shouldCompileQmdStandalone(srcPath, relativePath) {
        if (this.#isQmdPartialPath(relativePath)) {
            return false;
        }
        const check = this.#qmdHasRequiredFrontmatterKeyFast(srcPath);
        if (check.hasYaml && !check.hasRequired) {
            const rel = this.#toPosixPath(relativePath);
            if (!this.#qmdNearMissWarned.has(rel)) {
                this.#qmdNearMissWarned.add(rel);
                Print.warn(`[Quarto] Skipped standalone .qmd (frontmatter missing title/description/author): ${rel}`);
            }
        }
        return check.hasRequired;
    }

    /**
     * Invokes callback for each standalone `.qmd` (has required frontmatter; not under snippets/_partials paths).
     *
     * @param {(absoluteSrcPath: string, relativePath: string) => void} callback
     */
    #forEachStandaloneQmdUnderSrcDir(callback) {
        const walk = (absoluteDir) => {
            let entries = [];
            try {
                entries = Fs.readdirSync(absoluteDir, { withFileTypes: true });
            } catch {
                return;
            }
            for (const entry of entries) {
                const fullPath = Path.join(absoluteDir, entry.name);
                if (entry.isDirectory()) {
                    if (entry.name === '.quarto' || this.#isUnderTemplateDir(fullPath)) {
                        // eslint-disable-next-line no-continue
                        continue;
                    }
                    walk(fullPath);
                    // eslint-disable-next-line no-continue
                    continue;
                }
                if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.qmd')) {
                    // eslint-disable-next-line no-continue
                    continue;
                }
                if (this.#isUnderTemplateDir(fullPath)) {
                    // eslint-disable-next-line no-continue
                    continue;
                }
                const relativePath = Path.relative(this.#srcDir, fullPath);
                if (!this.#shouldCompileQmdStandalone(fullPath, relativePath)) {
                    // eslint-disable-next-line no-continue
                    continue;
                }
                callback(fullPath, relativePath);
            }
        };
        walk(this.#srcDir);
    }

    /**
     * Re-renders standalone `.qmd` pages that `{{< include >}}` a changed partial. Partial saves only run
     * `#stageQmdPartialForQuarto` otherwise, so parent HTML would stay stale (watch and single-file builds).
     *
     * @param {string} changedPartialAbsPath Absolute path to the edited partial `.qmd`.
     */
    #reprocessStandaloneQmdsThatIncludePartial(changedPartialAbsPath) {
        const targetKey = Path.resolve(changedPartialAbsPath);
        this.#forEachStandaloneQmdUnderSrcDir((srcPath, relativePath) => {
            if (Path.resolve(srcPath) === targetKey) {
                return;
            }
            let body = '';
            try {
                body = Fs.readFileSync(srcPath, 'utf8');
            } catch {
                return;
            }
            const matches = body.matchAll(REGEX.includeShortcode);
            for (const match of matches) {
                const resolved = this.#resolveLocalQuartoIncludePath(
                    typeof match[1] === 'string' ? match[1] : '',
                    srcPath
                );
                if (resolved && Path.resolve(resolved) === targetKey) {
                    const dest = this.#getDestPathFromRelative(relativePath, true, 'qmd');
                    this.#processQmdFile(srcPath, relativePath, dest);
                    break;
                }
            }
        });
    }

    /**
     * Normalize Markdown links such as .\features\tail Quarto emits; those degrade (e.g. .\f reads as controls).
     * Rewrite to `/features/...`.
     *
     * @param {string} markdownBody
     * @returns {string}
     */
    #sanitizeQuartoMarkdownLinkRoots(markdownBody) {
        return markdownBody.replace(REGEX.quartoFeaturesPathFromDot, (_m, tail) => {
            const trimmed = String(tail || '').replace(REGEX.windowsSlash, '/').replace(REGEX.trimLeadingForwardSlashes, '');
            return `](/features/${trimmed}`;
        });
    }

    #rewriteQuartoAssetPaths(markdownBody, relativePath) {
        const sourceDir = this.#toPosixPath(Path.dirname(relativePath));
        const sourcePrefix = sourceDir === '.' ? '' : `${sourceDir}/`;
        const assetsPrefix = `/${this.#quarto.assetsDir}/${sourcePrefix}`.replace(REGEX.collapseSlashes, '/');

        let body = markdownBody.replace(REGEX.quartoMarkdownImage, (full) => {
            if (!full.includes('_files')) {
                return full;
            }
            return full.replace(REGEX.windowsSlash, '/');
        });

        const applyFilesPaths = (text, pattern) => {
            return text.replace(pattern, (match, start, pathPart, end) => {
                const next = this.#rewriteQuartoFilesPathSegment(pathPart, assetsPrefix);
                if (next === null) {
                    return match;
                }
                return `${start}${next}${end}`;
            });
        };
        body = applyFilesPaths(body, REGEX.quartoMarkdownLinkRelativeFiles);
        body = applyFilesPaths(body, REGEX.quartoHtmlSrcRelativeFiles);
        return body;
    }

    #escapeHtmlAttribute(value) {
        return String(value)
            .replace(REGEX.escapeAmp, '&amp;')
            .replace(REGEX.escapeDoubleQuote, '&quot;')
            .replace(REGEX.escapeLt, '&lt;')
            .replace(REGEX.escapeGt, '&gt;');
    }

    /**
     * `data-formula` values pass through Markdown before Pandoc; mask `\`, then `#escapeHtmlAttribute`.
     *
     * @param {string} tex
     * @returns {string}
     */
    #texDataAttrForPandocPass(tex) {
        return this.#escapeHtmlAttribute(
            String(tex)
                .replace(/\r?\n/g, ' ')
                .replace(/\\/g, TEX_BACKSLASH_SENTINEL)
        );
    }

    /**
     * @param {string} htmlFragment Pandoc `--to html` output.
     * @returns {string}
     */
    #restoreTexBackslashesAfterPandoc(htmlFragment) {
        return String(htmlFragment).split(TEX_BACKSLASH_SENTINEL).join('\\');
    }

    /**
     * Minimal escape for raw TeX inside `<div class="math">…</div>` (KaTeX reads text; only harden &, <, >).
     */
    #escapeHtmlTextMinimal(value) {
        return String(value)
            .replace(REGEX.escapeAmp, '&amp;')
            .replace(REGEX.escapeLt, '&lt;')
            .replace(REGEX.escapeGt, '&gt;');
    }

    /**
     * Turn `$…$` / `$$…$$` in Quarto markdown into JamsEDU math HTML **before** Pandoc.
     * Skips fenced ``` code blocks and single-backtick `` `...` `` spans (so illustrative dollars inside code ticks stay verbatim).
     * Display math emits a bare `<div class="math">` (never ```{=html}` fences): fences break paragraphs and list items mid-line.
     * Built with string concat only so LaTeX backslashes are never mangled by JS template literals.
     */
    #convertMarkdownMathToJamsHtml(markdownBody) {
        const segments = markdownBody.split(REGEX.markdownFencedCodeBlock);
        const mapped = segments.map((segment, index) => {
            if (index % 2 === 1) {
                return segment;
            }
            return this.#rewriteMarkdownMathSpansOutsideInlineCode(segment);
        });
        return mapped.join('');
    }

    /**
     * @param {string} segment
     * @returns {string}
     */
    #rewriteMarkdownMathSpansOutsideInlineCode(segment) {
        const parts = String(segment).split(REGEX.markdownInlineCodeSegment);
        for (let i = 0; i < parts.length; i += 2) {
            let s = parts[i];
            s = s.replace(REGEX.markdownMathBlock, (match, formula) => {
                const trimmed = typeof formula === 'string' ? formula.trim() : '';
                const attr = this.#texDataAttrForPandocPass(trimmed);
                return `\n<div class="math" data-formula="${attr}"></div>\n`;
            });
            s = s.replace(REGEX.markdownMathInline, (match, formula) => {
                const trimmed = typeof formula === 'string' ? formula.trim() : '';
                if (trimmed.length === 0) {
                    return match;
                }
                if (/^[\d.,\s]+$/.test(trimmed)) {
                    return match;
                }
                const attr = this.#texDataAttrForPandocPass(trimmed);
                return `<span class="math inline" data-formula="${attr}"></span>`;
            });
            parts[i] = s;
        }
        return parts.join('');
    }

    #parseFencedDivClasses(attrText) {
        const raw = String(attrText || '').trim();
        if (!raw) {
            return [];
        }
        return raw
            .split(/\s+/)
            .map((token) => {
                return token.trim();
            })
            .filter((token) => {
                return token.startsWith('.');
            })
            .map((token) => {
                return token.slice(1);
            })
            .filter(Boolean);
    }

    #rewriteJamsFencedBlocksForQuartoRender(markdownBody) {
        const lines = String(markdownBody).split(/\r?\n/);
        const out = [];
        let i = 0;
        let inCodeFence = false;
        while (i < lines.length) {
            const line = lines[i];
            if (REGEX.markdownFenceLine.test(line)) {
                inCodeFence = !inCodeFence;
                out.push(line);
                i += 1;
                continue;
            }
            if (inCodeFence) {
                out.push(line);
                i += 1;
                continue;
            }
            const open = line.match(REGEX.markdownFencedDivOpen);
            if (!open) {
                out.push(line);
                i += 1;
                continue;
            }
            const classes = this.#parseFencedDivClasses(open[1]);
            const isMermaid = classes.includes('jams-mermaid') || classes.includes('jams-diagram');
            const isMath = classes.includes('jams-math') || classes.includes('jams-katex');
            if (!isMermaid && !isMath) {
                out.push(line);
                i += 1;
                continue;
            }
            let j = i + 1;
            const inner = [];
            while (j < lines.length && !REGEX.markdownFencedDivClose.test(lines[j])) {
                inner.push(lines[j]);
                j += 1;
            }
            if (j >= lines.length) {
                out.push(line);
                i += 1;
                continue;
            }
            const body = inner.join('\n').trim();
            if (isMermaid && body) {
                out.push('```{=html}');
                out.push('<pre class="mermaid">');
                out.push(body);
                out.push('</pre>');
                out.push('```');
            } else if (isMath && body) {
                const isMacro = classes.includes('macro');
                const className = isMacro ? 'math macro' : 'math';
                const attr = this.#texDataAttrForPandocPass(body);
                out.push('```{=html}');
                out.push(`<div class="${className}" data-formula="${attr}"></div>`);
                out.push('```');
            }
            i = j + 1;
        }
        return out.join('\n');
    }

    /** @type {ReadonlySet<string>} */
    static #voidHtmlTagNames = new Set([
        'area',
        'base',
        'br',
        'col',
        'embed',
        'hr',
        'img',
        'input',
        'link',
        'meta',
        'param',
        'source',
        'track',
        'wbr'
    ]);

    /**
     * Parses a trimmed single-line opening or self-closing HTML tag (`<div …>`, `<br>`, `<img … />`).
     *
     * @param {string} trimmedLine
     * @returns {{ tag: string; selfClosing: boolean } | null}
     */
    #parseHtmlOpeningTagMetadata(trimmedLine) {
        const t = String(trimmedLine || '').trim();
        if (!/^<[a-zA-Z]/.test(t) || /^<\//.test(t)) {
            return null;
        }
        const m = /^<([a-zA-Z][\w:-]*)\b/i.exec(t);
        if (!m) {
            return null;
        }
        const tag = m[1].toLowerCase();
        const voidTag = JamsEdu.#voidHtmlTagNames.has(tag);
        if (/[^/]\/\s*>$/.test(t)) {
            return { tag, selfClosing: true };
        }
        if (voidTag && />\s*$/.test(t)) {
            return { tag, selfClosing: true };
        }
        if (!/>\s*$/.test(t)) {
            return null;
        }
        return { tag, selfClosing: false };
    }

    /**
     * @param {string[]} lines
     * @param {number} openIdx
     * @returns {number | null}
     */
    #findBalancedHtmlIslandClosingLineIndex(lines, openIdx) {
        const opener = lines[openIdx];
        if (typeof opener !== 'string' || opener.length !== opener.trimStart().length) {
            return null;
        }
        const parsedOpen = this.#parseHtmlOpeningTagMetadata(opener.trim());
        if (!parsedOpen || parsedOpen.selfClosing) {
            return null;
        }
        const stack = [parsedOpen.tag];
        let j = openIdx + 1;
        while (j < lines.length && stack.length > 0) {
            const raw = lines[j];
            const trimmed = raw.trim();
            if (trimmed === '') {
                j += 1;
                continue;
            }
            const isCol0NonSpace = trimmed !== '' && raw === raw.trimStart();
            const closeMt = /^<\/([\w:-]+)\s*>/i.exec(trimmed);
            if (closeMt) {
                const tg = closeMt[1].toLowerCase();
                if (stack.length === 0 || stack[stack.length - 1] !== tg) {
                    return null;
                }
                stack.pop();
                const closedIdx = j;
                j += 1;
                if (stack.length === 0) {
                    return closedIdx;
                }
                continue;
            }
            const nestedOpen = this.#parseHtmlOpeningTagMetadata(trimmed);
            if (nestedOpen && !/^<\//.test(trimmed)) {
                if (!nestedOpen.selfClosing) {
                    stack.push(nestedOpen.tag.toLowerCase());
                }
                j += 1;
                continue;
            }
            if (!isCol0NonSpace) {
                j += 1;
                continue;
            }
            return null;
        }
        return null;
    }

    /**
     * Quarto markdown after `{=html}` often keeps prettily indented tags. Pandoc then treats 4+ space indents as
     * indented code blocks, so inner `<p>` becomes `<pre><code>`. Only rewrite balanced HTML islands outside ``` fences;
     * skip islands that contain `<pre>`, `<script>`, `<style>`, or `<textarea>` so whitespace-sensitive blocks stay
     * untouched. Does not disable markdown indented code blocks globally.
     *
     * @param {string[]} lines
     * @param {number} startIdx
     * @returns {{ startIdx: number; closingIdx: number; linesOut: string[] } | null}
     */
    #tryTrimStartIndentedHtmlIsland(lines, startIdx) {
        const closingIdx = this.#findBalancedHtmlIslandClosingLineIndex(lines, startIdx);
        if (closingIdx === null || closingIdx <= startIdx) {
            return null;
        }
        const innerSlice = lines.slice(startIdx + 1, closingIdx);
        const innerJoined = innerSlice.join('\n');
        if (/<\s*(pre|script|style|textarea)\b/i.test(innerJoined)) {
            return null;
        }
        const linesOut = [lines[startIdx]];
        for (let k = 0; k < innerSlice.length; k += 1) {
            linesOut.push(innerSlice[k].trimStart());
        }
        linesOut.push(lines[closingIdx]);
        const oldSeg = lines.slice(startIdx, closingIdx + 1).join('\n');
        const newSeg = linesOut.join('\n');
        if (oldSeg === newSeg) {
            return null;
        }
        return { startIdx, closingIdx, linesOut };
    }

    /**
     * @param {string} plainMarkdownChunk
     * @returns {string}
     */
    #relaxMisinterpretedIndentedHtmlInMarkdownPlainChunk(plainMarkdownChunk) {
        const lines = plainMarkdownChunk.split(/\r?\n/);
        const out = [];
        let i = 0;
        while (i < lines.length) {
            const island = this.#tryTrimStartIndentedHtmlIsland(lines, i);
            if (!island) {
                out.push(lines[i]);
                i += 1;
                continue;
            }
            for (let k = 0; k < island.linesOut.length; k += 1) {
                out.push(island.linesOut[k]);
            }
            i = island.closingIdx + 1;
        }
        return out.join('\n');
    }

    /**
     * Fixes `{=html}` / raw HTML blobs in Quarto intermediate markdown without changing global Pandoc markdown rules.
     *
     * @param {string} markdownBody
     * @returns {string}
     */
    #relaxMisinterpretedIndentedHtmlInQuartoMarkdown(markdownBody) {
        const segments = markdownBody.split(REGEX.markdownFencedCodeBlock);
        const mapped = segments.map((segment, index) => {
            if (index % 2 === 1) {
                return segment;
            }
            return this.#relaxMisinterpretedIndentedHtmlInMarkdownPlainChunk(segment);
        });
        return mapped.join('');
    }

    #pandocToHtmlFragment(markdownBody) {
        const quartoCommand = this.#resolveQuartoCommand();
        if (!quartoCommand) {
            throw new Error('Quarto CLI was not found while converting markdown to HTML.');
        }
        const rawHtml = this.#runCommand(quartoCommand, [
            'pandoc',
            '--lua-filter',
            Path.join(this.#quarto.rootDir, '_extensions', 'jamsedu', 'jamsedu-blocks.lua'),
            '--from',
            'markdown+fenced_divs+yaml_metadata_block-smart',
            '--to',
            'html',
            '--syntax-highlighting=none'
        ], { input: markdownBody }).trim();
        return this.#restoreTexBackslashesAfterPandoc(rawHtml);
    }

    /**
     * @param {string} markdownBody
     * @returns {Promise<string>}
     */
    async #pandocToHtmlFragmentAsync(markdownBody) {
        const quartoCommand = this.#resolveQuartoCommand();
        if (!quartoCommand) {
            throw new Error('Quarto CLI was not found while converting markdown to HTML.');
        }
        const stdout = await this.#runCommandAsync(quartoCommand, [
            'pandoc',
            '--lua-filter',
            Path.join(this.#quarto.rootDir, '_extensions', 'jamsedu', 'jamsedu-blocks.lua'),
            '--from',
            'markdown+fenced_divs+yaml_metadata_block-smart',
            '--to',
            'html',
            '--syntax-highlighting=none'
        ], { input: markdownBody });
        return this.#restoreTexBackslashesAfterPandoc(stdout.trim());
    }

    /**
     * Quarto/Pandoc HTML before `$echo(quartoHtml)`: JHP parses fragment badly if `<pre><code>` is jammed on one
     * line with raw `<>` in fenced code text. Rewrite common Pandoc shapes and entity-escape literal text runs.
     *
     * @param {string} htmlFragment
     * @returns {string}
     */
    #sanitizeHtmlFragmentForJhp(htmlFragment) {
        let s = String(htmlFragment);
        s = s.replace(/<pre([^>]*)><code([^>]*)>/g, '<pre$1><code$2>\n');
        s = s.replace(/<\/code><\/pre>/g, '\n</code></pre>');
        return s.replace(REGEX.scriptOpenNoAttributes, '<script type="text/javascript">');
    }

    #renderQmdWithTemplate(relativePath, htmlFragment, meta) {
        if (!this.#quarto.templatePath) {
            throw new Error(
                'No Quarto template: set quarto.template or add quarto.jhp under templateDir.'
            );
        }

        const templateContent = Fs.readFileSync(this.#quarto.templatePath, 'utf8');
        const context = {
            author: meta.author ?? null,
            date: meta.date ?? null,
            description: meta.description ?? null,
            keywords: this.#normalizeQmdKeywords(meta.keywords),
            quartoHtml: htmlFragment,
            title: meta.title ?? 'Quarto File'
        };
        const contextScript = `<script>
const qmdContext = ${JSON.stringify(context)};
$context('title', qmdContext.title);
$context('quartoHtml', qmdContext.quartoHtml);
if (qmdContext.description !== null) { $context('description', qmdContext.description); }
if (qmdContext.author !== null) { $context('author', qmdContext.author); }
if (qmdContext.date !== null) { $context('date', qmdContext.date); }
if (qmdContext.keywords !== null) { $context('keywords', qmdContext.keywords); }
</script>`;

        const combined = `${contextScript}\n${templateContent}`;
        return this.#JHP.process(combined, {
            cwd: Path.dirname(this.#quarto.templatePath),
            relPath: this.#determineRelativePath(Path.join(this.#srcDir, relativePath)),
            includeSearchRoots: this.#getIncludeSearchRoots()
        });
    }

    #renderMissingQuartoPage(relativePath) {
        const normalizedRelativePath = relativePath.replace(REGEX.windowsSlash, '/');
        const escaped = normalizedRelativePath.replace(REGEX.escapeLt, '&lt;').replace(REGEX.escapeGt, '&gt;');
        const attemptedLocations = this.#quarto.checkedCandidates
            .filter((candidate) => {
                return candidate !== 'quarto';
            })
            .slice(0, 3)
            .map((candidate) => {
                return `<code>${this.#escapeHtmlAttribute(candidate)}</code>`;
            });
        const locationHint = attemptedLocations.length > 0 ?
            `<details><summary>Advanced troubleshooting</summary>` +
            `<p>JamsEDU checked these locations for Quarto:</p>` +
            `<ul><li>${attemptedLocations.join('</li><li>')}</li></ul></details>` :
            '';
        /* eslint-disable max-len */
        const fallbackBody = `
<section class="callout warning">
    <div class="title">Quarto Not Installed</div>
    <p>The source file <code>${escaped}</code> could not be built because Quarto is not available right now. Install <a href="https://quarto.org/docs/get-started/" target="_blank" rel="noopener noreferrer">Quarto</a>, restart your app or terminal, and build again.</p>
    ${locationHint}
</section>`;
        /* eslint-enable max-len */
        return this.#renderQmdWithTemplate(relativePath, fallbackBody, {
            author: null,
            date: null,
            description: 'Quarto CLI is missing; this page is using graceful fallback output.',
            title: 'Quarto Not Installed'
        });
    }

    #writeMissingQuartoPage(dest, relativePath) {
        const renderedFallback = this.#renderMissingQuartoPage(relativePath);
        const qmdSrc = Path.join(this.#srcDir, relativePath);
        this.#writeFile(dest, renderedFallback, qmdSrc);
    }

    #findMissingQuartoIncludes(src, qmdContent) {
        const missing = [];
        const matches = qmdContent.matchAll(REGEX.includeShortcode);
        for (const match of matches) {
            const includePathRaw = typeof match[1] === 'string' ? match[1].trim() : '';
            const isRemoteInclude = REGEX.httpUrlScheme.test(includePathRaw);
            if (!includePathRaw || isRemoteInclude) {
                // eslint-disable-next-line no-continue
                continue;
            }
            if (!this.#resolveLocalQuartoIncludePath(includePathRaw, src)) {
                missing.push(includePathRaw);
            }
        }
        return missing;
    }

    #normalizeQuartoIncludesForRender(src, qmdContent) {
        const sourceDir = Path.dirname(src);
        return qmdContent.replace(REGEX.includeShortcode, (full, includePathRaw) => {
            const includePath = typeof includePathRaw === 'string' ? includePathRaw.trim() : '';
            if (!includePath || includePath.startsWith('http://') || includePath.startsWith('https://')) {
                return full;
            }
            if (!includePath.startsWith('/')) {
                return full;
            }

            const targetAbsolute = Path.resolve(
                this.#srcDir,
                includePath.replace(REGEX.trimEdgeForwardSlashes, '')
            );
            const relativeToSource = Path.relative(sourceDir, targetAbsolute).replace(REGEX.windowsSlash, '/');
            if (!relativeToSource) {
                return full;
            }
            return `{{< include ${relativeToSource} >}}`;
        });
    }

    #summarizeQuartoError(errorMessage) {
        if (typeof errorMessage !== 'string' || !errorMessage.trim()) {
            return 'Quarto failed while compiling this page.';
        }
        if (errorMessage.includes('Include directive failed')) {
            return 'An include file could not be found; check include paths in this page.';
        }
        if (errorMessage.includes('did not produce expected markdown output')) {
            return 'Quarto ran, but did not create the expected markdown output file.';
        }
        if (errorMessage.includes('Command failed:')) {
            return 'Quarto returned an error while rendering this page.';
        }
        return 'Quarto failed while compiling this page.';
    }

    #renderFailedQuartoPage(relativePath) {
        const normalizedRelativePath = relativePath.replace(REGEX.windowsSlash, '/');
        const escapedPath = normalizedRelativePath.replace(REGEX.escapeLt, '&lt;').replace(REGEX.escapeGt, '&gt;');
        /* eslint-disable max-len */
        const fallbackBody = `
<section class="callout warning">
    <div class="title">Quarto Render Failed</div>
    <p>The source file <code>${escapedPath}</code> could not be rendered. Check your Quarto content and try building again. If Quarto is not installed yet, start here: <a href="https://quarto.org/docs/get-started/" target="_blank" rel="noopener noreferrer">Install Quarto</a></p>
</section>`;
        /* eslint-enable max-len */
        return this.#renderQmdWithTemplate(relativePath, fallbackBody, {
            author: null,
            date: null,
            description: 'Quarto rendering failed; this page is using graceful fallback output.',
            title: 'Quarto Render Failed'
        });
    }

    #writeFailedQuartoPage(dest, relativePath, errorMessage) {
        const safePath = relativePath.replace(REGEX.windowsSlash, '/');
        const summary = this.#summarizeQuartoError(errorMessage);
        Print.error(`[Quarto] Failed to render ${safePath}: ${summary}`);
        if (this.#verbose && typeof errorMessage === 'string' && errorMessage.trim()) {
            Print.error(errorMessage);
        }
        const renderedFallback = this.#renderFailedQuartoPage(relativePath);
        const qmdSrc = Path.join(this.#srcDir, relativePath);
        this.#writeFile(dest, renderedFallback, qmdSrc);
    }

    /**
     * @returns {boolean} True when rendered HTML already reflects current `.qmd`/deps (watch path).
     */
    #shouldSkipQuartoRenderAsFresh(src, dest) {
        if (!Fs.existsSync(dest) || !Fs.existsSync(src)) {
            return false;
        }
        if (this.#buildUsesCleanSweep) {
            return false;
        }
        try {
            const destStat = Fs.statSync(dest);
            const srcStat = Fs.statSync(src);
            if (!destStat.isFile()) {
                return false;
            }
            const deps = this.#getQuartoStaleSkipInvalidationPaths(src)
                .filter((depPath) => {
                    return Fs.existsSync(depPath);
                });
            const newestMs = deps.reduce((max, depPath) => {
                return Math.max(max, Fs.statSync(depPath).mtimeMs);
            }, srcStat.mtimeMs);
            return destStat.mtimeMs >= newestMs;
        } catch {
            return false;
        }
    }

    /**
     * Shared QMD staging and payload preparation for sync/async render paths.
     *
     * @param {string} src
     * @param {string} relativePath
     * @returns {{
     *   stagedQmdPath: string;
     *   stagedMdPath: string;
     *   stagedQmdDir: string;
     *   stagedQmdBaseName: string;
     *   stagedMdBaseName: string;
     *   strayRootMdPath: string;
     *   strayManagedRootMdPath: string;
     * }}
     */
    #prepareQmdRenderStaging(src, relativePath) {
        const sourceContent = Fs.readFileSync(src, 'utf8');
        const missingIncludes = this.#findMissingQuartoIncludes(src, sourceContent);
        if (missingIncludes.length > 0) {
            const list = missingIncludes.map((filePath) => {
                return this.#toPosixPath(filePath);
            }).join(', ');
            throw new Error(`Missing include file(s): ${list}`);
        }

        const stagedQmdPath = Path.join(this.#quarto.rootDir, relativePath);
        const stagedMdPath = stagedQmdPath.replace(REGEX.qmdExt, '.md');
        const stagedQmdDir = Path.dirname(stagedQmdPath);
        const stagedQmdBaseName = Path.basename(stagedQmdPath);
        const stagedMdBaseName = Path.basename(stagedMdPath);

        this.#ensureManagedQuartoExtension();
        Fs.mkdirSync(stagedQmdDir, { recursive: true });
        const normalizedContent = this.#normalizeQuartoIncludesForRender(src, sourceContent);
        const rewrittenJamsBlocks = this.#rewriteJamsFencedBlocksForQuartoRender(normalizedContent);
        const stagedQmdPayload = this.#mergeJamseduShortcodeIntoFrontmatter(
            this.#applyDollarMathRewriteBeforeQuarto(rewrittenJamsBlocks),
            relativePath
        );
        Fs.writeFileSync(stagedQmdPath, stagedQmdPayload, 'utf8');

        return {
            stagedQmdPath,
            stagedMdPath,
            stagedQmdDir,
            stagedQmdBaseName,
            stagedMdBaseName,
            strayRootMdPath: Path.join(this.#usersRoot, stagedMdBaseName),
            strayManagedRootMdPath: Path.join(this.#quarto.rootDir, stagedMdBaseName)
        };
    }

    /**
     * @param {{stagedMdPath:string; strayRootMdPath:string; strayManagedRootMdPath:string;}} staged
     * @param {string} src
     */
    #cleanupQmdRenderStaging(staged, src) {
        if (Fs.existsSync(staged.strayRootMdPath) && Path.resolve(staged.strayRootMdPath) !== Path.resolve(staged.stagedMdPath)) {
            try {
                Fs.unlinkSync(staged.strayRootMdPath);
            } catch {
                // Ignore cleanup failure for leftover CLI output.
            }
        }
        if (
            Fs.existsSync(staged.strayManagedRootMdPath) &&
            Path.resolve(staged.strayManagedRootMdPath) !== Path.resolve(staged.stagedMdPath)
        ) {
            try {
                Fs.unlinkSync(staged.strayManagedRootMdPath);
            } catch {
                // Ignore cleanup failure for managed root markdown output.
            }
        }
        this.#removeStraySrcQuartoCache(src);
        this.#removeQuartoSessionTempDirs();
    }

    /**
     * @param {string} stagedMdPath
     * @returns {string}
     */
    #resolveRenderedMarkdownPath(stagedMdPath) {
        const stagedParse = Path.parse(stagedMdPath);
        const stagedQmdOutputPath = Path.join(stagedParse.dir, `${stagedParse.name}.qmd`);
        const renderedPath = Fs.existsSync(stagedMdPath) ? stagedMdPath : stagedQmdOutputPath;
        if (!Fs.existsSync(renderedPath)) {
            throw new Error(`Quarto render did not produce expected markdown output at: ${stagedMdPath}`);
        }
        return renderedPath;
    }

    /**
     * @param {string} stagedMdPath
     * @param {string} relativePath
     */
    #copyRenderedQmdAssets(stagedMdPath, relativePath) {
        const filesDir = Path.join(Path.dirname(stagedMdPath), `${Path.parse(stagedMdPath).name}_files`);
        if (!Fs.existsSync(filesDir)) {
            return;
        }
        const sourceDir = Path.dirname(relativePath);
        const prefix = sourceDir === '.' ? '' : sourceDir;
        const assetsDest = Path.join(this.#destDir, this.#quarto.assetsDir, prefix, Path.basename(filesDir));
        Fs.mkdirSync(assetsDest, { recursive: true });
        this.#copyDirectory(filesDir, assetsDest);
    }

    #processQmdFile(src, relativePath, dest) {
        const quartoCommand = this.#resolveQuartoCommand();
        if (!quartoCommand) {
            this.#writeMissingQuartoPage(dest, relativePath);
            return;
        }
        if (this.#shouldSkipQuartoRenderAsFresh(src, dest)) {
            return;
        }

        try {
            const staged = this.#prepareQmdRenderStaging(src, relativePath);
            try {
                /* Shortcodes resolve in Quarto preprocessing; Jupyter is optional and often missing on workstations. */
                this.#runCommand(quartoCommand, [
                    'render',
                    staged.stagedQmdBaseName,
                    '--to',
                    'markdown',
                    '--output',
                    staged.stagedMdBaseName,
                    '--no-execute',
                    '--execute-dir',
                    this.#quarto.rootDir
                ], {
                    cwd: staged.stagedQmdDir,
                    env: {
                        QUARTO_PROJECT_DIR: this.#quarto.rootDir
                    }
                });
            } finally {
                this.#cleanupQmdRenderStaging(staged, src);
            }

            const renderedPath = this.#resolveRenderedMarkdownPath(staged.stagedMdPath);

            const mdContent = Fs.readFileSync(renderedPath, 'utf8');
            const { frontmatter, body } = this.#splitFrontmatter(mdContent);
            const meta = this.#extractQmdMeta(frontmatter);
            const rewrittenBody = this.#sanitizeQuartoMarkdownLinkRoots(
                this.#rewriteQuartoAssetPaths(body, relativePath)
            );
            const mdRelaxedHtml = this.#relaxMisinterpretedIndentedHtmlInQuartoMarkdown(rewrittenBody);
            const mdWithMathHtml = this.#convertMarkdownMathToJamsHtml(mdRelaxedHtml);
            const htmlFragment = this.#sanitizeHtmlFragmentForJhp(this.#pandocToHtmlFragment(mdWithMathHtml));
            const finalHtml = this.#renderQmdWithTemplate(relativePath, htmlFragment, meta);
            this.#writeFile(dest, finalHtml, src);
            this.#copyRenderedQmdAssets(staged.stagedMdPath, relativePath);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.#writeFailedQuartoPage(dest, relativePath, errorMessage);
        }
    }

    /**
     * Async Quarto render for parallel batch builds.
     *
     * @param {string} src
     * @param {string} relativePath
     * @param {string} dest
     * @returns {Promise<void>}
     */
    async #processQmdFileAsync(src, relativePath, dest) {
        const quartoCommand = this.#resolveQuartoCommand();
        if (!quartoCommand) {
            this.#writeMissingQuartoPage(dest, relativePath);
            return;
        }
        if (this.#shouldSkipQuartoRenderAsFresh(src, dest)) {
            return;
        }

        try {
            const staged = this.#prepareQmdRenderStaging(src, relativePath);
            try {
                await this.#runCommandAsync(quartoCommand, [
                    'render',
                    staged.stagedQmdBaseName,
                    '--to',
                    'markdown',
                    '--output',
                    staged.stagedMdBaseName,
                    '--no-execute',
                    '--execute-dir',
                    this.#quarto.rootDir
                ], {
                    cwd: staged.stagedQmdDir,
                    env: {
                        QUARTO_PROJECT_DIR: this.#quarto.rootDir
                    }
                });
            } finally {
                this.#cleanupQmdRenderStaging(staged, src);
            }

            const renderedPath = this.#resolveRenderedMarkdownPath(staged.stagedMdPath);

            const mdContent = Fs.readFileSync(renderedPath, 'utf8');
            const { frontmatter, body } = this.#splitFrontmatter(mdContent);
            const meta = this.#extractQmdMeta(frontmatter);
            const rewrittenBody = this.#sanitizeQuartoMarkdownLinkRoots(
                this.#rewriteQuartoAssetPaths(body, relativePath)
            );
            const mdRelaxedHtml = this.#relaxMisinterpretedIndentedHtmlInQuartoMarkdown(rewrittenBody);
            const mdWithMathHtml = this.#convertMarkdownMathToJamsHtml(mdRelaxedHtml);
            const htmlFragment = this.#sanitizeHtmlFragmentForJhp(
                await this.#pandocToHtmlFragmentAsync(mdWithMathHtml)
            );
            const finalHtml = this.#renderQmdWithTemplate(relativePath, htmlFragment, meta);
            this.#writeFile(dest, finalHtml, src);
            this.#copyRenderedQmdAssets(staged.stagedMdPath, relativePath);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.#writeFailedQuartoPage(dest, relativePath, errorMessage);
        }
    }

    /**
     * @param {string} src
     * @param {{ deferQmd?: boolean }} [opts]
     */
    #processDir(src, opts = {}) {
        const deferQmd = opts.deferQmd === true;
        const entries = Fs.readdirSync(src, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.name === '.quarto') {
                // Quarto CLI project cache inside src/public; never copy or compile.
            } else {
                const srcPath = Path.join(src, entry.name);
                if (entry.isDirectory()) {
                    this.#processDir(srcPath, opts);
                } else if (entry.isFile()) {
                    const lower = entry.name.toLowerCase();
                    if (deferQmd && lower.endsWith('.qmd')) {
                        if (this.#isUnderTemplateDir(srcPath)) {
                            continue;
                        }
                        const relativePath = Path.relative(this.#srcDir, srcPath);
                        if (!this.#shouldCompileQmdStandalone(srcPath, relativePath)) {
                            this.#stageQmdPartialForQuarto(srcPath, relativePath);
                            continue;
                        }
                        const dest = this.#getDestPathFromRelative(relativePath, true, 'qmd');
                        this.#pendingQmdRenders.push({ src: srcPath, relativePath, dest });
                    } else {
                        this.#processFile(srcPath);
                    }
                }
            }
        }
    }

    #processFile(src) {
        if (this.#isUnderTemplateDir(src)) {
            return;
        }

        const relativePath = Path.relative(this.#srcDir, src);
        const isJhp = src.endsWith('.jhp');
        const isQmd = src.endsWith('.qmd');
        const isCompiledPage = isJhp || isQmd;
        const ext = Path.extname(src).replace('.', '');
        const dest = this.#getDestPathFromRelative(relativePath, isCompiledPage, ext);

        if (isJhp) {
            const cwd = Path.dirname(src);
            const relPath = this.#determineRelativePath(src);
            const content = Fs.readFileSync(src, 'utf8');
            const processed = this.#JHP.process(content, {
                cwd,
                relPath,
                includeSearchRoots: this.#getIncludeSearchRoots()
            });
            this.#writeFile(dest, processed, src);
        } else if (isQmd) {
            if (!this.#shouldCompileQmdStandalone(src, relativePath)) {
                this.#stageQmdPartialForQuarto(src, relativePath);
                this.#reprocessStandaloneQmdsThatIncludePartial(src);
                return;
            }
            this.#processQmdFile(src, relativePath, dest);
        } else {
            if (!this.#shouldCopyFile(relativePath, ext)) {
                return;
            }
            this.#copyFile(src, dest);
        }
    }

    #requireInit() {
        if (!this.#initialized) {
            if (this.#verbose) {
                Print.error('JamsEdu has not been initialized properly!');
            }
            return false;
        }
        return true;
    }

    /**
     * Merges reload intent from a watch batch; NSS calls are throttled.
     *
     * @param {{ reloadAll?: boolean; reloadStyles?: boolean; pagesToReload?: Set<string> }} batch
     */
    #queueThrottledWatchReload(batch) {
        if (!this.#NSS) {
            return;
        }
        if (batch.reloadAll) {
            this.#watchReloadQueued.reloadAll = true;
        }
        if (batch.reloadStyles) {
            this.#watchReloadQueued.reloadStyles = true;
        }
        if (batch.pagesToReload) {
            for (const page of batch.pagesToReload) {
                this.#watchReloadQueued.pages.add(page);
            }
        }
        this.#scheduleThrottledWatchReloadFlush();
    }

    #scheduleThrottledWatchReloadFlush() {
        if (!this.#NSS) {
            return;
        }
        if (this.#watchReloadFlushTimer !== null) {
            clearTimeout(this.#watchReloadFlushTimer);
            this.#watchReloadFlushTimer = null;
        }
        const elapsed = Date.now() - this.#watchReloadLastFlushMs;
        const delay = Math.max(0, this.#watchReloadThrottleMs - elapsed);
        this.#watchReloadFlushTimer = setTimeout(() => {
            this.#watchReloadFlushTimer = null;
            this.#flushWatchReloadQueueNow();
        }, delay);
    }

    /** Applies queued NSS reload calls and updates throttle clock. Skips empty queue. */
    #flushWatchReloadQueueNow() {
        if (!this.#NSS) {
            return;
        }
        const q = this.#watchReloadQueued;
        const { reloadAll } = q;
        const { reloadStyles } = q;
        const pages = [...q.pages];
        q.reloadAll = false;
        q.reloadStyles = false;
        q.pages.clear();
        if (!reloadAll && !reloadStyles && pages.length === 0) {
            return;
        }
        this.#watchReloadLastFlushMs = Date.now();
        if (reloadAll) {
            this.#NSS.reloadAllPages();
            return;
        }
        if (reloadStyles) {
            this.#NSS.reloadAllStyles();
        }
        for (const pagePath of pages) {
            this.#NSS.reloadSinglePage(pagePath);
        }
    }

    /**
     * Bypasses throttle (e.g. after watch bootstrap completes).
     */
    #flushWatchReloadImmediate() {
        if (!this.#NSS) {
            return;
        }
        if (this.#watchReloadFlushTimer !== null) {
            clearTimeout(this.#watchReloadFlushTimer);
            this.#watchReloadFlushTimer = null;
        }
        this.#flushWatchReloadQueueNow();
    }

    watch() {
        if (!this.#requireInit()) {
            if (this.#verbose) {
                Print.warn('JamsEdu has not been initialized properly! Watch aborted.');
            }
            return;
        }

        this.#NSS = new NodeSimpleServer({
            root: this.#destDir
        });

        this.#NSS.start(this.#PORT, (result) => {
            if (!result) {
                Print.error('Possible upstream issue with Node Simple Server! Try again later.');
                exit(1);
            }
        }, false);

        this.#NSS.watch(this.#srcDir, {
            events: {
                all: this.#watcherCallbackDebounced.bind(this)
            },
            followSymlinks: false,
            ignoreInitial: true,
            cwd: this.#srcDir
        });

        Print.success('JamsEdu is now watching for changes and will reload automatically.');
        Print.warn('Press Ctrl+C to stop.');
        Print.info('Access your site at the following address(es):');
        const addresses = this.#NSS.getAddresses().filter((addr) => {
            return addr.startsWith('http://localhost') || addr.startsWith('http://127.');
        });
        Print.info(`• ${addresses.join('\n• ')}`);
        Print.info('These addresses are meant for local network use only.');
        Print.info(
            '\nFinishing rebuild in the background; you may briefly see output from your last saved build.'
        );

        setImmediate(() => {
            void (async() => {
                try {
                    await this.build({ clean: false });
                    if (!this.#NSS) {
                        return;
                    }
                    this.#watchReloadQueued.reloadAll = true;
                    this.#flushWatchReloadImmediate();
                } catch (error) {
                    const message = error instanceof Error ? error.message : String(error);
                    Print.error(`Watch bootstrap rebuild failed: ${message}`);
                }
            })();
        });
    }

    /**
     * Debounced entry for watch events; batches rapid events (e.g. rename = unlink + add).
     */
    #watcherCallbackDebounced(event, path, statsOrDetails = {}) {
        this.#pendingWatchEvents.push({ event, path, statsOrDetails });
        if (this.#watchDebounceTimer !== null) {
            clearTimeout(this.#watchDebounceTimer);
        }
        this.#watchDebounceTimer = setTimeout(() => {
            this.#watchDebounceTimer = null;
            this.#processPendingWatchEvents();
        }, this.#watchDebounceMs);
    }

    /**
     * Normalize watched page paths for NSS reload calls.
     *
     * @param {string} pathFromWatch
     * @returns {string}
     */
    #toWatchReloadPagePath(pathFromWatch) {
        return this.#toPosixPath(pathFromWatch);
    }

    /**
     * Processes batched watch events: unlink/unlinkDir first (sync output), then change/add (build), then reload.
     */
    #processPendingWatchEvents() {
        const pending = this.#pendingWatchEvents.splice(0, this.#pendingWatchEvents.length);
        if (pending.length === 0) {
            return;
        }

        let reloadAll = false;
        const pagesToReload = new Set();
        let reloadStyles = false;
        let deferredTemplateRebuild = false;

        // Process unlink/unlinkDir first so output matches src (and renames don't leave stale files).
        for (const { event, path } of pending) {
            if (event === 'unlink') {
                const wasCompiledPage = path.toLowerCase().endsWith('.jhp') || path.toLowerCase().endsWith('.qmd');
                const ext = Path.extname(path).replace('.', '');
                const destPath = this.#resolveDestPath(path, wasCompiledPage, ext);
                if (destPath) {
                    this.#removeDestPath(destPath);
                }
                if (path.toLowerCase().endsWith('.qmd')) {
                    const sourceDir = Path.dirname(path);
                    const sourcePrefix = sourceDir === '.' ? '' : sourceDir;
                    const generatedAssetsPath = Path.join(
                        this.#destDir,
                        this.#quarto.assetsDir,
                        sourcePrefix,
                        `${Path.parse(path).name}_files`
                    );
                    this.#removeDestPath(generatedAssetsPath);
                }
                reloadAll = true;
            } else if (event === 'unlinkDir') {
                const destPath = this.#resolveDestPath(path, false, '');
                if (destPath) {
                    this.#removeDestPath(destPath);
                }
                reloadAll = true;
            }
        }

        // Then process change/add (build step).
        for (const { event, path, statsOrDetails } of pending) {
            if (event === 'change' || event === 'add') {
                const ext = String(statsOrDetails?.ext ?? Path.extname(path).replace('.', ''))
                    .replace(REGEX.dotPrefix, '')
                    .toLowerCase();
                const src = Path.join(this.#srcDir, path);

                if (ext === 'css') {
                    this.#processFile(src);
                    reloadStyles = true;
                } else if (this.#isUnderTemplateDir(src)) {
                    deferredTemplateRebuild = true;
                } else if (ext === 'jhp') {
                    this.#processFile(src);
                    pagesToReload.add(this.#toWatchReloadPagePath(path.replace(REGEX.jhpExt, '.html')));
                } else if (ext === 'qmd') {
                    this.#processFile(src);
                    pagesToReload.add(this.#toWatchReloadPagePath(path.replace(REGEX.qmdExt, '.html')));
                    reloadAll = true;
                } else {
                    // Remaining files (js, images, fonts, etc.) are copied like a full build; browsers cache
                    // scripts, so reload all pages (same idea as NSS watch examples for .js).
                    this.#processFile(src);
                    reloadAll = true;
                }
            }
        }

        if (deferredTemplateRebuild) {
            void (async() => {
                try {
                    await this.build({ clean: true });
                    if (!this.#NSS) {
                        return;
                    }
                    this.#watchReloadQueued.reloadAll = true;
                    this.#flushWatchReloadImmediate();
                } catch (error) {
                    const message = error instanceof Error ? error.message : String(error);
                    Print.error(`Watch rebuild failed: ${message}`);
                }
            })();
            return;
        }

        if (!this.#NSS) {
            return;
        }
        this.#queueThrottledWatchReload({ reloadAll, reloadStyles, pagesToReload });
    }

    /**
     * @param {string} dest
     * @param {string} content
     * @param {string | null} [sourceForMtime] Primary source path whose `mtime` is recorded for search indexing.
     */
    #writeFile(dest, content, sourceForMtime = null) {
        try {
            Fs.mkdirSync(Path.dirname(dest), { recursive: true });
            Fs.writeFileSync(dest, content, 'utf8');
            if (sourceForMtime) {
                this.#recordPageSourceMtime(dest, sourceForMtime);
            }
        } catch (err) {
            Print.error(`Failed to write file to ${dest}`);
            if (this.#verbose) {
                Print.error(err);
            }
            this.#errorLimit -= 1;
            if (this.#errorLimit <= 0) {
                Print.error('Too many errors encountered. Processing was stopped.');
                exit(1);
            }
        }
    }

};
