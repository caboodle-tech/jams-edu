export default (dom) => {
    dom.querySelectorAll('[anchor]').forEach((elem) => {
        // Remove the shorthand attribute tag.
        elem.removeAttribute('anchor');
        // Save any existing has attributes.
        const existing = elem.getAttribute('has') || '';
        // Add proper has attribute.
        elem.setAttribute('has', `${existing} je-anchor`.trim());
    });
};
