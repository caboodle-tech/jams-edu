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

TinyDocument creates interactive document editors from elements with the `.document` class. For a comprehensive guide on all supported elements, attributes, and document authoring patterns, see the [TinyDocument Guide](./tiny-documents.jamsedu.md).

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

- **Text Input**: `input[type="text"]`, `input[type="date"]`
- **Link Input**: `input[type="url"]` — opens a dialog for entering a display name and URL
- **Files**: `input[type="file"]` for images only. Includes image preview.
- **Select**: `<select>` elements
- **Textarea**: `<textarea>` plain textarea or add `.rich` class for WYSIWYG
- **Template Buttons**: `button.template` for cloning `<template>` content
- **Special Classes**: `.header`, `.section`, `.subsection`, `.title`, `.indent`, `.spacer`, `.instructions`

### Link Input

The `input[type="url"]` element provides a dialog-based link editor. Clicking the input opens a native `<dialog>` where users enter a display name and URL.

```html
<!-- Display text + URL (default) -->
<input type="url" placeholder="Teammates Name" prompt="Link to their GitHub repo">

<!-- URL only -->
<input type="url" data-raw placeholder="Repo URL">
```

Supported attributes:

- `placeholder` — label shown in the input and used as the text field placeholder in the dialog
- `prompt` or `data-prompt` — heading text shown in the dialog (falls back to `placeholder` value)
- `data-raw` — when present, the dialog only asks for a URL (no display text field)
- `data-url` — pre-populate with a URL value
- `data-text` — pre-populate with display text

### Example

```html
<div class="document">
    <div class="title">My Document</div>

    <div class="section">Personal Information</div>
    <input type="text" placeholder="Your Name">
    <input type="date">

    <div class="section">Links</div>
    <input type="url" placeholder="Portfolio" prompt="Link to your portfolio">

    <div class="section">Description</div>
    <textarea class="rich" placeholder="Write your description..."></textarea>

    <div class="section">Upload Image</div>
    <input type="file" accept="image/*">
</div>
```

### PDF Export

TinyDocument automatically adds a "Download Document as PDF" button that:
- Processes all form inputs
- Converts link inputs to clickable links
- Converts file uploads to inline images
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

- **Formatting**: Bold, italic, underline
- **Headings**: H1
- **Lists**: Ordered and unordered
- **Links**: Insert and edit links
- **Blockquote**: Quote blocks
- **Code**: Code blocks
- **Undo/Redo**: Full undo/redo support
- **Keyboard Shortcuts**: Standard shortcuts (Ctrl+B, Ctrl+I, etc.)
- **Placeholder**: Supports the textarea's `placeholder` attribute

### Example

```html
<textarea class="rich" placeholder="Write your content..."></textarea>
```

The textarea is automatically replaced with a rich text editor.

### Getting Content

```javascript
const editor = new TinyWysiwyg(textarea);
const htmlContent = editor.getHTML();
```

### Setting Content

```javascript
editor.setHTML('<p>Hello <strong>World</strong>!</p>');
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
- `editor.getHTML()` - Get HTML content
- `editor.setHTML(html)` - Set HTML content
- `editor.destroy()` - Remove the editor and restore textarea

### DomWatcher

- `DomWatcher.watch(selector, callback)` - Watch for elements matching selector
- Callback receives the matched element as first argument