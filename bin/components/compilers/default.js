// compilerDefault
const fs   = require( 'fs' );
const path = require( 'path' );

module.exports = function( location, dest, data, passBack ) {

    // Determine if we need to load the file or if we were sent the data already.
    let file = '';

    if ( data != undefined ) {
        if ( data.length > 2 ) {
            file = data;
        }
    }

    if ( file.length < 2 ) {
        file = fs.readFileSync( location, { encoding: 'utf8' } );
    }

    // Get the file contents and pull any variables from it.
    let obj  = this.stripVariables( file );
    let vars = obj.vars;
    file     = obj.file;

    // Add the compile time to the variables object.
    vars[ 'TIMESTAMP' ] = this.getTimestamp();

    // Add any page variables to the global variables object; this places globals first.
    vars = Object.assign( this.globalVars, vars );

    // Build the correct relative path and add that to the variables object.
    let count = location.replace( '.' + path.sep, '' ).split( path.sep ).length;
    if ( count > 0 ) {
        count--;
    }
    let rel = '';
    while ( count > 0 ) {
        rel += '../';
        count--;
    }
    vars[ 'PATH' ] = rel;

    // Templates may need page variables, replace variables in the templates first.
    let parts = this.templates;
    for( const tempProp in parts ) {
        let temp = parts[ tempProp ];
        for( const varProp in vars ) {
            let regex = new RegExp( '\\${{' + varProp + '}}', 'gi' );
            temp = temp.replace( regex, vars[ varProp ] );
            file = file.replace( regex, temp );
        }
        // Replace the template variables in the file with their actual values.
        let regex = new RegExp( '{{T\\:' + tempProp + '}}', 'gi' );
        file = file.replace( regex, temp );
    }

    // Do another check for template variables because templates can include templates.
    parts = this.templates;
    for( const tempProp in parts ) {
        let temp = parts[ tempProp ];
        let regex = new RegExp( '{{T\\:' + tempProp + '}}', 'gi' );
        file = file.replace( regex, temp );
    }

    // Replace all variables with their actual values in the file.
    for( const varProp in vars ) {
        let regex = new RegExp( '{{' + varProp + '}}', 'gi' );
        file = file.replace( regex, vars[ varProp ] );
    }

    /**
     * If a custom compiler called our built in one they may need
     * the result back instead of us immediately saving it.
     */
    if ( passBack ) {
        return file;
    } else {

        // Determine what the output file type should be.
        let ext  = path.parse( location ).ext;
        let name = path.parse( location ).name;
        let out  = this.compilers.outputs[ ext.replace( '.', '' ) ];
        if ( ! out ) {
            // Default to HTML.
            out = 'html';
        }
        out = '.' + out;

        // Build the path to the destination.
        dest = path.join( dest, name + out );

        this.saveCompiledFile( file, dest );
    }

}