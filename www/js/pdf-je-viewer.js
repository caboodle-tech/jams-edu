var PDFMiniViewers = ( function() {

    var DebounceTimer = null;
    var PDFViewers = {};
    var RELPATH = '';
    
    /**
     * Attach listeners to all the controls for a specific widget.
     *
     * @param {Element} pdfWidget The PDF widget to hook up.
     */
    var attachPdfListeners = function( pdfWidget ) {
        var elem = pdfWidget.querySelector('.pdf-toolbar .pdf-page-area .pdf-page-up');
        if ( elem ) {
            elem.addEventListener( 'click', changePage );
        }
        elem = pdfWidget.querySelector('.pdf-toolbar .pdf-page-area .pdf-page-down');
        if ( elem ) {
            elem.addEventListener( 'click', changePage );
        }
        elem = pdfWidget.querySelector('.pdf-toolbar .pdf-page-area .pdf-page');
        if ( elem ) {
            elem.addEventListener( 'keydown', goToPage );
        }
        elem = pdfWidget.querySelector('.pdf-toolbar .pdf-download');
        if ( elem ) {
            elem.addEventListener( 'click', download );
        }
        elem = pdfWidget.querySelector('.pdf-toolbar .pdf-print');
        if ( elem ) {
            elem.addEventListener( 'click', print );
        }
        elem = pdfWidget.querySelector('.pdf-toolbar .pdf-bookmark');
        if ( elem ) {
            elem.addEventListener( 'click', toggleBookmarks );
        }
        elem = pdfWidget.querySelector('.pdf-controls .pdf-fit');
        if ( elem ) {
            elem.addEventListener( 'click', fitToggle );
        }
        elem = pdfWidget.querySelector('.pdf-controls .pdf-zoom-in');
        if ( elem ) {
            elem.addEventListener( 'click', zoomIn );
        }
        var elem = pdfWidget.querySelector('.pdf-controls .pdf-zoom-out');
        if ( elem ) {
            elem.addEventListener( 'click', zoomOut );
        }
    };

    /**
     * Respond to the page up and down buttons, changing the page up or down by 1.
     */
    var changePage = function () {
        // Do nothing if this button is disabled.
        if ( ! this.classList.contains('pdf-disabled') ) {
            var widget = this.closest('.pdf-widget');
            var pdfObj = PDFViewers[ widget.dataset.id ];
            var current = parseInt( widget.querySelector('.pdf-page-area .pdf-page').value );
            if ( this.classList.contains('pdf-page-up') ) {
                // Go back (up) a page.
                current--;
                if ( current > 0 ) {
                    pdfObj.linkService.goToPage( current );
                }
            } else {
                // Go forward (down) a page.
                current++;
                if ( current <= pdfObj.pageTotal ) {
                    pdfObj.linkService.goToPage( current );
                }
            }
        }
    };

    /**
     * Transform PDF div's into proper widgets with PDFJS.
     *
     * @param {Element} elem The element to transform into the widget.
     * @param {String} password The password to unlock this PDF; default is null.
     */
    var convertPdfs = function( elem, password ) {
        // Make sure we actually have a PDF to work with.
        if ( elem.dataset.pdf.length > 4 ) {
            
            var id = elem.dataset.id;
            var protected = getProtectionStatus( elem.dataset.protect );
            
            // Has this PDF already been turned into a widget?
            if ( ! id ) {
                // No, create a unique ID for this new widget.
                id = uid();
                
                // Convert original PDF element into our PDF widget.
                elem.classList.add('pdf-widget');
                elem.dataset.id = id;
                var toolbar = getToolbar( protected );
                var controls = getControls();
                var container = getContainers( id );
                elem.appendChild( toolbar );
                elem.appendChild( container );
                elem.appendChild( controls );
                attachPdfListeners( elem );
                
                // Create a new PDF object for this PDF.
                var pdfObj = {
                    'container': elem.querySelector('.pdf-view-wrapper'),
                    'document': null,
                    'download': new pdfjsViewer.DownloadManager(),
                    'eventBus': new pdfjsViewer.EventBus(),
                    'history': null,
                    'id': id,
                    'linkService': null,
                    'loaded': 0,
                    'loader': null,
                    'pageTotal': 0,
                    'protected': protected,
                    'src': elem.dataset.pdf,
                    'timeoutCount': 0,
                    'viewer': null
                };
                
                // Update the eventBus to dispatch page change events to our own function.
                pdfObj.eventBus.on( 'pagechanging', function pagechange(evt) { 
                    updatePageInfo( evt );
                } );
                
                // Create and attach the PDFLinkService that handles links and navigation in the viewer.
                var linkService = new pdfjsViewer.PDFLinkService( {
                    'eventBus': pdfObj.eventBus,
                    'externalLinkEnabled': true,
                    'externalLinkRel': 'noopener noreferrer nofollow',
                    'externalLinkTarget': 2 // Blank
                } );
                pdfObj.linkService = linkService;
                
                // Create the actual PDFViewer that shows the PDF to the user.
                var pdfViewer = new pdfjsViewer.PDFViewer( {
                    'container': pdfObj.container,
                    'enableScripting': false, // Block embeded scripts for security
                    'enableWebGL': true,
                    'eventBus': pdfObj.eventBus,
                    'linkService': pdfObj.linkService,
                    'renderInteractiveForms': true, // Allow form fields to be editable
                    'textLayerMode': 2
                } );
                pdfObj.viewer = pdfViewer;
                pdfObj.linkService.setViewer( pdfObj.viewer );
                
                // Create the PDFHistory Object; PDFLinkService needs this? If not, remove it.
                var pdfHistory = new pdfjsViewer.PDFHistory( {
                    'eventBus': pdfObj.eventBus,
                    'linkService': pdfObj.linkService
                } );
                pdfObj.history = pdfHistory;
                pdfObj.linkService.setHistory( pdfHistory );
                
                // Call the PDFJS library and load the PDF. A loader object is returned.
                var loadingTask = pdfjsLib.getDocument( {
                    url: pdfObj.src,
                    cMapUrl: RELPATH + 'js/cmaps/',
                    cMapPacked: true,
                } );
                pdfObj.loader = loadingTask;
    
                // Update the loading progress of the PDF. Can use this later for a progress bar and abost after X time feature.
                loadingTask.onProgress = function (progressData) {
                    pdfObj.loaded = progressData.loaded / progressData.total;
                };
                PDFViewers[ id ] = pdfObj;
    
            } else {
                // A widget already exists, this is a locked PDF. Get the original PDF object.
                var pdfObj = PDFViewers[id];
                // Update the loader to use the supplied password.
                var loadingTask = pdfjsLib.getDocument( {
                    url: pdfObj.src,
                    cMapUrl: RELPATH + 'js/cmaps/',
                    cMapPacked: true,
                    password: password
                } );
                pdfObj.loader = loadingTask;
                // Clean out the password form.
                var form = elem.querySelector('.pdf-password-box');
                form.parentElement.removeChild( form );
            }
            
            // Attempt to load the PDF document and display it in the viewer.
            pdfObj.loader.promise.then(
                // Success function.
                function( doc ) {
                    pdfObj.document = doc;
                    pdfObj.pageTotal = doc.numPages;
                    pdfObj.viewer.setDocument( doc );
                    pdfObj.linkService.setDocument( doc );
                    // Unlock the toolbar and fix the viewers GUI.
                    unlockToolbar( pdfObj );
                    // Is the current page smaller than a normal PDF page?
                    if ( pdfObj.container.clientWidth < 850 ) {
                        // Yes. Trigger a page-width resize...
                        setTimeout( function() {
                            // ...on a delay to avoid a race condition with the viewer.
                            pdfObj.viewer.currentScaleValue = 'page-width';
                        }, 150 );
                    }
                },
                // Error function.
                function( exception ) {
                    // What type of error occurred?
                    if ( exception.name == 'PasswordException' ) {
                        // Password missing, prompt the user and try again.
                        elem.appendChild( getPdfPasswordBox() );
                    } else {
                        // Some other error, stop trying to load this PDF.
                        console.error( exception );
                    }
                    // TODO: Catch MissingPDFException and show visually.
                    /**
                     * Additional exceptions can be reversed engineered from here:
                     * https://github.com/mozilla/pdf.js/blob/master/examples/mobile-viewer/viewer.js
                     */
                }
            );
        }
    };

    // https://stackoverflow.com/a/52256801/3193156
    var debounce = function( func, time ) {
        time = time || 300;
        return function( event ) {
            if ( DebounceTimer ) {
                clearTimeout( DebounceTimer );
            }
            DebounceTimer = setTimeout( func, time, event );
        }
    };

    /**
     * Download the current PDF including any changes a user made to interactive PDFs.
     */
    var download = function() {
        var widget = this.closest('.pdf-widget');
        var toolbar = widget.querySelector('.pdf-toolbar');
        var id = widget.dataset.id;
        // Do not attempt a download if the toolbar is locked.
        if ( id && ! toolbar.classList.contains('pdf-locked') ){
            var pdfObj = PDFViewers[ id ];
            // Block print ability unless it was explicitly enabled.
            if ( ! pdfObj.protected ) {
                /**
                 * This was a pain to figure out! This pull/ merge request has all the
                 * files needed to figure this out: https://github.com/mozilla/pdf.js/pull/12137/files
                 */
                pdfObj.document.saveDocument( pdfObj.document.annotationStorage ).then(
                    // Success.
                    function( data ) {
                        var getUrl = window.location;
                        var url = getUrl.protocol + "//" + getUrl.host + "/" + getUrl.pathname.split('/')[1];
                        var blob = new Blob( [data], { type: "application/pdf" } );
                        pdfObj.download.download( blob, url, 'test.pdf' );
                    },
                    // Error.
                    function( e ) {
                        console.log( e );
                    }
                );
            } else {
                console.error('Downloading is not allowed for this PDF!');
            }
        }
    };

    /**
     * Display the PDF in its normal size.
     * 
     * @deprecated Since alpha. Kept so gitToggle makes more sense.
     */
    var fitActual = function() {
        var id = this.closest('.pdf-widget').dataset.id;
        if ( id ) {
            var pdfObj = PDFViewers[ id ];
            pdfObj.viewer.currentScale = 'page-actual';
        }
    };
    
    /**
     * Toggle between fitActual and fitWidth. If the fit button is in the
     * reset mode because the user zoomed in or out it will trigger
     * fitActual to cancel the zoom.
     */
    var fitToggle = function() {
        var id = this.closest('.pdf-widget').dataset.id;
        if ( id ) {
            var current = this.dataset.fit;
            var pdfObj = PDFViewers[ id ];
            // If the page is smaller than a normal PDF page force width mode all the time.
            if ( pdfObj.container.clientWidth < 850 ) {
                current = 'actual';
            }
            switch( current ) {
                case 'actual':
                    pdfObj.viewer.currentScaleValue = 'page-width';
                    this.classList.remove('pdf-reset');
                    this.classList.add('pdf-width');
                    this.dataset.fit = 'width';
                    break;
                case 'width':
                case 'reset':
                    pdfObj.viewer.currentScaleValue = 'page-actual';
                    this.classList.remove('pdf-reset');
                    this.classList.remove('pdf-width');
                    this.dataset.fit = 'actual';
                    break;
            }
        }
    };
    
    /**
     * Update the fit control GUI.
     */
    var fitUpdate = function( pdfWidget, pdfObj ) {
        var fit = pdfWidget.querySelector('.pdf-controls .pdf-fit');
        if ( pdfObj.viewer.currentScale == 1 ) {
            fit.classList.remove('pdf-reset');
            fit.dataset.fit = 'actual';
        } else {
            fit.classList.remove('pdf-width');
            fit.classList.add('pdf-reset');
            fit.dataset.fit = 'reset';
        }
    };
    
    /**
     * Display the PDF to the width of its container.
     * 
     * @deprecated Since alpha. Kept so gitToggle makes more sense.
     */
    var fitWidth = function() {
        var id = this.closest('.pdf-widget').dataset.id;
        if ( id ) {
            var pdfObj = PDFViewers[ id ];
            pdfObj.viewer.currentScale = 'page-width';
        }
    };

    /**
     * Recursively build and return the HTML for the PDFs bookmarks (annotations).
     *
     * @param {Array[Objects]} bookmarks An array of annotation objects (MessageHandler?). 
     * @return {HTML} An unordered list (ul) of this PDFs bookmarks (annotations).
     */
    var getBookmarks = function( bookmarks ) {
        var html = '<ul>';
        for ( var i = 0; i < bookmarks.length; i++ ) {
            // bookmarks[i].dest is an object that linkService will need.
            html += '<li><div class="pdf-bookmark-link" data-dest=\'' + JSON.stringify( bookmarks[i].dest ) + '\'>' + bookmarks[i].title + '</div>';
            if ( bookmarks[i].items.length > 0 ) {
                html += getBookmarks( bookmarks[i].items );
            }
            html += '</li>';
        }
        return html + '</ul>';
    };

    /**
     * Create and return the HTML to contain and display the PDF in.
     *
     * @param {String} id The unique ID for the widget this container will belong to.
     * @return {Element} The container element.
     */
    var getContainers = function( id ) {
        // Limit PDF viewers to 70% of the pages available height.
        var height = ( window.innerHeight * .70 ) + 'px';
        // Create viewer container.
        var container = document.createElement('DIV');
        container.classList.add('pdf-container');
        container.style.height = height;
        // Create a wrapper for the actual viewer to sit inside of.
        var viewWrapper = document.createElement('DIV');
        viewWrapper.classList.add('pdf-view-wrapper');
        viewWrapper.style.position = 'absolute'; // Must have!
        viewWrapper.style.height =  height;
        // Create the actual viewer.
        var viewer = document.createElement('DIV');
        viewer.id = id;
        viewer.classList.add('pdf-viewer');
        // Put everything together.
        viewWrapper.appendChild( viewer );
        container.appendChild( viewWrapper );
        // Send back the new elements for inclusion in the page.
        return container;
    };

    /**
     * Create and return the HTML for the zoom and resize controls.
     *
     * @return {Element} The controls element.
     */
    function getControls() {
        var controls = document.createElement('DIV');
        controls.classList.add('pdf-controls');
        controls.classList.add('pdf-locked');
        var html = '<div class="pdf-button pdf-fit" data-fit="actual">';
        html += '<i class="fas fa-compress pdf-actual pdf-icon"></i>';
        html += '<i class="fas fa-expand pdf-width pdf-icon"></i>';
        html += '<i class="fas fa-undo pdf-reset pdf-icon"></i></div>';
        html += '<div class="pdf-button pdf-zoom-in"><i class="fas fa-plus pdf-icon"></i></div>'; 
        html += '<div class="pdf-button pdf-zoom-out"><i class="fas fa-minus pdf-icon"></i></div>';
        controls.innerHTML = html;
        return controls;
    };

    /**
     * Create and return the HTML for the password prompt.
     *
     * @return {Element} The password prompt element.
     */
    var getPdfPasswordBox = function() {
        var password = document.createElement('DIV');
        password.classList.add('pdf-password-box');
        var html = '<div class="pdf-message"><i class="fas fa-lock pdf-icon"></i>';
        html += 'Please enter the password to unlock this PDF:';
        html += '</div>';
        html += '<div class="pdf-password"><input type="password" autocomplete="off">';
        html += '<button>Unlock</button></div>';
        password.innerHTML = html;
        password.querySelector('button').addEventListener( 'click', unlock );
        return password;
    };

    function getProtectionStatus( status ) {
        if ( ! status ) {
            return true;
        }
        if ( status.toUpperCase() == 'FALSE' || status == '0' ) {
            return false;
        }
        return true;
    };

    /**
     * Create and return the HTML for the toolbar controls.
     *
     * @return {Element} The toolbar element. 
     */
    var getToolbar = function( protected ) {
        var hide = '';
        if ( protected ) {
            hide = 'style="display:none;"';
        }
        var toolbar = document.createElement('DIV');
        toolbar.classList.add('pdf-toolbar');
        toolbar.classList.add('pdf-locked');
        var html = '<div class="pdf-page-area">';
        html += '<div class="pdf-button pdf-page-up pdf-disabled"><i class="fas fa-arrow-up pdf-icon"></i></div>';
        html += '<div class="pdf-button pdf-page-down pdf-disabled"><i class="fas fa-arrow-down pdf-icon"></i></div>';
        html += '<input type="number" class="pdf-page" title="Page" value="1" size="4" min="1" autocomplete="off"> <span class="pdf-page-slash">/</span> <span class="pdf-page-total">?</span>';
        html += '</div>';
        html += '<div class="pdf-control-area">';
        html += '<div class="pdf-button pdf-download" ' + hide + '><i class="fas fa-download pdf-icon"></i></div>';
        html += '<div class="pdf-button pdf-print" ' + hide + '><i class="fas fa-print pdf-icon"></i></div>';
        html += '<div class="pdf-button pdf-bookmark pdf-disabled"><i class="fas fa-bookmark pdf-icon"></i></div></div>';
        toolbar.innerHTML = html;
        return toolbar;
    };

    /**
     * Jump to the selected bookmarks (annotations) location.
     */
    var goToBookmark = function() {
        var widget = this.closest('.pdf-widget');
        var pdfObj = PDFViewers[ widget.dataset.id ];
        var dest = JSON.parse( this.dataset.dest );
        if ( dest ) {
            pdfObj.linkService.goToDestination( dest );
        }
    }

    /**
     * Respond to a change in the page number input box.
     *
     * @param {Event} evt The key down event that triggered this call.
     */
     var goToPage = function( evt ) {
        // Make sure we have an event.
        if ( evt ) {
            // Make sure the event is from the Enter key.
            if ( evt.key.toUpperCase() == 'ENTER' || evt.keyCode == 13 ) {
                var widget = this.closest('.pdf-widget');
                var toolbar = widget.querySelector('.pdf-toolbar');
                // If the toolbar is not locked (disabled) jump to the requested page.
                if ( ! toolbar.classList.contains('pdf-disabled') ) {
                    var pdfObj = PDFViewers[ widget.dataset.id ];
                    var page = parseInt( this.value );
                    // Make sure the supplied page is within bounds.
                    if ( page < 1 ) {
                        page = 1;
                    } else if ( page > pdfObj.pageTotal ) {
                        page = pdfObj.pageTotal
                    }
                    pdfObj.linkService.goToPage( page );
                }
            }
        }
    };

    var handleWindowResize = function() {
        for ( prop in PDFViewers ) {
            var pdfObj = PDFViewers[ prop ];
            var widget = pdfObj.container.closest('.pdf-widget');
            var fitBtn = widget.querySelector('.pdf-controls .pdf-fit');
            fitBtn.dataset.fit = 'actual';
            fitBtn.click();
        }
    }
    
    /**
     * Activate PDFMiniViewers.
     */
    var initialize = function() {
        if ( pdfjsLib.getDocument && pdfjsViewer.PDFViewer ) {
            // Record applications relative path.
            RELPATH = JAMSEDU.getRelativePath();
            // The workerSrc property must be specified.
            pdfjsLib.GlobalWorkerOptions.workerSrc = RELPATH + "js/pdf-worker.min.js";
            // Search the page for all embedded PDFs and convert them to viewers.
            var pdfs = document.querySelectorAll('[data-pdf]');
            pdfs.forEach( function( pdf ) {
                // Do not convert a viewer that has already been done.
                if ( ! pdf.dataset.id ) {
                    convertPdfs( pdf );
                }
            } );
            // Attach window resize listener.
            window.addEventListener('resize', debounce( handleWindowResize, 300 ), true);
        }
    };

    var loadBookmarks = function( pdfObj ) {
        if ( pdfObj.loaded >= 1 ) {
            var widget = document.querySelector( '[data-id="' + pdfObj.id + '"]' );
            var toolbar = widget.querySelector('.pdf-toolbar');
            pdfObj.document.getOutline().then(
                function( response ) {
                    // If we actually gave bookmarks build the HTML to display them.
                    if ( response && response.length > 0 ) {
                        var html = getBookmarks( response );
                        var bookmarks = document.createElement('DIV');
                        bookmarks.classList.add('pdf-bookmark-links');
                        bookmarks.innerHTML = html;
                        widget.appendChild( bookmarks );
                        var links = bookmarks.querySelectorAll('.pdf-bookmark-link');
                        links.forEach( function( link ) {
                            link.addEventListener( 'click', goToBookmark );
                        } );
                        var bookmark = toolbar.querySelector('.pdf-control-area .pdf-bookmark');
                        bookmark.classList.remove('pdf-disabled');
                    }
                },
                // Error.
                function( e ) {
                    console.error( e );
                }
            );
        } else {
            // Only try to load bookmarks for 10 seconds.
            if ( pdfObj.timeoutCount < 40 ) {
                pdfObj.timeoutCount++;
                setTimeout( loadBookmarks.bind( null, pdfObj ), 250 );
            } else {
                console.error( 'Loading PDF bookmarks timed out! This PDF is too huge.' );
            }
        }
    };

    /**
     * Print the current PDF including any changes a user made to interactive PDFs.
     */
    var print = function() {
        var widget = this.closest('.pdf-widget');
        var toolbar = widget.querySelector('.pdf-toolbar');
        var id = widget.dataset.id;
        if ( id && ! toolbar.classList.contains('pdf-locked') ) {
            var pdfObj = PDFViewers[ id ];
            // Block print ability unless it was explicitly enabled.
            if ( ! pdfObj.protected ) {
                /**
                 * This was a pain to figure out! This pull/ merge request has all the
                 * files needed to figure this out: https://github.com/mozilla/pdf.js/pull/12137/files
                 */
                pdfObj.document.saveDocument( pdfObj.document.annotationStorage ).then(
                    // Success.
                    function( data ) {
                        // Get the PDF as a blob.
                        var getUrl = window.location;
                        var url = getUrl.protocol + "//" + getUrl.host + "/" + getUrl.pathname.split('/')[1];
                        var blob = new Blob( [data], { type: "application/pdf" } );
                        var url = URL.createObjectURL( blob );
                        // Open it in a new tab and let the browser render it for printing.
                        var a = document.createElement("A");
                        a.target = '_blank';
                        a.href = url;
                        a.click();
                    },
                    // Error.
                    function( e ) {
                        console.error( e );
                    }
                );
            } else {
                console.error('Printing is not allowed for this PDF!');
            }
        }
    };

    var toggleBookmarks = function() {
        var widget = this.closest('.pdf-widget');
        var bookmarks = widget.querySelector('.pdf-bookmark-links');
        bookmarks.classList.toggle('pdf-active');
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

    /**
     * Respond to the unlock button being pressed on a locked PDF.
     */
    var unlock = function() {
        var password = this.previousSibling;
        // Do we have a password?
        if ( password ) {
            if ( password.value ) {
                // Yes, try to load the PDF again with the password this time.
                convertPdfs( this.closest('.pdf-widget'), password.value );
            }
        }
    };

    /**
     * The PDF is ready for interaction, unlock the toolbar and fix the GUI.
     * This function also starts the bookmark building process.
     */
    var unlockToolbar = function( pdfObj ) {
        // Get needed elements.
        var widget = document.querySelector( '[data-id="' + pdfObj.id + '"]' );
        var toolbar = widget.querySelector('.pdf-toolbar');
        var total = toolbar.querySelector('.pdf-page-area .pdf-page-total');
        var controls = widget.querySelector('.pdf-controls');
        // Unlock controls.
        toolbar.classList.remove('pdf-locked');
        controls.classList.remove('pdf-locked');
        // Correct page number or hide page controls if there is only one page.
        if ( pdfObj.pageTotal > 1 ) {
            total.innerHTML = pdfObj.pageTotal;
        } else {
            total.innerHTML = 1;
            total.parentElement.style.display = 'none';
        }
        // Dispatch a fake page change (pagechanging) event to update the GUI.
        pdfObj.eventBus.dispatch( 'pagechanging', {
            'source': pdfObj.viewer,
            'pageNumber': 1,
            'pageLabel': null,
            'previous': 0
        } );
        // Load PDF bookmarks (annotations).
        loadBookmarks( pdfObj, widget );
    };

    /**
     * Update the page number and the up and down buttons in the toolbar.
     *
     * @param {eventBus.event} evt The eventBus event triggered by a pagechanging call.
     */
    var updatePageInfo = function( evt ) {
        // Get all the elements we need.
        var widget = evt.source.container.closest('.pdf-widget');
        var up = widget.querySelector('.pdf-page-area .pdf-page-up');
        var down = widget.querySelector('.pdf-page-area .pdf-page-down');
        var pageTotal = widget.querySelector('.pdf-toolbar .pdf-page-area .pdf-page-total');
        var total = parseInt( pageTotal.innerHTML );
        var pageNum = widget.querySelector('.pdf-toolbar .pdf-page-area .pdf-page');
        // Update the current page number.
        pageNum.value = evt.pageNumber;
        // Update (disable/enable) the buttons.
        if ( total == 1 ) {
            up.classList.add('pdf-disabled');
            down.classList.add('pdf-disabled');
        } else if ( evt.pageNumber == 1 ) {
            up.classList.add('pdf-disabled');
            down.classList.remove('pdf-disabled');
        } else if ( evt.pageNumber == total ) {
            up.classList.remove('pdf-disabled');
            down.classList.add('pdf-disabled');
        } else {
            up.classList.remove('pdf-disabled');
            down.classList.remove('pdf-disabled');
        }
    };

    /**
     * Zoom the current PDF in.
     */
    var zoomIn = function() {
        var id = this.closest('.pdf-widget').dataset.id;
        if ( id ) {
            var pdfObj = PDFViewers[ id ];
            var scale = pdfObj.viewer.currentScale;
            if ( scale < 2 ) {
                pdfObj.viewer.currentScaleValue = parseFloat( ( scale + .10 ).toFixed(2) );
                fitUpdate( this.closest('.pdf-widget'), pdfObj );
            }
        }
    };
    
    /**
     * Zoom the current PDF out.
     */
    var zoomOut = function() {
        var id = this.closest('.pdf-widget').dataset.id;
        if ( id ) {
            var pdfObj = PDFViewers[ id ];
            var scale = pdfObj.viewer.currentScale;
            if ( scale > .50 ) {
                pdfObj.viewer.currentScaleValue = parseFloat( ( scale - .10 ).toFixed(2) );
                fitUpdate( this.closest('.pdf-widget'), pdfObj );
            }
        }
    };

    return {
        'initialize': initialize
    };

} )();