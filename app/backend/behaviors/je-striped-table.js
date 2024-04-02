export default (dom) => {
    dom.querySelectorAll('table[striped]').forEach((elem) => {
        // Remove the shorthand attribute tag.
        elem.removeAttribute('striped');
        // Save any existing has attributes.
        const existing = elem.getAttribute('has') || '';
        // Add proper has attribute.
        elem.setAttribute('has', `${existing} je-striped`.trim());
    });
};
