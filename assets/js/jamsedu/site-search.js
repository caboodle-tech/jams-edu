/**
 * Wires the header search panel to a dedicated worker that loads `sitemap.json` once per tab.
 * Queries debounce while typing; Enter submits the form and runs immediately (skips the debounce wait).
 */

const DEBOUNCE_MS = 220;

/** @type {Worker | null} */
let worker = null;

/** @type {number | null} */
let debounceTimer = null;

/** @type {(q: string, page: number) => void} */
let postWorkerSearch = () => {};

const getWorker = () => {
    if (worker) {
        return worker;
    }
    const url = new URL('./site-search-worker.js', import.meta.url);
    worker = new Worker(url, { type: 'module' });
    worker.addEventListener('message', (evt) => {
        const data = evt.data || {};
        if (data.type === 'results') {
            const el = document.getElementById('site-search-results');
            if (el) {
                const qResolved = typeof data.q === 'string' ? data.q.trim() : '';
                const items = Array.isArray(data.items) ? data.items : [];
                const page = typeof data.page === 'number' ? data.page : 0;
                const total = typeof data.total === 'number' ? data.total : 0;
                const totalPages = typeof data.totalPages === 'number' ? data.totalPages : 0;
                renderResults(el, items, qResolved, {
                    page,
                    total,
                    totalPages
                }, (nextPage) => {
                    postWorkerSearch(qResolved, nextPage);
                });
            }
        }
    });
    return worker;
};

const disposeWorker = () => {
    if (debounceTimer !== null) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
    }
    if (worker) {
        worker.terminate();
        worker = null;
    }
};

/**
 * @param {HTMLElement} resultsEl
 * @param {{ u: string; t: string; s: string }[]} items
 * @param {string} trimmedQuery
 * @param {{ page: number; total: number; totalPages: number }} pagination
 * @param {(nextPage: number) => void} goToPage
 */
const renderResults = (resultsEl, items, trimmedQuery, pagination, goToPage) => {
    resultsEl.innerHTML = '';
    if (!trimmedQuery) {
        return;
    }
    if (items.length === 0) {
        const p = document.createElement('p');
        p.className = 'site-search-empty';
        p.textContent = 'No matches found.';
        resultsEl.appendChild(p);
        return;
    }
    const ul = document.createElement('ul');
    ul.className = 'site-search-results-list';
    for (const it of items) {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = it.u.startsWith('/') ? it.u : `/${it.u}`;
        const title = it.t || it.u;
        a.textContent = title;
        li.appendChild(a);
        if (it.s) {
            const sn = document.createElement('p');
            sn.className = 'site-search-snippet';
            sn.textContent = it.s;
            li.appendChild(sn);
        }
        ul.appendChild(li);
    }
    resultsEl.appendChild(ul);

    if (pagination.totalPages > 1) {
        const nav = document.createElement('nav');
        nav.className = 'site-search-pagination';
        nav.setAttribute('aria-label', 'Search results pages');

        const prev = document.createElement('button');
        prev.type = 'button';
        prev.className = 'site-search-page-btn';
        prev.textContent = 'Previous';
        prev.disabled = pagination.page <= 0;
        prev.addEventListener('click', () => {
            goToPage(pagination.page - 1);
        });

        const status = document.createElement('span');
        status.className = 'site-search-page-status';
        const humanPage = pagination.page + 1;
        status.textContent = `Page ${humanPage} of ${pagination.totalPages} (${pagination.total} results)`;

        const nextBtn = document.createElement('button');
        nextBtn.type = 'button';
        nextBtn.className = 'site-search-page-btn';
        nextBtn.textContent = 'Next';
        nextBtn.disabled = pagination.page >= pagination.totalPages - 1;
        nextBtn.addEventListener('click', () => {
            goToPage(pagination.page + 1);
        });

        nav.appendChild(prev);
        nav.appendChild(status);
        nav.appendChild(nextBtn);
        resultsEl.appendChild(nav);
    }
};

const wireSiteSearch = () => {
    const panel = document.getElementById('site-search-panel');
    const toggle = document.getElementById('site-search-toggle');
    const input = document.getElementById('site-search-query');
    const resultsEl = document.getElementById('site-search-results');
    if (!panel || !toggle || !input || !resultsEl) {
        return;
    }

    postWorkerSearch = (q, page) => {
        const w = getWorker();
        w.postMessage({
            page,
            q,
            type: 'search'
        });
    };

    const requestIndex = () => {
        const w = getWorker();
        w.postMessage({ type: 'ensureIndex' });
    };

    const runSearch = () => {
        const q = input.value.trim();
        if (!q) {
            resultsEl.innerHTML = '';
            return;
        }
        postWorkerSearch(q, 0);
    };

    const scheduleSearch = () => {
        if (debounceTimer !== null) {
            clearTimeout(debounceTimer);
        }
        debounceTimer = window.setTimeout(() => {
            debounceTimer = null;
            runSearch();
        }, DEBOUNCE_MS);
    };

    toggle.addEventListener('change', () => {
        if (toggle.checked) {
            requestIndex();
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    input.focus({ preventScroll: true });
                });
            });
        }
    });

    input.addEventListener('focus', () => {
        requestIndex();
    });

    input.addEventListener('input', () => {
        scheduleSearch();
    });

    const form = panel.querySelector('form[role="search"]');
    if (form) {
        form.addEventListener('submit', (evt) => {
            evt.preventDefault();
            if (debounceTimer !== null) {
                clearTimeout(debounceTimer);
                debounceTimer = null;
            }
            runSearch();
        });
    }

    window.addEventListener('pagehide', disposeWorker);
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wireSiteSearch);
} else {
    wireSiteSearch();
}
