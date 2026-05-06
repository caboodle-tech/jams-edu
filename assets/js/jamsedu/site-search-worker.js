/**
 * Site search worker: loads `sitemap.json` once per worker lifetime, ranks pages in this thread.
 */

const PAGE_SIZE = 25;

/** @type {{ p: Array<{ u: string; t: string; d: string; k: string; h: string[]; s: string; m: number }> } | null} */
let index = null;

/** @type {Promise<void> | null} */
let loadPromise = null;

const tokenize = (q) => {
    return q
        .toLowerCase()
        .split(/\s+/u)
        .map((t) => {
            return t.trim();
        })
        .filter(Boolean);
};

/**
 * @param {string} q
 * @param {{ u: string; t: string; d: string; k: string; h: string[]; s: string }} row
 * @returns {number}
 */
const scoreRow = (q, row) => {
    const tokens = tokenize(q);
    if (tokens.length === 0) {
        return 0;
    }
    const hay = [
        row.t,
        row.d,
        row.k,
        row.s,
        Array.isArray(row.h) ? row.h.join(' ') : ''
    ]
        .join(' ')
        .toLowerCase();
    let score = 0;
    for (const tok of tokens) {
        if (tok) {
            if (row.t.toLowerCase().includes(tok)) {
                score += 6;
            }
            if (hay.includes(tok)) {
                score += 3;
            }
        }
    }
    return score;
};

const ensureLoaded = async() => {
    if (index) {
        return;
    }
    if (!loadPromise) {
        loadPromise = (async() => {
            const res = await fetch('/sitemap.json', { credentials: 'same-origin' });
            if (!res.ok) {
                index = { p: [] };
                return;
            }
            const data = await res.json();
            index = data && Array.isArray(data.p) ? data : { p: [] };
        })();
    }
    await loadPromise;
};

self.addEventListener('message', (evt) => {
    const msg = evt.data || {};
    if (msg.type === 'ensureIndex') {
        void (async() => {
            try {
                await ensureLoaded();
                self.postMessage({ type: 'ready' });
            } catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                self.postMessage({ type: 'error', message });
            }
        })();
        return;
    }
    if (msg.type === 'search') {
        const q = typeof msg.q === 'string' ? msg.q : '';
        const pageRaw = msg.page;
        let page = typeof pageRaw === 'number' && Number.isFinite(pageRaw) ?
            Math.floor(pageRaw) :
            parseInt(String(pageRaw), 10);
        if (Number.isNaN(page) || page < 0) {
            page = 0;
        }
        void (async() => {
            try {
                await ensureLoaded();
                const rows = index?.p ?? [];
                const rankedAll = rows
                    .map((row) => {
                        return { row, score: scoreRow(q, row) };
                    })
                    .filter((x) => {
                        return x.score > 0;
                    })
                    .sort((a, b) => {
                        return b.score - a.score || a.row.t.localeCompare(b.row.t);
                    });
                const total = rankedAll.length;
                const totalPages = total === 0 ? 0 : Math.ceil(total / PAGE_SIZE);
                const lastPage = totalPages > 0 ? totalPages - 1 : 0;
                const pageIdx = totalPages > 0 ? Math.min(page, lastPage) : 0;
                const start = pageIdx * PAGE_SIZE;
                const slice = rankedAll.slice(start, start + PAGE_SIZE).map((x) => {
                    return { u: x.row.u, t: x.row.t, s: x.row.s };
                });
                self.postMessage({
                    items: slice,
                    page: pageIdx,
                    pageSize: PAGE_SIZE,
                    q,
                    total,
                    totalPages,
                    type: 'results'
                });
            } catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                self.postMessage({ type: 'error', message });
            }
        })();
    }
});
