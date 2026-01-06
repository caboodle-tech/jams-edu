const jamsTables = (scope) => {
    const tableNodes = scope.dom.findAllByTag('table');

    for (const tableNode of tableNodes) {
        const parent = tableNode.parent;
        if (!parent) continue;

        if (parent.type === 'tag-open' && parent.name === 'div' && parent.getAttribute('class') === 'table-container') {
            continue;
        }

        const [wrapperOpen] = tableNode.createNode('div', { class: 'table-container' });
        tableNode.insertBefore(wrapperOpen);
        wrapperOpen.appendChild(tableNode);
    }
};

export default jamsTables;
