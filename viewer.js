"use strict";

var PDFViewers = {};

if ( pdfjsLib.getDocument && pdfjsViewer.PDFViewer ) {

    // The workerSrc property must be specified.
    pdfjsLib.GlobalWorkerOptions.workerSrc = "./pdf.worker.min.js";

    // Search the page for all embedded PDFs and convert them to viewers.
    var pdfs = document.querySelectorAll('[data-pdf]');
    pdfs.forEach( function( pdf ) {
        convertPdfs( pdf );
    } );

}

// https://gist.github.com/gordonbrander/2230317#gistcomment-1713405
function uid() {
    return ( Date.now().toString(36) + Math.random().toString(36).substr(2, 6) ).toUpperCase();
}

function attachPdfListeners( pdfWidget ) {

    var elem = pdfWidget.querySelector('.pdf-toolbar .pdf-page-area .pdf-page-up');
    if ( elem ) {
        elem.addEventListener( 'click', pdfChangePage );
    }

    elem = pdfWidget.querySelector('.pdf-toolbar .pdf-page-area .pdf-page-down');
    if ( elem ) {
        elem.addEventListener( 'click', pdfChangePage );
    }

    elem = pdfWidget.querySelector('.pdf-toolbar .pdf-page-area .pdf-page');
    if ( elem ) {
        elem.addEventListener( 'keydown', pdfJumpToPage );
    }

    elem = pdfWidget.querySelector('.pdf-toolbar .pdf-download');
    if ( elem ) {
        elem.addEventListener( 'click', pdfDownload );
    }

    elem = pdfWidget.querySelector('.pdf-toolbar .pdf-print');
    if ( elem ) {
        elem.addEventListener( 'click', pdfPrint );
    }

    elem = pdfWidget.querySelector('.pdf-controls .pdf-fit');
    if ( elem ) {
        elem.addEventListener( 'click', pdfFit );
    }

    elem = pdfWidget.querySelector('.pdf-controls .pdf-zoom-in');
    if ( elem ) {
        elem.addEventListener( 'click', pdfZoomIn );
    }

    var elem = pdfWidget.querySelector('.pdf-controls .pdf-zoom-out');
    if ( elem ) {
        elem.addEventListener( 'click', pdfZoomOut );
    }

}

function convertPdfs( elem, password ) {

    if ( elem.dataset.pdf.length > 4 ) {
        
        var id = elem.dataset.id;

        if ( ! id ) {

            id = uid();

            elem.classList.add('pdf-widget');
            elem.dataset.id = id;

            var toolbar = getPdfToolbar();
            var controls = getPdfControls();
            var container = getPdfContainers( id );
            elem.appendChild( toolbar );
            elem.appendChild( container );
            elem.appendChild( controls );

            attachPdfListeners( elem );
        
            var pdfObj = {
                'container': document.querySelector('.pdf-view-wrapper'),
                'document': null,
                'download': new pdfjsViewer.DownloadManager(),
                'eventBus': new pdfjsViewer.EventBus(),
                'history': null,
                'id': id,
                'linkService': null,
                'loaded': 0,
                'loader': null,
                'pageTotal': 0,
                'src': elem.dataset.pdf,
                'viewer': null
            };

            pdfObj.eventBus.on( 'pagechanging', function pagechange(evt) { 
                pdfUpdatePage( evt );
            } );

            var linkService = new pdfjsViewer.PDFLinkService( {
                'eventBus': pdfObj.eventBus,
                'externalLinkEnabled': true,
                'externalLinkRel': 'noopener noreferrer nofollow',
                'externalLinkTarget': 2 // Blank
            } );
            pdfObj.linkService = linkService;

            var pdfViewer = new pdfjsViewer.PDFViewer(
                {
                    'container': pdfObj.container,
                    'enableScripting': false,
                    'enableWebGL': true,
                    'eventBus': pdfObj.eventBus,
                    //'renderer': 'svg',
                    'linkService': pdfObj.linkService,
                    'renderInteractiveForms': true,
                    'textLayerMode': 2,
                    //'useOnlyCssZoom': true
                }
            );
            pdfObj.viewer = pdfViewer;
            pdfObj.linkService.setViewer( pdfObj.viewer );

            var pdfHistory = new pdfjsViewer.PDFHistory( {
                'eventBus': pdfObj.eventBus,
                'linkService': pdfObj.linkService
            } );
            pdfObj.history = pdfHistory;
            pdfObj.linkService.setHistory( pdfHistory );

            var loadingTask = pdfjsLib.getDocument( {
                url: pdfObj.src,
                cMapUrl: "./cmaps/", // TODO: WARNING: This will need to be made dynamic later
                cMapPacked: true,
            } );

            pdfObj.loader = loadingTask;

            //Can add a fancy loading bar later
            loadingTask.onProgress = function (progressData) {
                pdfObj.loaded = progressData.loaded / progressData.total;
            };
            PDFViewers[ id ] = pdfObj;

        } else {

            var pdfObj = PDFViewers[id];

            var loadingTask = pdfjsLib.getDocument( {
                url: pdfObj.src,
                cMapUrl: "./cmaps/", // TODO: WARNING: This will need to be made dynamic later
                cMapPacked: true,
                password: password
            } );
            
            pdfObj.loader = loadingTask;

            // Clean out old password form
            var form = elem.querySelector('.pdf-password-box');
            form.parentElement.removeChild( form );

        }

        pdfObj.loader.promise.then(
            // Success function.
            function( doc ) {
                pdfObj.document = doc;
                pdfObj.pageTotal = doc.numPages;
                // TODO: Set/ Get title here
                //loadPdf( pdfObj );
                //'textLayerMode': 1,
                //doc.textLayerFactory = new pdfjsViewer.DefaultTextLayerFactory();
                //doc.annotationLayerFactory = new pdfjsViewer.DefaultAnnotationLayerFactory();
                //console.log( doc );
                pdfObj.viewer.setDocument( doc );
                pdfObj.linkService.setDocument( doc );
                pdfUnlockToolbar( pdfObj );
            },
            // Error function.
            function( exception ) {
                if ( exception.name == 'PasswordException' ) {
                    elem.appendChild( getPdfPasswordBox() );
                } else {
                    console.log( exception );
                }
                // TODO: Pull from https://github.com/mozilla/pdf.js/blob/2067bccf09b8a82a943b9fdfa7df95f294f0ba1b/examples/mobile-viewer/viewer.js#L90
            }
        );

        // TODO: Hook up all listeners here

        // viewer.currentScaleValue = # 

    }
}

