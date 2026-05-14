/**
 * Post hook: external-looking `a[href]` links get `target="_blank"` and `rel` gains `noopener` and
 * `noreferrer` when appropriate. Skips `javascript:`, `data:`, `mailto:`, `tel:`, `sms:`, and `ftp:`.
 * Does not override an existing non-empty `target` except to merge `rel` when that target is `_blank`.
 */

const REGEX = Object.freeze({
    /** `http://`, `https://`, or protocol-relative `//`. */
    externalHttpOrProtocolRelative: /^(?:https?:)?\/\//iu,
    /** Scheme tokens we never decorate (case-insensitive). */
    blockedScheme: /^(?:javascript|data|vbscript)\s*:/iu,
    /** Schemes where a new browsing context is a poor default. */
    skipNewTabScheme: /^(?:mailto|tel|sms|ftp)\s*:/iu
});

/** simple-html-parser may use this placeholder for an empty attribute value. */
const EMPTY_ATTR_SENTINEL = '__EMPVAL__';

/**
 * True when `href` should open in a new tab for this hook.
 *
 * @param {string} href
 * @returns {boolean}
 */
const isExternalNewTabHref = (href) => {
    const trimmed = String(href || '').trim();
    if (trimmed === '') {
        return false;
    }
    if (REGEX.blockedScheme.test(trimmed) || REGEX.skipNewTabScheme.test(trimmed)) {
        return false;
    }
    return REGEX.externalHttpOrProtocolRelative.test(trimmed);
};

/**
 * Ensures `noopener` and `noreferrer` appear on `rel` without dropping existing tokens.
 *
 * @param {{
 *   getAttribute: (name: string) => string | null | undefined;
 *   setAttribute: (name: string, value: string) => void;
 * }} anchor
 * @returns {void}
 */
const mergeRelNoopenerNoreferrer = (anchor) => {
    const raw = anchor.getAttribute('rel');
    const parts =
        raw != null && String(raw).trim() !== '' ?
            String(raw).trim().split(/\s+/).filter(Boolean) :
            [];
    const lower = new Set(parts.map((p) => {
        return p.toLowerCase();
    }));
    if (!lower.has('noopener')) {
        parts.push('noopener');
        lower.add('noopener');
    }
    if (!lower.has('noreferrer')) {
        parts.push('noreferrer');
        lower.add('noreferrer');
    }
    anchor.setAttribute('rel', parts.join(' '));
};

/**
 * @param {{
 *   dom: {
 *     querySelectorAll: (sel: string) => Iterable<{
 *       getAttribute: (name: string) => string | null | undefined;
 *       setAttribute: (name: string, value: string) => void;
 *     }>;
 *   };
 * }} scope
 * @returns {void}
 */
const jamsEduExternalLinks = (scope) => {
    const anchors = scope.dom.querySelectorAll('a[href]');
    anchors.forEach((anchor) => {
        const hrefAttr = anchor.getAttribute('href');
        if (hrefAttr == null || String(hrefAttr).trim() === '') {
            return;
        }
        if (!isExternalNewTabHref(String(hrefAttr))) {
            return;
        }
        const existingTargetRaw = anchor.getAttribute('target');
        let existingTarget =
            existingTargetRaw == null || typeof existingTargetRaw !== 'string' ?
                '' :
                existingTargetRaw.trim();
        if (existingTarget === EMPTY_ATTR_SENTINEL) {
            existingTarget = '';
        }
        if (existingTarget !== '') {
            if (existingTarget.toLowerCase() === '_blank') {
                mergeRelNoopenerNoreferrer(anchor);
            }
            return;
        }
        anchor.setAttribute('target', '_blank');
        mergeRelNoopenerNoreferrer(anchor);
    });
};

export default jamsEduExternalLinks;
