/**
 * Caboodle Tech's opinionated rules for linting JSON with ESLint (standard JSON only).
 * Uses the official @eslint/json plugin with json/ rule prefix.
 *
 * Plugin: {@link https://www.npmjs.com/package/@eslint/json @eslint/json}
 * Rules: {@link https://github.com/eslint/json#rules}
 */
export default {
    'json/no-duplicate-keys': 'error',
    'json/no-empty-keys': 'error',
    'json/no-unnormalized-keys': 'error',
    'json/no-unsafe-values': 'error',
    'json/top-level-interop': 'warn'
};
