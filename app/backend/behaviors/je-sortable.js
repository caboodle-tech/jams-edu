export default (dom) => {
    dom.querySelectorAll('table[sortable]').forEach((elem) => {
        // Remove the shorthand attribute tag.
        elem.removeAttribute('sortable');
        // Save any existing has attributes.
        const existing = elem.getAttribute('has') || '';
        // Add proper has attribute.
        elem.setAttribute('has', `${existing} je-sortable`.trim());
    });
};
