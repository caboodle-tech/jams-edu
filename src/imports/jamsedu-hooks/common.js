const REGEX = {
    multipleNewlines: /\n\s*\n/g
};

export const rootRelativeToRelativeUrls = (scope) => {
    const urlWithProtocol = /^(?:http|https|ftp|mailto|tel|data):/i;

    if (scope.relPath !== null) {
        for (const node of scope.dom) {
            if (node.type === 'tag-open' && node.name !== 'pre') {
                for (const [attr, value] of Object.entries(node.attributes)) {
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
    let inPreTag = false;
    for (const node of scope.dom) {
        if (node.type === 'tag-open' && node.name === 'pre') {
            inPreTag = true;
        } else if (node.type === 'tag-close' && node.name === 'pre') {
            inPreTag = false;
        }

        if (!inPreTag && node.type === 'text') {
            node.content = node.content.replace(REGEX.multipleNewlines, '\n');
        }
    }
};

export const removeAllComments = (scope) => {
    scope.dom.findAllByType('comment').forEach((comment) => {
        comment.remove();
    });
};