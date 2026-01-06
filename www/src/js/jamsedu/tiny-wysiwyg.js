// @jamsedu-version: 1.0.0
// @jamsedu-component: tiny-wysiwyg
class TinyWysiwyg {

    #blocks = ['PRE', 'BLOCKQUOTE'];

    /* eslint-disable max-len */
    #icons = {
        blockquote: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-quote-icon lucide-quote"><path d="M16 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z"/><path d="M5 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z"/></svg>`,
        bold: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8"/></svg>`,
        code: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`,
        heading: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 12h12"/><path d="M6 20V4"/><path d="M18 20V4"/></svg>`,
        italic: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" x2="10" y1="4" y2="4"/><line x1="14" x2="5" y1="20" y2="20"/><line x1="15" x2="9" y1="4" y2="20"/></svg>`,
        link: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`,
        ol: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="10" x2="21" y1="6" y2="6"/><line x1="10" x2="21" y1="12" y2="12"/><line x1="10" x2="21" y1="18" y2="18"/><path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/></svg>`,
        paragraph: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-pilcrow-icon lucide-pilcrow"><path d="M13 4v16"/><path d="M17 4v16"/><path d="M19 4H9.5a4.5 4.5 0 0 0 0 9H13"/></svg>`,
        ul: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/></svg>`,
        underline: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4v6a6 6 0 0 0 12 0V4"/><line x1="4" x2="20" y1="20" y2="20"/></svg>`
    };
    /* eslint-enable max-len */

    constructor(textarea) {
        this.textarea = textarea;
        this.container = null;
        this.toolbar = null;
        this.editor = null;
        this.linkModal = null;
        this.savedSelection = null;
        this.mutationObserver = null;
        this.cleanupDebounceTimer = null;

        // Undo/Redo system
        this.history = [];
        this.historyIndex = -1;
        this.maxHistorySize = 30;
        this.lastRecordedContent = '';
        this.historyDebounceTimer = null;

        // Store bound event handlers for cleanup
        this.boundHandlers = {
            toolbarClick: null,
            input: null,
            keydown: null,
            paste: null
        };

        this.init();
    }

    static autoInitialize() {
        document.addEventListener('DOMContentLoaded', () => {
            const textareas = document.querySelectorAll('textarea.rich');
            textareas.forEach((textarea) => {
                new TinyWysiwyg(textarea);
            });
        });
    }

    // Unified cleanup method for both pasted content and regular formatting
    cleanHTML(element) {
        // Remove unwanted attributes
        const allElements = element.querySelectorAll('*');
        allElements.forEach((el) => {
            el.removeAttribute('style');
            el.removeAttribute('class');
            el.removeAttribute('id');
        });

        // Remove font tags while preserving their content
        const fonts = element.querySelectorAll('font');
        fonts.forEach((font) => {
            this.unwrapElement(font);
        });

        // Remove span tags while preserving their content
        const spans = element.querySelectorAll('span');
        spans.forEach((span) => {
            this.unwrapElement(span);
        });

        // Remove empty spans
        const emptySpans = element.querySelectorAll('span:empty');
        emptySpans.forEach((span) => { return span.remove(); });
    }

    // Debounced cleanup - only runs after user stops interacting
    debouncedCleanup() {
        clearTimeout(this.cleanupDebounceTimer);
        this.cleanupDebounceTimer = setTimeout(() => {
            this.cleanHTML(this.editor);
        }, 300);
    }

    convertToParagraph(element) {
        const p = document.createElement('p');
        while (element.firstChild) {
            p.appendChild(element.firstChild);
        }
        element.parentNode.replaceChild(p, element);

        const range = document.createRange();
        const selection = window.getSelection();
        range.setStart(p, 0);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
    }

    createEditorStructure() {
        // Create container
        this.container = document.createElement('div');
        this.container.className = 'tiny-wysiwyg-container';

        // Create toolbar
        this.toolbar = this.createToolbar();
        this.container.appendChild(this.toolbar);

        // Create editor div with ARIA attributes
        this.editor = document.createElement('div');
        this.editor.className = 'tw-content';
        this.editor.contentEditable = 'true';
        this.editor.setAttribute('role', 'textbox');
        this.editor.setAttribute('aria-multiline', 'true');
        this.editor.innerHTML = `<p>${this.textarea.value || this.textarea.placeholder || ''}</p>`;
        this.container.appendChild(this.editor);

        // Create reusable link modal (hidden by default)
        this.createLinkModal();

        // Replace textarea with editor
        this.textarea.setAttribute('aria-hidden', 'true');
        this.textarea.setAttribute('tabindex', '-1');
        this.textarea.style.display = 'none';
        this.textarea.parentNode.insertBefore(this.container, this.textarea.nextSibling);
    }

    createLinkModal() {
        this.linkModal = document.createElement('div');
        this.linkModal.className = 'tw-link-modal';
        this.linkModal.style.display = 'none';

        this.linkModal.innerHTML = `
            <div class="tw-lm-backdrop"></div>
            <div class="tw-lm-content">
                <h3 id="tw-lm-title">Insert Link</h3>
                <label for="tw-lm-link-url">URL:</label>
                <input type="url" id="tw-lm-link-url" placeholder="https://example.com">
                <div class="tw-lm-buttons">
                    <button class="danger" id="tw-lm-unlink-btn" style="display:none;">Remove Link</button>
                    <button id="tw-lm-cancel-btn">Cancel</button>
                    <button class="primary" id="tw-lm-insert-btn">Insert</button>
                </div>
            </div>
        `;

        this.container.appendChild(this.linkModal);

        // Set up modal event listeners once
        const urlInput = this.linkModal.querySelector('#tw-lm-link-url');
        const insertBtn = this.linkModal.querySelector('#tw-lm-insert-btn');
        const cancelBtn = this.linkModal.querySelector('#tw-lm-cancel-btn');
        const unlinkBtn = this.linkModal.querySelector('#tw-lm-unlink-btn');

        insertBtn.addEventListener('click', () => {
            const url = urlInput.value.trim();
            if (url) {
                const sanitized = this.sanitizeUrl(url);
                if (sanitized) {
                    this.insertLink(sanitized, this.linkModal.dataset.existingLink === 'true');
                }
            }
            this.hideLinkModal();
        });

        cancelBtn.addEventListener('click', () => { return this.hideLinkModal(); });

        unlinkBtn.addEventListener('click', () => {
            this.removeLink(this.linkModal.existingLinkElement);
            this.hideLinkModal();
        });

        urlInput.addEventListener('keydown', (evt) => {
            if (evt.key === 'Enter') {
                evt.preventDefault();
                insertBtn.click();
            } else if (evt.key === 'Escape') {
                evt.preventDefault();
                this.hideLinkModal();
            }
        });

        this.linkModal.addEventListener('click', (evt) => {
            if (evt.target === this.linkModal) {
                this.hideLinkModal();
            }
        });
    }

    createToolbar() {
        const toolbar = document.createElement('div');
        toolbar.className = 'tw-toolbar';
        toolbar.setAttribute('role', 'toolbar');

        toolbar.innerHTML = `
            <button data-action="bold" title="Bold (Ctrl+B)" aria-label="Bold">
                ${this.#icons.bold}
            </button>
            <button data-action="italic" title="Italic (Ctrl+I)" aria-label="Italic">
                ${this.#icons.italic}
            </button>
            <button data-action="underline" title="Underline (Ctrl+U)" aria-label="Underline">
                ${this.#icons.underline}
            </button>
            
            <div class="separator"></div>
            
            <button data-action="insertUnorderedList" title="Bullet List" aria-label="Bullet List">
                ${this.#icons.ul}
            </button>
            <button data-action="insertOrderedList" title="Numbered List" aria-label="Numbered List">
                ${this.#icons.ol}
            </button>
            
            <div class="separator"></div>
            
            <button data-action="p" title="Paragraph" aria-label="Paragraph">
                ${this.#icons.paragraph}
            </button>
            <button data-action="h1" title="Heading" aria-label="Heading">
                ${this.#icons.heading}
            </button>
            <button data-action="blockquote" title="Quote" aria-label="Quote">
                ${this.#icons.blockquote}
            </button>
            <button data-action="pre" title="Code Block" aria-label="Code Block">
                ${this.#icons.code}
            </button>
            
            <div class="separator"></div>
            
            <button data-action="link" title="Insert/Edit Link" aria-label="Insert or Edit Link">
                ${this.#icons.link}
            </button>
        `;

        return toolbar;
    }

    destroy() {
        // Disconnect MutationObserver
        if (this.mutationObserver) {
            this.mutationObserver.disconnect();
        }

        // Clear timers
        clearTimeout(this.cleanupDebounceTimer);
        clearTimeout(this.historyDebounceTimer);

        // Remove event listeners
        if (this.boundHandlers.toolbarClick) {
            this.toolbar.removeEventListener('click', this.boundHandlers.toolbarClick);
        }
        if (this.boundHandlers.input) {
            this.editor.removeEventListener('input', this.boundHandlers.input);
        }
        if (this.boundHandlers.keydown) {
            this.editor.removeEventListener('keydown', this.boundHandlers.keydown);
        }
        if (this.boundHandlers.paste) {
            this.editor.removeEventListener('paste', this.boundHandlers.paste);
        }

        // Remove DOM elements
        if (this.linkModal) {
            this.linkModal.remove();
        }
        this.container.remove();
        this.textarea.style.display = '';
    }

    formatHeading(tag) {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        const range = selection.getRangeAt(0);

        // Get all block elements in the selection (handles both single line and multi-line)
        const blocks = this.getBlocksInSelection(range);

        if (blocks.length === 0) return;

        // Check if all blocks are already the target format
        const allSameFormat = blocks.every((block) => { return block.tagName && block.tagName.toLowerCase() === tag.toLowerCase(); }
        );

        const modifiedBlocks = [];
        const cursorWasCollapsed = range.collapsed;

        blocks.forEach((blockElement) => {
            let newBlock;
            if (allSameFormat) {
                // Convert to paragraph if all are already in this format
                const p = document.createElement('p');
                while (blockElement.firstChild) {
                    p.appendChild(blockElement.firstChild);
                }
                if (blockElement.parentNode) {
                    blockElement.parentNode.replaceChild(p, blockElement);
                    newBlock = p;
                }
            } else {
                // Convert to the target format
                const newElement = document.createElement(tag);
                while (blockElement.firstChild) {
                    newElement.appendChild(blockElement.firstChild);
                }
                if (blockElement.parentNode) {
                    blockElement.parentNode.replaceChild(newElement, blockElement);
                    newBlock = newElement;
                }
            }
            if (newBlock) {
                modifiedBlocks.push(newBlock);
            }
        });

        // Place cursor intelligently based on whether it was collapsed or a selection
        if (modifiedBlocks.length > 0) {
            const targetBlock = cursorWasCollapsed ? modifiedBlocks[0] : modifiedBlocks[modifiedBlocks.length - 1];
            const newRange = document.createRange();
            const sel = window.getSelection();

            // If block is empty, add a BR to maintain cursor position
            if (targetBlock.childNodes.length === 0) {
                targetBlock.appendChild(document.createElement('br'));
            }

            newRange.selectNodeContents(targetBlock);

            // For collapsed (single line), try to maintain cursor position within the line
            // For selection (multi-line), place at end of last block
            newRange.collapse(!!(cursorWasCollapsed && modifiedBlocks.length === 1));

            sel.removeAllRanges();
            sel.addRange(newRange);
        }

        this.editor.focus();
        this.recordHistory();
        this.syncToTextarea();
    }

    getBlocksInSelection(range) {
        const blocks = [];
        const blockTags = ['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'PRE', 'DIV', 'LI'];

        // Handle collapsed selection (cursor position) - just get the block we're in
        if (range.collapsed) {
            const block = this.getBlockElement(range.startContainer);
            if (block && block !== this.editor) {
                return [block];
            }
            return [];
        }

        // For non-collapsed selection, get start and end blocks first
        const startBlock = this.getBlockElement(range.startContainer);
        const endBlock = this.getBlockElement(range.endContainer);

        // Same block selected
        if (startBlock === endBlock && startBlock && startBlock !== this.editor) {
            return [startBlock];
        }

        // Different blocks - need to get all blocks between start and end
        if (startBlock && startBlock !== this.editor) {
            blocks.push(startBlock);

            // Walk forward from start block to end block
            let currentBlock = startBlock.nextSibling;
            while (currentBlock && currentBlock !== endBlock) {
                if (currentBlock.nodeType === 1 && blockTags.includes(currentBlock.tagName)) {
                    blocks.push(currentBlock);
                }
                currentBlock = currentBlock.nextSibling;
            }

            // Add end block if different from start
            if (endBlock && endBlock !== this.editor && endBlock !== startBlock) {
                blocks.push(endBlock);
            }
        }

        return blocks;
    }

    getClosestElement(range) {
        if (!range || !range.rangeCount) {
            return null;
        }

        let node = range.getRangeAt(0).startContainer;

        // If a text node, climb to its parent element
        if (node.nodeType === Node.TEXT_NODE) {
            node = node.parentNode;
        }

        // Climb until an element node (or null)
        while (node && node.nodeType !== Node.ELEMENT_NODE) {
            node = node.parentNode;
        }

        if (!node) {
            return null;
        }

        return node;
    }

    formatText(command) {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        // Handle list commands differently
        if (command === 'insertUnorderedList' || command === 'insertOrderedList') {
            this.toggleList(command === 'insertUnorderedList' ? 'ul' : 'ol');
            return;
        }

        const range = selection.getRangeAt(0);

        // Map commands to HTML tags
        const tagMap = {
            bold: 'strong',
            italic: 'em',
            underline: 'u'
        };

        const tag = tagMap[command];
        if (!tag) {
            return;
        };

        // ALWAYS trim whitespace first
        this.trimRangeWhitespace(range);

        // Only expand to word if range is collapsed (no selection)
        if (range.collapsed) {
            this.expandRangeToWord(range);
        }

        // Check if selection is formatted with this tag
        const isFormatted = this.isSelectionFormatted(range, tag);

        if (isFormatted) {
        // Remove formatting
            this.removeFormatFromSelection(range, tag);
        } else {
        // Apply formatting
            this.applyFormatToSelection(range, tag);
        }

        this.editor.focus();
        this.recordHistory();
        this.syncToTextarea();
    }

    // Helper: Trim leading and trailing whitespace from range
    trimRangeWhitespace(range) {
        // Trim leading whitespace
        const start = range.startContainer;
        let { startOffset } = range;

        if (start.nodeType === 3) { // Text node
            const text = start.textContent;
            while (startOffset < text.length && /\s/.test(text[startOffset])) {
                startOffset++;
            }
            range.setStart(start, startOffset);
        }

        // Trim trailing whitespace
        const end = range.endContainer;
        let { endOffset } = range;

        if (end.nodeType === 3) { // Text node
            const text = end.textContent;
            while (endOffset > 0 && /\s/.test(text[endOffset - 1])) {
                endOffset--;
            }
            range.setEnd(end, endOffset);
        }
    }

    // Helper: Expand range to include the full word at cursor position
    expandRangeToWord(range) {
        const start = range.startContainer;

        if (start.nodeType !== 3) return; // Only works with text nodes

        const text = start.textContent;
        let { startOffset } = range;
        let { endOffset } = range;

        // Expand start to beginning of word
        while (startOffset > 0 && /\S/.test(text[startOffset - 1])) {
            startOffset--;
        }

        // Expand end to end of word
        while (endOffset < text.length && /\S/.test(text[endOffset])) {
            endOffset++;
        }

        range.setStart(start, startOffset);
        range.setEnd(start, endOffset);
    }

    isSelectionFormatted(range, tagName) {
    // Check if the specific tag exists ANYWHERE within the range

        // First check: is the range itself inside this tag?
        let node = range.commonAncestorContainer;
        if (node.nodeType === 3) node = node.parentElement;

        while (node && node !== this.editor) {
            if (node.tagName && node.tagName.toLowerCase() === tagName.toLowerCase()) {
                return true; // Found it in parent chain
            }
            node = node.parentElement;
        }

        // Second check: does the range CONTAIN this tag?
        const clonedContents = range.cloneContents();
        const tempDiv = document.createElement('div');
        tempDiv.appendChild(clonedContents);

        // Check if this specific tag exists within the cloned content
        const foundTags = tempDiv.querySelectorAll(tagName);
        if (foundTags.length > 0) {
            return true; // Found it within the selection
        }

        // Also check if the tempDiv's first child is the tag itself
        if (tempDiv.firstChild && tempDiv.firstChild.nodeType === 1 &&
        tempDiv.firstChild.tagName &&
        tempDiv.firstChild.tagName.toLowerCase() === tagName.toLowerCase()) {
            return true;
        }

        return false;
    }

    applyFormatToSelection(range, tagName) {
        const selectedText = range.toString();
        if (!selectedText) return;

        // Extract the content
        const fragment = range.extractContents();

        // Remove ONLY the specific tag type we're applying (prevent duplicate nesting)
        this.unwrapAllTags(fragment, tagName);

        // Create new formatted element
        const element = document.createElement(tagName);
        element.appendChild(fragment);

        // Insert back into the document
        range.insertNode(element);

        // Place cursor at end of the formatted element
        const newRange = document.createRange();
        const selection = window.getSelection();
        newRange.selectNodeContents(element);
        newRange.collapse(false);
        selection.removeAllRanges();
        selection.addRange(newRange);
    }

    removeFormatFromSelection(range, tagName) {
        // Check if this specific tag exists in parent chain
        let node = range.commonAncestorContainer;
        if (node.nodeType === 3) node = node.parentElement;

        let foundInParent = null;
        while (node && node !== this.editor) {
            if (node.tagName && node.tagName.toLowerCase() === tagName.toLowerCase()) {
                foundInParent = node;
                break;
            }
            node = node.parentElement;
        }

        // If found in parent chain, unwrap just that element
        if (foundInParent) {
            this.unwrapElement(foundInParent);
            return;
        }

        // Otherwise, extract range content and unwrap the tag from it
        const fragment = range.extractContents();

        // Create temp container
        const tempDiv = document.createElement('div');
        tempDiv.appendChild(fragment);

        // Unwrap ONLY the specific tag type
        this.unwrapAllTags(tempDiv, tagName);

        // Insert back in correct order using a document fragment
        const finalFragment = document.createDocumentFragment();
        while (tempDiv.firstChild) {
            finalFragment.appendChild(tempDiv.firstChild);
        }

        range.insertNode(finalFragment);
    }

    removeSpecificTagFromElement(range, element, tagName) {
        const elementRange = document.createRange();
        elementRange.selectNodeContents(element);

        const startCompare = range.compareBoundaryPoints(Range.START_TO_START, elementRange);
        const endCompare = range.compareBoundaryPoints(Range.END_TO_END, elementRange);

        if (startCompare <= 0 && endCompare >= 0) {
        // Selection completely contains the element - just unwrap it
            this.unwrapElement(element);
        } else if (startCompare > 0 && endCompare < 0) {
        // Selection is inside the element - need to split
            this.splitSpecificTag(range, element, tagName);
        } else if (startCompare > 0 || endCompare < 0) {
        // Partial overlap - split at boundaries
            this.splitSpecificTagAtBoundary(range, element, tagName);
        }
    }

    splitSpecificTag(range, element, tagName) {
        const parent = element.parentNode;
        if (!parent) return;

        // Clone the element to preserve all other attributes
        const beforeElement = element.cloneNode(false);
        const afterElement = element.cloneNode(false);

        // Create ranges for before and after content
        const beforeRange = document.createRange();
        beforeRange.setStartBefore(element.firstChild || element);
        beforeRange.setEnd(range.startContainer, range.startOffset);

        const afterRange = document.createRange();
        afterRange.setStart(range.endContainer, range.endOffset);
        afterRange.setEndAfter(element.lastChild || element);

        // Extract content
        const beforeContent = beforeRange.cloneContents();
        const afterContent = afterRange.cloneContents();
        const middleContent = range.extractContents();

        // Insert the three parts
        if (beforeContent.textContent.length > 0) {
            beforeElement.appendChild(beforeContent);
            parent.insertBefore(beforeElement, element);
        }

        // Middle part is unformatted (no tag wrapper)
        parent.insertBefore(middleContent, element);

        if (afterContent.textContent.length > 0) {
            afterElement.appendChild(afterContent);
            parent.insertBefore(afterElement, element);
        }

        // Remove the original element
        parent.removeChild(element);
    }

    splitSpecificTagAtBoundary(range, element, tagName) {
        const parent = element.parentNode;
        if (!parent) return;

        const elementRange = document.createRange();
        elementRange.selectNodeContents(element);

        const startCompare = range.compareBoundaryPoints(Range.START_TO_START, elementRange);
        const endCompare = range.compareBoundaryPoints(Range.END_TO_END, elementRange);

        if (startCompare <= 0 && endCompare < 0) {
        // Selection starts at/before element, ends inside
        // Keep formatting after selection end
            const afterElement = element.cloneNode(false);
            const afterRange = document.createRange();
            afterRange.setStart(range.endContainer, range.endOffset);
            afterRange.setEndAfter(element.lastChild || element);

            const afterContent = afterRange.extractContents();
            if (afterContent.textContent.length > 0) {
                afterElement.appendChild(afterContent);
                parent.insertBefore(afterElement, element.nextSibling);
            }

            this.unwrapElement(element);
        } else if (startCompare > 0 && endCompare >= 0) {
        // Selection starts inside element, ends at/after element
        // Keep formatting before selection start
            const beforeElement = element.cloneNode(false);
            const beforeRange = document.createRange();
            beforeRange.setStartBefore(element.firstChild || element);
            beforeRange.setEnd(range.startContainer, range.startOffset);

            const beforeContent = beforeRange.extractContents();
            if (beforeContent.textContent.length > 0) {
                beforeElement.appendChild(beforeContent);
                parent.insertBefore(beforeElement, element);
            }

            this.unwrapElement(element);
        }
    }

    // Helper: Recursively unwrap all instances of a specific tag from a fragment
    unwrapAllTags(node, tagName) {
        const lowerTag = tagName.toLowerCase();

        // If this node itself is the tag, unwrap it
        if (node.nodeType === 1 && node.tagName && node.tagName.toLowerCase() === lowerTag) {
            this.unwrapElement(node);
            return;
        }

        // Find all child elements with this tag
        if (node.querySelectorAll) {
            const elements = node.querySelectorAll(tagName);
            elements.forEach((el) => { return this.unwrapElement(el); });
        }
    }

    toggleList(listType) {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        const range = selection.getRangeAt(0);
        const blocks = this.getBlocksInSelection(range);

        if (blocks.length === 0) return;

        // Check if we're already in a list
        let currentList = null;
        const firstBlock = blocks[0];

        // Check if first block is a list item
        if (firstBlock.tagName === 'LI') {
            currentList = firstBlock.parentNode;
        } else {
            // Check if block is inside a list
            let node = firstBlock;
            while (node && node !== this.editor) {
                if (node.tagName === 'UL' || node.tagName === 'OL') {
                    currentList = node;
                    break;
                }
                node = node.parentNode;
            }
        }

        // Check if all blocks are in the same type of list
        const isInSameListType = currentList && currentList.tagName.toLowerCase() === listType;

        let lastModifiedElement = null;

        if (isInSameListType) {
            // Remove list formatting - convert list items back to paragraphs
            const listItems = currentList.querySelectorAll('li');
            const paragraphs = [];
            listItems.forEach((li) => {
                const p = document.createElement('p');
                while (li.firstChild) {
                    p.appendChild(li.firstChild);
                }
                currentList.parentNode.insertBefore(p, currentList);
                paragraphs.push(p);
            });
            currentList.remove();
            lastModifiedElement = paragraphs[paragraphs.length - 1];
        } else if (currentList && !isInSameListType) {
            // Change list type
            const newList = document.createElement(listType);
            while (currentList.firstChild) {
                newList.appendChild(currentList.firstChild);
            }
            currentList.parentNode.replaceChild(newList, currentList);

            // Get last list item
            const listItems = newList.querySelectorAll('li');
            lastModifiedElement = listItems[listItems.length - 1];
        } else {
            // Create new list
            const list = document.createElement(listType);
            const firstBlock = blocks[0];

            blocks.forEach((block) => {
                const li = document.createElement('li');

                // Move content to list item
                while (block.firstChild) {
                    li.appendChild(block.firstChild);
                }

                // If list item is empty, add a BR
                if (li.childNodes.length === 0) {
                    li.appendChild(document.createElement('br'));
                }

                list.appendChild(li);
            });

            // Replace first block with the list
            if (firstBlock && firstBlock.parentNode) {
                firstBlock.parentNode.replaceChild(list, firstBlock);

                // Remove remaining blocks (skip first since it's replaced)
                for (let i = 1; i < blocks.length; i++) {
                    if (blocks[i].parentNode) {
                        blocks[i].parentNode.removeChild(blocks[i]);
                    }
                }
            } else {
                this.editor.appendChild(list);
            }

            // Get last list item
            const listItems = list.querySelectorAll('li');
            lastModifiedElement = listItems[listItems.length - 1];
        }

        // Place cursor at END of last modified element
        if (lastModifiedElement) {
            const newRange = document.createRange();
            const sel = window.getSelection();

            newRange.selectNodeContents(lastModifiedElement);
            newRange.collapse(false); // Collapse to end

            sel.removeAllRanges();
            sel.addRange(newRange);
        }

        this.editor.focus();
        this.recordHistory();
        this.syncToTextarea();
    }

    getBlockElement(node) {
        const blockTags = ['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'PRE', 'DIV', 'LI'];

        while (node && node !== this.editor) {
            if (node.nodeType === 1 && blockTags.includes(node.tagName)) {
                return node;
            }
            node = node.parentNode;
        }

        return null;
    }

    getHTML() {
        return this.editor.innerHTML;
    }

    getSelectedLink() {
        const selection = window.getSelection();
        if (!selection.rangeCount) return null;

        let node = selection.anchorNode;
        while (node && node !== this.editor) {
            if (node.nodeType === 1 && node.tagName === 'A') {
                return node;
            }
            node = node.parentNode;
        }
        return null;
    }

    getTextAfterCursor(range) {
        const container = range.startContainer;
        const offset = range.startOffset;

        if (container.nodeType === 3) {
            return container.textContent.substring(offset);
        }

        let text = '';
        let started = false;

        const collectText = (node) => {
            if (node === container) {
                started = true;
            }

            if (started) {
                if (node.nodeType === 3) {
                    text += node.textContent;
                } else if (node.childNodes) {
                    for (const child of node.childNodes) {
                        collectText(child);
                    }
                }
            }
        };

        let preElement = container;
        while (preElement && preElement.tagName !== 'PRE') {
            preElement = preElement.parentNode;
        }

        if (preElement) {
            collectText(preElement);
        }

        return text;
    }

    handleBackspace(evt) {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        const range = selection.getRangeAt(0);
        const offset = range.startOffset;

        const blockElement = this.getBlockElement(range.startContainer);

        if (blockElement && ['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE'].includes(blockElement.tagName)) {
            if (offset === 0 && range.collapsed) {
                evt.preventDefault();
                this.convertToParagraph(blockElement);
                this.recordHistory();
            }
        }
    }

    handleEnterInBlock(evt) {
        if (evt.key !== 'Enter') {
            return;
        }

        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) {
            return;
        }

        const range = selection.getRangeAt(0);

        let node = range.startContainer;
        while (node && node.nodeType === Node.TEXT_NODE) {
            node = node.parentNode;
        }
        let block = node;
        while (block && !this.#blocks.includes(block.nodeName)) {
            block = block.parentNode;
        }

        if (!block) {
            return; // Let the browser handle it
        }

        evt.preventDefault();
        const tag = block.nodeName; // 'PRE' or 'BLOCKQUOTE'

        // ---------- helpers ----------
        const placeCaretAfter = (insertedNode) => {
            const r = document.createRange();
            if (insertedNode.nodeType === Node.TEXT_NODE) {
                r.setStart(insertedNode, insertedNode.length);
                r.setEnd(insertedNode, insertedNode.length);
            } else {
                r.setStartAfter(insertedNode);
                r.setEndAfter(insertedNode);
            }
            selection.removeAllRanges();
            selection.addRange(r);
        };

        const insertTextAtRange = (text) => {
            range.deleteContents();
            const tn = document.createTextNode(text);
            range.insertNode(tn);
            placeCaretAfter(tn);
        };

        const insertDoubleBrAtRange = () => {
            range.deleteContents();
            const br1 = document.createElement('br');
            const br2 = document.createElement('br');
            range.insertNode(br1);
            br1.parentNode.insertBefore(br2, br1.nextSibling);
            placeCaretAfter(br2);
        };

        const isAtEndOfBlock = (() => {
            const probe = range.cloneRange();
            probe.selectNodeContents(block);
            probe.setStart(range.endContainer, range.endOffset);
            const trailing = probe.toString()
                .replace(/\u00a0/g, ' ')
                .replace(/\u200b/g, '')
                .trim();
            const atEnd = trailing.length === 0;
            return atEnd;
        })();

        const lastLineIsEmpty = (() => {
            if (tag === 'PRE') {
                const text = block.textContent || '';
                const lines = text.split('\n');
                const last = lines.length ? lines[lines.length - 1] : '';
                const empty = last.trim().length === 0;
                return empty;
            }

            // For blockquote: check if we're positioned after two consecutive <br> tags
            const node = range.startContainer;
            const offset = range.startOffset;

            // Navigate to find the previous element
            let prevElement = null;

            if (node.nodeType === Node.ELEMENT_NODE && offset > 0) {
                prevElement = node.childNodes[offset - 1];
            } else if (node.nodeType === Node.TEXT_NODE) {
            // Check if text node is empty or only whitespace
                const textContent = node.textContent.replace(/\u200b/g, '').trim();
                if (textContent === '') {
                    prevElement = node.previousSibling;
                }
            }

            // Walk back through empty text nodes to find actual element
            while (prevElement && prevElement.nodeType === Node.TEXT_NODE) {
                const text = prevElement.textContent.replace(/\u200b/g, '').trim();
                if (text !== '') {
                    break;
                }
                prevElement = prevElement.previousSibling;
            }

            // Check if previous element is a BR
            if (prevElement && prevElement.nodeName === 'BR') {
            // Now check if the one before that is also a BR
                let beforeBr = prevElement.previousSibling;
                while (beforeBr && beforeBr.nodeType === Node.TEXT_NODE) {
                    const text = beforeBr.textContent.replace(/\u200b/g, '').trim();
                    if (text !== '') {
                        break;
                    }
                    beforeBr = beforeBr.previousSibling;
                }

                const empty = beforeBr && beforeBr.nodeName === 'BR';
                return empty;
            }
            return false;
        })();

        const removePreviousBreakUnit = () => {
            try {
            // For blockquote, remove the last two <br> tags
                if (tag === 'BLOCKQUOTE') {
                    const node = range.startContainer;
                    const offset = range.startOffset;

                    // Navigate to find previous elements
                    const toRemove = [];

                    if (node.nodeType === Node.ELEMENT_NODE && offset > 0) {
                        let prev = node.childNodes[offset - 1];
                        // Collect the two BRs and any whitespace text nodes between them
                        let count = 0;
                        while (prev && count < 2) {
                            if (prev.nodeName === 'BR') {
                                toRemove.push(prev);
                                count += 1;
                            } else if (prev.nodeType === Node.TEXT_NODE &&
                                   prev.textContent.replace(/\u200b/g, '').trim() === '') {
                                toRemove.push(prev);
                            } else {
                                break;
                            }
                            prev = prev.previousSibling;
                        }
                    }

                    // Remove collected nodes
                    toRemove.forEach((n) => {
                        if (n.parentNode) {
                            n.parentNode.removeChild(n);
                        }
                    });

                    return;
                }

                // PRE handling (unchanged)
                let n = range.startContainer;
                let o = range.startOffset;

                const climbToParent = () => {
                    const p = n && n.parentNode;
                    if (!p) {
                        return false;
                    }
                    o = Array.prototype.indexOf.call(p.childNodes, n);
                    n = p;
                    return true;
                };

                const stepLeft = () => {
                    if (n && n.nodeType === Node.TEXT_NODE && o > 0) {
                        return { type: 'text', node: n, offset: o - 1 };
                    }
                    if (n && n.nodeType === Node.ELEMENT_NODE && o > 0) {
                        let child = n.childNodes[o - 1];
                        while (child && child.lastChild) {
                            child = child.lastChild;
                        }
                        if (child) {
                            if (child.nodeType === Node.TEXT_NODE) {
                                const len = child.textContent ? child.textContent.length : 0;
                                return { type: 'text', node: child, offset: Math.max(0, len - 1) };
                            }
                            return { type: 'node', node: child };
                        }
                    }
                    if (!climbToParent()) {
                        return null;
                    }
                    return stepLeft();
                };

                const target = stepLeft();
                if (!target) {
                    return;
                }

                if (target.type === 'text') {
                    const t = target.node.textContent || '';
                    const ch = t[target.offset];
                    if (ch === '\n') {
                        target.node.textContent = t.slice(0, target.offset) + t.slice(target.offset + 1);
                        if (target.node.textContent.length === 0 && target.node.parentNode) {
                            target.node.parentNode.removeChild(target.node);
                        }
                    }
                }
            // eslint-disable-next-line no-unused-vars
            } catch (e) {
                // Ignore errors during cleanup
            }
        };

        // ---------- Shift+Enter: always insert a visible line break ----------
        if (evt.shiftKey === true) {
            if (tag === 'PRE') {
                insertTextAtRange('\n\n');
            } else {
                insertDoubleBrAtRange();
            }
            this.recordHistory();
            this.syncToTextarea();
            return;
        }

        // ---------- Double-Enter to exit: at end of block AND last line empty ----------
        const shouldExitBlock = isAtEndOfBlock && lastLineIsEmpty;

        if (shouldExitBlock) {
        // Clean up the trailing break unit so the block doesn't retain an extra blank line
            removePreviousBreakUnit();

            // Insert a paragraph after the block and move caret into it
            const p = document.createElement('p');
            p.innerHTML = '<br>';

            const parent = block.parentNode;
            if (!parent) {
                return;
            }

            if (block.nextSibling) {
                parent.insertBefore(p, block.nextSibling);
            } else {
                parent.appendChild(p);
            }

            const r = document.createRange();
            r.setStart(p, 0);
            r.collapse(true);
            selection.removeAllRanges();
            selection.addRange(r);

            this.recordHistory();
            this.syncToTextarea();
            return;
        }

        // ---------- Single Enter inside handled block ----------
        if (tag === 'PRE') {
            insertTextAtRange('\n\n');
        } else {
            insertDoubleBrAtRange();
        }

        this.recordHistory();
        this.syncToTextarea();
    }

    handleLinkAction() {
        this.saveSelection();

        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);

            // Trim whitespace
            this.trimRangeWhitespace(range);

            // If collapsed (no selection), expand to word
            if (range.collapsed) {
                this.expandRangeToWord(range);
            }

            // Save the modified selection
            this.savedSelection = range.cloneRange();
        }

        const existingLink = this.getSelectedLink();

        if (existingLink) {
            this.showLinkModal(existingLink.href, existingLink);
        } else {
            this.showLinkModal('', null);
        }
    }

    hideLinkModal() {
        this.linkModal.style.display = 'none';
        this.linkModal.existingLinkElement = null;
        this.editor.focus();
    }

    init() {
        // Create the editor structure
        this.createEditorStructure();

        // Set up event listeners
        this.setupEventListeners();

        // Set up MutationObserver for cleanup
        this.setupMutationObserver();

        // Record initial state
        this.recordHistory();
    }

    insertLink(url, isExistingLink) {
        this.restoreSelection();

        if (isExistingLink && this.linkModal.existingLinkElement) {
            this.linkModal.existingLinkElement.href = url;
            this.linkModal.existingLinkElement.target = '_blank';
            this.linkModal.existingLinkElement.rel = 'noopener noreferrer';

            // Place cursor at END of link
            const range = document.createRange();
            const selection = window.getSelection();
            range.selectNodeContents(this.linkModal.existingLinkElement);
            range.collapse(false);
            selection.removeAllRanges();
            selection.addRange(range);
        } else {
            const selection = window.getSelection();
            if (!selection.rangeCount) return;

            const range = selection.getRangeAt(0);

            // Trim whitespace from the range before creating link
            this.trimRangeWhitespace(range);

            const selectedText = range.toString();

            if (selectedText) {
            // Extract the content (preserves nested formatting)
                const fragment = range.extractContents();

                // Create link and append the fragment to it
                const link = document.createElement('a');
                link.href = url;
                link.target = '_blank';
                link.rel = 'noopener noreferrer';
                link.appendChild(fragment);

                range.insertNode(link);

                // Place cursor AFTER the link
                range.setStartAfter(link);
                range.collapse(true);
                selection.removeAllRanges();
                selection.addRange(range);
            }
        }

        this.recordHistory();
        this.syncToTextarea();
    }

    insertHTML(html) {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        const range = selection.getRangeAt(0);
        range.deleteContents();

        const fragment = document.createRange().createContextualFragment(html);

        // Keep reference to last node for cursor placement
        const lastNode = fragment.lastChild;

        range.insertNode(fragment);

        // Place cursor at END of inserted content
        if (lastNode) {
            range.setStartAfter(lastNode);
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
        }
    }

    insertText(text) {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        const range = selection.getRangeAt(0);
        range.deleteContents();

        const textNode = document.createTextNode(text);
        range.insertNode(textNode);

        // Place cursor AFTER the inserted text
        range.setStartAfter(textNode);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
    }

    recordHistory() {
        // Debounce history recording to avoid recording every keystroke
        clearTimeout(this.historyDebounceTimer);
        this.historyDebounceTimer = setTimeout(() => {
            const currentContent = this.editor.innerHTML;

            this.removeMalformedElements();

            // Only record if content actually changed
            if (currentContent === this.lastRecordedContent) {
                return;
            }

            this.lastRecordedContent = currentContent;

            // Remove any future history if we're not at the end
            if (this.historyIndex < this.history.length - 1) {
                this.history = this.history.slice(0, this.historyIndex + 1);
            }

            // Save current selection
            const selection = window.getSelection();
            let savedRange = null;
            if (selection.rangeCount > 0) {
                savedRange = selection.getRangeAt(0).cloneRange();
            }

            // Add to history
            this.history.push({
                html: currentContent,
                selection: savedRange
            });

            // Limit history size
            if (this.history.length > this.maxHistorySize) {
                this.history.shift();
            } else {
                this.historyIndex += 1;
            }
        }, 1000);
    }

    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex += 1;
            const state = this.history[this.historyIndex];
            this.editor.innerHTML = state.html;

            if (state.selection) {
                try {
                    const selection = window.getSelection();
                    selection.removeAllRanges();
                    selection.addRange(state.selection);
                // eslint-disable-next-line no-unused-vars
                } catch (e) {
                    // Selection may be invalid if DOM structure changed
                }
            }

            this.syncToTextarea();
        }
    }

    removeLink(linkElement) {
        if (!linkElement) return;

        this.unwrapElement(linkElement);
        this.recordHistory();
        this.syncToTextarea();
    }

    removeMalformedElements() {
        const elements = this.editor.querySelectorAll('em, span, strong, u');
        elements.forEach((el) => {
            if (el.childNodes.length === 0 || el.textContent.trim() === '') {
                el.parentNode.removeChild(el);
            }
        });
    }

    restoreSelection() {
        if (this.savedSelection) {
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(this.savedSelection);
        }
    }

    sanitizeUrl(url) {
        // Remove leading/trailing whitespace
        url = url.trim();

        // Block dangerous protocols
        const dangerousProtocols = ['javascript:', 'data:', 'vbscript:', 'file:'];
        const lowerUrl = url.toLowerCase();

        for (const protocol of dangerousProtocols) {
            if (lowerUrl.startsWith(protocol)) {
                return null;
            }
        }

        // Add https:// if no protocol specified
        if (!url.match(/^[a-z][a-z0-9+.-]*:/i)) {
            url = `https://${url}`;
        }

        // Limit overall URL length
        if (url.length > 2048) {
            return null;
        }

        // Basic URL validation
        try {
            const urlObj = new URL(url);

            // Limit query string length
            if (urlObj.search.length > 500) {
                return null;
            }

            return url;
        // eslint-disable-next-line no-unused-vars
        } catch (e) {
            return null;
        }
    }

    saveSelection() {
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            this.savedSelection = selection.getRangeAt(0);
        }
    }

    setHTML(html) {
        this.editor.innerHTML = html;
        this.recordHistory();
        this.syncToTextarea();
    }

    setupEventListeners() {
        // Toolbar button clicks
        this.boundHandlers.toolbarClick = (e) => {
            const button = e.target.closest('button');
            if (!button) {
                return;
            }

            e.preventDefault();

            const { action } = button.dataset;

            switch (action) {
                case 'bold':
                case 'insertOrderedList':
                case 'insertUnorderedList':
                case 'italic':
                case 'underline':
                    this.formatText(action);
                    break;
                case 'blockquote':
                case 'h1':
                case 'pre':
                    this.formatHeading(action);
                    break;
                case 'link':
                    this.handleLinkAction();
                    break;
                case 'p':
                    const elem = this.getClosestElement(window.getSelection());
                    if (elem && (this.#blocks.includes(elem.nodeName) || elem.nodeName === 'H1')) {
                        this.convertToParagraph(elem);
                    }
                    break;
            }
        };

        this.toolbar.addEventListener('click', this.boundHandlers.toolbarClick);

        // Input event for sync and history
        this.boundHandlers.input = () => {
            this.recordHistory();
            this.syncToTextarea();
        };
        this.editor.addEventListener('input', this.boundHandlers.input);

        // Keyboard shortcuts
        this.boundHandlers.keydown = (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key.toLowerCase()) {
                    case 'b':
                        e.preventDefault();
                        this.formatText('bold');
                        break;
                    case 'i':
                        e.preventDefault();
                        this.formatText('italic');
                        break;
                    case 'u':
                        e.preventDefault();
                        this.formatText('underline');
                        break;
                    case 'z':
                        if (e.shiftKey) {
                            e.preventDefault();
                            this.redo();
                        } else {
                            e.preventDefault();
                            this.undo();
                        }
                        break;
                    case 'y':
                        e.preventDefault();
                        this.redo();
                        break;
                }
            }

            if (e.key === 'Enter') {
                this.handleEnterInBlock(e);
            }

            if (e.key === 'Backspace') {
                this.handleBackspace(e);
            }
        };

        this.editor.addEventListener('keydown', this.boundHandlers.keydown);

        // Paste event
        this.boundHandlers.paste = (e) => {
            e.preventDefault();

            const text = e.clipboardData.getData('text/plain');
            const html = e.clipboardData.getData('text/html');

            if (html) {
                const temp = document.createElement('div');
                temp.innerHTML = html;
                this.cleanHTML(temp);
                this.insertHTML(temp.innerHTML);
            } else {
                this.insertText(text);
            }

            this.recordHistory();
            this.debouncedCleanup();
        };

        this.editor.addEventListener('paste', this.boundHandlers.paste);
    }

    setupMutationObserver() {
        this.mutationObserver = new MutationObserver(() => {
            this.debouncedCleanup();
        });

        this.mutationObserver.observe(this.editor, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['style', 'class']
        });
    }

    showLinkModal(currentUrl, existingLink) {
        const title = this.linkModal.querySelector('#tw-lm-title');
        const urlInput = this.linkModal.querySelector('#tw-lm-link-url');
        const insertBtn = this.linkModal.querySelector('#tw-lm-insert-btn');
        const unlinkBtn = this.linkModal.querySelector('#tw-lm-unlink-btn');

        const isEdit = !!existingLink;
        title.textContent = isEdit ? 'Edit Link' : 'Insert Link';
        urlInput.value = currentUrl;
        insertBtn.textContent = isEdit ? 'Update' : 'Insert';
        unlinkBtn.style.display = isEdit ? 'inline-block' : 'none';

        this.linkModal.dataset.existingLink = isEdit;
        this.linkModal.existingLinkElement = existingLink;

        this.linkModal.style.display = 'flex';
        urlInput.focus();
        urlInput.select();
    }

    syncToTextarea() {
        this.textarea.value = this.editor.innerHTML;
    }

    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex -= 1;
            const state = this.history[this.historyIndex];
            this.editor.innerHTML = state.html;

            if (state.selection) {
                try {
                    const selection = window.getSelection();
                    selection.removeAllRanges();
                    selection.addRange(state.selection);
                // eslint-disable-next-line no-unused-vars
                } catch (e) {
                    // Selection may be invalid if DOM structure changed
                }
            }

            this.syncToTextarea();
        }
    }

    unwrapElement(element) {
        const parent = element.parentNode;
        if (!parent) return;

        while (element.firstChild) {
            parent.insertBefore(element.firstChild, element);
        }
        parent.removeChild(element);
    }

}

window.TinyWysiwyg = TinyWysiwyg;

export default TinyWysiwyg;