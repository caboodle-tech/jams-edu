# CSS Customization Guide

JamsEdu provides a powerful CSS custom property system that allows you to customize built-in features and shared site styling without modifying core CSS files.

## How It Works

JamsEdu uses CSS custom properties (CSS variables) with a fallback chain system:

```css
--doc-text-color: var(--doc-text-color, var(--color-text, #000000));
```

This means:
1. First, try `--doc-text-color` (component-specific)
2. If not set, fall back to site tokens such as `--color-text`
3. If still unset, use the hard-coded default in the stylesheet

## TinyDocument Variables

TinyDocument uses variables prefixed with `--doc-*`:

### Color Variables

```css
:root {
    /* Text and Background */
    --doc-text-color: #000000;
    --doc-bg-color: #ffffff;
    
    /* Borders */
    --doc-border-color: #bdbdbd;
    --doc-border-color-light: #e0e0e0;
    
    /* Links and Focus */
    --doc-link-color: #1976d2;
    --doc-focus-color: #2196F3;
    --doc-focus-shadow: 0 0 0 2px rgba(33, 150, 243, 0.2);
    
    /* Primary Colors */
    --doc-primary-bg-color: #2196F3;
    --doc-primary-text-color: #ffffff;
    --doc-primary-hover-bg-color: #1976D2;
    --doc-primary-active-bg-color: #1565C0;
    
    /* Danger Colors */
    --doc-danger-color: #d32f2f;
    --doc-danger-hover-color: #b71c1c;
    
    /* Placeholder */
    --doc-placeholder-color: #9e9e9e;
}
```

### Spacing Variables

```css
:root {
    --doc-spacing: 14pt;
    --doc-margin: 14pt;
    --doc-padding: 14pt;
    --doc-border-radius: 4px;
}
```

### Typography Variables

```css
:root {
    --doc-font-size: 14pt;
    --doc-line-height: 1.5;
}
```

### Shadow Variables

```css
:root {
    --doc-shadow: 0 2px 8px rgba(0,0,0,0.15);
}
```

## TinyWysiwyg Variables

TinyWysiwyg uses variables prefixed with `--richtext-*`:

### Color Variables

```css
:root {
    /* Text and Background */
    --richtext-text-color: #000000;
    --richtext-content-bg-color: #ffffff;
    --richtext-container-bg-color: #ffffff;
    --richtext-toolbar-bg-color: #f8f9fa;
    
    /* Borders */
    --richtext-border-color: #dddddd;
    
    /* Links */
    --richtext-link-color: #3498db;
    
    /* Code and Blockquotes */
    --richtext-code-bg-color: #f4f4f4;
    --richtext-blockquote-bg-color: #f9f9f9;
    
    /* Buttons */
    --richtext-button-text-color: #000000;
    --richtext-button-hover-bg-color: #e8e8e8;
    
    /* Primary Colors */
    --richtext-primary-bg-color: #2196F3;
    --richtext-primary-text-color: #ffffff;
    --richtext-primary-hover-bg-color: #1976D2;
    
    /* Danger Colors */
    --richtext-danger-bg-color: #dc3545;
    --richtext-danger-text-color: #ffffff;
    --richtext-danger-hover-bg-color: #bb2d3b;
    
    /* Modal */
    --richtext-modal-backdrop-color: rgba(0, 0, 0, 0.5);
    --richtext-modal-button-bg-color: #f8f9fa;
    
    /* Focus */
    --richtext-focus-color: #1976d2;
    --richtext-focus-shadow: 0 0 0 2px rgba(25, 118, 210, 0.1);
}
```

### Spacing Variables

```css
:root {
    --richtext-spacing: 16px;
    --richtext-margin: 16px;
    --richtext-padding: 16px;
    --richtext-gap: 7px;
    --richtext-border-radius: 4px;
}
```

### Typography Variables

```css
:root {
    --richtext-font-size: 18px;
    --richtext-line-height: 1.6;
}
```

### Transition Variables

```css
:root {
    --richtext-transition-duration: 0.2s;
}
```

## How to Customize

### Option 1: Override in Your CSS

Add custom properties to your `src/css/main.css`:

```css
:root {
    /* Override TinyDocument colors */
    --doc-text-color: #333333;
    --doc-bg-color: #f5f5f5;
    --doc-link-color: #0066cc;
    
    /* Override TinyWysiwyg colors */
    --richtext-text-color: #333333;
    --richtext-toolbar-bg-color: #ffffff;
}
```

### Option 2: Use Global Variables

Set shared site tokens that built-in features can inherit through their fallback chains:

```css
:root {
    /* Shared site tokens */
    --color-text: #333333;
    --color-bg-page: #f5f5f5;
    --color-link: #0066cc;
    --color-border: #cccccc;
    
    /* Built-in features inherit these when feature-specific tokens are not set */
}
```

### Option 3: Component-Specific

Override only for specific components:

```css
:root {
    /* Only affects TinyDocument */
    --doc-text-color: #000000;
    
    /* Only affects TinyWysiwyg */
    --richtext-text-color: #333333;
}
```

## Dark Mode Support

Vendor chrome follows the same theme as `tokens/colors.css`. That sheet keys off the theme radios: `name="theme-preference"` with `value` set to `system`, `dark`, or `light`. Choosing `system` uses dark when `prefers-color-scheme` is dark; `dark` or `light` override the OS. You can duplicate the `.theme-menu` block (header and footer) because selectors use `name`/`value`, not element `id`s.

You can customize dark mode colors (for example):

```css
:root {
    /* Light mode colors */
    --doc-text-color: #000000;
    --doc-bg-color: #ffffff;
}

@media (prefers-color-scheme: dark) {
    :root {
        /* Dark mode colors */
        --doc-text-color: #e0e0e0;
        --doc-bg-color: #2a2a2a;
    }
}
```

## Example: Complete Customization

```css
/* src/css/main.css */
:root {
    /* Global theme colors */
    --primary: #3498db;
    --secondary: #2c3e50;
    --accent: #e74c3c;
    
    /* TinyDocument customization */
    --doc-text-color: var(--secondary);
    --doc-link-color: var(--primary);
    --doc-primary-bg-color: var(--primary);
    
    /* TinyWysiwyg customization */
    --richtext-text-color: var(--secondary);
    --richtext-link-color: var(--primary);
    --richtext-toolbar-bg-color: #f8f9fa;
    
    /* Spacing */
    --doc-spacing: 16pt;
    --richtext-spacing: 20px;
}
```

## Best Practices

1. **Use Global Variables**: Set common values as global variables for consistency
2. **Component-Specific Overrides**: Only override component-specific variables when needed
3. **Dark Mode**: Always provide dark mode colors for better UX
4. **Test Changes**: Test your customizations in both light and dark modes

## Full Variable Reference

For a complete list of all available variables, check the source files:
- `src/css/vendor/jamsedu/embed-pdf.css` — all `--pdf-*` variables (Embed PDF viewer)
- `src/css/vendor/jamsedu/tiny-document.css` — all `--doc-*` variables
- `src/css/vendor/jamsedu/tiny-wysiwyg.css` — all `--richtext-*` variables

