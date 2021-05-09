/* Copyright 2014 Mozilla Foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

"use strict";

var resizeLimiter;

// https://stackoverflow.com/a/5490021/3193156
window.addEventListener( 'resize', function( event ) {
    clearTimeout( resizeLimiter );
    resizeLimiter = setTimeout( updatePdfs, 500 );
} );

var pdfViews = {};

if ( pdfjsLib.getDocument && pdfjsViewer.PDFViewer ) {

    // The workerSrc property shall be specified.
    pdfjsLib.GlobalWorkerOptions.workerSrc = "./pdf.worker.min.js";

    var pdfs = document.querySelectorAll('[data-pdf]');
    pdfs.forEach( function( pdf ) {
        convertPdfs( pdf );
    } );

}

function updatePdfs() {
    for ( var prop in pdfViews ) {
        var pdfObj = pdfViews[ prop ];
        pdfObj.container.innerHTML = '';
        pdfObj.pageLoaded = 0;
        updateViewport( pdfObj );
        loadPdf( pdfObj );
    }
}

// https://gist.github.com/gordonbrander/2230317#gistcomment-1713405
function uid() {
    return (Date.now().toString(36) + Math.random().toString(36).substr(2, 6)).toUpperCase();
}

function convertPdfs( elem ) {

    var id = uid();

    elem.classList.add('pdf-widget');

    //elem.style.height = ( elem.clientWidth + ( elem.clientWidth * .30 ) ) + 'px';
    //elem.style.height = ( elem.clientWidth / 2 ) + 'px';

    var toolbar = document.createElement('DIV');
    toolbar.classList.add('pdf-toolbar');

    var controls = document.createElement('DIV');
    controls.dataset.for = id;
    controls.classList.add('pdf-controls');
    controls.innerHTML = '<div class="pdf-icon pdf-fit"><i class="fas fa-compress"></i></i></div><div class="pdf-icon pdf-zoom-in"><i class="fas fa-plus icon"></i></div><div class="pdf-icon pdf-zoom-out"><i class="fas fa-minus"></i></div>';

    var container = document.createElement('DIV');
    container.id = id;
    container.classList.add('pdf-container');
    container.style.height = ( window.innerHeight * .70 ) + 'px';

    elem.appendChild( toolbar );
    elem.appendChild( controls );
    elem.appendChild( container );

    // Add listeners
    controls.querySelector('.pdf-zoom-in').addEventListener( 'click', pdfZoomIn );
    controls.querySelector('.pdf-zoom-out').addEventListener( 'click', pdfZoomOut );

    // Some PDFs need external cmaps.
    var CMAP_URL = "./cmaps/";

    var eventBus = new pdfjsViewer.EventBus();

    var loadingTask = pdfjsLib.getDocument( {
        url: elem.dataset.pdf,
        cMapUrl: CMAP_URL,
        cMapPacked: true,
    } );

    var pdfObj = {
        "container": container,
        "document": null,
        "eventBus": eventBus,
        "id": id,
        "margin": 15,
        "pageLoaded": 0,
        "pageTotal": null,
        "viewport": null,
        "zoom": 0
    };

    updateViewport( pdfObj );

    loadingTask.promise.then( function( doc ) {
        pdfObj.document = doc;
        pdfObj.pageTotal = doc.numPages;
        pdfViews[ pdfObj.id ] = pdfObj;
        loadPdf( pdfObj );
    } );
}

function loadPdf( pdfObj ) {
    if ( pdfObj.pageLoaded < pdfObj.pageTotal ) {
        pdfObj.pageLoaded++;
        renderPage( pdfObj );
        loadPdf( pdfObj );
    }
}

function renderPage( pdfObj ) {
    pdfObj.document.getPage( pdfObj.pageLoaded ).then( function ( pdfPage ) {
        // Creating the page view with default parameters.
        var pdfView = new pdfjsViewer.PDFPageView( {
            container: pdfObj.container,
            id: pdfObj.pageLoaded,
            scale: pdfObj.viewport,
            defaultViewport: pdfPage.getViewport( { scale: pdfObj.viewport } ),
            eventBus: pdfObj.eventBus
        } );
        // Associates the actual page with the view, and drawing it
        pdfView.setPdfPage( pdfPage );
        pdfView.draw();
    } );
}

// eventBus
// webViewerZoomIn
// webViewerZoomOut
// this.pdfViewer.currentScaleValue = newScale;

// zoomIn: function pdfViewZoomIn(ticks) {
//     let newScale = this.pdfViewer.currentScale;
//     do {
//       newScale = (newScale * DEFAULT_SCALE_DELTA).toFixed(2);
//       newScale = Math.ceil(newScale * 10) / 10;
//       newScale = Math.min(MAX_SCALE, newScale);
//     } while (--ticks && newScale < MAX_SCALE);
//     this.pdfViewer.currentScaleValue = newScale;
//   },

function changeZoom( pdfObj, zoom ) {
    pdfObj.container.innerHTML = '';
    pdfObj.pageLoaded = 0;
    loadPdf( pdfObj, null, zoom );
}

function updateViewport( pdfObj ) {
    var initial = 0;
    if ( pdfObj.container.clientWidth < 816 ) {
        initial += ( pdfObj.container.clientWidth - pdfObj.margin * 2 ) / 816;
    } else {
        initial = 1;
    }
    if ( pdfObj.zoom == 0 ) {
        pdfObj.viewport = initial;
    } else {
        pdfObj.viewport = initial + .15 * pdfObj.zoom;
    }
}

function pdfZoomIn() {
    var id = this.parentElement.dataset.for;
    if ( id ) {
        if ( pdfViews[id] ) {
            var pdfObj = pdfViews[id];
            var zoom = pdfObj.zoom;
            if ( zoom < 5 ) {
                pdfObj.zoom++;
                updateViewport( pdfObj );
                pdfObj.container.innerHTML = '';
                pdfObj.pageLoaded = 0;
                loadPdf( pdfObj );
            }
        }
    }
}

function pdfZoomOut() {
    var id = this.parentElement.dataset.for;
    if ( id ) {
        if ( pdfViews[id] ) {
            var pdfObj = pdfViews[id];
            var zoom = pdfObj.zoom;
            if ( zoom > -5 ) {
                pdfObj.zoom--;
                updateViewport( pdfObj );
                pdfObj.container.innerHTML = '';
                pdfObj.pageLoaded = 0;
                loadPdf( pdfObj );
            }
        }
    }
}