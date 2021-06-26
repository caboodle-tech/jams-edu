const cmdLine   = require('child_process');
const dayjs     = require('./day');
const fs        = require('fs');
const initSqlJs = require( './sql-wasm' );
const md5       = require( './md5' );
const path      = require('path');
const process   = require('process');
const AVLTree   = require('./avl-tree');

/**
 * CALL IN (REQUIRE) YOUR COMPILER FILES
 * ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
 */

const compilerDefault   = require( './compilers/default' );
const compilerShortdown = require( './compilers/jsd' );

/**
 * ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲
 * END CALLING IN (REQUIRE) COMPILER FILES
 */

class CLI {

    constructor() {
        this.AVLTree      = null;
        this.compilers    = {};
        this.cwd          = '';
        this.DB           = null;
        this.dirRegex     = '';
        this.forceCompile = false;
        this.globalVars   = {};
        this.ready        = false;
        this.readyCount   = 0;
        this.settings     = {};
        this.stats        = {};
        this.SQL          = null;
        this.templates    = {};
        this.versions     = { 'jamsedu': '1.9.59' };
        this.initialize();
    }

    /**
     * Reads the settings file and determines what compilers are going to be needed. If
     * a requested compiler is not found in the CLI class we divert its calls to the
     * default compiler. This is done for better security, users must explicitly add
     * additional compilers to CLI if they would like them to be available.
     */
    buildCompilers() {
        let compilers = {
            'outputs': this.settings.output,
            'types': []
        };
        let list = this.settings.compile;
        for ( const prop in list ) {
            compilers.types.push( prop );
            if ( list[ prop ].toLowerCase() == 'compilerdefault' ) {
                compilers[ prop ] = 'compilerDefault';
                continue;
            }
            if ( typeof this[ list[ prop ] ] == 'function' ) {
                compilers[ prop ] = list[ prop ];
            } else {
                compilers[ prop ] = 'compilerDefault';
            }
        }
        this.compilers = compilers;
    }

    /**
     * Check if a string contains text from an array of substrings.
     * {@link https://stackoverflow.com/a/5582715/3193156|Source Code}
     * 
     * @param {string} str A string to search for substrings.
     * @param {array} array An array of substrings to check against str.
     * @return {boolean} True if a substring was found in str, otherwise false. 
     * @memberof CLI
     */
    containsAny( str, array ) {
        if ( ! str ){ return false; }
        if ( str.length < 1 ){ return false; }
        for ( let x = 0; x != array.length; x++ ) {
           let substring = array[ x ];
           if ( str.indexOf( substring ) != -1 ) {
             return true;
           }
        }
        return false; 
    }

    /**
     * Checks if the global file has changed, if it has we should force a recompile
     * by setting the global forceCompile setting true.
     */
    checkGlobalForCompile() {
        let location = 'bin/globals';
        let stats    = fs.statSync( location );
        let hash     = md5( location );
        let mtime    = new Date( stats.mtime );
        let result   = this.getFileTrackingStatus( hash, mtime );
        if ( ! this.forceCompile && ! result ) {
            this.forceCompile = true;
        }
    }
    
    /**
     * Checks if any template files have changed, if they have we should force a
     * recompile by setting the global forceCompile setting true.
     * 
     * @param {string} base The path to the template directory or a sub-directory of it.
     */
    checkTemplatesForCompile( base ) {
        if ( ! base || base.substring( 0, 9 ) != 'templates' ) {
            base = 'templates';
        }
        // Loop through all the template files and see if one has changed.
        let items = fs.readdirSync( base );
        for ( let i in items ) {
            let location = path.join( base, items[i] );
            let stats    = fs.statSync( location );
            if ( stats.isDirectory() ) {
                this.checkTemplatesForCompile( location );
            } else {
                let hash   = md5( location );
                let mtime  = new Date( stats.mtime );
                let result = this.getFileTrackingStatus( hash, mtime );
                if ( ! this.forceCompile && ! result ) {
                    this.forceCompile = true;
                    break;
                }
            }
        }
    }

