/* eslint-disable max-len */

/**
 * Caboodle Tech's opinionated rules for linting TypeScript with ESLint. Feel free to adapt or
 * modify these rules to suit your needs.
 *
 * NOTE: Caboodle Tech's JavaScript rules are also used for TypeScript files so you may want to
 * review those rules as well.
 *
 * TypeScript ESLint Plugin: {@link https://www.npmjs.com/package/@typescript-eslint/eslint-plugin @typescript-eslint/eslint-plugin}
 * TypeScript ESLint Parser: {@link https://www.npmjs.com/package/@typescript-eslint/parser @typescript-eslint/parser}
 * TypeScript ESLint Rules: {@link https://typescript-eslint.io/rules/ TypeScript ESLint Docs}
 */

import JsRules from './js-rules.js';

export default {
    '@typescript-eslint/explicit-function-return-type': 'error',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-inferrable-types': 'warn',
    '@typescript-eslint/explicit-module-boundary-types': 'warn',
    '@typescript-eslint/no-non-null-assertion': 'warn',
    '@typescript-eslint/no-var-requires': 'error',
    '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
    '@typescript-eslint/no-empty-interface': 'error',
    '@typescript-eslint/consistent-type-assertions': 'error',
    ...JsRules
};
