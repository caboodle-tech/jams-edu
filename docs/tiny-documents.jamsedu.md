# TinyDocument Guide

Place report markup inside `<div class="document">`. TinyDocument enhances fields, previews, and actions for use in the browser, and adds **Download Document as PDF** so the user can produce a printable version. Enhancement runs once when the page loads; the document is not processed again until the user exports or prints.

---

## Styling the Form Users See

Most interaction happens in the **browser view** (the `.document` region on your page) before anyone uses the download control. That is the surface you style.

Scope CSS under `.document` so global layout and navigation are unaffected. The following is a reasonable default frame.

```css
.document {
    max-width: 48rem;
    margin-inline: auto;
    padding: 1.5rem;
}
```

TinyDocument **replaces** short author classes with stable `doc-*` classes on the same element (for example `title` becomes `doc-title`). Selectors should target the `doc-*` names, such as `.document .doc-title`, `.document .doc-section`, and `.document .doc-header`.

Enhanced controls receive classes including `doc-input`, `doc-text`, `doc-date`, `doc-select`, `doc-textarea`, `doc-link`, `doc-file-wrapper`, `doc-preview`, `doc-template-button`, and `doc-download-button`. Link fields are wrapped in `doc-link-wrapper`; after a link is saved, the input also has `filled`.

For colors, spacing, and typography, JamsEdu provides **CSS custom properties** (`--doc-*` on `:root`, `.document`, or an ancestor). TinyWysiwyg honors `--richtext-*` variables. See the [CSS customization guide](css-customization.jamsedu.md) for the full list and fallback behavior.

**Layout Class Mapping**

| In Your HTML | Class on the Live DOM |
|--------------|------------------------|
| `.title` | `doc-title` |
| `.section` | `doc-section` |
| `.subsection` | `doc-subsection` |
| `.header` | `doc-header` |
| `.spacer` | `doc-spacer` |
| `.indent` | `doc-indent` |
| `.instructions` | `doc-instructions` |

The print preview and any PDF saved from it use a **separate** HTML document with its own layout. The browser view does not need to match that output exactly. Instruction blocks are omitted from the printable output.

---

## Document Container

```html
<div class="document">
    <!-- All content goes here -->
</div>
```

Use `TinyDocument.autoInitialize()` to initialize every `.document` on the page after `DOMContentLoaded`. To initialize a single container, construct an instance explicitly.

```javascript
new TinyDocument(document.querySelector('.document'));
```

---

## Layout Elements

For each pattern below, TinyDocument maps the author class to a `doc-*` class on the **same element**. Use the mapping table under **Styling the Form Users See** for a quick reference.

### Title

```html
<div class="title">Field Report</div>
```

### Section

```html
<div class="section">Equipment Checklist</div>
```

### Subsection

Secondary heading. Inputs, selects, and textareas nested inside keep regular weight next to the heading.

```html
<div class="subsection">Serial Numbers</div>
```

### Header

Often used for a name field and a date field on one row.

```html
<div class="header">
    <div><input type="text" placeholder="Your Name"></div>
    <div><input type="date"></div>
</div>
```

### Spacer

```html
<div class="spacer"></div>
```

### Indent

```html
<div class="indent">Indented note or clause text.</div>
```

### Instructions

Visible while the form is filled in the browser. **Not included** in the print preview or saved PDF. Suitable for rubrics, due-date reminders, or guidance that should not appear on the submitted document.

```html
<div class="instructions">
    <p>Attach one clear photo per item.</p>
</div>
```

```html
<p class="instructions">Due before midnight on the date below.</p>
```

### Center

Not modified by TinyDocument. Use only if your application already defines `.center`.

```html
<div class="center">Centered Line</div>
```

---

## Form Elements

In the browser, the user works with standard controls. **Download Document as PDF** builds a **print copy** in which those controls are replaced by plain text, links, or images so the print dialog receives a static document rather than an active form.