    cleanReleaseDir( tree ) {
        if ( tree.size() > 0 ) {
            let compilers = this.settings.output;
            let extMap = {};
            for ( const prop in compilers ) {
                if ( ! extMap[ compilers[prop] ] ) {
                    extMap[ compilers[prop] ] = [ prop ];
                } else {
                    extMap[ compilers[prop] ].push( prop );
                }
            }
            let files = [];

            let that = this;
            tree.forEach( function( item ) {
                let url = item.val;

                // https://stackoverflow.com/a/42505874/3193156
                that.rimraf( url );

                // Switch to WWW
                url = url.substring( that.settings.releaseDir.length );
                url = 'www' + url;
   
                let ext = path.parse( url ).ext.replace( '.', '' );

                if ( extMap[ ext ] ) {
                    extMap[ ext ].forEach( function( posExt ) {
                        files.push( url.replace( '.' + ext, '.' + posExt ) );
                    } );
                } else {
                    files.push( url );
                }

                
            } );

            files.forEach( function( file ) {
                that.DB.exec( "DELETE FROM history WHERE file = '" + md5(file) + "';" );
            } );
        }
    }

    /**
     * Try to close the database properly.
     */
    closeDatabase() {
        try {
            this.DB.close();
        } catch( err ){}
    }

    /**
     * The compiling operation. Attempts to compile the site.
     */
    compile() {

        //let recordedCount = 0;

        //let result = this.DB.exec( "SELECT modified FROM history WHERE file = '_____FILE_COUNT_____';" );

        // Make the release directory if its missing.
        try {
            if ( ! fs.existsSync( this.settings.releaseDir ) ) {
                fs.mkdirSync( this.settings.releaseDir );
            }
        } catch( err ) {
            this.errorOut( '[ERR-06] We could not create the release directory. You may have a permission problem. We will be unable to compile a release until this is resolved.' );
        }

        let compare = function( a, b ) {
            if ( typeof a != 'object' ) {
                a = { id: a };
            }
            if ( typeof b != 'object' ) {
                b = { id: b };
            }
            if ( a.id < b.id ) { return -1 };
            if ( a.id > b.id ) { return 1 };
            return 0;
        }

        let tree = new AVLTree( compare );
        this.recursiveHash( tree, this.settings.releaseDir );

        // console.log('============================');
        // tree.forEach( function( item ) {
        //     console.log( item.val );
        // } );
        //console.log('SIZE: (start)', tree.size() );
        // console.log('============================');

        //process.exit();

        // Reset stats.
        this.stats = {
            'dcopied': 0,
            'dignored': -1, // Remove the current dir (parent) from the stats.
            'fcompiled': 0,
            'fskipped': 0,
            'fcopied': 0,
            'fignored': 0,
            'time': process.hrtime()
        }
        
        this.processDirs( null, 'bin/components/required', 'bin/components/required', 'www' );

        // console.log('SIZE: (skip)', tree.size() );

        // Compile the root directory without recursion.
        //this.processDirs( '.', false );

        // Compile directories listed in the settings file.
        // this.settings.compileDirectories.forEach( dir => {
        //     this.processDirs( dir, true );
        // } );

        this.processDirs( tree, 'www', 'www', this.settings.releaseDir );

        //console.log('SIZE: (after)', tree.size() );
        this.cleanReleaseDir( tree );

        // console.log('============================');
        // tree.forEach( function( item ) {
        //     console.log( item.val );
        // } );
        // console.log('#============================');

        // process.exit();

        /**
         * Compile files listed in the settings file. These are files
         * that may have been excluded by the ignoreDir setting but
         * are still wanted.
         */
        // this.settings.keepFiles.forEach( file => {

        //     // Normalize the path to this file (if any); makes the path OS safe.
        //     file = path.normalize( file );
            
        //     // Make sure the dir path exists first or create it.
        //     let filename = path.parse( file ).name + path.parse( file ).ext
        //     let dest     = path.join( this.settings.releaseDir, file.replace( filename, '' ) );
        //     if ( ! fs.existsSync( dest ) ) {
        //         // let ext  = path.parse( dir ).ext;
        //         // let name = path.parse( dir ).name;
        //         // dir = dir.replace( name + ext, '' );
        //         fs.mkdirSync( dest, { recursive: true } );
        //         this.stats.dcopied += 1;
        //         // DO NOT ADD to the ignored count here.
        //     }

        //     let location = path.normalize( 'www' + path.sep + file );

        //     // No. Compile the file if its extension is in the compile list.
        //     let ext = path.parse( location ).ext.replace( '.', '' );
        //     if ( this.compilers.types.includes( ext ) ) {
        //         // Does this file actually need to be compiled?
        //         if ( this.needsCompile( location ) ) {
        //             let compiler = this.compilers[ ext ];
        //             this[ compiler ]( location, dest );
        //         }
        //     } else if ( this.settings.safeFileExtensions.includes( ext ) ) {
        //         // If this file is in the safe list copy it to release; no compile needed.
        //         this.copyFileToRelease( location );
        //     }

        // } );

        /**
         * The compiling may have updated database records.
         * Save any changes and close the database.
         */
        this.saveDatabase();
        this.closeDatabase();

        // Record process time.
        this.stats.time = this.getStatTimestamp( process.hrtime( this.stats.time ) );

    }

