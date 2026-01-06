// @jamsedu-version: 1.0.0
// @jamsedu-component: jamsedu-index
import DomWatcher from './dom-watcher.js';
import TinyDocument from './tiny-doc.js';
import TinyWysiwyg from './tiny-wysiwyg.js';

// Auto-initialize components
TinyDocument.autoInitialize();
TinyWysiwyg.autoInitialize();

// Export classes for use in user code
export { DomWatcher, TinyDocument, TinyWysiwyg };