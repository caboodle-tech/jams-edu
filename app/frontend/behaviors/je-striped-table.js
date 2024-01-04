export default () => {
    class JamsEduStripedTable {

        #elem;

        #initialized = false;

        constructor(elem) {
            this.#elem = elem;
        }

        connectedCallback() {
            if (this.#initialized) { return; } // Do not reprocess a table that was moved in the DOM.
            this.#stripeTable();
            this.#initialized = true;
        }

        #stripeTable() {
            const tbody = this.#elem.querySelector('tbody');
            let rows;
            if (tbody) {
                rows = tbody.querySelectorAll('tr');
            } else {
                rows = this.#elem.querySelectorAll('tr');
            }
            rows.forEach((row, i) => {
                if (i % 2 === 0) {
                    row.classList.add('odd');
                    return;
                }
                row.classList.add('even');
            });
        }

    }

    elementBehaviors.define('je-striped', JamsEduStripedTable);
};
