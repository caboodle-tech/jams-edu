import assert from 'node:assert/strict';
import Fs from 'node:fs';
import Os from 'node:os';
import Path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { siteAppearsToHaveFavicon } from '../src/imports/favicon-path-probe.js';
import { sha256FileBuffer } from '../src/imports/template-binary-assets.js';

const repoRoot = Path.resolve(Path.dirname(fileURLToPath(import.meta.url)), '..');

test('template head references existing files under src/template/src/images/favicon', () => {
    const headPath = Path.join(repoRoot, 'src/template/src/templates/head.html');
    const html = Fs.readFileSync(headPath, 'utf8');
    const basenames = [...html.matchAll(/\/assets\/images\/favicon\/([^"]+)/gu)].map((m) => {
        return m[1];
    });
    assert.ok(basenames.length >= 1);
    for (const base of basenames) {
        const onDisk = Path.join(repoRoot, 'src/template/src/images/favicon', base);
        assert.ok(Fs.existsSync(onDisk), `expected file at ${onDisk}`);
    }
});

test('siteAppearsToHaveFavicon is false when no common favicon files exist', () => {
    const dir = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'jams-fav-'));
    assert.equal(siteAppearsToHaveFavicon(dir, { srcDir: 'src' }), false);
});

test('siteAppearsToHaveFavicon is true when favicon.ico exists at project root', () => {
    const dir = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'jams-fav-'));
    Fs.writeFileSync(Path.join(dir, 'favicon.ico'), Buffer.from([0x00, 0x01]));
    assert.equal(siteAppearsToHaveFavicon(dir, { srcDir: 'src' }), true);
});

test('siteAppearsToHaveFavicon finds assets/images/favicon when srcDir is absolute (CLI style)', () => {
    const absSrc = Path.join(repoRoot, 'www', 'private');
    const favDir = Path.join(absSrc, 'assets', 'images', 'favicon');
    if (!Fs.existsSync(favDir)) {
        return;
    }
    assert.equal(
        siteAppearsToHaveFavicon(repoRoot, {
            srcDir: absSrc,
            assetsDir: 'assets',
            destDir: Path.join(repoRoot, 'www', 'public')
        }),
        true
    );
});

test('sha256FileBuffer returns stable hex for a template favicon file', () => {
    const png = Path.join(repoRoot, 'src/template/src/images/favicon/favicon.png');
    if (!Fs.existsSync(png)) {
        return;
    }
    const a = sha256FileBuffer(png);
    const b = sha256FileBuffer(png);
    assert.match(a, /^[a-f0-9]{64}$/u);
    assert.equal(a, b);
});
