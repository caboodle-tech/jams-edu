// @jamsedu-version: 1.1.0
// @jamsedu-component: eslint-config
import HtmlParser from '@html-eslint/parser';
import HtmlPlugin from '@html-eslint/eslint-plugin';
import HtmlRules from './eslint/html-rules.js';
import JsRules from './eslint/js-rules.js';
import JsonPlugin from '@eslint/json';
import JsonRules from './eslint/json-rules.js';

export default [
    {
        // Caboodle Tech HTML settings.
        ...HtmlPlugin.configs['flat/recommended'],
        files: ['**/*.html'],
        plugins: {
            '@html-eslint': HtmlPlugin
        },
        rules: { ...HtmlRules },
        languageOptions: {
            parser: HtmlParser
        }
    },
    {
        // Caboodle Tech JavaScript settings.
        files: ['**/*.js'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module'
        },
        rules: { ...JsRules }
    },
    {
        // Caboodle Tech JSON settings (standard JSON only; official @eslint/json plugin).
        files: ['**/*.json'],
        plugins: {
            json: JsonPlugin
        },
        language: 'json/json',
        rules: { ...JsonRules }
    }
];