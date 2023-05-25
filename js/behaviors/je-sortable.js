class JamsEduSortable {

    #EL;

    #header = null;

    #initialized = false;

    #order = null;

    #references = {
        rows: null,
        originalData: null
    };

    constructor(elem) {
        this.#EL = elem;
        if (this.#EL.nodeName !== 'TABLE') {
            this.connectedCallback = () => {};
            this.disconnectedCallback = () => {};
            return;
        }
    }

    #addSortIcons() {
        // Does this table have a thead tag?
        let header = this.#EL.querySelector('thead');
        if (header) {
            // Yes, now see if it contains a valid row.
            const rows = header.querySelectorAll('tr');
            header = this.#rowWithoutColspan(rows);
        }
        // If the thead tag is missing or invalid, do we have a tbody tag?
        if (!header) {
            header = this.#EL.querySelector('tbody');
            if (header) {
                // Yes, now see if it contains a valid row.
                header = this.#rowWithoutColspan([header.querySelector('tr')]);
            }
        }
        // If no valid header has been found yet try to use the first row.
        if (!header) {
            header = this.#rowWithoutColspan([this.#EL.querySelector('tr')]);
        }
        // If we still do not have a header this is an invalid table.
        if (!header) {
            console.warn('No valid table header was found, could not make table sortable.');
            return false;
        }
        // Keep a reference to the header.
        this.#header = header;
        // Add sort icons to each column in the header.
        for (let i = 0; i < header.children.length; i++) {
            const th = header.children[i];
            const options = {
                classes: 'icon sort',
                innerHTML: JamsEduIcons.get('sortAsc')
            };
            th.classList.add('text-left');
            th.addEventListener('click', this.#sort.bind(this));
            th.appendChild(JamsEdu.createElement('div', options));
        }
        return true;
    }

    castToAppropriateDataType(unknown = '') {
        const cleanedStr = unknown.replace(/[^0-9.-]+/g, '');

        // Check if the cleaned string represents a floating-point number
        if (/^-?\d+(\.\d+)?$/.test(cleanedStr)) {
            return parseFloat(cleanedStr);
        }

        // Check if the cleaned string represents an integer
        if (/^-?\d+$/.test(cleanedStr)) {
            return parseInt(cleanedStr, 10);
        }

        // Return the original string if no appropriate data type is found
        return unknown;
    }

    connectedCallback() {
        if (this.#initialized) { return; }
        if (!this.#addSortIcons()) { return; }
        this.#standardize();
        this.#initialized = true;
    }

    disconnectedCallback() {

    }

    #performSort(column) {
        const data = this.#references.originalData.map((arr) => {
            return arr.slice();
        });

        if (this.#order == 'ASC' || this.#order == 'DESC') {
            const originalColumn = data[column].slice().sort((a, b) => {
                a = this.castToAppropriateDataType(a);
                b = this.castToAppropriateDataType(b);
                if (typeof a == 'number' && typeof b == 'number') {
                    if (a < b) { return (this.#order == 'ASC') ? -1 : 1; }
                    if (a > b) { return (this.#order == 'ASC') ? 1 : -1; }
                    return 0;
                }
                let num = a.localeCompare(b);
                if (num == 0) { return 0; }
                return (this.#order == 'ASC') ? num : -1 * num;
            });

            // We need to build a map (order) or the original indexes accounting for dup values
            const indexMap = {};
            data[column].forEach((val, i) => {
                if (!(val in indexMap)) {
                    indexMap[val] = [];
                }
                indexMap[val].push(i);
            });

            // Now compare the original and sorted arrays to deduce where everything was moved
            const newIndices = [];
            originalColumn.forEach((val) => {
                const originalIndices = indexMap[val];
                newIndices.push(originalIndices.shift());
            });

            // Now sort all the data accordingly
            for (let i = 0; i < data.length; i++) {
                if (i == column) {
                    data[i] = originalColumn;
                    continue;
                }
                const newArray = [];
                newIndices.forEach((ni) => {
                    newArray.push(data[i][ni]);
                });
                data[i] = newArray;
            }
        }

        this.#references.rows.forEach((row, ri) => {
            for (let i = 0; i < row.cells.length; i++) {
                row.cells[i].innerText = data[i][ri];
            }
        });
    }

    #rowWithoutColspan(rows) {
        let header = null;
        for (let i = 0; i < rows.length; i++) {
            if (!rows[i].querySelector('[colspan]')) {
                header = rows[i];
                break;
            }
        }
        return header;
    }

    
    #sort(evt) {
        if(!evt.target) { return; };
        const table = evt.target.closest('table');
        const tr = evt.target.closest('tr');

        tr.querySelector('.icon.sort.selected')?.classList.remove('selected');

        switch(this.#order) {
            case 'DESC':
                this.#order = null;
                this.#header.querySelectorAll('.icon.sort').forEach((icon) => {
                    icon.innerHTML = '';
                });
                break;
            case 'ASC':
                this.#order = 'DESC';
                this.#header.querySelectorAll('.icon.sort').forEach((icon) => {
                    icon.innerHTML = JamsEduIcons.get('sortDesc');
                });
                break;
            default:
                this.#order = 'ASC';
                this.#header.querySelectorAll('.icon.sort').forEach((icon) => {
                    icon.innerHTML = JamsEduIcons.get('sortAsc');
                });
        }

        let cell = evt.target;
        while (cell.nodeName != 'TD' && cell.nodeName != 'TH') {
            cell = cell.parentElement;
            if (cell === null) { return }
        }

        if (this.#order) {
            cell.querySelector('.icon.sort').classList.add('selected');
        }

        const column = Array.from(tr.cells).indexOf(cell);

        if (this.#references.originalData) {
            this.#performSort(column);
            return;
        }

        let body = table.querySelector('tbody');
        let rows;
        if (!body) {
            body = table;
            rows = body.querySelectorAll('tr').slice(1);
        } else {
            rows = body.querySelectorAll('tr');
        }

        const columns = [];

        const columnCount = rows[0].cells.length;
        
        for(let c = 0; c < columnCount; c++) {
            const columnData = [];
            for(let r = 0; r < rows.length; r++) {
                columnData.push(rows[r].cells[c].innerText);
            }
            columns.push(columnData);
        }

        this.#references.rows = rows;
        this.#references.originalData = columns;

        this.#performSort(column);

        // TODO: Save a ref to the original table structure
        // TODO: Add flag so we don't process table again???
        // TODO: Sort the columns and then display them
    }

    #standardize() {
        let parent = this.#EL.querySelector('tbody');
        if (!parent) {
            parent = this.#EL;
        }

        const colspans = parent.querySelectorAll('td[colspan]');
        if (colspans.length > 0) {
            colspans.forEach((td) => {
                let span = parseInt(td.getAttribute('colspan')) - 1;
                td.removeAttribute('colspan');
                while (span > 0) {
                    const newTd = document.createElement('td');
                    newTd.innerHTML = td.innerText;
                    td.insertAdjacentElement('afterend', newTd)
                    span--;
                }
            });
        }

        const rowspans = parent.querySelectorAll('td[rowspan]');
        if (rowspans.length > 0) {
            rowspans.forEach((td) => {
                let span = parseInt(td.getAttribute('rowspan')) - 1;
                let row = td.closest('tr');
                const cellIndex = Array.prototype.indexOf.call(row.cells, td);
                td.removeAttribute('rowspan');
                while (span > 0) {
                    row = row.nextElementSibling;
                    const newTd = document.createElement('td');
                    newTd.innerHTML = td.innerText;
                    row.insertBefore(newTd, row.cells[cellIndex]);
                    span--;
                }
            });
        }
    }

}

elementBehaviors.define('je-sortable', JamsEduSortable);