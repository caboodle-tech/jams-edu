import assert from 'node:assert/strict';
import Fs from 'fs';
import Path from 'path';
import test from 'node:test';
import { fileURLToPath } from 'url';
import { writeSearchIndexAndSitemap } from '../src/search-index-and-sitemap.js';

const dirname = Path.dirname(fileURLToPath(import.meta.url));

/**
 * @returns {string} Absolute path to a new empty temp directory under this repo's test tree.
 */
const makeTempSiteRoot = () => {
    const base = Path.join(dirname, '_tmp-search-index');
    Fs.mkdirSync(base, { recursive: true });
    return Fs.mkdtempSync(Path.join(base, 'run-'));
};

test('writeSearchIndexAndSitemap writes sitemap.json and optional sitemap.xml', async () => {
    const usersRoot = makeTempSiteRoot();
    const destDir = Path.join(usersRoot, 'www');
    Fs.mkdirSync(destDir, { recursive: true });
    const htmlPath = Path.join(destDir, 'hello.html');
    Fs.writeFileSync(
        htmlPath,
        '<!DOCTYPE html><html><head><title>Hello Page</title>' +
            '<meta name="description" content="A greeting"></head><body><h1>Hello</h1></body></html>\n',
        'utf8'
    );
    try {
        await writeSearchIndexAndSitemap({
            usersRoot,
            destDir,
            websiteUrl: 'https://example.org'
        });
        const jsonPath = Path.join(destDir, 'sitemap.json');
        assert.ok(Fs.existsSync(jsonPath));
        const payload = JSON.parse(Fs.readFileSync(jsonPath, 'utf8'));
        assert.equal(typeof payload.generatedAt, 'string');
        assert.ok(Array.isArray(payload.p));
        assert.equal(payload.p.length, 1);
        assert.equal(payload.p[0].u, '/hello.html');
        assert.equal(payload.p[0].t, 'Hello Page');
        assert.equal(payload.p[0].d, 'A greeting');
        assert.ok(Array.isArray(payload.p[0].h));
        const xmlPath = Path.join(destDir, 'sitemap.xml');
        assert.ok(Fs.existsSync(xmlPath));
        const xml = Fs.readFileSync(xmlPath, 'utf8');
        assert.ok(xml.includes('https://example.org/hello.html'));
        assert.ok(xml.includes('<lastmod>'));
        const fpPath = Path.join(usersRoot, '.jamsedu', 'search-output-fingerprints.json');
        assert.ok(Fs.existsSync(fpPath));
        const fp = JSON.parse(Fs.readFileSync(fpPath, 'utf8'));
        assert.equal(fp.version, 1);
        assert.equal(typeof fp.urls, 'object');
        assert.ok(typeof fp.urls['/hello.html'] === 'string');
    } finally {
        Fs.rmSync(usersRoot, { recursive: true, force: true });
    }
});
