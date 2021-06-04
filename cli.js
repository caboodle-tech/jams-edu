// Start the JamsEDU CLI application.
const CLI = require( './bin/components/cli' );

// Attempt to pull the users command from the command line (terminal).
let cmd = process.argv.slice(2);
if ( cmd[0] ) {
    cmd = cmd[0];
} else {
    cmd = '';
}

/**
 * Create a new CLI instance and run the command. This will change the working
 * directory to the projects root in case the user ran it from bin.
 */
let cli = new CLI();
cli.runCmd( cmd, process.argv.slice(3).join( ' ' ) );