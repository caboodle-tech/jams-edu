import process from 'process';

/**
 * A utility class for parsing command line arguments.
 */
export class ArgParser {

    /**
     * Parses the command-line arguments and returns an object with the parsed arguments.
     * @param {string[]} argv - The command-line arguments to parse. Defaults to `process.argv`.
     * @returns {Object} - An object containing the parsed arguments.
     */
    static parse(argv = process.argv) {
        const parsedArgs = {
            cwd: process.cwd(), // Set the current working directory
            executing: argv[1], // Set the executing file path
            execPath: argv[0] // Set the executable path
        };

        // Remove executing file path and executable path from the arguments
        argv.splice(0, 2);

        for (let i = 0; i < argv.length; i++) {
            let arg = argv[i];
            let key;
            let value = true;

            // Check if the argument contains '='
            if (arg.includes('=')) {
                // Split the argument into key and value
                [arg, value] = arg.split('=');
            }

            // Check if the argument starts with '--' or '-' (flag)
            if (arg.startsWith('--') || arg.startsWith('-')) {
                // Remove the leading '--' or '-' from the argument
                key = arg.startsWith('--') ? arg.slice(2) : arg.slice(1);

                // Set the value to the next argument if it's not a flag
                if (value === true && i + 1 < argv.length && !argv[i + 1].startsWith('-')) {
                    value = argv[i + 1];
                    // Skip the next argument
                    i += 1;
                }
            } else {
                // Set the key to the argument itself
                key = arg;
            }
            parsedArgs[key] = value;
        }

        return parsedArgs;
    }

};

/**
 * Get the file extension from a file path.
 *
 * @param {string} file The file path.
 * @returns {string} The file extension or an empty string if there is no extension.
 */
export const Ext = (file) => {
    const dotIndex = file.lastIndexOf('.');
    if (dotIndex === -1) {
        return '';
    }
    return file.slice(dotIndex + 1);
};

/**
 * The fastest way to get the actual type of anything in JavaScript.
 *
 * {@link https://jsbench.me/ruks9jljcu/2 | See benchmarks}.
 *
 * @param {*} unknown Anything you wish to check the type of.
 * @returns {string|undefined} The type in lowercase of the unknown value passed in or undefined.
 */
export const WhatIs = (unknown) => {
    try {
        return {}.toString.call(unknown).match(/\s([^\]]+)/)[1].toLowerCase();
    } catch (e) { return undefined; }
};