    /**
     * ADD COMPILER CALLS HERE
     * ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
     */

    compilerDefault( location, data, passBack ) {
        return compilerDefault.call( this, location, data, passBack );
    }

    compilerShortdown( location, data, passBack ) {
        return compilerShortdown.call( this, location, data, passBack );
    }

    /**
     * ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲
     * END ADDING COMPILER CALLS
     */

    /**
     * Runs the LESS or SASS compiler as part of the JamsEDU compiling process.
     * Can be triggered by adding the --styles flag to the compile command.
     */
    compileStyles() {
        if ( this.settings.preprocessor ) {
            let files = [ 'main', 'dark', 'light', 'main-light', 'main-dark' ];
            let regex = new RegExp( '(\\d+\\.\\d+\\.\\d+)', 'gm' );
            try {
                // Attempt to compile the styles, show an error message if something failed.
                if ( this.settings.preprocessor.toLowerCase() == 'sass') {
                    if ( fs.existsSync( 'sass' ) ) {
                        let ver = cmdLine.execSync( 
                            'sass --version',
                            {stdio: 'pipe' }
                        ).toString().trim();
                        if ( ver.match( regex ) ) {
                            files.forEach( function( file ) {
                                if ( fs.existsSync( path.join( 'sass', file + '.sass' ) ) ) {
                                    cmdLine.execSync( 
                                        'sass sass/' + file + '.sass www/css/' + file + '.css',
                                        { stdio: 'pipe' }
                                    ).toString().trim();
                                }
                            } );
                        }
                    } else {
                        this.errorDisplay( '[SKIPPED STYLES] The sass directory is missing.' );
                    }
                } else {
                    if ( fs.existsSync( 'less' ) ) {
                        let ver = cmdLine.execSync( 
                            'lessc --version',
                            {stdio: 'pipe' }
                        ).toString().trim();
                        if ( ver.match( regex ) ) {
                            let release = this.settings.releaseDir;
                            files.forEach( function( file ) {
                                if ( fs.existsSync( path.join( 'less', file + '.less' ) ) ) {
                                    cmdLine.execSync( 
                                        'lessc less/' + file + '.less www/css/' + file + '.css',
                                        { stdio: 'pipe' }
                                    ).toString().trim();
                                }
                            } );
                        }
                    } else {
                        this.errorDisplay( '[SKIPPED STYLES] The less directory is missing.' );
                    }
                }
            } catch( error ){
                this.errorDisplay( '[SKIPPED STYLES] We could not auto compile your style sheet(s). There was an error in one of your files:\n' );
                console.error( error.message );
            }
        } else {
            this.errorDisplay( '[SKIPPED STYLES] We could not auto compile your style sheet(s). The pre-processor is missing from the settings file.' );
        }
    };

