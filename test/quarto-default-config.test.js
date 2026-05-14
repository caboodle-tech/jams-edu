import assert from 'node:assert/strict';
import test from 'node:test';
import {
    configIsMissingExplicitQuartoKeys,
    joinConfigRelPosixPath
} from '../src/imports/quarto-default-config.js';

test('joinConfigRelPosixPath joins with forward slashes and trims edges', () => {
    assert.equal(joinConfigRelPosixPath('www/private/templates', 'quarto.jhp'), 'www/private/templates/quarto.jhp');
    assert.equal(joinConfigRelPosixPath('www\\private\\templates\\', '\\quarto.jhp'), 'www/private/templates/quarto.jhp');
    assert.equal(joinConfigRelPosixPath('', 'only-leaf'), 'only-leaf');
    assert.equal(joinConfigRelPosixPath('only-base', ''), 'only-base');
});

test('configIsMissingExplicitQuartoKeys when quarto missing or template empty', () => {
    assert.equal(configIsMissingExplicitQuartoKeys({}), true);
    assert.equal(configIsMissingExplicitQuartoKeys({ quarto: null }), true);
    assert.equal(configIsMissingExplicitQuartoKeys({ quarto: {} }), true);
    assert.equal(configIsMissingExplicitQuartoKeys({ quarto: { template: '   ' } }), true);
    assert.equal(configIsMissingExplicitQuartoKeys({ quarto: { template: 'x.jhp' } }), false);
});
