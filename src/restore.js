/**
 * Utility to detect and terminate processes occupying specified ports.
 * Useful for freeing ports blocked by orphaned or unresponsive server processes.
 */
import { exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';
import Print from './imports/print.js';
import PromptUser from 'prompt-sync';

const execAsync = promisify(exec);
const Prompt = PromptUser({ sigint: true });

class PortKiller {

    constructor() {
        this.platform = os.platform();
        this.commands = this.getOSCommands();
    }

    getOSCommands() {
        const commands = {
            win32: {
                check: (port) => { return `netstat -ano | findstr :${port}`; },
                getPid: (output) => {
                    const lines = output.split('\n');
                    for (const line of lines) {
                        const parts = line.trim().split(/\s+/);
                        if (parts.length > 4) {
                            return parts[parts.length - 1];
                        }
                    }
                    return null;
                },
                kill: (pid) => { return `taskkill /F /PID ${pid}`; },
                processInfo: (pid) => { return `tasklist /FI "PID eq ${pid}" /FO LIST`; }
            },
            darwin: {
                check: (port) => { return `lsof -i :${port} -sTCP:LISTEN -t`; },
                getPid: (output) => { return output.trim(); },
                kill: (pid) => { return `kill -9 ${pid}`; },
                processInfo: (pid) => { return `ps -p ${pid} -o comm=`; }
            },
            linux: {
                check: (port) => { return `ss -lptn 'sport = :${port}'`; },
                getPid: (output) => {
                    const match = output.match(/pid=(\d+)/);
                    return match ? match[1] : null;
                },
                kill: (pid) => { return `kill -9 ${pid}`; },
                processInfo: (pid) => { return `ps -p ${pid} -o comm=`; }
            }
        };

        // Fallback to common POSIX commands if OS not specifically supported
        const defaultCommands = commands.linux;

        return commands[this.platform] || defaultCommands;
    }

    async findProcess(port) {
        try {
            const { stdout } = await execAsync(this.commands.check(port));
            if (!stdout) return null;

            const pid = this.commands.getPid(stdout);
            if (!pid) return null;

            return { pid, port };
        } catch (error) {
            // Process not found is an expected case
            return null;
        }
    }

    async getProcessInfo(pid) {
        try {
            const { stdout } = await execAsync(this.commands.processInfo(pid));
            return stdout.trim();
        } catch (error) {
            return 'Unknown Process';
        }
    }

    async killProcess(pid) {
        try {
            await execAsync(this.commands.kill(pid));
            return true;
        } catch (error) {
            Print.error(`Failed to kill process ${pid}: ${error.message}`);
            return false;
        }
    }

    static async restore(ports) {
        if (!ports || ports.length === 0) {
            Print.error('No ports provided');
            return;
        }

        const killer = new PortKiller();

        for (const port of ports) {
            Print.out(`\nChecking port ${port}...`);

            const process = await killer.findProcess(port);

            if (!process) {
                Print.info(`No process found using port ${port}`);
                continue;
            }

            const processName = await killer.getProcessInfo(process.pid);
            Print.out(`Found process ${processName} (PID: ${process.pid}) using port ${port}`);

            const answer = Prompt('Do you want to kill this process? (y/N): ');

            if (answer.toLowerCase() === 'y') {
                const success = await killer.killProcess(process.pid);
                if (success) {
                    Print.success(`Successfully killed process on port ${port}`);
                } else {
                    Print.error(`Failed to kill process on port ${port}`);
                }
            }
        }
    }

}

export default PortKiller;