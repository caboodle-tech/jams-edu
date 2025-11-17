/**
 * Caboodle Tech's opinionated rules for linting HTML with ESLint. Feel free to adapt or modify
 * these rules to suit your needs.
 *
 * ESLint Plugin: {@link https://www.npmjs.com/package/@html-eslint/eslint-plugin @html-eslint/eslint-plugin}
 * HTML ESLint Parser: {@link https://www.npmjs.com/package/@html-eslint/parser @html-eslint/parser}
 * HTML ESLint Rules: {@link https://html-eslint.org/docs/rules HTML ESLint Docs}
 */
export default {
    '@html-eslint/indent': ['error', 4],
    '@html-eslint/no-duplicate-attrs': 'error',
    '@html-eslint/no-duplicate-id': 'error',
    '@html-eslint/no-extra-spacing-attrs': 'error',
    '@html-eslint/no-inline-styles': 'warn',
    '@html-eslint/no-multiple-empty-lines': ['error', { max: 1 }],
    '@html-eslint/no-obsolete-tags': 'error',
    '@html-eslint/no-script-style-type': 'error',
    '@html-eslint/no-target-blank': 'error',
    '@html-eslint/no-trailing-spaces': 'error',
    '@html-eslint/require-button-type': 'warn',
    '@html-eslint/require-closing-tags': 'error',
    '@html-eslint/require-doctype': 'error',
    '@html-eslint/require-li-container': 'warn',
    '@html-eslint/require-meta-viewport': 'error',
    '@html-eslint/sort-attrs': 'warn'
};