    /**
     * Copies the specified file to the release directory.
     * 
     * @param {string} location The location of the file in question.
     */
    copyFileToRelease( location, dest ) {

        //let dest    = path.join( this.settings.releaseDir, location.substr( 3 ) );
        let hash    = md5( location );
        let mtime   = new Date( fs.statSync( location ).mtime );
        mtime       = mtime.toGMTString();
        let tracked = this.getFileTrackingStatus( hash, mtime );
        
        
        // Is this file untracked or missing in the release directory?
        if ( ! tracked || ! fs.existsSync( dest ) ) {

            this.stats.fcopied += 1;

            // Copy file to release directory.
            fs.copyFileSync(
                location,
                dest
            );

        } else {
            this.stats.fignored += 1;
        }
    }

    /**
     * Show an error to the user.
     * 
     * @param {string} err The error text to show.
     */
    errorDisplay( err ) {
        err = this.wrap( err, 80 );
        console.log( '\x1B[0;31m' + err + '\x1B[0m' );
    }

    /**
     * Show an error to the user and kill the application.
     * 
     * @param {string} err The error text to show.
     */
    errorOut( err ) {
        err = this.wrap( err, 80 );
        console.log( '\x1B[0;31m' + err + '\x1B[0m' );
        this.closeDatabase();
        process.exit();
    }

    /**
     * Check if a file or directory has been modified based on our records.
     * 
     * @param {string}  hash  A MD5 hash of the file or directory in question.
     * @param {integer} mtime The last modified time we pulled from the file.
     */
    getFileTrackingStatus( hash, mtime ) {

        // Check if this file needs compiling based on its modified time.
        let result = this.DB.exec( "SELECT modified FROM history WHERE file = '" + hash + "';" );

        // Did we get a result?
        if ( result.length > 0 ) {

            // Yes.
            let old = result[0].values[0][0];
            if ( mtime != old || this.forceCompile ){
                this.DB.exec( "UPDATE history SET modified = '" + mtime + "' WHERE file = '" + hash + "';" );
                return false;
            }

        } else {

            // No. Start tracking this file.
            this.DB.exec( "INSERT INTO history VALUES ('" + hash + "', '" + mtime + "');" );
            return false;

        }

        return true;

    }

    /**
     * Print out the stats for this compile operation.
     */
    getStatBlock() {
        
    let block = `
====================================
Files that were compiled:       ${this.stats.fcompiled}
Files skipped compiling:        ${this.stats.fskipped}
------------------------------------
New files copied to release:    ${this.stats.fcopied + this.stats.fcompiled}
Existing files in release:      ${this.stats.fignored + this.stats.fskipped}
------------------------------------
New folders created in release: ${this.stats.dcopied}
Existing folders in release:    ${this.stats.dignored}
====================================
Compile completed in: ${this.stats.time}
    `;

        return block;
    }

    /**
     * Create a human readable UTC like timestamp: YYYY-MM-DD @ HH:MM:SS
     */
    getTimestamp( d ) {

        d = d || new Date();

        return dayjs( d, this.settings.timestampFormat ).format( this.settings.timestampFormat );

        // let dy = d.getDate();
        // if ( dy < 10 ){ dy = '0' + dy; }

        // let mm = d.getMonth() + 1;
        // if ( mm < 10 ){ mm = '0' + mm; }

        // let hr = d.getHours();
        // if ( hr < 10 ){ hr = '0' + hr; }

        // let mn = d.getMinutes();
        // if ( mn < 10 ){ mn = '0' + mn; }

        // let sc = d.getSeconds();
        // if ( sc < 10 ){ sc = '0' + sc; }

        // let timestamp  = d.getFullYear() + '-' + mm + '-' + dy;
        // timestamp     += ' @ ' + hr + ':' + mn + ':' + sc;

        // return timestamp;
    }

