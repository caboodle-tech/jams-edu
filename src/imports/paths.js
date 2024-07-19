/**
 * Returns the absolute application paths to any file that imports this script.
 */

import Path from 'path';
import { fileURLToPath as FileURLToPath } from 'url';

export default function getRootPaths(importMetaUrl) {
    const FILENAME = FileURLToPath(importMetaUrl);
    const DIRNAME = Path.dirname(FILENAME);
    const APPDIR = Path.dirname(FileURLToPath(import.meta.url));
    return { APPDIR, DIRNAME, FILENAME };
}
