<!-- @jamsedu-version: 4.2.0 -->
<!-- @jamsedu-component: docs-JAVASCRIPT-SETUP -->
# JavaScript Setup Guide

## ⚠️ CRITICAL: Module Type Required

**You MUST use `type="module"` when linking JavaScript files that use ES6 imports!**

### Correct Usage

```html
<script type="module" src="./js/main.js"></script>
```

### What Happens Without `type="module"`

If you forget `type="module"`:
- ❌ ES6 `import` statements will fail
- ❌ Your JavaScript won't load
- ❌ You'll see errors in the browser console

### Why It's Needed

JamsEdu's JavaScript components use ES6 module syntax:

```javascript
// src/js/main.js
import { DomWatcher, TinyDocument, TinyWysiwyg } from './jamsedu/index.js';
```

Modern browsers require `type="module"` to process `import` and `export` statements.

## Including JavaScript in Your Pages

### In JHP Templates

Add the script tag in your template files:

```html
<!-- src/templates/head.html -->
<head>
    <meta charset="UTF-8">
    <title>My Site</title>
    <link rel="stylesheet" href="./css/main.css">
    <script type="module" src="./js/main.js"></script>
</head>
```

### Multiple Script Files

If you have multiple module files:

```html
<script type="module" src="./js/main.js"></script>
<script type="module" src="./js/custom.js"></script>
```

**Note**: Each module file is loaded independently. They don't share scope unless you import/export.

## File Structure

Your JavaScript files should be organized like this:

```
src/
  js/
    jamsedu/          # JamsEdu components (don't modify)
      index.js
      tiny-doc.js
      tiny-wysiwyg.js
      dom-watcher.js
    main.js           # Your custom code
    custom.js         # Additional custom code
```

## Importing JamsEdu Components

In your `main.js` or custom files:

```javascript
// Import what you need
import { DomWatcher, TinyDocument, TinyWysiwyg } from './jamsedu/index.js';

// Use the components
DomWatcher.watch('.my-element', (element) => {
    console.log('Found element:', element);
});
```

## Common Mistakes

### ❌ Wrong: Missing `type="module"`

```html
<script src="./js/main.js"></script>  <!-- Won't work! -->
```

### ✅ Correct: With `type="module"`

```html
<script type="module" src="./js/main.js"></script>  <!-- Works! -->
```

### ❌ Wrong: Using `require()` (CommonJS)

```javascript
const something = require('./module.js');  // Won't work in modules!
```

### ✅ Correct: Using `import` (ES6)

```javascript
import something from './module.js';  // Works!
```

## Browser Support

`type="module"` is supported in all modern browsers:
- Chrome 61+
- Firefox 60+
- Safari 10.1+
- Edge 16+

If you need to support older browsers, consider using a bundler or transpiler.

## Learn More

- [MDN: JavaScript Modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules)
- [MDN: script element](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script)

