# CSS Customization Guide

JamsEdu provides a powerful CSS custom property system that allows you to customize the appearance of TinyDocument and TinyWysiwyg components without modifying the core CSS files.

## How It Works

JamsEdu uses CSS custom properties (CSS variables) with a fallback chain system:

```css
--_text-color: var(--td-text-color, var(--text-color, #000000));
```

This means:
1. First, try `--td-text-color` (component-specific)
2. If not found, try `--text-color` (global)
3. If not found, use default `#000000`

## TinyDocument Variables

TinyDocument uses variables prefixed with `--td-*`:

### Color Variables

```css
:root {
    /* Text and Background */
    --td-text-color: #000000;
    --td-bg-color: #ffffff;
    
    /* Borders */
    --td-border-color: #bdbdbd;
    --td-border-color-light: #e0e0e0;
    
    /* Links and Focus */
    --td-link-color: #1976d2;
    --td-focus-color: #2196F3;
    --td-focus-shadow: 0 0 0 2px rgba(33, 150, 243, 0.2);
    
    /* Primary Colors */
    --td-primary-bg-color: #2196F3;
    --td-primary-text-color: #ffffff;
    --td-primary-hover-bg-color: #1976D2;
    --td-primary-active-bg-color: #1565C0;
    
    /* Danger Colors */
    --td-danger-color: #d32f2f;
    --td-danger-hover-color: #b71c1c;
    
    /* Placeholder */
    --td-placeholder-color: #9e9e9e;
}
```

### Spacing Variables

```css
:root {
    --td-spacing: 14pt;
    --td-margin: 14pt;
    --td-padding: 14pt;
    --td-border-radius: 4px;
}
```

### Typography Variables

```css
:root {
    --td-font-size: 14pt;
    --td-line-height: 1.5;
}
```

### Shadow Variables

```css
:root {
    --td-shadow: 0 2px 8px rgba(0,0,0,0.15);
}
```

## TinyWysiwyg Variables

TinyWysiwyg uses variables prefixed with `--tw-*`:

### Color Variables

```css
:root {
    /* Text and Background */
    --tw-text-color: #000000;
    --tw-bg-color: #ffffff;
    --tw-container-bg-color: #ffffff;
    --tw-toolbar-bg-color: #f8f9fa;
    
    /* Borders */
    --tw-border-color: #dddddd;
    
    /* Links */
    --tw-link-color: #3498db;
    
    /* Code and Blockquotes */
    --tw-code-bg-color: #f4f4f4;
    --tw-blockquote-bg-color: #f9f9f9;
    
    /* Buttons */
    --tw-button-text-color: #000000;
    --tw-button-hover-bg-color: #e8e8e8;
    
    /* Primary Colors */
    --tw-primary-bg-color: #2196F3;
    --tw-primary-text-color: #ffffff;
    --tw-primary-hover-bg-color: #1976D2;
    
    /* Danger Colors */
    --tw-danger-bg-color: #dc3545;
    --tw-danger-text-color: #ffffff;
    --tw-danger-hover-bg-color: #bb2d3b;
    
    /* Modal */
    --tw-modal-backdrop-color: rgba(0, 0, 0, 0.5);
    --tw-modal-button-bg-color: #f8f9fa;
    
    /* Focus */
    --tw-focus-color: #1976d2;
    --tw-focus-shadow: 0 0 0 2px rgba(25, 118, 210, 0.1);
}
```

### Spacing Variables

```css
:root {
    --tw-spacing: 16px;
    --tw-margin: 16px;
    --tw-padding: 16px;
    --tw-gap: 7px;
    --tw-border-radius: 4px;
}
```

### Typography Variables

```css
:root {
    --tw-font-size: 18px;
    --tw-line-height: 1.6;
}
```

### Transition Variables

```css
:root {
    --tw-transition-duration: 0.2s;
}
```

## How to Customize

### Option 1: Override in Your CSS

Add custom properties to your `src/css/main.css`:

```css
:root {
    /* Override TinyDocument colors */
    --td-text-color: #333333;
    --td-bg-color: #f5f5f5;
    --td-link-color: #0066cc;
    
    /* Override TinyWysiwyg colors */
    --tw-text-color: #333333;
    --tw-toolbar-bg-color: #ffffff;
}
```

### Option 2: Use Global Variables

Set global variables that both components will use:

```css
:root {
    /* Global variables (used by both components) */
    --text-color: #333333;
    --bg-color: #f5f5f5;
    --link-color: #0066cc;
    --border-color: #cccccc;
    
    /* Both TinyDocument and TinyWysiwyg will use these */
}
```

### Option 3: Component-Specific

Override only for specific components:

```css
:root {
    /* Only affects TinyDocument */
    --td-text-color: #000000;
    
    /* Only affects TinyWysiwyg */
    --tw-text-color: #333333;
}
```

## Dark Mode Support

Both components support dark mode automatically via `prefers-color-scheme: dark` or by adding `.dark` or `.dark-mode` class to `<html>`:

```html
<html class="dark">
```

You can customize dark mode colors:

```css
:root {
    /* Light mode colors */
    --td-text-color: #000000;
    --td-bg-color: #ffffff;
}

@media (prefers-color-scheme: dark) {
    :root {
        /* Dark mode colors */
        --td-text-color: #e0e0e0;
        --td-bg-color: #2a2a2a;
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
    --td-text-color: var(--secondary);
    --td-link-color: var(--primary);
    --td-primary-bg-color: var(--primary);
    
    /* TinyWysiwyg customization */
    --tw-text-color: var(--secondary);
    --tw-link-color: var(--primary);
    --tw-toolbar-bg-color: #f8f9fa;
    
    /* Spacing */
    --td-spacing: 16pt;
    --tw-spacing: 20px;
}
```

## Best Practices

1. **Use Global Variables**: Set common values as global variables for consistency
2. **Component-Specific Overrides**: Only override component-specific variables when needed
3. **Dark Mode**: Always provide dark mode colors for better UX
4. **Test Changes**: Test your customizations in both light and dark modes

## Full Variable Reference

For a complete list of all available variables, check the source files:
- `src/css/jamsedu/tiny-document.css` - All `--td-*` variables
- `src/css/jamsedu/tiny-wysiwyg.css` - All `--tw-*` variables