function getPdfContainers( id ) {

    // Limit PDF viewers to 70% of the pages available height.
    var height = ( window.innerHeight * .70 ) + 'px';

    var container = document.createElement('DIV');
    container.classList.add('pdf-container');
    container.style.height = height;

    var viewWrapper = document.createElement('DIV');
    viewWrapper.classList.add('pdf-view-wrapper');
    viewWrapper.style.position = 'absolute'; // Must have!
    viewWrapper.style.height =  height;

    var viewer = document.createElement('DIV');
    viewer.id = id;
    viewer.classList.add('pdf-viewer');

    viewWrapper.appendChild( viewer );
    container.appendChild( viewWrapper );

    return container;

}

function getPdfControls() {
    var controls = document.createElement('DIV');
    controls.classList.add('pdf-controls');
    controls.classList.add('pdf-locked');
    var html = '<div class="pdf-button pdf-fit" data-fit="actual">';
    html += '<i class="fas fa-compress pdf-actual pdf-icon"></i>';
    html += '<i class="fas fa-expand pdf-width pdf-icon"></i>';
    html += '<i class="fas fa-undo pdf-reset pdf-icon"></i>';
    html += '</div>';
    html += '<div class="pdf-button pdf-zoom-in"><i class="fas fa-plus pdf-icon"></i></div>'; 
    html += '<div class="pdf-button pdf-zoom-out"><i class="fas fa-minus pdf-icon"></i></div>';
    controls.innerHTML = html;
    return controls;
}

function getPdfToolbar() {

    var toolbar = document.createElement('DIV');
    toolbar.classList.add('pdf-toolbar');
    toolbar.classList.add('pdf-locked');
    var html = '<div class="pdf-page-area">';
    html += '<div class="pdf-button pdf-page-up pdf-disabled"><i class="fas fa-arrow-up pdf-icon"></i></div>';
    html += '<div class="pdf-button pdf-page-down pdf-disabled"><i class="fas fa-arrow-down pdf-icon"></i></div>';
    html += '<input type="number" class="pdf-page" title="Page" value="1" size="4" min="1" autocomplete="off"> <span class="pdf-page-slash">/</span> <span class="pdf-page-total">?</span>';
    html += '</div>';
    html += '<div class="pdf-control-area">';
    html += '<div class="pdf-button pdf-download"><i class="fas fa-download pdf-icon"></i></div>';
    html += '<div class="pdf-button pdf-print"><i class="fas fa-print pdf-icon"></i></div>';
    html += '<div class="pdf-button pdf-bookmark pdf-disabled"><i class="fas fa-bookmark pdf-icon"></i></div>';
    html += '</div>';
    toolbar.innerHTML = html;
    return toolbar;

}

