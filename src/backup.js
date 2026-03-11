/**
 * Full-site backup by archiving the project with system tar (no extra dependencies).
 * Excludes only node_modules, .jamsedu/backups, and .git. Includes .gitignore,
 * .vscode, .jamsedu (config/manifest), and other dotfiles/dotdirs. Archive root
 * is project root (no leading "." directory).
 */

import Fs from 'fs';
import Path from 'path';
import { spawnSync } from 'child_process';
import Print from './imports/print.js';

const BACKUPS_DIR = '.jamsedu/backups';

/** Top-level names to exclude from the backup (only these). */
const EXCLUDE_NAMES = new Set(['node_modules', '.git']);

/**
 * Create a full site backup (tar.gz) of the project. Uses system tar. Excludes
 * only node_modules, .jamsedu/backups, and .git. Includes .gitignore, .vscode,
 * .jamsedu, and other dotfiles. Puts project contents at archive root.
 *
 * @param {string} cwd - Project root to archive.
 * @returns {string} Path to the created backup file (relative to cwd).
 */
export const fullSiteBackup = (cwd) => {
    const backupsDir = Path.join(cwd, BACKUPS_DIR);
    if (!Fs.existsSync(Path.join(cwd, '.jamsedu'))) {
        Fs.mkdirSync(Path.join(cwd, '.jamsedu'), { recursive: true });
    }
    if (!Fs.existsSync(backupsDir)) {
        Fs.mkdirSync(backupsDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const archiveName = `site-backup-${timestamp}.tar.gz`;
    const archivePath = Path.join(backupsDir, archiveName);

    const entries = Fs.readdirSync(cwd, { withFileTypes: false });
    const rootNames = entries.filter((name) => !EXCLUDE_NAMES.has(name));

    if (rootNames.length === 0) {
        throw new Error('Nothing to back up (project root is empty or only excluded paths).');
    }

    const excludeArgs = ['.jamsedu/backups'].flatMap((p) => ['--exclude', p]);
    const args = ['-czf', archivePath, '-C', cwd, ...excludeArgs, ...rootNames];

    const result = spawnSync('tar', args, {
        stdio: 'pipe',
        maxBuffer: 50 * 1024 * 1024
    });

    if (result.status !== 0) {
        const msg = result.stderr?.toString() || result.error?.message || 'tar failed';
        Print.error('Full site backup failed. Is "tar" available on your PATH?');
        Print.error(msg);
        throw new Error(msg);
    }

    return Path.relative(cwd, archivePath).replace(/\\/g, '/');
};

export default { fullSiteBackup };
