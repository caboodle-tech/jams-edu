import JeAnchors from './je-anchor.js';
import JeSortable from './je-sortable.js';
import JeStripedTable from './je-striped-table.js';

const behaviors = [
    JeAnchors,
    JeSortable,
    JeStripedTable
];

export default {
    apply: (dom) => {
        behaviors.forEach((behavior) => {
            behavior(dom);
        });
    }
};
