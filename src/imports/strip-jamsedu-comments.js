/**
 * Shared utilities for stripping @jamsedu-version and @jamsedu-component comments
 * from template/output files. Single source of truth for init, update, and build.
 */

/** Extensions for files we treat as text and strip comments from (build copy). */
const TEXT_EXTENSIONS = new Set([
    'css', 'htm', 'html', 'js', 'json', 'mjs', 'cjs', 'md', 'qmd', 'svg', 'xml'
]);

const LINE_END = String.raw`(?:\r\n|\n|\r)`;

/**
 * Strip @jamsedu-version and @jamsedu-component lines from content.
 * Handles //, block, and HTML comment forms. Line endings: CRLF, LF, or CR.
 * CSS block comment forms consume one trailing line terminator with each stripped tag so the file
 * does not gain extra blank runs before real content.
 * If any metadata was removed, trims a leading UTF-8 BOM and leading newlines.
 *
 * @param {string} content - Raw file content.
 * @returns {string} Content with JamsEdu comment lines removed.
 */
export const stripJamseduComments = (content) => {
    const before = content;
    let out = content;
    out = out.replace(
        new RegExp(`//\\s*@jamsedu-version:\\s*[\\d.]+\\s*${LINE_END}?`, 'g'),
        ''
    );
    out = out.replace(
        new RegExp(`//\\s*@jamsedu-component:\\s*\\S+\\s*${LINE_END}?`, 'g'),
        ''
    );
    out = out.replace(
        new RegExp(`\\/\\*\\s*@jamsedu-version:\\s*[\\d.]+\\s*\\*\\/${LINE_END}?`, 'g'),
        ''
    );
    out = out.replace(
        new RegExp(`\\/\\*\\s*@jamsedu-component:\\s*\\S+\\s*\\*\\/${LINE_END}?`, 'g'),
        ''
    );
    out = out.replace(
        new RegExp(String.raw`<!--\s*@jamsedu-version:\s*[\d.]+\s*-->${LINE_END}?`, 'g'),
        ''
    );
    out = out.replace(
        new RegExp(String.raw`<!--\s*@jamsedu-component:\s*\S+\s*-->${LINE_END}?`, 'g'),
        ''
    );
    if (before !== out) {
        out = out.replace(/^\uFEFF/, '').replace(new RegExp(`^${LINE_END}+`), '');
    }
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
        .map((line) => { return line.replace(/\s+$/, ''); })
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