function getPdfPasswordBox() {

    var password = document.createElement('DIV');
    password.classList.add('pdf-password-box');
    var html = '<div class="pdf-message"><i class="fas fa-lock pdf-icon"></i>';
    html += 'Please enter the password to unlock this PDF:';
    html += '</div>';
    html += '<div class="pdf-password"><input type="password" autocomplete="off">';
    html += '<button>Unlock</button></div>';
    password.innerHTML = html;

    password.querySelector('button').addEventListener( 'click', pdfUnlock );

    return password;
    
}

function pdfJumpToPage( evt ) {
    if ( evt ) {
        if ( evt.key.toUpperCase() == 'ENTER' || evt.keyCode == 13 ) {
            var widget = this.closest('.pdf-widget');
            var toolbar = widget.querySelector('.pdf-toolbar');
            if ( ! toolbar.classList.contains('pdf-disabled') ) {
                var pdfObj = PDFViewers[ widget.dataset.id ];
                var page = parseInt( this.value );
                if ( page < 1 ) {
                    page = 1;
                } else if ( page > pdfObj.pageTotal ) {
                    page = pdfObj.pageTotal
                }
                pdfObj.linkService.goToPage( page );
            }
        }
    }
}

function pdfChangePage() {
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
}

function pdfUpdatePage( evt ) {
    var widget = evt.source.container.closest('.pdf-widget');
    var up = widget.querySelector('.pdf-page-area .pdf-page-up');
    var down = widget.querySelector('.pdf-page-area .pdf-page-down');
    var pageTotal = widget.querySelector('.pdf-toolbar .pdf-page-area .pdf-page-total');
    var total = parseInt( pageTotal.innerHTML );
    var pageNum = widget.querySelector('.pdf-toolbar .pdf-page-area .pdf-page');
    pageNum.value = evt.pageNumber;

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

}

function pdfCreateBookmarks( bookmarks ) {
    var html = '<ul>';
    for ( var i = 0; i < bookmarks.length; i++ ) {
        html += '<li><div class="pdf-bookmark-link" data-dest=\'' + JSON.stringify( bookmarks[i].dest ) + '\'>' + bookmarks[i].title + '</div>';
        if ( bookmarks[i].items.length > 0 ) {
            html += pdfCreateBookmarks( bookmarks[i].items );
        }
        html += '</li>';
    }
    return html + '</ul>';
}

function pdfGoToBookmark() {
    var widget = this.closest('.pdf-widget');
    var pdfObj = PDFViewers[ widget.dataset.id ];
    var dest = JSON.parse( this.dataset.dest );
    if ( dest ) {
        pdfObj.linkService.goToDestination( dest );
    }
}

function pdfUnlockToolbar( pdfObj ) {

    var widget = document.querySelector( '[data-id="' + pdfObj.id + '"]' );
    var toolbar = widget.querySelector('.pdf-toolbar');
    var total = toolbar.querySelector('.pdf-page-area .pdf-page-total');
    var controls = widget.querySelector('.pdf-controls');
    toolbar.classList.remove('pdf-locked');
    controls.classList.remove('pdf-locked');
    if ( pdfObj.pageTotal > 1 ) {
        total.innerHTML = pdfObj.pageTotal;
    } else {
        total.innerHTML = 1;
        total.parentElement.style.display = 'none';
    }

    // Dispatch a fake page change event to update the GUI.
    pdfObj.eventBus.dispatch( 'pagechanging', {
        'source': pdfObj.viewer,
        'pageNumber': 1,
        'pageLabel': null,
        'previous': 0
    } );

    // pdfObj.document.getOutline().then(
    //     function( response ) {
    //         if ( response && response.length > 0 ) {
    //             var html = pdfCreateBookmarks( response );
    //             var bookmarks = document.createElement('DIV');
    //             bookmarks.classList.add('pdf-bookmark-links');
    //             bookmarks.innerHTML = html;
    //             widget.appendChild( bookmarks );
    //             var links = bookmarks.querySelectorAll('.pdf-bookmark-link');
    //             links.forEach( function( link ) {
    //                 link.addEventListener( 'click', pdfGoToBookmark );
    //             } );
    //         } else {
    //             var bookmark = toolbar.querySelector('.pdf-control-area .pdf-bookmark');
    //             bookmark.style.display = 'none';
    //         }
    //     },
    //     function( error ) {

    //     }
    // );
    
}

