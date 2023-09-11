class JamsEduSortable {

    #EL;

    #header = null;

    #initialized = false;

    #sortableRegion = {
        cells: [],
        columnCount: 0,
        columns: [],
        rowRef: []
    };

    constructor(elem) {
        this.#EL = elem;
        // Do not allow this behavior to run on non-table elements.
        if (this.#EL.nodeName !== 'TABLE') {
            this.connectedCallback = () => {};
            this.disconnectedCallback = () => {};

        }
    }

    #addSortIcons() {
        let header = this.#EL.querySelector('thead');
        if (header) {
            // If this table has a proper thead tag use it's tr as the header row.
            const rows = header.querySelectorAll('tr');
            header = this.#rowWithoutColspan(rows);
        }
        if (!header) {
            header = this.#EL.querySelector('tbody');
            if (header) {
                // If we could not locate a valid thead tag try the first row in the tbody.
                header = this.#rowWithoutColspan([header.querySelector('tr')]);
            }
        }
        // If no valid header has been found yet attempt to use the first row we find.
        if (!header) {
            header = this.#rowWithoutColspan([this.#EL.querySelector('tr')]);
        }
        // If we still do not have a header this is an invalid table.
        if (!header) {
            console.warn(
                'No valid table header was found, could not make table sortable.'
            );
            return false;
        }
        // Keep a reference to the header.
        this.#header = header;
        // Add sort icons to each column in the header.
        for (let i = 0; i < header.children.length; i++) {
            const th = header.children[i];
            const options = {
                classes: 'icon sort',
                innerHTML: JamsEduIcon.get('sort')
            };
            th.classList.add('text-left');
            th.addEventListener('click', this.#sort.bind(this));
            th.appendChild(JamsEdu.createElement('div', options));
        }
        return true;
    }

    castToAppropriateDataType(unknown = '') {
        const trimmedStr = unknown.trim();
        const cleanedStr = trimmedStr.replace(/[^0-9.-]+/g, '');

        // Check if the original string is a boolean.
        if (trimmedStr.toUpperCase === 'TRUE') {
            return true;
        }
        if (trimmedStr.toUpperCase === 'FALSE') {
            return false;
        }

        // Check if the cleaned string represents a floating-point number.
        if (/^-?\d+(\.\d+)?$/.test(cleanedStr)) {
            return parseFloat(cleanedStr);
        }

        // Check if the cleaned string represents an integer; or boolean in int form.
        if (/^-?\d+$/.test(cleanedStr)) {
            return parseInt(cleanedStr, 10);
        }

        // Return the original string if no appropriate data type is found.
        return unknown;
    }

    connectedCallback() {
        if (this.#initialized) { return; } // Do not reprocess a table that was moved in the DOM.
        if (!this.#addSortIcons()) { return; }
        this.#standardize();
        this.#initialized = true;
    }

    disconnectedCallback() {}

    #getColumnsFromCells(rowLen, colLen, cells) {
        const maxCells = rowLen * colLen;
        const columns = [];
        for (let curCol = 0; curCol < colLen; curCol++) {
            const group = [cells[curCol]];
            for (let jump = curCol + colLen; jump < maxCells; jump += colLen) {
                group.push(cells[jump]);
            }
            columns.push(group);
        }
        return columns;
    }

    #performSort(columnNumber, order) {

        if (order === 'ASC' || order === 'DESC') {
            const originalColumn = this.#sortableRegion.columns[columnNumber];
            const colToSortCopy = originalColumn.map((val) => val);

            const sortFunc = (a, b) => {
                a = this.castToAppropriateDataType(a);
                b = this.castToAppropriateDataType(b);
                if (typeof a === 'number' && typeof b === 'number') {
                    if (a < b) {
                        return order === 'ASC' ? -1 : 1;
                    }
                    if (a > b) {
                        return order === 'ASC' ? 1 : -1;
                    }
                    return 0;
                }
                const num = a.localeCompare(b);
                if (num === 0) {
                    return 0;
                }
                return order === 'ASC' ? num : -1 * num;
            };

            colToSortCopy.sort(sortFunc);

            // We need to build a map (order) or the original indexes accounting for dup values
            const indexMap = {};
            originalColumn.forEach((val, i) => {
                if (!(val in indexMap)) {
                    indexMap[val] = [];
                }
                indexMap[val].push(i);
            });

            // Now compare the original and sorted arrays to deduce where everything was moved
            const newIndices = [];
            colToSortCopy.forEach((val) => {
                const originalIndices = indexMap[val];
                newIndices.push(originalIndices.shift());
            });

            // Now sort all the data accordingly
            this.#sortableRegion.columns[columnNumber] = colToSortCopy;
            this.#sortableRegion.columns.forEach((col, colNum) => {
                if (columnNumber === colNum) { return; }
                const reordered = [];
                newIndices.forEach((index) => {
                    reordered.push(col[index]);
                });
                this.#sortableRegion.columns[colNum] = reordered;
            });

        } else {
            this.#sortableRegion.columns = this.#getColumnsFromCells(
                this.#sortableRegion.rowRef.length,
                this.#sortableRegion.columnCount,
                this.#sortableRegion.cells
            );
        }

        // Update the table with the newly sorted data.
        this.#sortableRegion.rowRef.forEach((row, rowNum) => {
            Array.from(row.cells).forEach((td, tdNum) => {
                td.innerText = this.#sortableRegion.columns[tdNum][rowNum];
            });
        });
    }

    /**
     * Find the first row in a table that does not contain a colspan in it.
     *
     * @param {array} rows An array of rows to check.
     * @returns A table row with no colspans or null if none were found.
     */
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
        if (!evt.target) {
            return;
        }

        // Locate the column (td or th) that the user is trying to sort.
        let column = evt.target;
        while (column.nodeName !== 'TD' && column.nodeName !== 'TH') {
            column = column.parentElement;
            if (column === null) {
                return;
            }
        }

        // Remove the previous selected class (tag) even if it is the same column.
        this.#header.querySelector('.icon.sort.selected')?.classList.remove('selected');

        // Determine what sort should be done and update the sort icons.
        const icon = column.querySelector('.icon.sort');
        let sort = '';
        if (column.dataset.jeSort === 'ASC') {
            column.dataset.jeSort = 'DESC';
            sort = 'DESC';
            icon.innerHTML = JamsEduIcon.get('sortDesc');
            icon.classList.add('selected');
        } else if (column.dataset.jeSort === 'DESC') {
            delete column.dataset.jeSort;
            icon.innerHTML = JamsEduIcon.get('sort');
        } else {
            column.dataset.jeSort = 'ASC';
            sort = 'ASC';
            icon.innerHTML = JamsEduIcon.get('sortAsc');
            icon.classList.add('selected');
        }

        // Reset the icon in a previous sorted column if the user switches columns.
        this.#header.querySelectorAll('[data-je-sort]').forEach((oldSortedColumn) => {
            if (oldSortedColumn === column) { return; }
            delete oldSortedColumn.dataset.jeSort;
            oldSortedColumn.querySelector('.icon.sort').innerHTML = JamsEduIcon.get('sort');
        });

        // const column = Array.from(this.#header.cells).indexOf(cell);

        // if (this.#references.originalData) {
        //     this.#performSort(column);
        //     return;
        // }

        if (this.#sortableRegion.columnCount > 0) {
            this.#performSort(column.cellIndex, sort);
            return;
        }

        const table = evt.target.closest('table');

        let body = table.querySelector('tbody');
        let rows;
        if (!body) {
            body = table;
            rows = body.querySelectorAll('tr').slice(1);
        } else {
            rows = body.querySelectorAll('tr');
        }

        const cells = [];
        let columnCount = 0;
        rows.forEach((row) => {
            if (row.cells.length > columnCount) { columnCount = row.cells.length; }
            Array.from(row.cells).forEach((cell) => {
                cells.push(cell.innerText);
            });
        });

        const columns = this.#getColumnsFromCells(rows.length, columnCount, cells);

        // for (let cell_num = 0; cell_num < cells.length; cell_num += columnCount) {
        //     console.log(cell_num);
        //     const group = [];
        //     for (let col_num = 0; col_num < columnCount; col_num++) {
        //         group.push(cells[cell_num + col_num]);
        //     }
        //     columns.push(group);
        // }

        this.#sortableRegion = {
            cells, columns, columnCount, rowRef: rows
        };

        // const columns = [];

        // const columnCount = rows[0].cells.length;

        // for (let c = 0; c < columnCount; c++) {
        //     const columnData = [];
        //     for (let r = 0; r < rows.length; r++) {
        //         columnData.push(rows[r].cells[c].innerText);
        //     }
        //     columns.push(columnData);
        // }

        // this.#references.rows = rows;
        // this.#references.originalData = columns;

        this.#performSort(column.cellIndex, sort);

    // TODO: Save a ref to the original table structure
    // TODO: Add flag so we don't process table again???
    // TODO: Sort the columns and then display them
    }

    #standardize() {
        // Attempt to find the tbody tag and only standardize it's content.
        let parent = this.#EL.querySelector('tbody');
        if (!parent) {
            parent = this.#EL; // No tbody, standardize the whole table.
        }

        /**
         * Remove colspans and actually create the missing td elements in the
         * correct amount of columns across the table.
         */
        const colspans = parent.querySelectorAll('td[colspan]');
        if (colspans.length > 0) {
            colspans.forEach((td) => {
                // Record how many columns this spans.
                let span = parseInt(td.getAttribute('colspan'), 10) - 1;
                td.removeAttribute('colspan');
                // Create missing td elements and add them to the table row.
                while (span > 0) {
                    const newTd = document.createElement('td');
                    newTd.innerHTML = td.innerText;
                    td.insertAdjacentElement('afterend', newTd);
                    span -= 1;
                }
            });
        }

        /**
         * Remove rowspans and actually create the missing td elements in the
         * correct amount of rows down the table.
         */
        const rowspans = parent.querySelectorAll('td[rowspan]');
        if (rowspans.length > 0) {
            rowspans.forEach((td) => {
                // Record how many rows this spans.
                let span = parseInt(td.getAttribute('rowspan'), 10) - 1;
                // Move to the row element.
                let row = td.closest('tr');
                // Record the column number (row cell) we need to edit.
                const cellIndex = Array.prototype.indexOf.call(row.cells, td);
                td.removeAttribute('rowspan');
                // Create missing td elements and add them to the appropriate row(s).
                while (span > 0) {
                    row = row.nextElementSibling;
                    const newTd = document.createElement('td');
                    newTd.innerHTML = td.innerText;
                    row.insertBefore(newTd, row.cells[cellIndex]);
                    span -= 1;
                }
            });
        }
    }

}

elementBehaviors.define('je-sortable', JamsEduSortable);
