import assert from 'node:assert/strict';
import test from 'node:test';
import { maskAsciiDollarInQuartoContextJson } from '../src/imports/quarto-context-dollar-mask.js';

test('masks every ASCII dollar for JHP-safe JSON embedding', () => {
    assert.equal(maskAsciiDollarInQuartoContextJson(''), '');
    assert.equal(maskAsciiDollarInQuartoContextJson('no dollars'), 'no dollars');
    assert.equal(maskAsciiDollarInQuartoContextJson('a$b'), 'a&#36;b');
    assert.equal(maskAsciiDollarInQuartoContextJson('$$'), '&#36;&#36;');
});

test('stringifies nullish input as empty before masking', () => {
    assert.equal(maskAsciiDollarInQuartoContextJson(null), '');
    assert.equal(maskAsciiDollarInQuartoContextJson(undefined), '');
});

test('preserves non-dollar characters in stringified Quarto context shape', () => {
    const json = JSON.stringify({ quartoHtml: '<p>$ echo not a directive</p>', title: 'T' });
    const masked = maskAsciiDollarInQuartoContextJson(json);
    assert.ok(!masked.includes('$echo'));
    assert.ok(masked.includes('&#36;'));
});
