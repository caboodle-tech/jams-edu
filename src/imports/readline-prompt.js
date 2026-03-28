/**
 * Single-line stdin prompts using Node readline/promises (no prompt-sync).
 * One shared interface for the process; Ctrl+C exits with code 130.
 */
import * as Readline from 'node:readline/promises';

/** @type {import('node:readline/promises').Interface | null} */
let iface = null;

/**
 * @returns {import('node:readline/promises').Interface}
 */
const getInterface = () => {
    if (!iface) {
        iface = Readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            terminal: true
        });
        iface.on('SIGINT', () => {
            iface?.pause();
            process.stdout.write('\n');
            process.exit(130);
        });
    }
    return iface;
};

/**
 * Reads one line after optional query (same idea as prompt-sync).
 * @param {string} [query]
 * @returns {Promise<string>}
 */
export const promptLine = async (query = '') => {
    const rl = getInterface();
    const line = await rl.question(query);
    return typeof line === 'string' ? line : '';
};