    /**
     * Create a human readable timestamp that supports hours, minutes, seconds, and milliseconds.
     * 
     * @param {*} ary 
     */
    getStatTimestamp( ary ) {

        let sec = ary[0];
        let ns  = ary[1];
        let ms  = ( ns / 1000000 ).toFixed( 2 );
        let min = 0;
        let hr  = 0;

        if ( sec >= 60 ) {
            min = Math.round( sec / 60 );
            sec = Math.round( 60 * ( sec / 60 % 1 ).toFixed( 4 ) );
        } 
        
        if ( min >= 60 ) {
            hr  = Math.round( min / 60 );
            min = Math.round( 60 * ( min / 60 % 1 ).toFixed( 4 ) );
        }

        if ( sec > 0 ){ sec = sec + 'sec '; } else { sec = ''; }
        if ( min > 0 ){ min = min + 'min '; } else { min = ''; }
        if ( hr > 0 ){ hr = hr + 'hr '; } else { hr = ''; }
        
        return hr + min + sec + ms + 'ms';

    }

    // https://gist.github.com/iperelivskiy/4110988
    hash( str ) {
        let h = 9;
        for ( let i = 0; i < str.length; ) {
            h = Math.imul( h ^ str.charCodeAt(i++), 387420489 );
        }
        return h ^ h >>> 9;
    }

    /**
     * Start the application and make sure everything is in place or error out.
     */
    initialize() {

        let that = this;

        let cwd = process.cwd().split( path.sep );

        if ( cwd[ cwd.length - 1 ] == 'bin' ) {
            try {
                process.chdir( '../' );
                this.cwd = process.cwd();
            } catch ( err ) {
                this.errorOut( '[ERR-01] Node could not change your working directory. There may be permission issues keeping the compiler from running.' );
            }
        } else {
            // Add the following path parts to the cwd parts.
            let check = [ 'bin', 'components', 'cli.js' ];
            check = cwd.concat( check );
            // Flatten to a full absolute file path.
            check = check.join( path.sep );
            // Return cwd back to its string state.
            this.cwd = cwd.join( path.sep );
            try {
                // If the cli.js is found in the spot we expect don't error out.
                if ( ! fs.existsSync( check ) ) {
                    this.errorOut( '[ERR-03] You attempted to run the compiler from an unexpected directory, moved the compiler file, or renamed the compiler file.' );
                }
            } catch ( err ) {
                this.errorOut( '[ERR-02] Node could not check your file system. There may be permission issues keeping the compiler from running or you attempted to run it from an incorrect directory.' );
            }
        }

        try {
            this.settings = JSON.parse( fs.readFileSync( 'bin/settings.json' ) );
        } catch ( err ) {
            this.errorOut( '[ERR-04] There was an error locating or loading the settings JSON file. Make sure it exists in the bin directory and that its contents are valid JSON code.' );
        }

        // Turn on Sqlite3.
        initSqlJs().then( function( SQL ) {
            that.SQL = SQL;
            // If the database file is missing recreate it.
            let location = path.normalize( './bin/components/db.sqlite' );
            if ( ! fs.existsSync( location ) ) {
                // Create an empty file.
                fs.writeFileSync( location, '' );
                let filebuffer = fs.readFileSync( location );
                // Open the empty file and use it for our database.
                that.DB = new SQL.Database( filebuffer );
                // Create and save the database table our application needs.
                that.DB.exec( "CREATE TABLE 'history'( 'file' TEXT, 'modified' TEXT, PRIMARY KEY( 'file' ) );" );
                let data   = that.DB.export();
                let buffer = new Buffer.from( data );
                fs.writeFileSync( location, buffer );
            } else {
                // Open the existing database file.
                let filebuffer = fs.readFileSync( location );
                that.DB = new SQL.Database( filebuffer );
                // Check if we need to force compile.
                that.checkGlobalForCompile();
                if ( ! that.forceCompile ) {
                    that.checkTemplatesForCompile();
                }
            }
            that.ready = true;
        } ).catch( function( err ) {
            // TODO ADD ERROR
            console.log( err )
        } );

        let sep = path.sep;
        if ( sep == '/' ) {
            sep = '\\/';
        } else if ( sep == '\\' ) {
            sep = '\\\\';
        }
        this.dirRegex = new RegExp( '\\\.' + sep + '|\\\.\\\.' + sep, 'g' );

        this.recordVersions();
        this.buildCompilers();
        this.loadTemplates();
        this.loadGlobals();
    }

