/**
 * Shared utilities for stripping @jamsedu-version and @jamsedu-component comments
 * from template/output files. Single source of truth for init, update, and build.
 */

/** Extensions for files we treat as text and strip comments from (build copy). */
const TEXT_EXTENSIONS = new Set([
    'css', 'htm', 'html', 'js', 'json', 'mjs', 'cjs', 'md', 'svg', 'xml'
]);

/**
 * Strip @jamsedu-version and @jamsedu-component lines from content.
 * Handles //, /* *\/, and <!-- --> comment styles.
 *
 * @param {string} content - Raw file content.
 * @returns {string} Content with JamsEdu comment lines removed.
 */
export const stripJamseduComments = (content) => {
    let out = content;
    out = out.replace(/\/\/\s*@jamsedu-version:\s*[\d.]+\s*\n?/g, '');
    out = out.replace(/\/\/\s*@jamsedu-component:\s*\S+\s*\n?/g, '');
    out = out.replace(/\/\*\s*@jamsedu-version:\s*[\d.]+\s*\*\//g, '');
    out = out.replace(/\/\*\s*@jamsedu-component:\s*\S+\s*\*\//g, '');
    out = out.replace(/<!--\s*@jamsedu-version:\s*[\d.]+\s*-->\s*\n?/g, '');
    out = out.replace(/<!--\s*@jamsedu-component:\s*\S+\s*-->\s*\n?/g, '');
    return out;
};

/**
 * Parse @jamsedu-version value from content (before stripping).
 *
 * @param {string} content - File content.
 * @returns {string|null} Version string or null.
 */
export const parseVersionFromFile = (content) => {
    const js = content.match(/\/\/\s*@jamsedu-version:\s*([\d.]+)/);
    if (js) return js[1];
    const css = content.match(/\/\*\s*@jamsedu-version:\s*([\d.]+)\s*\*\//);
    if (css) return css[1];
    const html = content.match(/<!--\s*@jamsedu-version:\s*([\d.]+)\s*-->/);
    if (html) return html[1];
    return null;
};

/**
 * Parse @jamsedu-component value from content (before stripping).
 *
 * @param {string} content - File content.
 * @returns {string|null} Component id or null.
 */
export const parseComponentFromFile = (content) => {
    const js = content.match(/\/\/\s*@jamsedu-component:\s*(\S+)/);
    if (js) return js[1];
    const css = content.match(/\/\*\s*@jamsedu-component:\s*(\S+)\s*\*\//);
    if (css) return css[1];
    const html = content.match(/<!--\s*@jamsedu-component:\s*(\S+)\s*-->/);
    if (html) return html[1];
    return null;
};

/**
 * Normalize content for hash comparison so trivial changes (EOL, trailing spaces) don't mark as customized.
 * Poor man's normalize: same line endings, trim trailing whitespace per line and at end of file.
 *
 * @param {string} content - Raw file content.
 * @returns {string} Normalized content.
 */
export const normalizeContentForHash = (content) => {
    if (typeof content !== 'string') return '';
    return content
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .split('\n')
        .map((line) => line.replace(/\s+$/, ''))
        .join('\n')
        .trimEnd();
};

/**
 * Whether the file extension is one we strip comments from when copying to build output.
 *
 * @param {string} filePath - Path or filename.
 * @returns {boolean}
 */
export const isTextFileForStripping = (filePath) => {
    const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
    return TEXT_EXTENSIONS.has(ext);
};
