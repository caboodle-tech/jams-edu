import Fs from 'fs';
import Path from 'path';
import Print from './print.js';
import { WhatIs } from './helpers.js';

/** @typedef {{ patched: boolean; reason?: string }} QuartoPersistResult */

/**
 * Join two project-relative path segments using forward slashes (matches config file style).
 *
 * @param {string} base
 * @param {string} leaf
 * @returns {string}
 */
export const joinConfigRelPosixPath = (base, leaf) => {
    const a = String(base || '').trim().replace(/\\/g, '/').replace(/\/+$/, '');
    const b = String(leaf || '').trim().replace(/\\/g, '/').replace(/^\/+/, '');
    if (!a) {
        return b;
    }
    if (!b) {
        return a;
    }
    return `${a}/${b}`;
};

/**
 * Depth-first synchronous walk: true when any `.qmd` exists under root.
 *
 * @param {string} absRoot
 * @returns {boolean}
 */
export const dirTreeHasAnyQmd = (absRoot) => {
    if (!Fs.existsSync(absRoot)) {
        return false;
    }
    const stack = [absRoot];
    while (stack.length > 0) {
        const dir = stack.pop();
        let entries = [];
        try {
            entries = Fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            entries = [];
        }
        for (const entry of entries) {
            const child = Path.join(dir, entry.name);
            if (entry.isDirectory()) {
                if (entry.name !== '.quarto') {
                    stack.push(child);
                }
            } else if (entry.isFile() && /\.qmd$/i.test(entry.name)) {
                return true;
            }
        }
    }
    return false;
};

/**
 * True when Quarto `.qmd` integration keys are omitted from loaded config object.
 *
 * @param {Record<string, unknown>} config
 * @returns {boolean}
 */
export const configIsMissingExplicitQuartoKeys = (config) => {
    const q = WhatIs(config.quarto) === 'object' && config.quarto !== null ? config.quarto : null;
    if (q === null) {
        return true;
    }
    const tplNested = typeof q.template === 'string' ? q.template.trim() : '';
    return tplNested === '';
};

/**
 * Avoid touching config when Quarto wiring is partly or fully spelled out already.
 *
 * @param {string} fileText
 * @returns {boolean}
 */
const configJsMentionsAnyQuartoKey = (fileText) => {
    return /\bquarto\s*:\s*\{/m.test(fileText);
};

/**
 * When the site has `.qmd` sources and config omits Quarto keys, append defaults to `export default {`.
 * Applies in-memory merges on `config` so the running process matches disk.
 *
 * @param {{ configFileAbsPath: string; usersRoot: string; config: Record<string, unknown> }} params
 * @returns {QuartoPersistResult}
 */
export const persistQuartoDefaultsIntoConfigJsIfEligible = (params) => {
    const { configFileAbsPath, usersRoot, config } = params;
    const normalizedConfigPath = String(configFileAbsPath || '').trim();
    if (!normalizedConfigPath.endsWith('.js')) {
        return { patched: false, reason: 'not-js' };
    }
    const srcAbs = typeof config.srcDir === 'string' ?
        Path.resolve(usersRoot, config.srcDir.trim()) :
        '';

    const templateDirRaw = typeof config.templateDir === 'string' ? config.templateDir.trim() : '';
    if (
        templateDirRaw === '' ||
        !dirTreeHasAnyQmd(srcAbs) ||
        !configIsMissingExplicitQuartoKeys(config)
    ) {
        return { patched: false, reason: 'skip' };
    }

    let fileText = '';
    try {
        fileText = Fs.readFileSync(normalizedConfigPath, 'utf8');
    } catch {
        return { patched: false, reason: 'read-fail' };
    }

    if (configJsMentionsAnyQuartoKey(fileText)) {
        return { patched: false, reason: 'file-partial-quarto' };
    }

    const templateDirNormalized = templateDirRaw.replace(/\\/g, '/').replace(/^\/+/, '');
    const relativeQuartoTpl = joinConfigRelPosixPath(templateDirNormalized, 'quarto.jhp');
    const injectionLines =
        `\n    quarto: {\n` +
        `        template: ${JSON.stringify(relativeQuartoTpl)},\n` +
        `        assetsDir: 'quarto-assets',\n` +
        `        workingDir: '.quarto'\n` +
        `    }`;

    const trimmedEnd = fileText.replace(/\s*$/, '');
    const exportCloseRegex = /\n}\s*;\s*$/;
    const closeMatchIndex = trimmedEnd.search(exportCloseRegex);
    if (closeMatchIndex === -1) {
        Print.warn('[Quarto] Could not safely patch config: expected file to end with `};`.');
        return { patched: false, reason: 'unexpected-shape' };
    }

    /** @type {string} */
    let prefix = trimmedEnd.slice(0, closeMatchIndex).replace(/\s*$/, '');
    if (!prefix.endsWith(',')) {
        prefix = `${prefix},`;
    }

    const suffix = trimmedEnd.slice(closeMatchIndex);
    const updated = `${prefix}${injectionLines}${suffix}`;

    try {
        Fs.writeFileSync(normalizedConfigPath, `${updated}\n`, 'utf8');
    } catch {
        Print.warn('[Quarto] Failed to write Quarto defaults into config.');
        return { patched: false, reason: 'write-fail' };
    }

    config.quarto = {
        template: relativeQuartoTpl,
        assetsDir: 'quarto-assets',
        workingDir: '.quarto'
    };

    const relConfig = Path.relative(usersRoot, normalizedConfigPath).replace(/\\/g, '/') ||
        normalizedConfigPath;
    Print.info(`[Quarto] Added default quarto block (template + paths) to ${relConfig} (found .qmd under srcDir).`);

    return { patched: true };
};
