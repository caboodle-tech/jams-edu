const JamsTables = (scope) => {
    // console.log(scope.dom.visualize());
    // Find all table tags
    const tableNodes = scope.dom.findAllByTag('table');

    for (const tableNode of tableNodes) {
        const wrapperOpen = scope.dom.createNode('tag-open', 'div', { class: 'table-container' });
        // const wrapperClose = scope.dom.createNode('tag-close', 'div');

        tableNode.replaceWith(wrapperOpen);
        wrapperOpen.appendChild(tableNode);
    }
};

export default JamsTables;
