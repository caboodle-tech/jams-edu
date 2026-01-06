import TinyWysiwyg from './tiny-wysiwyg.js';

class TinyDocument {

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
        'input[type="url"]': this.#setupUrlInputs.bind(this),
        select: this.#setupSelects.bind(this),
        textarea: this.#setupTextareas.bind(this)
    };

    /* eslint-disable max-len */
    #icons = {
        close: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-x-icon lucide-x"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`,
        img: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-image-icon lucide-image"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>`,
        imgUpload: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-image-up-icon lucide-image-up"><path d="M10.3 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10l-3.1-3.1a2 2 0 0 0-2.814.014L6 21"/><path d="m14 19.5 3-3 3 3"/><path d="M17 22v-5.5"/><circle cx="9" cy="9" r="2"/></svg>`
    };
    /* eslint-enable max-len */

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

    setDocumentElement(documentElement) {
        this.#document = documentElement;
    }

    static autoInitialize() {
        document.addEventListener('DOMContentLoaded', () => {
            const docs = document.querySelectorAll('.document');
            docs.forEach((doc) => {
                new TinyDocument(doc);
            });
        });
    }

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
        return `<style>body{margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen,Ubuntu,Cantarell,sans-serif}.document{margin:0;padding:.5in;max-width:100%;ol,ul{margin:0 0 14pt 0;padding-left:.5in}li{margin:6pt 0}a{color:#1976d2;text-decoration:none;&:hover{text-decoration:underline}}div,p{page-break-inside:avoid}.doc-header,.doc-subsection,.doc-template-wrapper{page-break-inside:avoid}.doc-section{page-break-after:avoid}.doc-preview{display:block;.doc-preview-item{display:block;img{max-width:100%;height:auto;margin:12pt auto}}}.doc-instructions,.doc-download,.tiny-wysiwyg-container,.doc-template-button,.doc-file-wrapper,.doc-download-button,.doc-trash-button,.doc-remove{display:none!important}.doc-title{font-size:24pt;font-weight:700;text-align:center;margin:0 0 24pt 0}.doc-header{display:flex;justify-content:space-between;margin-bottom:24pt}.doc-section{font-size:16pt;font-weight:700;margin:24pt 0 14pt 0;border-bottom:1px solid #000;padding-bottom:3pt}.doc-subsection{font-size:14pt;font-weight:700;margin:18pt 0 6pt 0}.doc-indent{margin-left:.25in}.doc-spacer{display:block;margin-bottom:18pt;clear:both;min-height:1px}.center{text-align:center}.not-provided{color:#757575}blockquote{position:relative;border:1px solid #c5c5c5;border-left:4pt solid #c5c5c5;background-color:#f4f4f4;padding:6pt 6pt 6pt calc(18pt + 20px);margin:12pt 0;&::before{font-family:Arial;content:"\\201C";color:#c5c5c5;font-size:48pt;position:absolute;left:10px;top:-2px}}h1,h2,h3,h4,h5,h6{font-size:14pt;font-weight:700;margin:18pt 0 6pt 0}pre{background-color:#f4f4f4;padding:6pt;border-radius:2pt;margin:12pt 0;font-family:'Roboto Mono','Courier New',monospace;font-size:11pt;border:1px solid #c5c5c5;white-space:pre-wrap;word-wrap:break-word}}</style>`;
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
        };
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
            const files = Array.from(evt.target.files).filter((file) => file.type.startsWith('image/'));
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

    #setupUrlInputs(elem, _) {
        elem.classList.add('doc-input', 'doc-url');
        elem.setAttribute('pattern', 'https?://.+');
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
        await this.#replaceFileInputsWithImages(clone);  // Just add 'await'

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
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    #validateLinks() {
        const linkInputs = this.#document.querySelectorAll('input.link');
        const missingUrls = [];

        linkInputs.forEach((input) => {
            if (!input.value.trim()) {
                return;
            }

            let nextElement = input.nextElementSibling;
            while (nextElement && nextElement.tagName !== 'INPUT') {
                nextElement = nextElement.nextElementSibling;
            }

            if (nextElement && nextElement.type === 'url' && !nextElement.value.trim()) {
                missingUrls.push(input.value.trim());
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
        const processedIndices = new Set();

        inputs.forEach((input, idx) => {
            if (processedIndices.has(idx)) {
                return;
            }

            // Handle link + URL pairs
            if (input.classList.contains('link')) {
                const urlInput = this.#findNextUrlInput(inputs, idx);

                if (urlInput) {
                    const urlIdx = inputs.indexOf(urlInput);
                    processedIndices.add(urlIdx);

                    const linkText = input.value.trim();
                    const linkUrl = urlInput.value.trim();

                    if (linkText && linkUrl) {
                        const a = document.createElement('a');
                        a.href = linkUrl;
                        a.textContent = linkText;
                        a.target = '_blank';
                        input.parentNode.replaceChild(a, input);
                        urlInput.remove();
                    } else if (!linkText && !linkUrl) {
                        const span = document.createElement('span');
                        span.className = 'not-provided';
                        span.textContent = '[Not Provided]';
                        input.parentNode.replaceChild(span, input);
                        urlInput.remove();
                    } else {
                        const span = document.createElement('span');
                        span.textContent = linkText || '[Not Provided]';
                        if (!linkText) {
                            span.className = 'not-provided';
                        }
                        input.parentNode.replaceChild(span, input);
                        urlInput.remove();
                    }
                    return;
                }
            }

            // Handle standalone URL inputs
            if (input.type === 'url' && !processedIndices.has(idx)) {
                const urlValue = input.value.trim();
                if (urlValue) {
                    const a = document.createElement('a');
                    a.href = urlValue;
                    a.textContent = urlValue;
                    a.target = '_blank';
                    input.parentNode.replaceChild(a, input);
                } else {
                    const span = document.createElement('span');
                    span.className = 'not-provided';
                    span.textContent = '[Not Provided]';
                    input.parentNode.replaceChild(span, input);
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

    #findNextUrlInput(inputs, startIdx) {
        for (let i = startIdx + 1; i < inputs.length; i++) {
            if (inputs[i].type === 'url') {
                return inputs[i];
            }
            // Stop searching if we hit another input with class 'link' or a different input type
            if (inputs[i].classList.contains('link') ||
                (inputs[i].type !== 'text' && inputs[i].type !== 'url')) {
                break;
            }
        }
        return null;
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
                const editorContent = editor.querySelector('.tw-content');
                if (editorContent) {
                    const htmlContent = editorContent.innerHTML.trim();
                    if (htmlContent && editorContent.textContent !== ta.placeholder) {
                        div.innerHTML = htmlContent;
                        div.className = 'rich-content';
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

export default TinyDocument;
