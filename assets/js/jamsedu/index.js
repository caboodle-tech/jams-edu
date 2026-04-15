import DomWatcher from './dom-watcher.js';
import EmbedPdfLoader from './embed-pdf.js';
import HighlightJsLiteLoader from './highlight-js-lite.js';
import KatexLoader from './katex.js';
import MermaidLoader from './mermaid.js';
import TinyDocument from './tiny-doc.js';
import TinyWysiwyg from './tiny-wysiwyg.js';

const embedPdfDefaultDisabledCategories = [
    'form',
    'redaction',
    'document-open',
    'document-close',
    'document-capture',
    'document-protect',
    'capture'
];

/**
 * @typedef {object} JamsEduTinyDocumentOptions
 * @property {boolean} [useMutationObserver] Watch DOM for new `.document` nodes (default true).
 */

/**
 * @typedef {object} JamsEduTinyWysiwygOptions
 * @property {boolean} [useMutationObserver] Watch DOM for new `textarea.rich` nodes.
 */

/**
 * @typedef {object} JamsEduKatexOptions
 * @property {boolean} [useMutationObserver]
 * @property {string} [version] jsDelivr/npm tag for katex (default `latest`).
 * @property {string} [katexVersion] Same as `version`.
 */

/**
 * @typedef {object} JamsEduMermaidOptions
 * @property {boolean} [useMutationObserver]
 * @property {string} [version] jsDelivr tag for mermaid.
 * @property {string} [mermaidVersion] Same as `version`.
 * @property {string} [theme] Mermaid theme name.
 */

/**
 * @typedef {object} JamsEduHighlightJsLiteOptions
 * @property {boolean} [useMutationObserver] Accepted for consistency; HLJSL uses its own observers.
 * @property {string} [version] jsDelivr Git ref (`latest`, `v4.0.0`, …).
 * @property {string} [hljslVersion] Same as `version`.
 * Other keys are forwarded to `window.hljslConfig` (JSON-serializable only).
 */

/**
 * @typedef {object} JamsEduEmbedPdfOptions
 * @property {boolean} [useMutationObserver]
 * @property {string} [version] `@embedpdf/snippet` tag.
 * @property {string} [snippetVersion] Same as `version`.
 * @property {number} [minZoom]
 * @property {number} [maxZoom]
 * @property {number} [scrollPageGap]
 * @property {string[]} [disabledCategories] Toolbar category ids to hide (full list replacement).
 * @property {boolean} [fullscreenProxy] Extra fullscreen control wiring for the snippet UI.
 */

/**
 * @typedef {object} JamsEduConfig
 * @property {false | JamsEduTinyDocumentOptions} [tinyDocument]
 * @property {false | JamsEduTinyWysiwygOptions} [tinyWysiwyg]
 * @property {false | JamsEduKatexOptions} [katex]
 * @property {false | JamsEduMermaidOptions} [mermaid]
 * @property {false | JamsEduHighlightJsLiteOptions} [highlightJsLite]
 * @property {false | JamsEduEmbedPdfOptions} [embedPdf]
 */

/**
 * Default options for each loader. Set any key to `false` in `jamsEduConfig` (in `main.js`) to skip that loader.
 *
 * @type {JamsEduConfig}
 */
export const defaultJamsEduConfig = {
    tinyDocument: {
        useMutationObserver: true
    },
    tinyWysiwyg: {
        useMutationObserver: true
    },
    katex: {
        useMutationObserver: true,
        version: '0.16.45'
    },
    mermaid: {
        useMutationObserver: true,
        version: '11.14.0',
        /* Light palette only: dark UI uses `invert` + `hue-rotate` in `jamsedu.css`. Do not set `dark` here. */
        theme: 'default'
    },
    highlightJsLite: {
        useMutationObserver: true,
        version: '4.3.0'
    },
    embedPdf: {
        useMutationObserver: true,
        version: '2.14.0',
        minZoom: 0.5,
        maxZoom: 3,
        scrollPageGap: 12,
        disabledCategories: [...embedPdfDefaultDisabledCategories],
        fullscreenProxy: true
    }
};

/**
 * @param {Record<string, unknown>} defaults Library defaults for one loader key.
 * @param {false | true | null | undefined | Record<string, unknown>} override
 *   `jamsEduConfig` entry: `false` skips that loader; object shallow-merges into `defaults`.
 * @returns {false | Record<string, unknown>}
 */
const mergeDefaultsWithOverride = (defaults, override) => {
    if (override === false) {
        return false;
    }
    if (override === undefined || override === null || override === true) {
        return { ...defaults };
    }
    if (typeof override !== 'object' || override === null) {
        return { ...defaults };
    }
    const merged = { ...defaults, ...override };
    if (Array.isArray(merged.disabledCategories)) {
        merged.disabledCategories = [...merged.disabledCategories];
    }
    return merged;
};

/**
 * Starts TinyDocument, TinyWysiwyg, KaTeX, Mermaid, Highlight JS Lite, and Embed PDF from `main.js` config.
 *
 * @param {JamsEduConfig | {}} [overrides] Usually `jamsEduConfig`; merged over `defaultJamsEduConfig`.
 */
export const initJamsEdu = (overrides = {}) => {
    const hasMO = typeof MutationObserver !== 'undefined';

    /**
     * @param {Record<string, unknown>} opts
     * @returns {Record<string, unknown>}
     */
    const withMutationObserverOption = (opts) => {
        return {
            ...opts,
            useMutationObserver: opts.useMutationObserver !== false && hasMO
        };
    };

    const tinyDocument = mergeDefaultsWithOverride(
        defaultJamsEduConfig.tinyDocument,
        overrides.tinyDocument
    );
    const tinyWysiwyg = mergeDefaultsWithOverride(
        defaultJamsEduConfig.tinyWysiwyg,
        overrides.tinyWysiwyg
    );
    const katex = mergeDefaultsWithOverride(defaultJamsEduConfig.katex, overrides.katex);
    const mermaid = mergeDefaultsWithOverride(defaultJamsEduConfig.mermaid, overrides.mermaid);
    const highlightJsLite = mergeDefaultsWithOverride(
        defaultJamsEduConfig.highlightJsLite,
        overrides.highlightJsLite
    );
    const embedPdf = mergeDefaultsWithOverride(defaultJamsEduConfig.embedPdf, overrides.embedPdf);

    if (tinyDocument !== false) {
        TinyDocument.start(withMutationObserverOption(tinyDocument));
    }
    if (tinyWysiwyg !== false) {
        TinyWysiwyg.start(withMutationObserverOption(tinyWysiwyg));
    }
    if (katex !== false) {
        KatexLoader.start(withMutationObserverOption(katex));
    }
    if (mermaid !== false) {
        MermaidLoader.start(withMutationObserverOption(mermaid));
    }
    if (highlightJsLite !== false) {
        HighlightJsLiteLoader.start(withMutationObserverOption(highlightJsLite));
    }
    if (embedPdf !== false) {
        EmbedPdfLoader.start(withMutationObserverOption(embedPdf));
    }
};

export {
    DomWatcher,
    EmbedPdfLoader,
    HighlightJsLiteLoader,
    KatexLoader,
    MermaidLoader,
    TinyDocument,
    TinyWysiwyg
};
