import assert from 'node:assert/strict';
import Fs from 'node:fs';
import Os from 'node:os';
import Path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import Initializer from '../src/initializer.js';

const repoRoot = Path.join(Path.dirname(fileURLToPath(import.meta.url)), '..');
const repoTemplateGitignore = Path.join(repoRoot, 'src', 'template', '.gitignore');

test('mergeTemplateGitignoreIntoExisting prepends template patterns and dedupes', () => {
    const template = '/.jamsedu/backups/\n/.quarto/\nnode_modules/\n';
    const existing = '# my section\n/dist/\nnode_modules/\n';
    const merged = Initializer.mergeTemplateGitignoreIntoExisting(existing, template);

    assert.ok(merged.includes('/.jamsedu/backups/'));
    assert.ok(merged.includes('/.quarto/'));
    assert.ok(merged.includes('# my section'));
    assert.ok(merged.includes('/dist/'));
    const nodeLines = merged.split('\n').filter((line) => {
        return line.trim() === 'node_modules/';
    });
    assert.equal(nodeLines.length, 1);
    assert.ok(merged.endsWith('\n'));
    const firstPattern = merged.split('\n').find((line) => {
        return line.trim() !== '' && !line.trim().startsWith('#');
    });
    assert.equal(firstPattern, '/.jamsedu/backups/');
});

test('mergeTemplateGitignoreIntoExisting handles empty existing', () => {
    const template = Fs.readFileSync(repoTemplateGitignore, 'utf-8');
    const merged = Initializer.mergeTemplateGitignoreIntoExisting('', template);
    assert.ok(merged.includes('node_modules/'));
    assert.ok(merged.endsWith('\n'));
});

test('ensureGitignore merges packaged template and appends destDir without dropping user lines', () => {
    const tmp = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'jamsedu-gitignore-'));
    try {
        const gi = Path.join(tmp, '.gitignore');
        Fs.writeFileSync(gi, '# keep me\n/custom-ignored/\n', 'utf-8');
        Initializer.ensureGitignore(tmp, 'out', repoTemplateGitignore);
        const body = Fs.readFileSync(gi, 'utf-8');

        assert.ok(body.includes('# keep me'));
        assert.ok(body.includes('/custom-ignored/'));
        assert.ok(body.includes('/.jamsedu/backups/'));
        assert.ok(body.includes('/.quarto/'));
        assert.ok(body.includes('node_modules/'));
        assert.ok(body.includes('out/'));
        const outLines = body.split('\n').filter((line) => {
            return line.trim() === 'out/' || line.trim() === 'out';
        });
        assert.equal(outLines.length, 1);
    } finally {
        Fs.rmSync(tmp, { recursive: true, force: true });
    }
});

test('ensureGitignore does not duplicate destDir when already present', () => {
    const tmp = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'jamsedu-gitignore-'));
    try {
        const gi = Path.join(tmp, '.gitignore');
        Fs.writeFileSync(gi, 'out/\n', 'utf-8');
        Initializer.ensureGitignore(tmp, 'out', repoTemplateGitignore);
        const body = Fs.readFileSync(gi, 'utf-8');
        const outSlashLines = body.split('\n').filter((line) => {
            return line.trim() === 'out/';
        });
        assert.equal(outSlashLines.length, 1);
    } finally {
        Fs.rmSync(tmp, { recursive: true, force: true });
    }
});
