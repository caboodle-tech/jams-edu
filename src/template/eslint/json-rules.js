// @jamsedu-version: 1.0.0
// @jamsedu-component: eslint-json-rules
/**
 * Caboodle Tech's opinionated rules for linting JSON with ESLint. Feel free to adapt or modify
 * these rules to suit your needs.
 *
 * ESLint Plugin: {@link https://www.npmjs.com/package/eslint-plugin-jsonc eslint-plugin-jsonc}
 * JSON ESLint Parser: {@link https://www.npmjs.com/package/jsonc-eslint-parser jsonc-eslint-parser}
 * JSON ESLint Rules: {@link https://ota-meshi.github.io/eslint-plugin-jsonc/rules/ JSON ESLint Docs}
 */
export default {
    'jsonc/array-bracket-spacing': ['error', 'never'],
    'jsonc/comma-dangle': ['error', 'never'],
    'jsonc/comma-style': ['error', 'last'],
    'jsonc/indent': ['error', 4],
    'jsonc/key-spacing': ['error', { beforeColon: false, afterColon: true }],
    'jsonc/object-curly-newline': ['error', { consistent: true }],
    'jsonc/object-curly-spacing': ['error', 'always'],
    'jsonc/object-property-newline': ['error', { allowMultiplePropertiesPerLine: true }],
    'jsonc/quote-props': ['error', 'always'],
    'jsonc/quotes': ['error', 'double']
};