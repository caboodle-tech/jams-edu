# JamsEdu Project Template

Welcome to your new JamsEdu project! This template provides everything you need to get started building static websites.

## Quick Start

1. **Build your site**:
   ```bash
   jamsedu --build
   ```

2. **Start development server**:
   ```bash
   jamsedu --watch
   ```

3. **View your site**: Open the URL shown in the terminal (usually `http://localhost:8080`)

## What's Included

This template includes:

- **JHP Templates**: Template engine for building HTML pages
- **TinyDocument**: Interactive document editor component
- **TinyWysiwyg**: Rich text editor component
- **DomWatcher**: DOM observation utility
- **ESLint**: Code quality and consistency tools
- **CSS Components**: Customizable styling system

## Project Structure

```
.
├── src/                    # Your source files
│   ├── templates/         # Template partials (header, footer, etc.)
│   ├── css/               # Stylesheets
│   │   ├── jamsedu/       # JamsEdu CSS components (don't modify)
│   │   └── main.css       # Your custom styles
│   ├── js/                # JavaScript files
│   │   ├── jamsedu/       # JamsEdu JS components (don't modify)
│   │   └── main.js        # Your custom JavaScript
│   └── *.jhp             # Your page templates
├── eslint/                # ESLint configuration
├── docs/                  # Documentation (this folder)
├── jamsedu.config.js      # JamsEdu configuration
└── package.json           # Project dependencies
```

## Documentation

- **[JHP Templates Guide](./docs/JHP-TEMPLATES.md)** - Learn how to use JHP template engine
- **[JavaScript Setup](./docs/JAVASCRIPT-SETUP.md)** - ⚠️ **IMPORTANT**: How to include JavaScript files
- **[CSS Customization](./docs/CSS-CUSTOMIZATION.md)** - Customize JamsEdu components
- **[JavaScript API](./docs/JAVASCRIPT-API.md)** - Use TinyDocument, TinyWysiwyg, and DomWatcher

## Key Concepts

### JHP Files

Files with `.jhp` extension are processed by JHP and converted to `.html`:

```html
<!-- src/index.jhp -->
<script>
    $include('./templates/header.html');
</script>

<h1>Welcome</h1>

<script>
    $include('./templates/footer.html');
</script>
```

### JavaScript Modules

**⚠️ CRITICAL**: Always use `type="module"` when linking JavaScript:

```html
<script type="module" src="./js/main.js"></script>
```

Without `type="module"`, ES6 imports won't work!

### CSS Customization

Override JamsEdu components using CSS variables:

```css
:root {
    --td-text-color: #333333;
    --td-link-color: #0066cc;
}
```

## Next Steps

1. Read the [JHP Templates Guide](./docs/JHP-TEMPLATES.md) to learn about templates
2. Check [JavaScript Setup](./docs/JAVASCRIPT-SETUP.md) for proper script inclusion
3. Customize styles using [CSS Customization Guide](./docs/CSS-CUSTOMIZATION.md)
4. Explore the [JavaScript API](./docs/JAVASCRIPT-API.md) for component usage

## Getting Help

- Visit [jamsedu.com](https://jamsedu.com/) for full documentation
- Check the [GitHub repository](https://github.com/caboodle-tech/jams-edu) for issues and discussions
- Run `jamsedu --help` for CLI options

Happy building! 🚀

