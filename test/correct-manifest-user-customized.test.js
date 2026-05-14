import assert from 'node:assert/strict';
import Crypto from 'node:crypto';
import Fs from 'node:fs';
import Os from 'node:os';
import Path from 'node:path';
import test from 'node:test';
import Updater from '../src/updater.js';
import { normalizeContentForHash } from '../src/imports/strip-jamsedu-comments.js';

const hashText = (s) => {
    return Crypto.createHash('sha256').update(normalizeContentForHash(s)).digest('hex');
};

test('correctManifest keeps userCustomized false when disk matches manifest hash but template content changed', () => {
    const cwd = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'jams-um-'));
    const rel = 'src/widget.js';
    const userContent = '// @jamsedu-version: 7.0.0\n// @jamsedu-component: widget-a\nalpha\n';
    Fs.mkdirSync(Path.join(cwd, 'src'), { recursive: true });
    Fs.writeFileSync(Path.join(cwd, rel), userContent, 'utf8');
    const diskHash = hashText(userContent);
    const manifest = {
        components: {
            'widget-a': {
                file: rel,
                hash: diskHash,
                version: '7.0.0',
                userCustomized: false,
                modified: false
            }
        }
    };
    const templateContent = '// @jamsedu-version: 7.1.0\n// @jamsedu-component: widget-a\nbeta\n';
    const templateFiles = [{
        component: 'widget-a',
        userPath: rel,
        content: templateContent,
        version: '7.1.0',
        templatePath: 'src/widget.js'
    }];
    Updater.correctManifest(manifest, templateFiles, cwd, 'src', {});
    assert.equal(manifest.components['widget-a'].userCustomized, false);
});

test('correctManifest sets userCustomized true when disk differs from stored manifest hash', () => {
    const cwd = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'jams-um-'));
    const rel = 'src/widget.js';
    const original = '// @jamsedu-version: 7.0.0\n// @jamsedu-component: widget-b\nalpha\n';
    const edited = '// @jamsedu-version: 7.0.0\n// @jamsedu-component: widget-b\ngamma\n';
    Fs.mkdirSync(Path.join(cwd, 'src'), { recursive: true });
    Fs.writeFileSync(Path.join(cwd, rel), edited, 'utf8');
    const staleHash = hashText(original);
    const manifest = {
        components: {
            'widget-b': {
                file: rel,
                hash: staleHash,
                version: '7.0.0',
                userCustomized: false,
                modified: false
            }
        }
    };
    const templateFiles = [{
        component: 'widget-b',
        userPath: rel,
        content: original,
        version: '7.0.0',
        templatePath: 'src/widget.js'
    }];
    Updater.correctManifest(manifest, templateFiles, cwd, 'src', {});
    assert.equal(manifest.components['widget-b'].userCustomized, true);
});