    /**
     * Checks if the application is ready to be used. Will trigger the error
     * out message if the app does not start in a timely manner. If the app
     * is ready any stacked commands will be run.
     * 
     * @param {function} cmd A command the application is trying to run.
     */
    isReady( cmd, flags ) {
        // Is the application ready?
        if ( this.ready ) {
            // Yes.
            this.readyCount = 0;
            return true;
        }
        // No. The database is not ready yet, have we waited to long?
        if ( this.readyCount > 12 ) {
            // Yes.
            this.errorOut( '[ERR-11] The application took to long to initialize. This is most likely caused by an issue with the database file. You may need to manually delete it or create it because of a permission problem with your installation.' );
        } else {
            // No. Wait for up to 3 seconds and check every 250ms.
            this.readyCount += 1;
            let that = this;
            setTimeout( function() {
                // Call the command that was originally called.
                that.runCmd( cmd, flags );
            }, 250 );
        }
    }

    /**
     * Add any global variables to the application now so we don't have
     * to keep reloading them every time a file is compiled.
     */
    loadGlobals() {

        let gls = '';

        try {
            gls = fs.readFileSync( 'bin/globals', { encoding: 'utf8' } );
            gls += '\n';
        } catch ( err ) {
            this.errorOut( '[ERR-10] There was an error loading the global variable file. It could be missing or there is a permission issue.' );
        }

        let obj = this.stripVariables( gls, 'G:' );
        this.globalVars = obj.vars;
        
    }

    /**
     * Load all the template files into memory.
     */
    loadTemplates( base ) {
        if ( ! base || base.substring( 0, 9 ) != 'templates' ) {
            base = 'templates';
        }
        let files = fs.readdirSync( base );
        files.forEach( file => {
            let stats = fs.statSync( base + path.sep + file );
            if ( stats.isDirectory() ) {
                this.loadTemplates( base + path.sep + file );
            } else {
                let name = base + path.sep + path.parse( file ).name;
                name     = name.replace( /templates(\/|\\{1,2})/, '' );
                this.templates[ name.toUpperCase() ] = fs.readFileSync(
                    base + path.sep + file,
                    {
                        encoding: 'utf8'
                    }
                );
            }
        } );
    }

