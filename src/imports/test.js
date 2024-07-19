import HtmlSom from './html-som.js';

const html = `
<head>
    <title>
        <slot>A</slot>
    </title>
    <slot>B</slot>
    <slot merge>C</slot>
    </div>
</head>
`;

const rec = (som) => {
    som.forEach((node, key) => {
        if (node.children.size > 0) {
            rec(node.children);
        } else {
            console.log(node);
        }
        console.log('----------------------------------');
    });
};

export default () => {
    const som = new HtmlSom(html);

    // rec(som.getStructure().som);

    const results = som.findAll('slot');

    console.log('Matches', results.length);
    // results.forEach((node) => {
    //     console.log(node);
    // });
};
