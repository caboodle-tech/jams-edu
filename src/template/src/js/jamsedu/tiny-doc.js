// @jamsedu-version: 1.4.0
// @jamsedu-component: tiny-doc

import './dom-watcher.js';
import TinyWysiwyg from './tiny-wysiwyg.js';

/**
 * One interactive `.document` form (fields, rich areas, templates, “download as PDF”).
 */
class TinyDocument {

    /** Root element with class `document`. */
    #document;

    #elements = {
        '.header': this.#setupGenericElement.bind(this),
        '.indent': this.#setupGenericElement.bind(this),
        '.instructions': this.#setupGenericElement.bind(this),
        '.section': this.#setupGenericElement.bind(this),
        '.spacer': this.#setupGenericElement.bind(this),
        '.subsection': this.#setupGenericElement.bind(this),
        '.title': this.#setupGenericElement.bind(this),
        'button.template': this.#setupTemplateButtons.bind(this),
        'input[type="date"]': this.#setupDate.bind(this),
        'input[type="file"]': this.#setupFileInputs.bind(this),
        'input[type="text"]': this.#setupInput.bind(this),
        'input[type="url"]': this.#setupLinkInputs.bind(this),
        select: this.#setupSelects.bind(this),
        textarea: this.#setupTextareas.bind(this)
    };

    /* eslint-disable max-len */
    #icons = {
        close: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-x-icon lucide-x"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`,
        img: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-image-icon lucide-image"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>`,
        imgUpload: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-image-up-icon lucide-image-up"><path d="M10.3 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10l-3.1-3.1a2 2 0 0 0-2.814.014L6 21"/><path d="m14 19.5 3-3 3 3"/><path d="M17 22v-5.5"/><circle cx="9" cy="9" r="2"/></svg>`,
        link: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-link2-icon lucide-link-2"><path d="M9 17H7A5 5 0 0 1 7 7h2"/><path d="M15 7h2a5 5 0 1 1 0 10h-2"/><line x1="8" x2="16" y1="12" y2="12"/></svg>`
    };
    /* eslint-enable max-len */

    /**
     * @param {HTMLElement} documentElement Root `.document` node.
     */
    constructor(documentElement) {
        this.#document = documentElement;
        this.initialize();
    }

    #setupDate(elem, _) {
        elem.classList.add('doc-input', 'doc-date');
    }

    #setupInput(elem, _) {
        elem.classList.add('doc-input', 'doc-text');
    }

    /**
     * @param {HTMLElement} documentElement New root `.document`.
     */
    setDocumentElement(documentElement) {
        this.#document = documentElement;
    }

    /**
     * Finds all `.document` on DOM ready, then watches for more via `window.DomWatcher` (unless disabled).
     *
     * @param {{ useMutationObserver?: boolean }} [options]
     */
    static start(options = {}) {
        const useMutationObserver = options.useMutationObserver !== false;
        /** @type {WeakSet<Element>} */
        const attached = new WeakSet();
        const attach = (el) => {
            if (!(el instanceof HTMLElement) || !el.classList.contains('document')) {
                return;
            }
            if (attached.has(el)) {
                return;
            }
            attached.add(el);
            new TinyDocument(el);
        };

        const scan = () => {
            document.querySelectorAll('.document').forEach(attach);
        };

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', scan, { once: true });
        } else {
            scan();
        }

        const w = window.DomWatcher;
        if (useMutationObserver && w && typeof MutationObserver !== 'undefined') {
            w.watch('.document', attach, false);
        }
    }

    /** Same as `start({})` for older call sites. */
    static autoInitialize() {
        TinyDocument.start({});
    }

    /** Wires inputs, textareas, templates, download button. */
    initialize() {
        if (!this.#document) {
            console.error('No document element set for TinyDocument.');
            return;
        }

        this.#processElements(this.#document, this.#elements);

        this.#addDownloadButton();
    }

    #processElements(container, elements) {
        for (const [key, callback] of Object.entries(elements)) {

            if (typeof callback === 'string' && callback === '') {
                console.warn(`No callback defined for key: ${key}`);
                // eslint-disable-next-line no-continue
                continue;
            }

            const elems = container.querySelectorAll(key);
            elems.forEach((elem) => {
                callback(elem, key);
            });
        }
    }

    #generateStyleSheet() {
        /* eslint-disable max-len */
        return `<style>body{margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen,Ubuntu,Cantarell,sans-serif}.document{margin:0;padding:.5in;max-width:100%;ol,ul{margin:0 0 14pt 0;padding-left:.5in}li{margin:6pt 0}a{color:#1976d2;text-decoration:none;&:hover{text-decoration:underline}}div,p{page-break-inside:avoid}.doc-header,.doc-subsection,.doc-template-wrapper{page-break-inside:avoid}.doc-section{page-break-after:avoid}.doc-preview{display:block;.doc-preview-item{display:block;img{max-width:100%;height:auto;margin:12pt auto}}}.doc-instructions,.doc-download,.tiny-wysiwyg-container,.doc-template-button,.doc-file-wrapper,.doc-download-button,.doc-trash-button,.doc-remove,.doc-link-icon{display:none!important}.doc-title{font-size:24pt;font-weight:700;text-align:center;margin:0 0 24pt 0}.doc-header{display:flex;justify-content:space-between;margin-bottom:24pt}.doc-section{font-size:16pt;font-weight:700;margin:24pt 0 14pt 0;border-bottom:1px solid #000;padding-bottom:3pt}.doc-subsection{font-size:14pt;font-weight:700;margin:18pt 0 6pt 0}.doc-indent{margin-left:.25in}.doc-spacer{display:block;margin-bottom:18pt;clear:both;min-height:1px}.center{text-align:center}.not-provided{color:#757575}blockquote{position:relative;border:1px solid #c5c5c5;border-left:4pt solid #c5c5c5;background-color:#f4f4f4;padding:6pt 6pt 6pt calc(18pt + 20px);margin:12pt 0;&::before{font-family:Arial;content:"\\201C";color:#c5c5c5;font-size:48pt;position:absolute;left:10px;top:-2px}}h1,h2,h3,h4,h5,h6{font-size:14pt;font-weight:700;margin:18pt 0 6pt 0}pre{background-color:#f4f4f4;padding:6pt;border-radius:2pt;margin:12pt 0;font-family:'Roboto Mono','Courier New',monospace;font-size:11pt;border:1px solid #c5c5c5;white-space:pre-wrap;word-wrap:break-word}}</style>`;
        /* eslint-enable max-len */
    }

    #setupFileInputs(elem, _) {
        // Set up file input for image uploads
        elem.classList.add('doc-input', 'doc-file');
        elem.setAttribute('accept', 'image/*');

        // Create and add preview container
        const previewContainer = document.createElement('div');
        previewContainer.classList.add('doc-preview', 'empty');
        elem.parentNode.insertBefore(previewContainer, elem.nextSibling);

        // Create a wrapper for the file input and add icons
        const wrapper = document.createElement('div');
        wrapper.classList.add('doc-file-wrapper', 'empty');
        wrapper.innerHTML = `<span class="count">0</span>${this.#icons.img}${this.#icons.imgUpload}`;

        // Move the file input into the wrapper
        elem.parentElement.replaceChild(wrapper, elem);
        wrapper.prepend(elem);

        // Handle multiple vs single file uploads
        if (elem.hasAttribute('multiple')) {
            wrapper.classList.add('multiple');
            previewContainer.classList.add('multiple');
            this.#hookMultipleFileUpload(elem, wrapper, previewContainer);
            return;
        }
        this.#hookSingleFileUpload(elem, wrapper, previewContainer);
    }

    #hookSingleFileUpload(fileInput, wrapper, previewContainer) {
        wrapper.querySelector('.count').textContent = '✚';

        fileInput.addEventListener('change', () => {
            previewContainer.innerHTML = '';
            const file = fileInput.files[0];

            if (file && file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (evt) => {
                    const preview = document.createElement('div');
                    preview.classList.add('doc-preview-item');
                    preview.addEventListener('click', () => {
                        wrapper.querySelector('.count').textContent = '✚';
                        wrapper.classList.add('empty');
                        previewContainer.innerHTML = '';
                        previewContainer.classList.add('empty');
                        fileInput.value = '';
                    });

                    const img = document.createElement('img');
                    img.src = evt.target.result;
                    img.classList.add('doc-image');

                    preview.appendChild(img);
                    previewContainer.appendChild(preview);
                    previewContainer.classList.remove('empty');

                    wrapper.querySelector('.count').textContent = '✔';
                    wrapper.classList.remove('empty');
                };
                reader.readAsDataURL(file);
            } else {
                wrapper.querySelector('.count').textContent = '✚';
                wrapper.classList.add('empty');
                previewContainer.classList.add('empty');
            }
        });
    }

    #hookMultipleFileUpload(fileInput, wrapper, previewContainer) {
        let selectedFiles = [];

        const removeImage = (index) => {
            selectedFiles.splice(index, 1);
            displayImages();
        };

        const displayImages = () => {
            previewContainer.innerHTML = '';

            if (selectedFiles.length === 0) {
                wrapper.querySelector('.count').textContent = '0';
                wrapper.classList.add('empty');
                previewContainer.classList.add('empty');
                return;
            }

            wrapper.querySelector('.count').textContent = selectedFiles.length;

            selectedFiles.forEach((file, index) => {
                const reader = new FileReader();
                reader.onload = (evt) => {
                    const preview = document.createElement('div');
                    preview.classList.add('doc-preview-item');
                    preview.addEventListener('click', () => {
                        removeImage(index);
                    });

                    const img = document.createElement('img');
                    img.src = evt.target.result;
                    img.classList.add('doc-image');

                    preview.appendChild(img);
                    previewContainer.appendChild(preview);
                };
                reader.readAsDataURL(file);
            });

            wrapper.classList.remove('empty');
            previewContainer.classList.remove('empty');
        };

        fileInput.addEventListener('change', (evt) => {
            const files = Array.from(evt.target.files).filter((file) => { return file.type.startsWith('image/'); });
            selectedFiles = [...selectedFiles, ...files];
            displayImages();
            fileInput.value = '';
        });
    }

    #setupGenericElement(elem, key) {
        elem.classList.add(`doc-${key.replace('.', '')}`);
        elem.classList.remove(key.replace('.', ''));
    }

    #setupSelects(elem, _) {
        elem.classList.add('doc-select');

        // Ensure one option always has the 'selected' attribute
        if (elem.selectedIndex < 0) {
            elem.selectedIndex = 0;
        }

        Array.from(elem.options).forEach((option, index) => {
            if (index === elem.selectedIndex) {
                option.setAttribute('selected', 'selected');
            } else {
                option.removeAttribute('selected');
            }
        });

        const updateSelected = () => {
            Array.from(elem.options).forEach((option, index) => {
                if (index === elem.selectedIndex) {
                    option.setAttribute('selected', 'selected');
                } else {
                    option.removeAttribute('selected');
                }
            });
        };

        elem.addEventListener('change', updateSelected);
    }

    #setupTextareas(elem, _) {
        if (elem.classList.contains('rich')) {
            new TinyWysiwyg(elem);
            return;
        }

        elem.classList.add('doc-textarea');

        const resize = this.throttle(() => {
            elem.style.height = 'auto';
            elem.style.height = `${elem.scrollHeight}px`;
        }, 250);

        resize();

        elem.addEventListener('input', resize);
    }

    #setupLinkInputs(elem, _) {
        const isRaw = elem.hasAttribute('data-raw');

        // Normalize prompt -> data-prompt
        if (elem.hasAttribute('prompt')) {
            elem.dataset.prompt = elem.getAttribute('prompt');
            elem.removeAttribute('prompt');
        }

        const prompt = elem.dataset.prompt || '';
        const originalPlaceholder = elem.placeholder || '';

        // Wrap input in a container for icon positioning
        const wrapper = document.createElement('span');
        wrapper.classList.add('doc-link-wrapper');
        elem.parentNode.replaceChild(wrapper, elem);
        wrapper.appendChild(elem);

        // Add the link icon
        const icon = document.createElement('span');
        icon.classList.add('doc-link-icon');
        icon.innerHTML = this.#icons.link;
        wrapper.appendChild(icon);

        elem.setAttribute('readonly', '');
        elem.classList.add('doc-input', 'doc-link');
        elem.value = '';

        // If data attributes are pre-populated, set initial state
        if (elem.dataset.url) {
            elem.value = elem.dataset.text || elem.dataset.url;
            elem.classList.add('filled');
        }

        elem.addEventListener('click', () => {
            this.#openLinkPopover(elem, isRaw, originalPlaceholder, prompt);
        });

        icon.addEventListener('click', () => {
            this.#openLinkPopover(elem, isRaw, originalPlaceholder, prompt);
        });
    }

    /**
     * @param {string} text Label text for the link dialog.
     * @returns {string} Adds trailing `:` when missing sentence punctuation.
     */
    #formatLinkPopoverHeading(text) {
        const trimmed = String(text).trim();
        if (!trimmed) {
            return '';
        }
        const last = trimmed.slice(-1);
        if ('.?!:'.includes(last)) {
            return trimmed;
        }
        return `${trimmed}:`;
    }

    /**
     * @param {HTMLInputElement} elem URL field using `data-prompt` / `data-url` / `data-text`.
     * @param {boolean} isRaw If true, only store a single value (no separate label).
     * @param {string} originalPlaceholder Input placeholder before dialog.
     * @param {string} prompt Optional copy for the dialog title.
     */
    #openLinkPopover(elem, isRaw, originalPlaceholder, prompt) {
        // Don't open multiple
        if (this.#document.querySelector('dialog.doc-link-popover')) {
            return;
        }

        const trimmedPrompt = prompt && String(prompt).trim() ? String(prompt).trim() : '';
        const hasPlaceholder = Boolean(originalPlaceholder && String(originalPlaceholder).trim());
        const labelPlaceholder = hasPlaceholder ? String(originalPlaceholder).trim() : 'Link Text';

        let headingText;
        if (trimmedPrompt) {
            headingText = this.#formatLinkPopoverHeading(trimmedPrompt);
        } else if (isRaw) {
            if (hasPlaceholder) {
                headingText = this.#formatLinkPopoverHeading(String(originalPlaceholder).trim());
            } else {
                headingText = this.#formatLinkPopoverHeading('Link Value');
            }
        } else if (!hasPlaceholder) {
            headingText = this.#formatLinkPopoverHeading('Link Information');
        } else {
            headingText = this.#formatLinkPopoverHeading(String(originalPlaceholder).trim());
        }

        const dialog = document.createElement('dialog');
        dialog.classList.add('doc-link-popover');

        const heading = document.createElement('div');
        heading.classList.add('doc-link-popover-heading');
        heading.textContent = headingText || 'Add Link';

        const urlField = document.createElement('input');
        urlField.type = 'url';
        urlField.placeholder = 'https://...';
        urlField.classList.add('doc-link-popover-input');
        urlField.value = elem.dataset.url || '';

        let textField = null;
        if (!isRaw) {
            textField = document.createElement('input');
            textField.type = 'text';
            textField.placeholder = labelPlaceholder;
            textField.classList.add('doc-link-popover-input');
            textField.value = elem.dataset.text || '';
        }

        const actions = document.createElement('div');
        actions.classList.add('doc-link-popover-actions');

        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.innerHTML = this.#icons.close;
        cancelBtn.classList.add('doc-button', 'doc-link-cancel');

        const saveBtn = document.createElement('button');
        saveBtn.type = 'button';
        saveBtn.textContent = 'Save';
        saveBtn.classList.add('doc-button', 'doc-link-save');

        const clearBtn = document.createElement('button');
        clearBtn.type = 'button';
        clearBtn.textContent = 'Clear';
        clearBtn.classList.add('doc-button', 'doc-link-clear');

        actions.appendChild(cancelBtn);
        actions.appendChild(clearBtn);
        actions.appendChild(saveBtn);

        dialog.appendChild(heading);
        if (!isRaw) {
            dialog.appendChild(textField);
        }
        dialog.appendChild(urlField);
        dialog.appendChild(actions);

        this.#document.appendChild(dialog);
        dialog.showModal();

        // Focus the first relevant field
        if (textField && !textField.value) {
            textField.focus();
        } else {
            urlField.focus();
        }

        const closeDialog = () => {
            dialog.close();
            dialog.remove();
        };

        // Save handler
        saveBtn.addEventListener('click', () => {
            const url = urlField.value.trim();
            const text = textField ? textField.value.trim() : '';

            if (url) {
                elem.dataset.url = url;
                if (text) {
                    elem.dataset.text = text;
                    elem.value = text;
                } else {
                    delete elem.dataset.text;
                    elem.value = url;
                }
                elem.classList.add('filled');
            }

            closeDialog();
        });

        // Clear handler
        clearBtn.addEventListener('click', () => {
            delete elem.dataset.url;
            delete elem.dataset.text;
            elem.value = '';
            elem.classList.remove('filled');
            closeDialog();
        });

        // Native backdrop click to close
        dialog.addEventListener('click', (evt) => {
            if (evt.target === dialog) {
                closeDialog();
            }
        });

        // Native Escape key closes it automatically, clean up on close
        dialog.addEventListener('close', () => {
            dialog.remove();
        });
    }

    #setupTemplateButtons(elem, _) {
        elem.classList.add('doc-button', 'doc-template-button');
        elem.classList.remove('template');

        elem.addEventListener('click', () => {
            const template = elem.previousElementSibling;
            if (!template || template.tagName !== 'TEMPLATE') {
                return;
            }

            const clone = template.content.cloneNode(true);
            const wrapper = document.createElement('div');
            wrapper.className = 'doc-template-wrapper';

            const trashBtn = this.#createTrashButton();
            trashBtn.addEventListener('click', () => {
                wrapper.remove();
            });

            wrapper.appendChild(trashBtn);
            wrapper.appendChild(clone);

            elem.parentNode.insertBefore(wrapper, template);

            // Setup all interactive elements in the newly added content
            this.#processElements(wrapper, this.#elements);
        });
    }

    throttle(func, delay) {
        let timeoutId = null;
        let lastArgs = null;
        let lastThis = null;

        // eslint-disable-next-line func-names
        return function(...args) {
            lastArgs = args;
            lastThis = this;

            if (!timeoutId) {
                timeoutId = setTimeout(() => {
                    func.apply(lastThis, lastArgs);
                    timeoutId = null;
                    lastArgs = null;
                    lastThis = null;
                }, delay);
            }
        };
    }

    #createTrashButton() {
        const btn = document.createElement('button');
        btn.classList.add('doc-button', 'doc-trash-button');
        btn.type = 'button';
        // eslint-disable-next-line max-len
        btn.innerHTML = `<svg width="24" height="24" xmlns="http://www.w3.org/2000/svg" fill-rule="evenodd" clip-rule="evenodd"><path d="M19 24h-14c-1.104 0-2-.896-2-2v-16h18v16c0 1.104-.896 2-2 2zm-7-10.414l3.293-3.293 1.414 1.414-3.293 3.293 3.293 3.293-1.414 1.414-3.293-3.293-3.293 3.293-1.414-1.414 3.293-3.293-3.293-3.293 1.414-1.414 3.293 3.293zm10-8.586h-20v-2h6v-1.5c0-.827.673-1.5 1.5-1.5h5c.825 0 1.5.671 1.5 1.5v1.5h6v2zm-8-3h-4v1h4v-1z"/></svg>`;
        return btn;
    }

    #addDownloadButton() {
        const div = document.createElement('div');
        div.classList.add('doc-download');

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.classList.add('doc-button', 'doc-download-button');
        btn.textContent = 'Download Document as PDF';

        div.appendChild(btn);
        this.#document.appendChild(div);

        btn.addEventListener('click', this.#downloadDocument.bind(this));
    }

    async #downloadDocument() {
        if (!this.#validateLinks()) {
            return;
        }

        const clone = this.#document.cloneNode(true);
        await this.#replaceFileInputsWithImages(clone);

        const processedHTML = this.#processClone(clone);
        const fullHTML = this.#buildFullHTML(processedHTML);

        const printWindow = window.open('', '_blank');
        printWindow.document.write(fullHTML);
        printWindow.document.close();

        printWindow.onload = () => {
            setTimeout(() => {
                printWindow.focus();
                printWindow.print();
            }, 250);
        };
    }

    async #replaceFileInputsWithImages(clone) {
        // Find all image file inputs in ORIGINAL document (to access the files)
        const originalInputs = Array.from(
            this.#document.querySelectorAll('input[type="file"][accept*="image"]')
        );

        // Find all image file inputs in CLONED document (to replace)
        const clonedInputs = Array.from(
            clone.querySelectorAll('input[type="file"][accept*="image"]')
        );

        // Process each input by index
        const promises = originalInputs.map(async(originalInput, index) => {
            const clonedInput = clonedInputs[index];

            // Check if this input has a file selected
            if (originalInput.files && originalInput.files.length > 0) {
                const file = originalInput.files[0];

                // Read file as base64
                const base64 = await this.#fileToBase64(file);

                // Create image element
                const img = document.createElement('img');
                img.classList.add('doc-image');
                img.src = base64;
                img.alt = file.name;

                // Optional: preserve any styling or dimensions
                if (originalInput.style.width) {
                    img.style.width = originalInput.style.width;
                }
                if (originalInput.style.height) {
                    img.style.height = originalInput.style.height;
                }

                // Replace the cloned input with the image
                clonedInput.parentNode.replaceChild(img, clonedInput);
            } else {
                // No file selected, just remove the input
                clonedInput.remove();
            }
        });

        // Wait for all file reads to complete
        await Promise.all(promises);
    }

    #fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => { return resolve(reader.result); };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    #validateLinks() {
        const linkInputs = this.#document.querySelectorAll('input.doc-link');
        const missingUrls = [];

        linkInputs.forEach((input) => {
            // If there's a display text but no URL, that's a problem
            if (input.dataset.text && !input.dataset.url) {
                missingUrls.push(input.dataset.text);
            }
        });

        if (missingUrls.length > 0) {
            // eslint-disable-next-line max-len
            alert(`The following links are missing URLs:\n\n${missingUrls.join('\n')}\n\nPlease add URLs before downloading.`);
            return false;
        }

        return true;
    }

    #processClone(clone) {
        // Remove instructions and download buttons
        const instructionsElements = clone.querySelectorAll('.instructions, .download');
        instructionsElements.forEach((el) => {
            el.remove();
        });

        // Remove all template tags
        const templates = clone.querySelectorAll('template');
        templates.forEach((t) => {
            t.remove();
        });

        // Remove all template buttons
        const templateButtons = clone.querySelectorAll('button.template');
        templateButtons.forEach((btn) => {
            btn.remove();
        });

        // Remove trash buttons
        const trashButtons = clone.querySelectorAll('button.trash-btn');
        trashButtons.forEach((btn) => {
            btn.remove();
        });

        // Process inputs
        this.#processInputsInClone(clone);

        // Process selects
        this.#processSelectsInClone(clone);

        // Process textareas
        this.#processTextareasInClone(clone);

        return clone.innerHTML;
    }

    #processInputsInClone(clone) {
        const inputs = Array.from(clone.querySelectorAll('input'));

        inputs.forEach((input) => {

            // Handle link inputs (type="url" with doc-link class)
            if (input.classList.contains('doc-link')) {
                const url = input.dataset.url || '';
                const text = input.dataset.text || '';

                // Replace the wrapper with just the link or not-provided span
                const wrapper = input.closest('.doc-link-wrapper');
                const parent = wrapper ? wrapper.parentNode : input.parentNode;

                if (url) {
                    const a = document.createElement('a');
                    a.href = url;
                    a.textContent = text || url;
                    a.target = '_blank';
                    if (wrapper) {
                        parent.replaceChild(a, wrapper);
                    } else {
                        parent.replaceChild(a, input);
                    }
                } else {
                    const span = document.createElement('span');
                    span.className = 'not-provided';
                    span.textContent = '[Not Provided]';
                    if (wrapper) {
                        parent.replaceChild(span, wrapper);
                    } else {
                        parent.replaceChild(span, input);
                    }
                }
                return;
            }

            // Handle date inputs
            if (input.type === 'date') {
                const dateValue = input.value;
                const span = document.createElement('span');

                if (dateValue) {
                    const isUS = input.classList.contains('us');
                    span.textContent = this.#formatDate(dateValue, isUS);
                } else {
                    span.className = 'not-provided';
                    span.textContent = '[Not Provided]';
                }

                input.parentNode.replaceChild(span, input);
                return;
            }

            // Handle file inputs (skip, handled separately)
            if (input.type === 'file') {
                return;
            }

            // Handle all other inputs
            const span = document.createElement('span');
            const value = input.value.trim();

            if (value) {
                span.textContent = value;
            } else {
                span.className = 'not-provided';
                span.textContent = '[Not Provided]';
            }

            input.parentNode.replaceChild(span, input);
        });
    }

    #formatDate(dateString, isUS = false) {
        const date = new Date(`${dateString}T00:00:00`);
        const day = date.getDate();
        const month = date.toLocaleDateString('en-US', { month: 'long' });
        const year = date.getFullYear();

        if (isUS) {
            return `${month} ${day}, ${year}`;
        }
        return `${day} ${month} ${year}`;

    }

    #processSelectsInClone(clone) {
        const selects = clone.querySelectorAll('select');
        selects.forEach((select) => {
            const span = document.createElement('span');
            const selectedOption = select.options[select.selectedIndex];

            if (selectedOption && selectedOption.value) {
                span.textContent = selectedOption.text;
            } else {
                span.className = 'not-provided';
                span.textContent = '[Not Provided]';
            }

            select.parentNode.replaceChild(span, select);
        });
    }

    #processTextareasInClone(clone) {
        const textareas = clone.querySelectorAll('textarea');

        textareas.forEach((ta) => {
            const div = document.createElement('div');
            div.className = 'not-provided';
            div.textContent = '[Not Provided]';

            if (ta.classList.contains('rich')) {
                // For rich text editors, extract the HTML content
                const editor = ta.nextElementSibling;
                if (editor) {
                    const editorContent = editor.querySelector('.tw-content');
                    if (editorContent) {
                        const htmlContent = editorContent.innerHTML.trim();
                        if (htmlContent && editorContent.textContent !== ta.placeholder) {
                            div.innerHTML = htmlContent;
                            div.className = 'rich-content';
                        }
                    }
                }
            } else {
                const value = ta.value.trim();

                if (value) {
                    // Preserve formatting including blank lines
                    div.style.whiteSpace = 'pre-wrap';
                    div.textContent = value;
                    div.className = 'plain-text';
                }
            }

            ta.parentNode.replaceChild(div, ta);
        });
    }

    #buildFullHTML(bodyContent) {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Document</title>
    ${this.#generateStyleSheet()}
</head>
<body>
    <div class="document">
        ${bodyContent}
    </div>
</body>
</html>`;
    }

}

window.TinyDocument = TinyDocument;

export default TinyDocument;