function pdfUnlock() {
    var password = this.previousSibling;
    if ( password ) {
        if ( password.value ) {
            convertPdfs( this.closest('.pdf-widget'), password.value );
        }
    }
}

function pdfDownload() {
    var widget = this.closest('.pdf-widget');
    var toolbar = widget.querySelector('.pdf-toolbar');
    var id = widget.dataset.id;
    if ( id && ! toolbar.classList.contains('pdf-locked') ){
        var pdfObj = PDFViewers[ id ];
        // https://github.com/mozilla/pdf.js/pull/12137/files
        pdfObj.document.saveDocument( pdfObj.document.annotationStorage ).then(
            function suc( data ) {
                var getUrl = window.location;
                var url = getUrl.protocol + "//" + getUrl.host + "/" + getUrl.pathname.split('/')[1];
                var blob = new Blob( [data], { type: "application/pdf" } );
                pdfObj.download.download( blob, url, 'test.pdf' );
            },
            function err( e ) {
                console.log( e );
            }
        );
    }
}

function pdfPrint() {
    var widget = this.closest('.pdf-widget');
    var toolbar = widget.querySelector('.pdf-toolbar');
    var id = widget.dataset.id;
    if ( id && ! toolbar.classList.contains('pdf-locked') ) {
        var pdfObj = PDFViewers[ id ];
        // https://github.com/mozilla/pdf.js/pull/12137/files
        pdfObj.document.saveDocument( pdfObj.document.annotationStorage ).then(
            function suc( data ) {
                var getUrl = window.location;
                var url = getUrl.protocol + "//" + getUrl.host + "/" + getUrl.pathname.split('/')[1];
                var blob = new Blob( [data], { type: "application/pdf" } );
                var url = URL.createObjectURL( blob );
                var a = document.createElement("A");
                a.target = '_blank';
                a.href = url;
                a.click();
            },
            function err( e ) {
                console.log( e );
            }
        );
    }
}

function pdfFitActual() {
    var id = this.closest('.pdf-widget').dataset.id;
    if ( id ) {
        var pdfObj = PDFViewers[ id ];
        pdfObj.viewer.currentScale = 'page-actual';
    }
}

function pdfFitWidth() {
    var id = this.closest('.pdf-widget').dataset.id;
    if ( id ) {
        var pdfObj = PDFViewers[ id ];
        pdfObj.viewer.currentScale = 'page-width';
    }
}

function pdfFit() {
    var id = this.closest('.pdf-widget').dataset.id;
    if ( id ) {
        var current = this.dataset.fit;
        var pdfObj = PDFViewers[ id ];
        switch( current ) {
            case 'actual':
                pdfObj.viewer.currentScaleValue = 'page-width';
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
}

function pdfFitUpdateState( pdfWidget, pdfObj ) {
    var fit = pdfWidget.querySelector('.pdf-controls .pdf-fit');
    if ( pdfObj.viewer.currentScale == 1 ) {
        fit.classList.remove('pdf-reset');
        fit.dataset.fit = 'actual';
    } else {
        fit.classList.remove('pdf-width');
        fit.classList.add('pdf-reset');
        fit.dataset.fit = 'reset';
    }
}

function pdfZoomIn() {
    var id = this.closest('.pdf-widget').dataset.id;
    if ( id ) {
        var pdfObj = PDFViewers[ id ];
        var scale = pdfObj.viewer.currentScale;
        if ( scale < 2 ) {
            pdfObj.viewer.currentScaleValue = parseFloat( ( scale + .10 ).toFixed(2) );
            pdfFitUpdateState( this.closest('.pdf-widget'), pdfObj );
        }
    }
}

function pdfZoomOut() {
    var id = this.closest('.pdf-widget').dataset.id;
    if ( id ) {
        var pdfObj = PDFViewers[ id ];
        var scale = pdfObj.viewer.currentScale;
        if ( scale > .50 ) {
            pdfObj.viewer.currentScaleValue = parseFloat( ( scale - .10 ).toFixed(2) );
            pdfFitUpdateState( this.closest('.pdf-widget'), pdfObj );
        }
    }
}