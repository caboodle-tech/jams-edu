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
    var IFRAME = null;
    var PARAMS = {};
    var PATHS = {
        'absolute': '',
        'relative': '',
        'self': ''
    };

    var attachAnchor = function() {
        var main = document.getElementById('main-content');
        if ( main ) {
            var anchors = main.querySelectorAll('h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]');
            anchors.forEach( function( anchor ) {
                var link = document.createElement('A');
                link.href = PATHS.self + '#' + anchor.id;
                link.classList.add('anchor');
                link.innerHTML = '<i class="fas fa-link"></i>';
                anchor.appendChild( link );
            } );
        }
    };

    var attachCollapsible = function() {
        var collapsibles = document.querySelectorAll( '.collapsible' );
        collapsibles.forEach( function( collapsible ){
            collapsible.addEventListener( 'click', toggleCollapsible );
        } );
    };

    var attachGoBack = function() {
        var main = document.getElementById('main-content');
        if ( main ) {
            if ( main.classList.contains('go-back') ) {
                var div = document.createElement('DIV');
                div.id = 'go-back';
                div.innerHTML = '<a href="../"><i class="fas fa-chevron-left icon"></i> Go Back</a>';
                main.prepend( div );
            }
        }
    };

    var convertAudioLinks = function() {

        var map = {
            'ogg': 'ogg',
            'mp3': 'mpeg',
            'wav': 'wav'
        }

        var audioLinks = document.querySelectorAll( '[data-audio]' );

        audioLinks.forEach( function( link ) {

            // Set a flag if this audio is inside a paragraph tag; we'll need to move it.
            var current   = link.parentElement;
            var linkInPar = false;
            while ( current != null ) {
                if ( current.tagName == 'P' ) {
                    linkInPar = true;
                    break;
                }
                current = current.parentElement;
            }

            var html  = '';
            var src = link.href;
            var audio = document.createElement('AUDIO');
            audio.setAttribute( 'preload', 'metadata' );
            audio.setAttribute( 'id', uid( 14 ) );
            var type  = src.substring( src.lastIndexOf('.') + 1 ).toLowerCase();
            var alts  = link.dataset.audio.split(',');
            html += '<source src="' + src + '" type="audio/' + map[ type ] + '">';
            alts.forEach( function( alt ) {
                html += '<source src="' + src.replace( '.' + type, '.' + alt );
                html += '" type="audio/' + map[ alt ] + '">';
            } );
            audio.innerHTML = html;
            var audioDiv = document.createElement('DIV');
            audioDiv.classList.add('audio');

            link.dataset.title = link.innerHTML;

            // In case the user used Author instead of Artists.
            if ( link.dataset.author ) {
                link.dataset.artist = link.dataset.author;
            }

            generateAudioHTML( link.dataset.title, link.dataset.artist, link.dataset.transcript, audioDiv, audio );

            // Swap out the link and replace with the video and fallback divs.
            if ( ! linkInPar ) {
                // Replace the current link in place.
                link.parentElement.replaceChild( audio, link );
                insertAfter( audioDiv, audio );
            } else {
                // Original link is in a paragraph, delete the link and add the video wrapper after the paragraph.
                var current = link;
                while ( current.tagName != 'P' ) {
                    current = current.parentElement
                }
                link.parentElement.removeChild( link );
                insertAfter( audo, current );
                insertAfter( audioDiv, audio );
            }
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
            var src = video.href;
            if ( src ) {
                /**
                 * Make sure all video links open in new tabs and are marked properly for security.
                 * This only will effect links that end up not being processed.
                 */
                video.setAttribute( 'target', '_blank' );
                video.setAttribute( 'rel', 'noopener noreferrer' );
                src = src.trim();
                processVideo( src, video );
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

    var generateAudioHTML = function( title, author, transcript, div, audio ) {
        audio.onloadedmetadata = function() {
            // Attach the first audio source as the current Audio element.
            div.dataset.playing = audio.id;
            // Create times.
            var start = '0:00';
            var end   = '0:00';
            var max   = '0';
            var dur   = audio.duration;
            if ( ! isNaN( dur ) ) {
                max   = Math.floor( dur );
                end   = getSecondsToStamp( max );
                start = end.replace( /[0-9]/g, '0' );
            }
            // Variable for parts of HTML.
            var html = '';
            // Create and add the author and title.
            var metadata = document.createElement('DIV');
            metadata.classList.add( 'metadata' );
            // Display title and author if present.
            if ( title ) {
                html += '<div class="title">' + title + '</div>';
            }
            if ( author ) {
                if ( author.indexOf(':') > 0 ) {
                    var href = author.substring( author.indexOf(':') + 1 );
                    author   = author.substring( 0, author.indexOf(':') );
                    html += '<div class="artist">&nbsp;|&nbsp;<a href="' + href + '" ';
                    html += 'target="_blank">' + author + '</a></div>';
                } else {
                    html += '<div class="artist">&nbsp;|&nbsp;' + author + '</div>';
                }
            }
            metadata.innerHTML = html;
            div.appendChild( metadata );
            // Play/pause controls.
            var controlsOne = document.createElement('DIV');
            controlsOne.classList.add( 'controls-one' );
            controlsOne.innerHTML = '<div class="play"><i class="fas fa-play icon"></i></div><div class="pause"><i class="fas fa-pause icon pause"></i></div>';
            div.appendChild( controlsOne );
            // Time display.
            var timeWrapper = document.createElement('DIV');
            timeWrapper.classList.add( 'time' );
            timeWrapper.innerHTML = '<div class="current">' + start + '</div><div class="seperator">/</div><div class="total">' + end + '</div>';
            div.appendChild( timeWrapper );
            // Seeker.
            var seeker = document.createElement('DIV');
            seeker.classList.add( 'seeker' );
            seeker.innerHTML = '<input class="range" type="range" min="0" max="' + dur + '" step="1" value="0">';
            div.appendChild( seeker );
            // Build the transcript button if we have a transcript.
            html = '';
            if ( transcript ) {
                html = '<a href="' + transcript + '" target="_blank" class="transcript" download><i class="fas fa-file-alt icon"></i></a>';
            }
            // Volume and transcript controls.
            var controlsTwo = document.createElement('DIV');
            controlsTwo.classList.add( 'controls-two' );
            controlsTwo.innerHTML = '<div class="volume"><i class="fas fa-volume-up icon"></i></div><div class="mute"><i class="fas fa-volume-mute icon"></i></div>' + html + '<div class="volume-wrapper"><input class="range" type="range" min="0" max="100" step="1" value="100"></div>';
            div.appendChild( controlsTwo );

            var scrubber     = seeker.querySelector('.range');
            var volumeButton = controlsTwo.querySelector('.volume');
            var volumeMute   = controlsTwo.querySelector('.mute');
            var volume       = controlsTwo.querySelector('.volume-wrapper .range');

            audio.addEventListener( 'timeupdate', audioUpdate.bind( div, seeker, timeWrapper ) );
            audio.addEventListener( 'ended', audioEnded.bind( div, controlsOne ) );

            scrubber.addEventListener( 'change', audioScrub.bind( div, scrubber ) );
            scrubber.addEventListener( 'input', audioScrub.bind( div, scrubber ) );

            controlsOne.addEventListener( 'click', audioToggle.bind( div, controlsOne ) );
            
            volumeButton.addEventListener( 'click', audioToggleVolume.bind( div, controlsTwo ) );
            volumeMute.addEventListener( 'click', audioToggleVolume.bind( div, controlsTwo ) );
            volume.addEventListener( 'change', audioVolume.bind( div, volume, controlsTwo ) );
            volume.addEventListener( 'input', audioVolume.bind( div, volume, controlsTwo ) );
        };
    };

    var audioEnded = function( wrapper ) {
        wrapper.classList.remove('playing');
    };

    var audioScrub = function( scrubber ) {
        var audio = document.getElementById( this.dataset.playing );
        audio.currentTime = scrubber.value;
    };

    var audioVolume = function( volume, wrapper ) {
        var audio = document.getElementById( this.dataset.playing );
        var level = ( parseInt( volume.value ) * 0.01 ).toFixed(2);
        audio.volume = level;
        volume.setAttribute( 'value', ( parseFloat( level ) * 100 ).toFixed(0) );
        if ( level <= 0 ) {
            wrapper.classList.add('volume-muted');
        } else {
            wrapper.classList.remove('volume-muted');
        }
    };

    var audioUpdate = function( seeker, times ) {
        var audio = document.getElementById( this.dataset.playing );
        var current = times.querySelector('.current');
        var range   = seeker.querySelector('.range');
        var time    = Math.floor( audio.currentTime );
        var stamp   = getSecondsToStamp( time );
        range.value =  time
        range.setAttribute( 'value', time );
        current.innerHTML = stamp;
    };

    var audioToggleVolume = function( wrapper ) {
        wrapper.classList.toggle('volume-open');
    };

    var audioToggle = function( wrapper ) {
        var audio = document.getElementById( this.dataset.playing );
        if ( wrapper.classList.contains('playing') ) {
            audio.pause();
            wrapper.classList.remove('playing');
        } else {
            audio.play();
            wrapper.classList.add('playing');
        }
    };

    var getAbsolutePath = function() {
        return PATHS.absolute;
    };

    // https://stackoverflow.com/a/6313008/3193156
    var getSecondsToStamp = function( sec ) {
        var sec_num = parseInt(sec, 10);
        var hours   = Math.floor(sec_num / 3600);
        var minutes = Math.floor((sec_num - (hours * 3600)) / 60);
        var seconds = sec_num - (hours * 3600) - (minutes * 60);
        var result = '';
        if ( hours > 0 ) {
            result += hours + ':';
        }
        if ( minutes > 0 ) {
            result += minutes + ':';
        } else {
            result += '0:';
        }
        if (seconds < 10) { seconds = '0' + seconds; }
        return result + seconds;
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

    var getUrlParamaters = function( url ) {
        var results = {};
        if ( ! url ) {
            url = window.location.href;
        }
        if ( url.lastIndexOf('?') > -1 ) {
            url = url.substring( url.lastIndexOf('?') + 1 );
            if ( url.lastIndexOf('#') > -1 ) {
                url = url.substring( 0, url.lastIndexOf('#') );
            }
            var params = url.split('&');
            for ( var i = 0; i < params.length; i++ ) {
                var parts = params[i].split('=');
                if ( parts[1] ) {
                    results[ parts[0] ] = decodeURIComponent( parts[1].replace(/\+/g, ' ' ) );
                } else {
                    results[ parts[0] ] = ''
                }
            }
        }
        return results;
    };

    var highlightAnchor = function() {

        var anchor = window.location.hash;

        if ( anchor.length > 1 ) {

            anchor = anchor.substring( 1 );
            anchor = document.getElementById( anchor );

            if ( anchor ) {

                anchor.classList.add( 'highlight' );
                anchor.scrollIntoView( { behavior: "smooth", block: "center", inline: "nearest" } );

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

        IFRAME = isInFrame();
        PARAMS = getUrlParamaters();

        // Allow hiding the header and footer when the page is in an iFrame.
        if ( IFRAME ) {
            if ( PARAMS['header'] && PARAMS['header'].toLowerCase() == 'false' ) {
                var h = document.getElementById('header');
                if ( h ) {
                    h.style.display = 'none';
                }
            }
            if ( PARAMS['sidebar'] && PARAMS['sidebar'].toLowerCase() == 'false' ) {
                var s = document.getElementById('sidebar');
                if ( s ) {
                    s.style.display = 'none';
                }
            }
            if ( PARAMS['footer'] && PARAMS['footer'].toLowerCase() == 'false' ) {
                var f = document.getElementById('footer');
                if ( f ) {
                    f.style.display = 'none';
                }
            }
        }

        loadAssets();
        highlightAnchor();
        attachAnchor();
        attachCollapsible();
        attachGoBack();
        convertImages();
        convertQuotes();
        convertVideoLinks();
        convertAudioLinks();
        convertTables();

    };

    // https://stackoverflow.com/a/4793630/3193156
    var insertAfter = function( newNode, referenceNode ) {
        referenceNode.parentNode.insertBefore( newNode, referenceNode.nextSibling );
    };

    // https://stackoverflow.com/a/65381881/3193156
    var isInFrame = function() {
        var windowLen = window.frames.length;
        var parentLen = parent.frames.length;
        if (windowLen == 0 && parentLen >= 1) {
            this.isInIframe = true
            return true;
        }
        return false;
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
        var selfPath = document.location.href;
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

        // Clean self path.
        if ( window.location.hash ) {
            selfPath = selfPath.replace( window.location.hash, '' );
        }
        if ( window.location.search ) {
            selfPath = selfPath.replace( window.location.search, '' );
        }

        // Record paths so the rest of the app can use them.
        PATHS.absolute = absPath;
        PATHS.relative = relPath;
        PATHS.self     = selfPath;

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
            tag.src   = relPath + 'js/pdf-viewer.js';
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

    var processSelfhostedVideo = function( src, link ) {
        // Build the video element.
        var type  = src.substring( src.lastIndexOf('.') + 1 );
        var video = document.createElement('video');
        video.setAttribute('preload', 'metadata');
        video.setAttribute('controlsList', 'nodownload');
        video.setAttribute('controls', '');
        // Add a poster image if there is one.
        if ( link.dataset.poster ) {
            video.setAttribute( 'poster', link.dataset.poster );
        }
        // Add the original video source.
        var html = '<source src="' + src + '" type="video/' + type + '">';
        // Add any alternate video sources.
        var alts = link.dataset.video;
        if ( alts ) {
            alts = alts.toLowerCase().trim();
            alts = alts.replace( /,|\./g, '' );
            alts = alts.split(' ');
            alts.forEach( function( alt ) {
                html += '<source src="' + src.replace( '.' + type, '.' + alt ) + '" ';
                html += 'type="video/' + alt + '">';
            } );
        }
        // Add any closed captions.
        var ccs = link.dataset.captions;
        if ( ccs ) {
            var def = ' default';
            ccs = ccs.split(',');
            ccs.forEach( function( cc ) {
                var parts = cc.split(':');
                var label = parts[0].trim();
                var lang  = parts[1].substring( 0, cc.lastIndexOf('.') );
                lang = lang.substring( cc.lastIndexOf('.') );
                html += '<track label="' + label + '" ';
                html += 'kind="captions" srclang="' + lang + '" ';
                html += 'src="' + parts[1].trim() + '"' + def + '>';
                def = '';
            } );
        }
        // Add any subtitles
        var subs = link.dataset.subtitles;
        if ( subs ) {
            subs = ccs.split(',');
            subs.forEach( function( sub ) {
                var parts = sub.split(':');
                var label = parts[0].trim();
                var lang  = parts[1].substring( cc.indexOf('.'), cc.lastIndexOf('.') ).trim();
                html += '<track label="' + label + '" ';
                html += 'kind="subtitles" srclang="' + lang + '" ';
                html += 'src="' + parts[1].trim() + '">';
            } );
        }
        // Add the no support message.
        video.innerHTML = html + '\nYour browser does not support the video tag.';
        return video;
    };
    
    var processVideo = function( src, link ) {

        // Should we consider this video self-hosted?
        var selfhosted = false;
        if ( src.includes( window.location.hostname ) || link.dataset.selfHosted ) {
            selfhosted = true;
        }

        // Set a flag if this video is inside a paragraph tag; we'll need to move it.
        var current   = link.parentElement;
        var linkInPar = false;
        while ( current != null ) {
            if ( current.tagName == 'P' ) {
                linkInPar = true;
                break;
            }
            current = current.parentElement;
        }

        var frame = '';
        var fallback = document.createElement( 'DIV' );
        fallback.classList.add( 'video-fallback' );

        if ( selfhosted ) {
            frame = processSelfhostedVideo( src, link );
            // Make the fallback link div.
            fallback.innerHTML = '&mdash;&nbsp;&nbsp;&#x2139;&nbsp;&nbsp;' + link.innerHTML;
        } else {

            var provider = link.hostname.toLowerCase();
            provider = provider.split('.');
            
            if ( provider.includes('youtube') || provider.includes('youtu') ) {
                src = src.substring( src.lastIndexOf( '/' ) + 1 );
                src = 'https://www.youtube-nocookie.com/embed/' + src;
            } else if ( provider.includes('vimeo') ) {
                src = src.substring( src.lastIndexOf( '/' ) + 1 );
                src = 'https://player.vimeo.com/video/' + src;
            } else if ( provider.includes('dailymotion') || provider.includes('dai') ) {
                src = src.substring( src.lastIndexOf( '/' ) + 1 );
                src = 'https://www.dailymotion.com/embed/video/' + src;
            }

            // Build the iframe.
            frame = document.createElement( 'IFRAME' );
            frame.setAttribute( 'allowFullScreen', '' );
            frame.setAttribute( 'allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture' );
            frame.setAttribute( 'frameborder', '0' );
            frame.setAttribute( 'sandbox', 'allow-scripts allow-same-origin' );
            frame.setAttribute( 'src', src );
            // Make the fallback link.
            var a = document.createElement( 'A' );
            a.setAttribute( 'href', link.href );
            a.setAttribute( 'target', '_blank' );
            a.setAttribute( 'rel', 'noopener noreferrer' );
            a.innerHTML = '&#x2139;&nbsp;&nbsp;' + link.innerHTML;
            // Make the fallback link div.
            fallback.innerHTML = '&mdash;&nbsp;&nbsp;';
            fallback.appendChild( a );
        }

        // Make the video wrapper div and add the frame to it.
        var html = '';
        if ( selfhosted ) {
            html = frame;
        } else {
            html = document.createElement( 'DIV' );
            html.classList.add( 'video' );
            html.appendChild( frame );
        }

       
        // Swap out the link and replace with the video and fallback divs.
        if ( ! linkInPar ) {
            // Replace the current link in place.
            link.parentElement.replaceChild( html, link );
            insertAfter( fallback, html );
        } else {
            // Original link is in a paragraph, delete the link and add the video wrapper after the paragraph.
            var current = link;
            while ( current.tagName != 'P' ) {
                current = current.parentElement
            }
            link.parentElement.removeChild( link );
            insertAfter( html, current );
            insertAfter( fallback, html );
        }
    };

    var toggleCollapsible = function() {
        this.classList.toggle( 'open' );
    };

    /**
     * Generate a fairly unique ID for use as an HTML ID.
     * {@link https://gist.github.com/gordonbrander/2230317#gistcomment-1713405|Source}
     * 
     * @return {String} A 14 character unique ID.
     */
    var uid = function() {
        return ( Date.now().toString(36) + Math.random().toString(36).substr(2, 6) ).toUpperCase();
    };

    domReady( initialize );

    return {
        'debounce': debounce,
        'domReady': domReady,
        'getAbsolutePath': getAbsolutePath,
        'getCookie': getCookie,
        'getRelativePath': getRelativePath,
        'uid': uid
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
            // No need to attach listeners.
            return;
        }

        // Attach listeners to any JamsEDU nav collapsible more sections.
        var mores = elems.sidebar.querySelectorAll( 'nav .more' );
        mores.forEach( function( more ) {
            more.addEventListener( 'click', toggleMore );
        } );

        // Attach listeners to any JamsEDU nav placeholder sections.
        var links = elems.sidebar.querySelectorAll( 'nav .link' );
        links.forEach( function( link ) {
            var empty = link.querySelector( 'a' );
            if ( ! empty ) {
                // Pass click over to the more button, this is a placeholder link.
                link.addEventListener( 'click', passToMore );
            }
        } );

    };

    var handleWindowResize = function() {
        if ( elems.sidebar ) {
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
        }
    };

    var initialize = function() {

        elems.sidebar = document.getElementById('sidebar' );
        elems.mobileNavButton = document.getElementById('mobile-nav-button' );

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
        if ( this.classList.contains( 'open' ) ) {
            // Close open child menu.
            this.classList.remove( 'open' );
            if ( this.nextElementSibling ) {
                this.nextElementSibling.classList.remove( 'open' );
                // Also close any remaining open child menus.
                var menus = this.nextElementSibling.querySelectorAll( '.open' );
                menus.forEach( function( menu ) {
                    menu.classList.remove( 'open' );
                } );
            }
        } else {
            // Open child menu.
            this.classList.add( 'open' );
            if ( this.nextElementSibling ) {
                this.nextElementSibling.classList.add( 'open' );
            }
        }
    };

    var toggleNav = function() {
        
        var nav = elems.sidebar;

        if ( ! nav.classList.contains( 'block-interaction' ) ) {

            nav.classList.add( 'block-interaction' );
            var width = nav.offsetWidth;

            if ( nav.classList.contains( 'open' ) ) {

                nav.classList.remove( 'open' );

                // Close the menu.
                intervals.nav = setInterval( function(){

                    var nav   = elems.sidebar;
                    var width = nav.offsetWidth;
                    var right = parseInt( nav.style.right ) - 10;

                    if ( right < -width ) {
                        nav.style.right = '-' + width + 'px';
                        nav.classList.remove( 'block-interaction' );
                        clearInterval( intervals.nav );
                    } else {
                        nav.style.right = right + 'px';
                    }

                }, 20 );

            } else {

                nav.classList.add( 'open' );
                nav.style.right = '-' + width + 'px';

                // Open the menu.
                intervals.nav = setInterval( function(){

                    var nav   = elems.sidebar;
                    var right = parseInt( nav.style.right ) + 10;

                    if ( right >= 0 ) {
                        nav.style.right = '0';
                        nav.classList.remove( 'block-interaction' );
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