    /**
     * A file needs compiling, process and record it.
     * @param {string} location The path to the file in question.
     */
    needsCompile( location, dest ) {

        // Setup key variables.
        let result = false;
        let hash   = md5( location );
        let mtime  = new Date( fs.statSync( location ).mtime );
        mtime      = mtime.toGMTString();

        // // Determine what the output file type should be.
        // let ext = path.parse( location ).ext;
        // let out = this.compilers.outputs[ ext.replace( '.', '' ) ];
        // if ( ! out ) {
        //     // Default to HTML.
        //     out = 'html';
        // }
        // out = '.' + out;
        
        // Replace the original file and extension from the path (location).
        // let name = path.parse( location ).name;
        // let dest = location.replace( name + ext, name + out );
        // dest     = path.join( this.settings.releaseDir, this.removeWWW( dest ) );

        // If this file is missing from the release directory compile it.
        if ( ! fs.existsSync( dest ) ) {
            // Insert or update this files record; there is a 50/50 chance it needs updating.
            this.DB.exec( "INSERT OR REPLACE INTO history (file, modified) VALUES ('" + hash + "', '" + mtime + "');" );
            result = true;
        } else {
            result = ! this.getFileTrackingStatus( hash, mtime );
        }

        if ( result ) {
            this.stats.fcompiled += 1;
        } else {
            this.stats.fskipped += 1;
        }

        return result;

    }

    /**
     * Recursively (if enabled) loop through a directory and process
     * all its files. If a directory does not exist create it in the
     * release directory.
     * 
     * @param {string}  dir       The directory in question.
     */
    processDirs( tree, dir, base, output ) {

        let dest = path.join( output, dir.replace( base, '' ) );
        if ( ! fs.existsSync( dest ) ) {
            this.stats.dcopied += 1;
            fs.mkdirSync( dest, { recursive: true } );
        } else {
            this.stats.dignored += 1;
        }
        
        if ( tree != null ) {
            if ( dest.indexOf('style-guide') > 0 ) {
                console.log( dest );
            }
            tree.remove( this.hash( dest ) );
        }

        let items = fs.readdirSync( dir );
        items.forEach( item => {
            let location = path.join( dir, item );
            let stats    = fs.statSync( location );
            
            // Is this a directory?
            if ( stats.isDirectory() ) {
                this.processDirs( tree, location, base, output );
            } else {
                // Does this file need to be compiled?
                //let ext = path.parse( location ).ext.replace( '.', '' );
                let output = "";
                let ext = path.parse( location ).ext.replace( '.', '' );
                
                // Account for non-extension files.
                if ( ! ext || ext.length < 1 ) {
                    ext = location.substring( location.lastIndexOf( path.sep ) + 1 );
                    ext = ext.toLowerCase().replace( /[\.\-\_\ ]/g, '' );
                }

                if ( this.compilers.types.includes( ext ) ) {
                    // Determine what the output file type should be.
                    let name = path.parse( location ).name;
                    let out  = this.compilers.outputs[ ext ];
                    if ( ! out ) {
                        // Default to HTML.
                        out = 'html';
                    }
                    out = '.' + out;
                    output = path.join( dest, name + out );
                    
                    if ( tree != null ){
                        tree.remove( this.hash( output ) );
                    }

                    if ( this.needsCompile( location, output ) ) {
                        let compiler = this.compilers[ ext ];
                        this[ compiler ]( location, output );
                    }
                } else if ( this.settings.safeFileExtensions.includes( ext ) ) {
                    // No, if this file is in the safe list copy it to release.
                    output = path.join( dest, item );
                    if ( tree != null ){
                        tree.remove( this.hash( output ) );
                    }
                    this.copyFileToRelease( location, output );
                }
            }
        } );

    }

    recursiveHash( tree, dir ) {
        let items = fs.readdirSync( dir );
        items.forEach( item => { 
            let location = path.join( dir, item );
            let stats    = fs.statSync( location );
            //console.log( location );
            tree.insert( { 'id': this.hash( location ), 'val': location } );
            if ( stats.isDirectory() ) {
                this.recursiveHash( tree, location );
            }
        } );
    }

    recordVersions() {
        // TODO: Implement.
    }