### Text Input

```html
<input type="text" placeholder="Room or lab ID">
```

The field receives `doc-input` and `doc-text`. In the print copy it appears as text, or as `[Not Provided]` if left blank.

### Date Input

```html
<input type="date">
```

The field receives `doc-input` and `doc-date`. The print copy shows a spelled-out date (for example `1 January 2025`). For US-style month-first wording, add the `us` class.

```html
<input type="date" class="us">
```

### Select

TinyDocument maintains the `selected` attribute on the active `<option>` so the correct choice is represented when the print copy is built.

```html
<select>
    <option value="pending">Pending</option>
    <option value="ok">Passed</option>
    <option value="fail">Needs follow-up</option>
</select>
```

The control has `doc-select` in the browser. The print copy shows the selected option’s visible label as text.

### Textarea

Height increases as the user enters text.

```html
<textarea placeholder="List any hazards observed..."></textarea>
```

The control has `doc-textarea`. The print copy preserves line breaks. An empty value appears as `[Not Provided]`.

### Rich Textarea

TinyWysiwyg is enabled with the `rich` class.

```html
<textarea class="rich" placeholder="Executive summary (formatting allowed)"></textarea>
```

The browser shows the editor in place of the raw textarea. The print copy includes the formatted HTML, or `[Not Provided]` if there is no substantive content.

---

## Link Input

`input[type="url"]` opens a `<dialog>` for display text and URL, or for URL only in raw mode.

### Display Text and URL

```html
<input type="url" placeholder="Repository name" prompt="Link to the repository">
```

The dialog heading uses `prompt` or `data-prompt` when present, then the placeholder, then a default. After save, the field shows the chosen label and can be reopened to edit.

### URL Only

```html
<input type="url" data-raw placeholder="Canonical URL">
```

### Attributes

| Attribute | Required | Description |
|-----------|----------|-------------|
| `type="url"` | Yes | Link field |
| `placeholder` | No | Field label; dialog hint |
| `prompt` or `data-prompt` | No | Dialog title; `prompt` is stored as `data-prompt` |
| `data-raw` | No | URL-only dialog |
| `data-url` | No | Initial URL |
| `data-text` | No | Initial label |

### Prompt Shorthand

```html
<input type="url" placeholder="Ticket" prompt="Link to the ticket">
```

Equivalent to setting `data-prompt` directly.

### Print Output and Validation

In the print copy, each link field becomes a clickable anchor when a URL is present, or `[Not Provided]` when it is not. If display text exists without a URL, export is blocked and an alert lists the affected fields.

---

## File Input (Images)

```html
<input type="file">
<input type="file" multiple>
```

`accept="image/*"` is set automatically. The input is wrapped and a preview region is inserted after it. **Single file:** one thumbnail; the user can clear the selection by clicking the preview. **Multiple files:** a count is shown, new selections append, and each thumbnail can be removed individually.

Selected images are embedded in the print copy. If no file was chosen, that control is omitted from the print output.

---

## Templates (Repeatable Sections)

Place repeatable markup inside `<template>`. The **immediate next sibling** must be `button.template`.

```html
<ul>
    <li><input type="url" placeholder="Reference" prompt="Link to source"></li>
    <template>
        <li><input type="url" placeholder="Reference" prompt="Link to source"></li>
    </template>
    <button class="template">Add Reference</button>
</ul>
```

Each activation clones the template into a wrapper that includes a delete control; nested content is initialized the same way as the rest of the document. For nested repetition, include another `<template>` / `button.template` pair inside the outer template’s content.

The print copy removes add buttons, delete controls, and raw `<template>` elements. Only user-added blocks remain.

---

## What Happens When Someone Clicks Download Document as PDF

1. Link fields are validated. Display text without a corresponding URL prevents export until corrected.
2. `.document` is cloned; images from file inputs are embedded in the clone.
3. Template chrome and instruction blocks are removed as applicable. Remaining content is flattened to text, links, and images as described above.
4. The result opens in a new window and the browser print dialog runs (PDF export typically uses the same dialog).

