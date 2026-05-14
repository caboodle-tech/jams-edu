import assert from 'node:assert/strict';
import test from 'node:test';
import { SimpleHtmlParser } from '@caboodle-tech/jhp/simple-html-parser';
import jamsEduExternalLinks from '../src/imports/jamsedu-hooks/external-links.js';

/**
 * @param {{ getAttribute: (n: string) => unknown }} el
 * @param {string} name
 * @returns {string | null}
 */
const attr = (el, name) => {
    const v = el.getAttribute(name);
    return v == null ? null : v;
};

/**
 * @param {string} innerHtml
 * @returns {object}
 */
const parseBody = (innerHtml) => {
    const parser = new SimpleHtmlParser();
    return parser.parse(`<!DOCTYPE html><html><body>${innerHtml}</body></html>`);
};

test('adds target and rel for https, http, and protocol-relative URLs', () => {
    const dom = parseBody(
        `<a id="x" href="https://a.example/">x</a>` +
            `<a id="y" href="http://b.example/">y</a>` +
            `<a id="z" href="//c.example/path">z</a>`
    );
    jamsEduExternalLinks({ dom });
    for (const id of ['x', 'y', 'z']) {
        const a = dom.querySelector(`#${id}`);
        assert.equal(attr(a, 'target'), '_blank');
        assert.match(attr(a, 'rel') || '', /noopener/);
        assert.match(attr(a, 'rel') || '', /noreferrer/);
    }
});

test('does not change internal or fragment-only hrefs', () => {
    const dom = parseBody(
        `<a id="r" href="/features/">r</a>` +
            `<a id="d" href="./doc.html">d</a>` +
            `<a id="u" href="../up.html">u</a>` +
            `<a id="h" href="#section">h</a>`
    );
    jamsEduExternalLinks({ dom });
    for (const id of ['r', 'd', 'u', 'h']) {
        const a = dom.querySelector(`#${id}`);
        assert.equal(attr(a, 'target'), null);
        assert.equal(attr(a, 'rel'), null);
    }
});

test('skips mailto, tel, javascript, and data URLs', () => {
    const dom = parseBody(
        `<a id="m" href="mailto:a@b.co">m</a>` +
            `<a id="t" href="tel:+1">t</a>` +
            `<a id="j" href="javascript:void(0)">j</a>` +
            `<a id="d" href="data:text/plain,hi">d</a>`
    );
    jamsEduExternalLinks({ dom });
    for (const id of ['m', 't', 'j', 'd']) {
        const a = dom.querySelector(`#${id}`);
        assert.equal(attr(a, 'target'), null);
    }
});

test('does not override a non-blank existing target', () => {
    const dom = parseBody(`<a id="s" href="https://x.example/" target="_self">s</a>`);
    jamsEduExternalLinks({ dom });
    const a = dom.querySelector('#s');
    assert.equal(attr(a, 'target'), '_self');
    assert.equal(attr(a, 'rel'), null);
});

test('merges rel when target is already _blank', () => {
    const dom = parseBody(
        `<a id="b" href="https://x.example/" target="_blank">b</a>` +
            `<a id="f" href="https://y.example/" target="_blank" rel="nofollow">f</a>`
    );
    jamsEduExternalLinks({ dom });
    const b = dom.querySelector('#b');
    assert.equal(attr(b, 'target'), '_blank');
    assert.equal(attr(b, 'rel'), 'noopener noreferrer');
    const f = dom.querySelector('#f');
    assert.equal(attr(f, 'target'), '_blank');
    const rel = attr(f, 'rel') || '';
    assert.match(rel, /nofollow/);
    assert.match(rel, /noopener/);
    assert.match(rel, /noreferrer/);
});

test('skips ftp scheme', () => {
    const dom = parseBody(`<a id="f" href="ftp://host/file">f</a>`);
    jamsEduExternalLinks({ dom });
    const a = dom.querySelector('#f');
    assert.equal(attr(a, 'target'), null);
});

test('skips sms and vbscript schemes', () => {
    const dom = parseBody(
        `<a id="s" href="sms:+15551212">s</a>` + `<a id="v" href="vbscript:msgbox(1)">v</a>`
    );
    jamsEduExternalLinks({ dom });
    assert.equal(attr(dom.querySelector('#s'), 'target'), null);
    assert.equal(attr(dom.querySelector('#v'), 'target'), null);
});

test('treats uppercase HTTPS and spaced href as external', () => {
    const dom = parseBody(
        `<a id="u" href="HTTPS://UP.EXAMPLE/">u</a>` +
            `<a id="w" href="  https://spaced.example/path  ">w</a>`
    );
    jamsEduExternalLinks({ dom });
    assert.equal(attr(dom.querySelector('#u'), 'target'), '_blank');
    assert.equal(attr(dom.querySelector('#w'), 'target'), '_blank');
});

test('treats external URL with hash as external', () => {
    const dom = parseBody(`<a id="h" href="https://ex.example/doc#frag">h</a>`);
    jamsEduExternalLinks({ dom });
    const a = dom.querySelector('#h');
    assert.equal(attr(a, 'target'), '_blank');
});

test('empty target attribute is treated like unset and gets _blank', () => {
    const dom = parseBody(`<a id="e" href="https://x.example/" target="">e</a>`);
    jamsEduExternalLinks({ dom });
    const a = dom.querySelector('#e');
    assert.equal(attr(a, 'target'), '_blank');
    assert.match(attr(a, 'rel') || '', /noopener/);
});

test('external link with rel noopener noreferrer gains target without duplicating rel tokens', () => {
    const dom = parseBody(
        `<a id="r" href="https://x.example/" rel="noopener noreferrer">r</a>`
    );
    jamsEduExternalLinks({ dom });
    const a = dom.querySelector('#r');
    assert.equal(attr(a, 'target'), '_blank');
    assert.equal(attr(a, 'rel'), 'noopener noreferrer');
});

test('case-insensitive blocked javascript scheme', () => {
    const dom = parseBody(`<a id="j" href="JavaScript:alert(1)">j</a>`);
    jamsEduExternalLinks({ dom });
    assert.equal(attr(dom.querySelector('#j'), 'target'), null);
});
