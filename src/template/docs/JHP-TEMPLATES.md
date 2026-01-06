# JHP Templates Guide

## What is JHP?

JHP (JavaScript HTML Processor) is the template engine that powers JamsEdu. It processes `.jhp` files and converts them to `.html` files during the build process.

## How JHP Works

1. **File Extension**: Files with `.jhp` extension are processed by JHP
2. **Processing**: JHP processes the file and outputs `.html` in your `destDir`
3. **Template Variables**: You can use variables and includes in your `.jhp` files

## Basic Usage

### Creating a JHP File

Create a file with `.jhp` extension in your `srcDir`:

```html
<!-- src/index.jhp -->
<script>
    $include('./templates/header.html');
</script>

<h1>Welcome to My Site</h1>
<p>This is my homepage.</p>

<script>
    $include('./templates/footer.html');
</script>
```

When you run `jamsedu --build`, this becomes `destDir/index.html`.

## Template Partials

### Including Partials

Use `$include()` to include partial files (header, footer, etc.):

```html
<script>
    $include('./templates/header.html');
</script>
```

**Important**: The path is relative to the current `.jhp` file's location.

### Creating Partials

Create reusable template files in your `templateDir` (default: `src/templates/`):

**src/templates/header.html**:
```html
<header>
    <nav>
        <a href="/">Home</a>
        <a href="/about">About</a>
    </nav>
</header>
```

**src/templates/footer.html**:
```html
<footer>
    <p>&copy; 2024 My Site</p>
</footer>
```

## Variables

### Using Variables

JHP supports variables that can be used in your templates:

```html
<script>
    const title = 'My Awesome Site';
    const description = 'This is my site description';
</script>
<!DOCTYPE html>
<html>
<head>
    <title><script>$echo(title);</script></title>
    <meta name="description" content="<script>$echo(description);</script>">
</head>
<body>
    <h1><script>$echo(title);</script></h1>
</body>
</html>
```

### Outputting Variables

Use `$echo()` to output variable values:

```html
<script>$echo(variableName);</script>
```

## Template Directory Structure

Your templates should be organized in your `templateDir` (configured in `jamsedu.config.js`):

```
src/
  templates/          # Your templateDir
    header.html
    footer.html
    nav.html
  index.jhp          # Your pages
  about.jhp
```

## Best Practices

1. **Organize Partials**: Keep reusable components in `src/templates/`
2. **Use Variables**: Define variables at the top of your `.jhp` files
3. **Relative Paths**: Use relative paths for `$include()` based on file location
4. **Naming**: Use `.jhp` extension for all template files

## Example: Complete Page

```html
<!-- src/index.jhp -->
<script>
    const title = 'Home Page';
    const description = 'Welcome to my site';
    
    $include('./templates/head.html');
</script>

<script>
    $include('./templates/header.html');
</script>

<main>
    <h1><script>$echo(title);</script></h1>
    <p><script>$echo(description);</script></p>
</main>

<script>
    $include('./templates/footer.html');
</script>
```

## Learn More

For more advanced JHP features, visit the [JHP documentation](https://github.com/caboodle-tech/jhp).