Empty values in the print copy use this element.

```html
<span class="not-provided">[Not Provided]</span>
```

---

## Full-Featured Example

The following document demonstrates layout blocks, instructions, indent, plain and rich text, both date formats, a select, link patterns (`prompt`, `data-raw`, prefilled values), single- and multi-file uploads, a repeating list, and nested templates (additional witnesses, each with optional contact rows).

```html
<div class="document">
    <div class="title">Incident and Witness Log</div>

    <div class="header">
        <div><input type="text" placeholder="Reporter Name"></div>
        <div><input type="date" placeholder="Report Date"></div>
    </div>

    <div class="section">Event Summary</div>

    <div class="instructions">
        <p><strong>Note for instructors.</strong> Students must complete the required links and attach at least one photograph. This block does not appear in the exported PDF.</p>
    </div>

    <div class="subsection">What Happened</div>
    <textarea placeholder="Factual description (plain text, multiple lines)"></textarea>

    <div class="subsection">Severity</div>
    <select>
        <option value="">Choose...</option>
        <option value="low">Low — no immediate risk</option>
        <option value="med">Medium — supervision required</option>
        <option value="high">High — escalate per policy</option>
    </select>

    <div class="spacer"></div>

    <div class="section">References</div>

    <div class="indent">
        <div>Primary Write-Up (Label Plus URL)</div>
        <input type="url" placeholder="Ticket or Document Title" prompt="Link to ticketing system or doc">
    </div>

    <div class="subsection">Canonical Link (URL Only)</div>
    <input type="url" data-raw placeholder="Stable permalink">

    <div class="subsection">Prefilled Example (Optional)</div>
    <input type="url" placeholder="Safety office" data-url="https://example.org/safety" data-text="Campus safety">

    <div class="subsection">Additional References</div>
    <ul>
        <li><input type="url" placeholder="Reference Label" prompt="Link to supporting material"></li>
        <template>
            <li><input type="url" placeholder="Reference Label" prompt="Link to supporting material"></li>
        </template>
        <button class="template">Add Reference</button>
    </ul>

    <div class="spacer"></div>

    <div class="section">Witnesses</div>
    <p>Provide one block per witness. Additional contact rows are optional.</p>

    <div class="subsection">Witness 1</div>
    <div><input type="text" placeholder="Full Name"></div>
    <div class="subsection">Reachable At</div>
    <ul>
        <li>
            <input type="text" placeholder="Email or Phone">
            On <input type="date" class="us">
        </li>
        <template>
            <li>
                <input type="text" placeholder="Email or Phone">
                On <input type="date" class="us">
            </li>
        </template>
        <button class="template">Add Contact Row</button>
    </ul>

    <template>
        <div class="spacer"></div>
        <div class="subsection">Additional Witness</div>
        <div><input type="text" placeholder="Full Name"></div>
        <div class="subsection">Reachable At</div>
        <ul>
            <li>
                <input type="text" placeholder="Email or Phone">
                On <input type="date" class="us">
            </li>
            <template>
                <li>
                    <input type="text" placeholder="Email or Phone">
                    On <input type="date" class="us">
                </li>
            </template>
            <button class="template">Add Contact Row</button>
        </ul>
    </template>
    <button class="template">Add Another Witness</button>

    <div class="spacer"></div>

    <div class="section">Narrative for File</div>
    <textarea class="rich" placeholder="Formatted summary for the official record"></textarea>

    <div class="section">Attachments</div>
    <div class="subsection">Scene Photo (Single Image)</div>
    <input type="file">

    <div class="subsection">Extra Photos (Multiple)</div>
    <input type="file" multiple>

    <div class="center">When all required sections are complete, use <strong>Download Document as PDF</strong> to generate the printable document.</div>
</div>
```