    /**
     * Remove files and directories recursively.
     * 
     * @param {string} dir_path
     * @see https://stackoverflow.com/a/42505874/3193156
     */
    rimraf( location ) {
        // Security check to prevent deleting system files.
        location = location.replace( this.dirRegex, '' );
        if ( ! location.includes( process.cwd() ) ) {
            location = path.join( process.cwd(), location );
        }
        if( fs.existsSync( location ) ) {
            if ( fs.lstatSync( location ).isDirectory() ) {
                let that = this;
                fs.readdirSync( location ).forEach( function( file ) {
                    file = path.join( location, file );
                    if ( fs.lstatSync( file ).isDirectory() ) {
                        that.rimraf( file );
                    } else {
                        fs.unlinkSync( file );
                    }
                } );
                fs.rmdirSync( location );
            } else {
                fs.unlinkSync( location );
            }
        }
    }

    /**
     * Attempt to run the users command.
     * @param {string} cmd   The command the user would like to run.
     * @param {string} flags A string of any flags passed passed with this command.
     */
    runCmd( cmd, flags ) {

        switch( cmd ) {
            case '':
            case ' ':
                let msg = 'You need to enter a command for the compiler to execute. Run the \x1B[1;33mhelp\x1B[0m command to get a list of available commands:\x1B[1;33mnode cli help\x1B[0m';
                console.log( this.wrap( msg, 80 ) );
                break;
            case 'help':
            case '-h':
            case '-help':
            case '--h':
            case '--help':
                this.showHelp();
                break;
            case 'compile':
                if ( this.isReady( 'compile', flags ) ) {
                    if ( this.containsAny( flags, [ '-style', '--style', '-styles', '--styles' ] ) ) {
                        this.compileStyles();
                    }
                    this.compile();
                    console.log( this.getStatBlock() );
                }
                break;
            case 'w':
                
                break;
        }

    }

    /**
     * Save a compiled file to the release directory.
     * 
     * @param {string} file The contents of the compiled file.
     * @param {string} dest The location in the release directory to save this file.
     */
    saveCompiledFile( file, dest ) {

        // Save the file to disk.
        try {
            fs.writeFileSync(
                path.join( dest ),
                file,
                { encoding: 'utf8' }
            );
        } catch ( err ) {
            this.errorDisplay( '[ERR-05] We could not save the following compiled file. If you are getting a lot of these errors there may be permission problems with the location your attempting to compile to:\n>>> ' + location + '\n' );
        }
    }

    /**
     * Save (write) the current database from memory to disk.
     */
    saveDatabase() {
        let location = path.normalize( './bin/components/db.sqlite' );
        let data     = this.DB.export();
        let buffer   = new Buffer.from( data );
        fs.writeFileSync( location, buffer );
    }

    /**
     * Show the help (man) page in console.
     */
    showHelp() {
        console.log( 'Help page coming soon!' );
    }

    /**
     * Pull key value pairs our of files with JamED variable assignments in them.
     * 
     * @param {string} file The contents of a file to pull variables from (if any). 
     */
    stripVariables( file, prepend ) {

        if ( ! prepend ) {
            prepend = '';
        }

        let vars = {};
        let matches = file.match( /\${{.*}}.*\n/g );

        if ( matches ) {
            matches.forEach( match => {
                let key = match.match( /\${{(.*)}}/ )[1].toUpperCase();
                let val = match.match( /= *(?:'|")(.*)(?:'|") *;/ )[1];
                vars[ prepend + key ] = val;
                file = file.replace( match, '' );
            } );
        }

        return {
            'file': file.trim(),
            'vars': vars
        };
    }

    /**
     * Break a long line of text up into multiple lines based on a supplied
     * text width; this is a line wrap function.
     * 
     * Source: @see {@link https://stackoverflow.com/a/51506718/3193156|StackOverflow}
     * @param {string}         s The string of text to wrap.
     * @param {string|integer} w The width to wrap each line of text at.
     */
    wrap( s, w ) {
        return s.replace(
            new RegExp( `(?![^\\n]{1,${w}}$)([^\\n]{1,${w}})\\s`, 'g' ),
            '$1\n'
        );
    }

}

module.exports = CLI;