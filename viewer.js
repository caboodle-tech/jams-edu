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

    var elem = pdfWidget.querySelector('.pdf-toolbar .pdf-download');
    if ( elem ) {
        elem.addEventListener( 'click', pdfDownload );
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
                'loader': null,
                'pageTotal': 0,
                'src': elem.dataset.pdf,
                'viewer': null
            }

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

            // Can add a fancy loading bar later
            // loadingTask.onProgress = function (progressData) {
            //     console.log(progressData.loaded / progressData.total);
            // };
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
    var html = '<div class="pdf-page-area">';
    html += '<div class="pdf-button pdf-page-up"><i class="fas fa-arrow-up pdf-icon"></i></div>';
    html += '<div class="pdf-button pdf-page-down"><i class="fas fa-arrow-down pdf-icon"></i></div>';
    html += '<input type="number" class="pdf-page" title="Page" value="1" size="4" min="1" autocomplete="off"> <span class="pdf-page-slash">/</span> <span class="pdf-page-total">14</span>';
    html += '</div>';
    html += '<div class="pdf-control-area">';
    html += '<div class="pdf-button pdf-download"><i class="fas fa-download pdf-icon"></i></div>';
    html += '<div class="pdf-button pdf-print"><i class="fas fa-print pdf-icon"></i></div>';
    html += '<div class="pdf-button pdf-bookmark"><i class="fas fa-bookmark pdf-icon"></i></div>';
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

function pdfUnlock() {
    var password = this.previousSibling;
    if ( password ) {
        if ( password.value ) {
            convertPdfs( this.closest('.pdf-widget'), password.value );
        }
    }
}

function pdfDownload() {
    var id = this.closest('.pdf-widget').dataset.id;
    if ( id ) {
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