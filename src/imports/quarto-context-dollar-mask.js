/**
 * JHP rewrites `$include`, `$echo`, and other `$word` builtins. Quarto bootstrap embeds `qmdContext` from
 * `JSON.stringify`, so literal `$` in `quartoHtml` or YAML strings would corrupt the stored HTML. Mask `$`
 * as `&#36;` in the serialized object literal; the HTML parser decodes it when `$echo(quartoHtml)` runs.
 *
 * @param {string} stringifiedContext
 * @returns {string}
 */
export const maskAsciiDollarInQuartoContextJson = (stringifiedContext) => {
    return String(stringifiedContext || '').replace(/\$/g, '&#36;');
};
