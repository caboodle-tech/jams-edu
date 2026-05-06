// @jamsedu-version: 1.1.0
// @jamsedu-component: js-theme-preference

/**
 * Early theme sync for `tokens/colors.css` (`html:has(input[name="theme-preference"]…)`).
 * Load as a blocking script in `head` without `defer` or `async`.
 * If `document.body` is not created yet, append to `document.head`; `html:has(…)` still matches.
 *
 * Creates `#theme-preference-sync` (hidden radio group) when absent.
 * Saving the choice from the visible `.theme-menu` runs in `main.js` (`localStorage` key `theme-preference`).
 */
(() => {
    const ALLOWED_VALUES = ['light', 'system', 'dark'];
    const ALLOWED = new Set(ALLOWED_VALUES);
    const syncContainerId = 'theme-preference-sync';

    let container = document.getElementById(syncContainerId);
    if (!container) {
        container = document.createElement('div');
        container.id = syncContainerId;
        container.hidden = true;
        container.setAttribute('aria-hidden', 'true');
        ALLOWED_VALUES.forEach((v) => {
            const input = document.createElement('input');
            input.type = 'radio';
            input.name = 'theme-preference';
            input.value = v;
            if (v === 'system') {
                input.checked = true;
            }
            container.appendChild(input);
        });
        const mount = document.body ?? document.head;
        if (mount) {
            mount.appendChild(container);
        }
    }

    let stored = null;
    try {
        stored = localStorage.getItem('theme-preference');
    } catch {
        /* ignore (e.g. disabled storage) */
    }
    const value = ALLOWED.has(stored) ? stored : 'system';
    const input = container.querySelector(`input[value="${value}"]`);
    if (input) {
        input.checked = true;
    }
})();
