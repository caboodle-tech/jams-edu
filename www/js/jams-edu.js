/**
 * Polyfill forEach.
 * 
 * {@link https://developer.mozilla.org/en-US/docs/Web/API/NodeList/forEach|Code Source}
 */
if (window.NodeList && !NodeList.prototype.forEach) {
    NodeList.prototype.forEach = function (callback, thisArg) {
        thisArg = thisArg || window;
        for (var i = 0; i < this.length; i++) {
            callback.call(thisArg, this[i], i, this);
        }
    };
}

var JAMSEDU = ( function() {

    var debounceFuncs = {}
    var debounceTimer = null;

    var PATHS = {
        'absolute': '',
        'relative': ''
    };

    var attachCollapsible = function() {
        var collapsibles = document.querySelectorAll( '.collapsible' );
        collapsibles.forEach( function( collapsible ){
            collapsible.addEventListener( 'click', toggleCollapsible );
        } );
    };

    var convertImages = function() {

        var images = document.querySelectorAll( '#main-content img' );
        images.forEach( function( img ) {

            var cls = '';

            if ( img.classList.contains( 'left' ) ) {
                cls = 'left';
                img.classList.remove( 'left' );
            } else if ( img.classList.contains( 'right' ) ) {
                cls = 'right';
                img.classList.remove( 'right' );
            } else {
                cls = 'center';
                img.classList.remove( 'center' );
            }

            var fig = document.createElement( 'FIGURE' );
            fig.classList.add( cls );
            fig.innerHTML = img.outerHTML;

            if ( img.dataset.caption ) {
                var caption = convertMDLink( img.dataset.caption );
                fig.innerHTML = fig.innerHTML + '<figcaption>' + caption + '</figcaption>';
            }

            img.parentNode.replaceChild( fig, img );
        } );

    };

    var convertMDLink = function( data ) {

        var links = data.match(/\[([^\[\]]*)\]\((.*?)\)/g);

        if ( links ) {
            links.forEach( function( link ) {
                var parts = link.match(/\[([^\[\]]*)\]\((.*?)\)/);
                if ( parts.length == 3 ) {
                    console.log(link)
                    a = '<a href="' + parts[2] + '" target="_blank" rel="noreferrer noopener">' + parts[1] + '</a>';
                    data = data.replace( link, a );
                }
            } );
        }

        return data;

    };

    var convertTables = function() {

        var tables = document.querySelectorAll( 'table' );

        tables.forEach( function( tbl ) {
            var div = document.createElement( 'DIV' );
            div.style.overflowX = 'auto';
            div.innerHTML = tbl.outerHTML;
            tbl.parentNode.replaceChild( div, tbl );
        } );

    };

    var convertQuotes = function() {

        var quotes = document.querySelectorAll( 'blockquote' );

        quotes.forEach( function( quote ) {
            var url = quote.cite;
            var cite = quote.querySelector( 'cite' );
            if ( cite && url.length > 5 ) {
                var a = document.createElement('A');
                var newCite = document.createElement('CITE');
                a.innerHTML = cite.innerHTML;
                a.setAttribute( 'href', url );
                a.setAttribute( 'target', '_blank' );
                a.setAttribute( 'rel', 'noopener noreferrer' );
                newCite.appendChild( a );
                quote.replaceChild( newCite, cite );
            }
        } );
    };

    var convertVideoLinks = function() {

        var videos = document.querySelectorAll( '[data-video]' );

        videos.forEach( function( video ) {
            var type = video.dataset.video;
            if ( type ) {
                /**
                 * Make sure all video links open in new tabs and are marked properly for security.
                 * This only will effect links that end up not being processed.
                 */
                video.setAttribute( 'target', '_blank' );
                video.setAttribute( 'rel', 'noopener noreferrer' );
                type = type.trim();
                processVideo( type, video );
            }
        } );
    };

    // https://stackoverflow.com/a/52256801/3193156
    var debounce = function( func ) {
        time = 250;
        hash = 'F' + getStringHash( func.toString() );
        if ( ! debounceFuncs[ hash ] ) {
            debounceFuncs[ hash ] = [ func, event ];
            return function( event ) {
                if ( debounceTimer ) {
                    clearTimeout( debounceTimer );
                }
                debounceTimer = setTimeout( doDebounce, time );
            }   
        }
    };

    var doDebounce = function() {
        for( var prop in debounceFuncs ) {
            var parts = debounceFuncs[ prop ];
            parts[0].call( null, parts[1] );
        }
    };

    /**
     * Vanilla Javascript DOM Ready function supporting IE 8+.
     *
     * @param {function} fn A function to call when the DOM is ready.
     * @see {@link http://youmightnotneedjquery.com/>}
     * @author adamfschwartz
     * @author zackbloom
     */
    var domReady = function( fn ) {
        if (document.readyState != 'loading'){
            fn();
        } else if (document.addEventListener) {
            document.addEventListener( 'DOMContentLoaded', fn );
        } else {
            document.attachEvent( 'onreadystatechange', function(){
                if (document.readyState != 'loading'){
                    fn();
                }
            });
        }
    };

    var getAbsolutePath = function() {
        return PATHS.absolute;
    };

    // https://stackoverflow.com/a/47305680/3193156
    var getCookie = function( name ) {
        var dc, prefix, begin, end;
    
        dc = document.cookie;
        prefix = name + "=";
        begin = dc.indexOf("; " + prefix);
        end = dc.length; // default to end of the string
    
        // found, and not in first position
        if (begin !== -1) {
            // exclude the "; "
            begin += 2;
        } else {
            //see if cookie is in first position
            begin = dc.indexOf(prefix);
            // not found at all or found as a portion of another cookie name
            if (begin === -1 || begin !== 0 ) return null;
        } 
    
        // if we find a ";" somewhere after the prefix position then "end" is that position,
        // otherwise it defaults to the end of the string
        if (dc.indexOf(";", begin) !== -1) {
            end = dc.indexOf(";", begin);
        }
    
        return decodeURI(dc.substring(begin + prefix.length, end) ).replace(/\"/g, ''); 
    };

    var getRelativePath = function() {
        return PATHS.relative;
    };

    var getStringHash = function( string ) {
        var hash = 0, i = 0, len = string.length;
        while ( i < len ) {
            hash  = ((hash << 5) - hash + string.charCodeAt(i++)) << 0;
        }
        if ( hash < 0 ) {
            hash *= -1;
        }
        return hash;
    };

    var highlightAnchor = function() {

        var anchor = window.location.hash;

        if ( anchor.length > 1 ) {

            anchor = anchor.substring( 1 );
            anchor = document.getElementById( anchor );

            if ( anchor ) {

                anchor.classList.add( 'highlight' );

                setTimeout( function() {
                    var anchor = document.querySelector( '.highlight' );
                    if ( anchor ) {
                        anchor.classList.remove( 'highlight' );
                    }
                }, 3000 );
            }
        }
    };

    var initialize = function() {

        loadAssets();
        highlightAnchor();
        attachCollapsible();
        convertImages();
        convertQuotes();
        convertVideoLinks();
        convertTables();

    };

    // https://stackoverflow.com/a/4793630/3193156
    var insertAfter = function( newNode, referenceNode ) {
        referenceNode.parentNode.insertBefore( newNode, referenceNode.nextSibling );
    };

    /**
     * Load all of the CSS and JS files needed for JamsEDU's features
     * unless the user has asked for them to be disabled.
     */
    var loadAssets = function () {

        // Setup.
        var disabled = [];
        var scripts  = document.querySelectorAll( 'head script' );
        var root     = ''
        var absPath  = document.location.href.substring( 0, document.location.href.lastIndexOf( '/' ) );
        var relPath  = '';
        var darkMode = false;

        // Check for dark mode cookie.
        if ( getCookie( 'jamsedu-dark-mode' ) ) {
            darkMode = true;
        }

        /**
         * Using the absolute path to the current file and the jams-edu.js
         * file path determine the sites root path. Also pull out any
         * parameters passed into the jams-edu.js script.
         */
        var len = scripts.length;
        for ( var x = 0; x < len; x++ ) {
            if ( scripts[ x ].src ) {
                if ( scripts[ x ].src.includes( 'jams-edu.js' ) ) {
                    // Root path.
                    var s = scripts[ x ];
                    root  = s.src.substring( 0, s.src.lastIndexOf( '/' ) );
                    root  = root.substring( 0, root.lastIndexOf( '/' ) );
                    // Script parameters, if any.
                    if ( s.src.indexOf( '=' ) > 1 ) {
                        s        = s.src.substring( s.src.lastIndexOf( '=' ) + 1 );
                        s        = s.toUpperCase();
                        disabled = s.split( '+' );
                    }
                    break;
                }
            }
        }

        // Determine how many directories we are away from the root and build the relative path.
        relPath = absPath.replace( root, '' );
        count   = relPath.split( '/' ).length - 1;
        relPath = '';
        while ( count > 0 ) {
            relPath += '../';
            count--;
        }

        // Record paths so the rest of the app can use them.
        PATHS.absolute = absPath;
        PATHS.relative = relPath;

        if ( ! ( disabled.includes( 'FA' ) || disabled.includes( 'FONT' ) ) ) {

            // Load the Font Awesome script into the current page.
            var tag   = document.createElement( 'SCRIPT' );
            tag.async = true;
            tag.type  = 'text/javascript';
            tag.src   = relPath + 'js/fa-all.min.js';
            document.head.appendChild( tag );

        }

        if ( ! ( disabled.includes( 'HIGHLIGHT' ) || disabled.includes( 'CODE' ) ) ) {

            // Load the main Highlight JS stylesheet into the current page.
            tag      = document.createElement( 'LINK' );
            tag.rel  = 'stylesheet';
            tag.href = relPath + 'css/highlight.min.css';
            document.head.appendChild( tag );

            // Load the Highlight JS theme stylesheet into the current page.
            tag      = document.createElement( 'LINK' );
            tag.rel  = 'stylesheet';
            if ( darkMode ) {
                tag.href = relPath + 'css/highlight-dark.min.css';
            } else {
                tag.href = relPath + 'css/highlight-light.min.css';
            }
            document.head.appendChild( tag );

            // Load the Highlight JS script into the current page.
            tag       = document.createElement( 'SCRIPT' );
            tag.async = true;
            tag.type  = 'text/javascript';
            tag.src   = relPath + 'js/highlight.min.js';
            document.head.appendChild( tag );
            loadHighlight( 0 );

        }

        if ( ! ( disabled.includes( 'PDF' ) ) ) {

            // Load ...
            tag       = document.createElement( 'SCRIPT' );
            tag.async = true;
            tag.type  = 'text/javascript';
            tag.src   = relPath + 'js/pdf.min.js';
            document.head.appendChild( tag );

            // Load ...
            tag       = document.createElement( 'SCRIPT' );
            tag.async = true;
            tag.type  = 'text/javascript';
            tag.src   = relPath + 'js/pdf-viewer.js';

            // Load ...
            tag       = document.createElement( 'SCRIPT' );
            tag.async = true;
            tag.type  = 'text/javascript';
            tag.src   = relPath + 'js/pdf-je-viewer.js';
            document.head.appendChild( tag );
            loadPDF( 0 );

        }

        if ( ! ( disabled.includes( 'KATEX' ) || disabled.includes( 'MATH' ) ) ) {

            // Load the Katex stylesheet into the current page.
            tag      = document.createElement( 'LINK' );
            tag.rel  = 'stylesheet';
            tag.href = relPath + 'css/katex.min.css';
            document.head.appendChild( tag );

            // Load the Katex script into the current page.
            tag       = document.createElement( 'SCRIPT' );
            tag.async = true;
            tag.type  = 'text/javascript';
            tag.src   = relPath + 'js/katex.min.js';
            document.head.appendChild( tag );
            loadKatex( 0 );

        }

        if ( ! ( disabled.includes( 'MERMAID' ) || disabled.includes( 'DIAGRAM') ) ) {

            // Before we load the mermaid script add the correct class to all diagrams on the page.
            var diagrams = document.querySelectorAll( '.diagram' );
            diagrams.forEach( function( d ) {
                d.classList.add( 'mermaid' );
            } );

            // Load the Mermaid script into the current page.
            tag       = document.createElement( 'SCRIPT' );
            tag.async = true;
            tag.type  = 'text/javascript';
            tag.src   = relPath + 'js/mermaid.min.js';
            document.head.appendChild( tag );
            loadMermaid( 0 );

        }
    };

    /**
     * Calls the function to initialize Highlight JS once it loads. 
     * @param {integer} count How many times this funciton has been called by setTimeout().
     *                        Times out after 3 seconds of trying. 
     */
    var loadHighlight = function( count ) {

        if ( count > 30 ) {
            return;
        }

        if ( typeof hljs !== 'undefined' ) {

            // Initialize Highlight.js to format all code examples on the page.
            var tag  = document.createElement( 'SCRIPT' );
            tag.type = 'text/javascript';
            tag.innerHTML = 'hljs.initHighlighting();';
            document.head.appendChild( tag );

        } else {
            setTimeout( loadHighlight.bind( null, count++ ), 100 );
        }

    };

     /**
     * Calls the function to initialize Katex once it loads. 
     * @param {integer} count How many times this funciton has been called by setTimeout().
     *                        Times out after 3 seconds of trying. 
     */
      var loadKatex = function( count ) {

        if ( count > 30 ) {
            return;
        }

        if ( typeof katex !== 'undefined' ) {
            // Render all Katex math blocks.
            katexAreas = document.querySelectorAll( '.katex' );
            katexAreas.forEach( function( elem ) {
                katex.render( elem.innerHTML, elem, { throwOnError: false } );
            } );
        } else {
            setTimeout( loadKatex.bind( null, count++ ), 100 );
        }

    };

    /**
     * Calls the function to initialize Mermaid once it loads. 
     * @param {integer} count How many times this funciton has been called by setTimeout().
     *                        Times out after 3 seconds of trying. 
     */
    var loadMermaid = function( count ) {

        if ( count > 30 ) {
            return;
        }

        if ( typeof mermaid !== 'undefined' ) {

            // Initialize Mermaid to format all diagrams on the page.
            var tag  = document.createElement( 'SCRIPT' );
            tag.type = 'text/javascript';
            tag.innerHTML = 'mermaid.initialize( { startOnLoad: true } );';
            document.head.appendChild( tag );
            
        } else {
            setTimeout( loadMermaid.bind( null, count++ ), 100 );
        }

    };

    /**
     * Calls the function to initialize PDFs once it loads. 
     * @param {integer} count How many times this funciton has been called by setTimeout().
     *                        Times out after 5 seconds of trying.
     */
     var loadPDF = function( count ) {

        if ( count > 50 ) {
            return;
        }

        if ( typeof PDFMiniViewers !== 'undefined' ) {

            // Load ...AVOIDS A RACE CONDITION
            if ( typeof pdfjsViewer == 'undefined' ) {
                var tag   = document.createElement( 'SCRIPT' );
                tag.async = true;
                tag.type  = 'text/javascript';
                tag.src   = PATHS.relative + 'js/pdf-viewer.js';
                document.head.appendChild( tag );
                setTimeout( loadPDF.bind( null, count++ ), 100 );
            } else {
                // Initialize PDFJS to format all PDFs on the page.
                PDFMiniViewers.initialize();
            }

        } else {
            setTimeout( loadPDF.bind( null, count++ ), 100 );
        }

    };
    
    var processVideo = function( type, link ) {

        // Set a flag if this video is inside a paragraph tag.
        var current   = link.parentElement;
        var linkInPar = false;
        while ( current != null ) {
            if ( current.tagName == 'P' ) {
                linkInPar = true;
                break;
            }
            current = current.parentElement;
        }

        switch ( type.toUpperCase() ) {
            case 'YOUTUBE':
                // Get the video source or bail.
                var src = link.href;
                if ( src ) {
                    src = src.substring( src.lastIndexOf( '/' ) + 1 );
                    if ( src.length < 5 ) {
                        return;
                    }
                }
                // Build the iframe.
                var frame = document.createElement( 'IFRAME' );
                frame.setAttribute( 'allowFullScreen', '' );
                frame.setAttribute( 'allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture' );
                frame.setAttribute( 'frameborder', '0' );
                frame.setAttribute( 'src', 'https://www.youtube-nocookie.com/embed/' + src );
                // Make the fallback link.
                var a = document.createElement( 'A' );
                a.setAttribute( 'href', link.href );
                a.setAttribute( 'target', '_blank' );
                a.setAttribute( 'rel', 'noopener noreferrer' );
                a.innerHTML = '&#x2139;&nbsp;&nbsp;' + link.innerHTML;
                // Make the fallback link div.
                var fallback = document.createElement( 'DIV' );
                fallback.classList.add( 'video-fallback' );
                fallback.innerHTML = '&mdash;&nbsp;&nbsp;';
                fallback.appendChild( a );
                // Make the video wrapper div and add the frame to it.
                var html = document.createElement( 'DIV' );
                html.classList.add( 'video' );
                html.appendChild( frame );
                // Swap out the link and replace with the video and fallback divs.
                if ( ! linkInPar ) {
                    // Replace the current link in place.
                    link.parentElement.replaceChild( html, link );
                    insertAfter( fallback, html );
                } else {
                    /**
                     * The original link was in a paragraph, delete the link and
                     * add the video wrapper after the paragraph.
                     */
                    var current = link;
                    while ( current.tagName != 'P' ) {
                        current = current.parentElement
                    }
                    link.parentElement.removeChild( link );
                    insertAfter( html, current );
                    insertAfter( fallback, html );
                }
                break;
        }
    };

    var toggleCollapsible = function() {
        this.classList.toggle( 'open' );
    };

    domReady( initialize );

    return {
        'debounce': debounce,
        'domReady': domReady,
        'getAbsolutePath': getAbsolutePath,
        'getCookie': getCookie,
        'getRelativePath': getRelativePath
    };

} )();

var JAMSEDU_NAV = ( function() {

    var elems = {};
    var intervals = {};

    /**
     * Add event listeners to JamsEDU elements.
     */
    var attachListeners = function() {

        // Is the sidebar on this page?
        if ( elems.sidebar ) {
            // Yes, if it exists attach the listener to the mobile nav button.
            if ( elems.mobileNavButton ) {
                elems.mobileNavButton.addEventListener( 'click', toggleNav );
            }
        } else {
            // No, hide the mobile nav button if it exists.
            if ( elems.mobileNavButton ) {
                elems.mobileNavButton.style.display = 'none';
            }
        }

        // Attach listeners to any JamsEDU nav collapsible more sections.
        var mores = elems.sidebar.querySelectorAll( 'nav .je-more' );
        mores.forEach( function( more ) {
            more.addEventListener( 'click', toggleMore );
        } );

        // Attach listeners to any JamsEDU nav placeholder sections.
        var links = elems.sidebar.querySelectorAll( 'nav .je-link' );
        links.forEach( function( link ) {
            var empty = link.querySelector( 'a' );
            if ( ! empty ) {
                // Pass click over to the more button, this is a placeholder link.
                link.addEventListener( 'click', passToMore );
            }
        } );

    };

    var handleWindowResize = function() {
        var nav = elems.sidebar;
        var pageWidth = window.innerWidth;

        if ( pageWidth < 769 ) {
            if ( nav.dataset.previous ) {
                nav.style.right = nav.dataset.previous;
            }
        } else {
            var right = nav.style.right;
            nav.dataset.previous = right;
            nav.style.right = 0;
        }
    };

    var initialize = function() {

        elems.sidebar = document.getElementById('je-sidebar' );
        elems.mobileNavButton = document.getElementById('je-mobile-nav-button' );

        attachListeners();

        // Attach window resize listener.
        window.addEventListener( 'resize', JAMSEDU.debounce( handleWindowResize ), true );
    };

    var passToMore = function() {
        var more = this.nextElementSibling;
        if ( more ) {
            if ( more.classList.contains( 'more' ) ) {
                toggleMore.call( more );
            }
        }
    };

    var toggleMore = function() {
        if ( this.classList.contains( 'je-open' ) ) {
            // Close open child menu.
            this.classList.remove( 'je-open' );
            if ( this.nextElementSibling ) {
                this.nextElementSibling.classList.remove( 'je-open' );
                // Also close any remaining open child menus.
                var menus = this.nextElementSibling.querySelectorAll( '.je-open' );
                menus.forEach( function( menu ) {
                    menu.classList.remove( 'je-open' );
                } );
            }
        } else {
            // Open child menu.
            this.classList.add( 'je-open' );
            if ( this.nextElementSibling ) {
                this.nextElementSibling.classList.add( 'je-open' );
            }
        }
    };

    var toggleNav = function() {
        
        var nav = elems.sidebar;

        if ( ! nav.classList.contains( 'je-block-interaction' ) ) {

            nav.classList.add( 'je-block-interaction' );
            var width = nav.offsetWidth;

            if ( nav.classList.contains( 'je-open' ) ) {

                nav.classList.remove( 'je-open' );

                // Close the menu.
                intervals.nav = setInterval( function(){

                    var nav   = elems.sidebar;
                    var width = nav.offsetWidth;
                    var right = parseInt( nav.style.right ) - 10;

                    if ( right < -width ) {
                        nav.style.right = '-' + width + 'px';
                        nav.classList.remove( 'je-block-interaction' );
                        clearInterval( intervals.nav );
                    } else {
                        nav.style.right = right + 'px';
                    }

                }, 20 );

            } else {

                nav.classList.add( 'je-open' );
                nav.style.right = '-' + width + 'px';

                // Open the menu.
                intervals.nav = setInterval( function(){

                    var nav   = elems.sidebar;
                    var right = parseInt( nav.style.right ) + 10;

                    if ( right >= 0 ) {
                        nav.style.right = '0';
                        nav.classList.remove( 'je-block-interaction' );
                        clearInterval( intervals.nav );
                    } else {
                        nav.style.right = right + 'px';
                    }

                }, 20 );
            }
        }
    };

    JAMSEDU.domReady( initialize );

} )();