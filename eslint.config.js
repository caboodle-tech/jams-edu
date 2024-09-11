import HtmlParser from '@html-eslint/parser';
import HtmlPlugin from '@html-eslint/eslint-plugin';
import HtmlRules from './src/imports/eslint/html-rules.js';
import JamsEduHtmlPlugin from './src/imports/eslint/jamsedu-plugin.js';
import JsRules from './src/imports/eslint/js-rules.js';
import JsonRules from './src/imports/eslint/json-rules.js';
import JsoncParser from 'jsonc-eslint-parser';
import JsoncPlugin from 'eslint-plugin-jsonc';
import TsParser from '@typescript-eslint/parser';
import TsPlugin from '@typescript-eslint/eslint-plugin';
import TsRules from './src/imports/eslint/ts-rules.js';

export default [
    {
        // Caboodle Tech HTML settings.
        ...HtmlPlugin.configs['flat/recommended'],
        files: ['**/*.html'],
        plugins: {
            '@html-eslint': HtmlPlugin,
            '@jamsedu': JamsEduHtmlPlugin
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
        // Caboodle Tech JSON settings.
        files: ['**/*.json'],
        languageOptions: {
            parser: JsoncParser,
            ecmaVersion: 'latest'
        },
        plugins: {
            jsonc: JsoncPlugin
        },
        rules: { ...JsonRules }
    },
    {
        // Caboodle Tech TypeScript settings.
        files: ['**/*.ts', '**/*.tsx'],
        languageOptions: {
            parser: TsParser,
            ecmaVersion: 'latest',
            sourceType: 'module'
        },
        plugins: {
            '@typescript-eslint': TsPlugin
        },
        rules: { ...TsRules }
    }
];
