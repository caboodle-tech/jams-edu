const jamsEduBlockquotes = (scope) => {
    const blockquotes = scope.dom.querySelectorAll('blockquote');
    blockquotes.forEach((blockquote) => {
        const link = blockquote.getAttribute('cite');
        if (!link) {
            return;
        }

        const cite = blockquote.querySelector('cite');
        if (!cite) {
            return;
        }

        cite.innerHTML = `<a href="${link}" target="_blank" rel="noreferrer"> ${cite.innerHTML.trim()}</a>`;
    });
};

export default jamsEduBlockquotes;
