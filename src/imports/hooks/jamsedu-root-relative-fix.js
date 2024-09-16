/* eslint-disable no-param-reassign */

/**
 * Converts all root-relative URLs to relative URLs.
 *
 * @param {string} html The HTML content to process.
 * @param {object} som The object representing the HTML structure.
 * @returns {string} The modified HTML content with embedded videos.
 */
const JamsRootRelativeFix = (html, som) => {
    som.findAll('(img|script|iframe|audio|video|source|track|embed|input)[src]').forEach((match) => {
        const oldHtml = som.getNodeHtml(match);
        const oldSrc = match.value.attrsMap.get('src');
        if (oldSrc.length === 0) return;
        if (oldSrc[0] !== '/') return;
        const newSrc = `${som.stats.relativeLevels}${oldSrc.substring(1)}`;
        const newHtml = oldHtml.replace(oldSrc, newSrc);
        html = html.replace(oldHtml, newHtml);
    });
    som.findAll('(a|link|area|base)[href]').forEach((match) => {
        const oldHtml = som.getNodeHtml(match);
        const oldHref = match.value.attrsMap.get('href');
        if (oldHref.length === 0) return;
        if (oldHref[0] !== '/') return;
        const newHref = `${som.stats.relativeLevels}${oldHref.substring(1)}`;
        const newHtml = oldHtml.replace(oldHref, newHref);
        html = html.replace(oldHtml, newHtml);
    });
    return html;
};

export default JamsRootRelativeFix;
