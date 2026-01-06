export const rootRelativeToRelativeUrls = (scope) => {
    const urlWithProtocol = /^(?:http|https|ftp|mailto|tel|data):/i;

    // Process root-relative URLs in the DOM
    if (scope.relPath !== null) {
        for (const node of scope.dom) {
            if (node.type === 'tag-open' && node.name !== 'pre') {
                // Check each attribute for URL patterns
                for (const [attr, value] of Object.entries(node.attributes)) {
                    // Skip URLs that are protocol-relative or absolute
                    if (value.startsWith('/') &&
                        !value.startsWith('//') &&
                        !urlWithProtocol.test(value)) {
                        const relPath = scope.relPath === '' ? './' : scope.relPath;
                        node.attributes[attr] = `${relPath}${value.slice(1)}`;
                    }
                }
            }
        }
    }
};

export const removeEmptyLines = (scope) => {
    const reduceMultipleNewlines = /\n\s*\n/g;

    // Remove empty lines that are not inside pre tags
    let inPreTag = false;
    for (const node of scope.dom) {
        // Track when we enter/exit pre tags
        if (node.type === 'tag-open' && node.name === 'pre') {
            inPreTag = true;
        } else if (node.type === 'tag-close' && node.name === 'pre') {
            inPreTag = false;
        }

        // Only process text nodes outside pre tags
        if (!inPreTag) {
            if (node.type === 'text') {
                node.content = node.content.replace(reduceMultipleNewlines, '\n');
            }
        }
    }
};

export const removeAllComments = (scope) => {
    // Remove all code comments first; potentially shortens the code significantly
    scope.dom.findAllByType('comment').forEach((comment) => {
        comment.remove();
    });
};