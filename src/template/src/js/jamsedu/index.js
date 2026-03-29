// @jamsedu-version: 2.0.2
// @jamsedu-component: jamsedu-index
import DomWatcher from './dom-watcher.js';
import EmbedPdfLoader from './embed-pdf.js';
import Katex from './katex.js';
import Mermaid from './mermaid.js';
import TinyDocument from './tiny-doc.js';
import TinyWysiwyg from './tiny-wysiwyg.js';

// Auto-initialize components
EmbedPdfLoader.autoInitialize();
Katex.autoInitialize();
Mermaid.autoInitialize();
TinyDocument.autoInitialize();
TinyWysiwyg.autoInitialize();

// Export class(es) for use in user code
export { DomWatcher };
