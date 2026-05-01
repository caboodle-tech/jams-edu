// @jamsedu-version: 3.2.0
// @jamsedu-component: main-js

import { DomWatcher, initJamsEdu } from './jamsedu/index.js';
import './jamsedu/site-search.js';

/**
 * Change settings here. Only add keys you care about; everything else uses `defaultJamsEduConfig`
 * from `jamsedu/index.js`. Use `false` to turn a loader off (e.g. `katex: false`).
 *
 * @type {import('./jamsedu/index.js').JamsEduConfig}
 */
const jamsEduConfig = {
    // katex: false,
    // katex: { version: '0.16.11' },
    // mermaid: { version: '11.4.0', theme: 'dark' },
    // embedPdf: { minZoom: 0.5, maxZoom: 4, fullscreenProxy: false }
};

initJamsEdu(jamsEduConfig);

DomWatcher.watch(
    '.theme-menu',
    (elem) => {
        const labels = elem.querySelectorAll('label.theme-control');

        labels.forEach((label) => {
            label.addEventListener('click', (evt) => {
                evt.preventDefault();
                try {
                    localStorage.setItem('theme-preference', label.dataset.themePick);
                } catch {
                    /* ignore */
                }
                label.querySelector('input').checked = true;
                elem.open = false;
            });
        });
    },
    500
);

/**
 * `DomWatcher` is also on `window` (see `dom-watcher.js`).
 *
 * Example:
 *   DomWatcher.watch('.my-element', (element) => { console.log(element); });
 */
export { DomWatcher };
