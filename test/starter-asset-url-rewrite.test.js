import assert from 'node:assert/strict';
import Fs from 'node:fs';
import Os from 'node:os';
import Path from 'node:path';
import test from 'node:test';

import {
    normalizeGroupedAssetsDir,
    rewriteStarterAssetReferencesInContent,
    syncStarterAssetUrlPrefixes
} from '../src/imports/starter-asset-url-rewrite.js';

test('normalizeGroupedAssetsDir returns empty for falsy or invalid', () => {
    assert.equal(normalizeGroupedAssetsDir(''), '');
    assert.equal(normalizeGroupedAssetsDir('   '), '');
    assert.equal(normalizeGroupedAssetsDir('../x'), '');
    assert.equal(normalizeGroupedAssetsDir('.'), '');
});

test('normalizeGroupedAssetsDir keeps first segment', () => {
    assert.equal(normalizeGroupedAssetsDir('static'), 'static');
    assert.equal(normalizeGroupedAssetsDir('/assets/'), 'assets');
    assert.equal(normalizeGroupedAssetsDir('vendor\\extra'), 'vendor');
});

test('rewriteStarterAssetReferencesInContent maps buckets for custom grouped dir', () => {
    const raw = `
<link href="/assets/css/main.css">
<script type="module" src="/assets/js/main.js"></script>
<img src="/assets/images/logo.svg">
<p>/assets/docs/readme.pdf</p>
`;
    const out = rewriteStarterAssetReferencesInContent(raw, 'static');
    assert.ok(out.includes('href="/static/css/main.css"'));
    assert.ok(out.includes('src="/static/js/main.js"'));
    assert.ok(out.includes('src="/static/images/logo.svg"'));
    assert.ok(out.includes('/assets/docs/readme.pdf'));
});

test('rewriteStarterAssetReferencesInContent is identity for default assets folder', () => {
    const raw = '<link href="/assets/css/main.css">';
    assert.equal(rewriteStarterAssetReferencesInContent(raw, 'assets'), raw);
});

test('rewriteStarterAssetReferencesInContent flattens for no-assets layout', () => {
    const raw = '<link href="/assets/css/main.css">';
    const out = rewriteStarterAssetReferencesInContent(raw, 'no-assets');
    assert.ok(out.includes('href="/css/main.css"'));
});

test('syncStarterAssetUrlPrefixes rewrites files on disk', () => {
    const tmp = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'jamsedu-starter-url-'));
    try {
        const srcDirRel = 'www/src';
        const srcRoot = Path.join(tmp, 'www', 'src');
        const templatesDir = Path.join(srcRoot, 'templates');
        Fs.mkdirSync(templatesDir, { recursive: true });
        Fs.writeFileSync(
            Path.join(templatesDir, 'head.html'),
            '<link href="/assets/css/main.css">\n',
            'utf-8'
        );

        syncStarterAssetUrlPrefixes(tmp, srcDirRel, 'static', { silent: true });

        const written = Fs.readFileSync(Path.join(templatesDir, 'head.html'), 'utf-8');
        assert.ok(written.includes('href="/static/css/main.css"'));
    } finally {
        Fs.rmSync(tmp, { recursive: true, force: true });
    }
});
