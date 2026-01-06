<!-- @jamsedu-version: 4.2.0 -->
<!-- @jamsedu-component: docs-JAVASCRIPT-API -->
# JavaScript API Documentation

JamsEdu provides three main JavaScript components that you can use in your projects.

## Components Overview

- **TinyDocument**: Interactive document editor with form inputs, file uploads, and PDF export
- **TinyWysiwyg**: Rich text editor (WYSIWYG) for formatted content
- **DomWatcher**: Utility for watching DOM elements and executing callbacks

## Auto-Initialization

By default, TinyDocument and TinyWysiwyg are automatically initialized when you import the JamsEdu module:

```javascript
// src/js/main.js
import { DomWatcher, TinyDocument, TinyWysiwyg } from './jamsedu/index.js';

// TinyDocument and TinyWysiwyg are already initialized!
// They automatically find and initialize elements with:
// - .document class (TinyDocument)
// - .rich class on textareas (TinyWysiwyg)
```

## TinyDocument

TinyDocument creates interactive document editors from elements with the `.document` class.

### Auto-Initialization

TinyDocument automatically initializes all elements with the `.document` class:

```html
<div class="document">
    <!-- Your document content -->
</div>
```

### Manual Initialization

```javascript
import { TinyDocument } from './jamsedu/index.js';

// Initialize a specific element
const docElement = document.querySelector('.my-document');
const doc = new TinyDocument(docElement);
```

### Supported Elements

TinyDocument automatically handles these elements:

- **Inputs**: `input[type="text"]`, `input[type="url"]`, `input[type="date"]`
- **File Uploads**: `input[type="file"]` (with image preview)
- **Selects**: `<select>` elements
- **Textareas**: `<textarea>` (plain or `.rich` for WYSIWYG)
- **Template Buttons**: `button.template` (for cloning template content)
- **Special Classes**: `.header`, `.section`, `.subsection`, `.title`, `.indent`, `.spacer`, `.instructions`

### Example

```html
<div class="document">
    <div class="title">My Document</div>
    
    <div class="section">Personal Information</div>
    <input type="text" placeholder="Your Name">
    <input type="date">
    
    <div class="section">Description</div>
    <textarea class="rich" placeholder="Write your description..."></textarea>
    
    <div class="section">Upload Image</div>
    <input type="file" accept="image/*">
</div>
```

### PDF Export

TinyDocument automatically adds a "Download Document as PDF" button that:
- Processes all form inputs
- Converts file uploads to images
- Opens print dialog for PDF export

## TinyWysiwyg

TinyWysiwyg creates rich text editors from textareas with the `.rich` class.

### Auto-Initialization

TinyWysiwyg automatically initializes all textareas with the `.rich` class:

```html
<textarea class="rich" placeholder="Write formatted text..."></textarea>
```

### Manual Initialization

```javascript
import { TinyWysiwyg } from './jamsedu/index.js';

const textarea = document.querySelector('.my-rich-text');
const editor = new TinyWysiwyg(textarea);
```

### Features

- **Formatting**: Bold, italic, underline, strikethrough
- **Headings**: H1-H6
- **Lists**: Ordered and unordered
- **Links**: Insert and edit links
- **Blockquotes**: Quote blocks
- **Code**: Inline and block code
- **Undo/Redo**: Full undo/redo support
- **Keyboard Shortcuts**: Standard shortcuts (Ctrl+B, Ctrl+I, etc.)

### Example

```html
<textarea class="rich" placeholder="Write your content..."></textarea>
```

The textarea is automatically replaced with a rich text editor.

### Getting Content

```javascript
const editor = new TinyWysiwyg(textarea);
const htmlContent = editor.getContent(); // Get HTML content
const textContent = editor.getTextContent(); // Get plain text
```

### Setting Content

```javascript
editor.setContent('<p>Hello <strong>World</strong>!</p>');
```

## DomWatcher

DomWatcher is a utility for watching the DOM for elements matching CSS selectors.

### Usage

```javascript
import { DomWatcher } from './jamsedu/index.js';

// Watch for elements matching a selector
DomWatcher.watch('.my-element', (element) => {
    console.log('Found element:', element);
    // Do something with the element
});
```

### Static Method

```javascript
// Watch for multiple elements
DomWatcher.watch('.dynamic-content', (element) => {
    element.classList.add('loaded');
});

// The callback is called for:
// 1. Elements that already exist in the DOM
// 2. Elements added to the DOM later (via MutationObserver)
```

### Example: Dynamic Content

```javascript
import { DomWatcher } from './jamsedu/index.js';

// Watch for dynamically added elements
DomWatcher.watch('.lazy-load', (element) => {
    // Load content when element appears
    loadContent(element);
});

// Later, when new elements are added:
document.body.innerHTML += '<div class="lazy-load">New content</div>';
// DomWatcher automatically detects and processes it
```

## Combining Components

You can use all components together:

```javascript
import { DomWatcher, TinyDocument, TinyWysiwyg } from './jamsedu/index.js';

// Auto-initialization handles most cases
// But you can also manually initialize:

// Watch for new document elements
DomWatcher.watch('.document', (element) => {
    new TinyDocument(element);
});

// Watch for new rich text areas
DomWatcher.watch('textarea.rich', (textarea) => {
    new TinyWysiwyg(textarea);
});
```

## Best Practices

1. **Use Auto-Initialization**: Let JamsEdu handle initialization automatically
2. **Use DomWatcher for Dynamic Content**: When adding elements via JavaScript
3. **Manual Initialization**: Only when you need custom behavior
4. **Check for Elements**: Always check if elements exist before initializing

## API Reference

### TinyDocument

- `new TinyDocument(element)` - Create a new TinyDocument instance
- `TinyDocument.autoInitialize()` - Auto-initialize all `.document` elements
- `doc.initialize()` - Re-initialize the document
- `doc.setDocumentElement(element)` - Change the document element

### TinyWysiwyg

- `new TinyWysiwyg(textarea)` - Create a new TinyWysiwyg instance
- `TinyWysiwyg.autoInitialize()` - Auto-initialize all `.rich` textareas
- `editor.getContent()` - Get HTML content
- `editor.getTextContent()` - Get plain text content
- `editor.setContent(html)` - Set HTML content
- `editor.destroy()` - Remove the editor and restore textarea

### DomWatcher

- `DomWatcher.watch(selector, callback)` - Watch for elements matching selector
- Callback receives the matched element as first argument

