/**
 * Site search worker: loads `sitemap.json` once per worker lifetime, ranks pages in this thread.
 */

const PAGE_SIZE = 25;

const MAX_SITEMAP_PREFIX_SEGMENTS = 3;

/** @type {{ p: Array<{ u: string; t: string; d: string; k: string; h: string[]; s: string; m: number }> } | null} */
let index = null;

/** @type {Promise<void> | null} */
let loadPromise = null;

/**
 * @param {string[]} candidates
 * @returns {Promise<Response | null>}
 */
const fetchFirstOk = async(candidates) => {
    for (const href of candidates) {
        try {
            const res = await fetch(href, { credentials: 'same-origin' });
            if (res.ok) {
                return res;
            }
        } catch {
            // try next candidate
        }
    }
    return null;
};

/**
 * @param {string[]} out
 * @param {Set<string>} seen
 * @param {string} href
 */
const pushCandidate = (out, seen, href) => {
    if (!href || seen.has(href)) {
        return;
    }
    seen.add(href);
    out.push(href);
};

/**
 * @param {Record<string, unknown>} msg
 * @returns {string[]}
 */
const buildSitemapCandidates = (msg) => {
    const out = [];
    const seen = new Set();
    const explicit = typeof msg.sitemapUrl === 'string' ? msg.sitemapUrl.trim() : '';
    if (explicit) {
        try {
            pushCandidate(out, seen, new URL(explicit).href);
        } catch {
            // invalid explicit URL
        }
    }
    const probeStrRaw = typeof msg.probeBaseUrl === 'string' ? msg.probeBaseUrl.trim() : '';
    const pageHrefRaw = typeof msg.pageHref === 'string' ? msg.pageHref.trim() : '';
    const probeStr = probeStrRaw || pageHrefRaw;
    if (!probeStr) {
        return out;
    }
    let probeUrl;
    try {
        probeUrl = new URL(probeStr);
    } catch {
        return out;
    }
    if (probeUrl.protocol !== 'http:' && probeUrl.protocol !== 'https:') {
        return out;
    }
    const { origin, pathname } = probeUrl;
    pushCandidate(out, seen, `${origin}/sitemap.json`);
    try {
        pushCandidate(out, seen, new URL('sitemap.json', probeUrl).href);
    } catch {
        // ignore
    }
    const parts = pathname.split('/').filter(Boolean);
    if (parts.length === 0) {
        return out;
    }
    const dirSegs = parts.slice(0, -1);
    const cap = Math.min(MAX_SITEMAP_PREFIX_SEGMENTS, dirSegs.length);
    for (let k = 1; k <= cap; k++) {
        const prefix = dirSegs.slice(0, k).join('/');
        pushCandidate(out, seen, `${origin}/${prefix}/sitemap.json`);
    }
    return out;
};

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

/**
 * @param {Record<string, unknown>} msg
 */
const ensureLoaded = async(msg) => {
    if (index) {
        return;
    }
    if (!loadPromise) {
        const loadMsg = msg;
        loadPromise = (async() => {
            const candidates = buildSitemapCandidates(loadMsg);
            const res = candidates.length > 0 ? await fetchFirstOk(candidates) : null;
            if (!res) {
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
                await ensureLoaded(msg);
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
                await ensureLoaded(msg);
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
