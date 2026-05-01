<!-- @jamsedu-version: 5.1.0 -->
<!-- @jamsedu-component: docs-jhp-templates -->
# JHP Templates Guide

## What is JHP?

JHP (JavaScript HTML Processor) is the template engine that powers JamsEdu. It processes `.jhp` files and converts them to `.html` files during the build process.

## How JHP Works

1. **File Extension**: Files with `.jhp` extension are processed by JHP
2. **Processing**: JHP processes the file and outputs `.html` in your `destDir`
3. **Template Variables**: You can use variables and includes in your `.jhp` files

JamsEdu uses **@caboodle-tech/jhp** 4.x. The CLI passes **`includeSearchRoots`** to each `JHP` `process()` call: an **ordered** list of absolute directories, **`templateDir` first** (when it differs from `srcDir`), then **`srcDir`**. That list only affects **built-in** `$include` resolution; for full control, JHP also supports a custom `includePathResolver` (rare in JamsEdu projects).

## Include paths in JamsEdu

These rules describe how **`$include('…')`** is resolved with JamsEdu's default setup (no custom resolver):

| Path form | What happens |
|------------|----------------|
| Starts with `../` | Resolve **only** from the **including file's directory** (JHP: parent-directory includes; no search roots). |
| Starts with `/` (root-semantic) | Try the path **without the leading `/`** under each `includeSearchRoot` in order: **`templateDir`**, then **`srcDir`**. |
| Other relative (e.g. `partials/x.html` or starts with `./`) | JHP tries the **current file's directory** first, then the search roots, then a legacy fallback to the **page working directory** (`#rootDir`). |
| `../` in the middle of a path | Normal path resolution; still constrained by the rules above. |

**Practical takeaways:**

- From **any** page, **`$include('/header.html')`** looks for `header.html` under your configured `templateDir` first, then under `srcDir`, so you do not have to count `../` segments for site-wide partials.
- For pages in subfolders, you can still use **explicit relatives** (e.g. `$include('../templates/header.html')`) if you prefer; that resolves from the current file's directory first.
- Partials in **`templateDir`** (often `<your-src-dir>/templates/`) are the usual home for `header.html`, `footer.html`, and `head.html`.

For the exact algorithm and options (`includeSearchRoots`, `includePathResolver`), see the [JHP repository](https://github.com/caboodle-tech/jhp) README, **Include paths** section.

## Basic Usage

### Creating a JHP File

Create a file with `.jhp` extension in your configured `srcDir`.

**Option A – root-style includes from `templateDir` / `srcDir` (good for a top-level `index.jhp`):**

```html
<!-- <your-src-dir>/index.jhp -->
<script>
    $include('/header.html');
</script>

<h1>Welcome to My Site</h1>
<p>This is my homepage.</p>

<script>
    $include('/footer.html');
</script>
```

**Option B – paths relative to the current file (same as always):**

```html
<script>
    $include('./templates/header.html');
</script>
```

When you run `jamsedu --build`, this becomes `destDir/index.html` (or the matching path under `destDir`).

## Template Partials

### Including Partials

Use `$include()` to include partial files (header, footer, etc.):

```html
<script>
    $include('/header.html');
</script>
```

Choose **`/name.html`** for includes that should follow **`templateDir` → `srcDir`**, or a **relative** path when you want resolution from the current file's location first.

### Creating Partials

Create reusable template files in your configured `templateDir` (commonly `<your-src-dir>/templates`):

**<your-templateDir>/header.html**:
```html
<header>
    <nav>
        <a href="/">Home</a>
        <a href="/about">About</a>
    </nav>
</header>
```

**<your-templateDir>/footer.html**:
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

Your templates should be organized in your `templateDir` (configured in `.jamsedu/config.js`):

```
<your-src-dir>/
  ... pages and content
<your-templateDir>/   # Reusable includes
  header.html
  footer.html
  nav.html
```

## Best Practices

1. **Organize Partials**: Keep reusable components in your configured `templateDir`
2. **Use Variables**: Define variables at the top of your `.jhp` files
3. **Root-style includes**: Use paths starting with `/` (e.g. `/header.html`) when you want the same include from many folders without `../` chains
4. **Relative paths**: Use `./` and `../` when you want resolution strictly from the current file's tree first
5. **Naming**: Use the `.jhp` extension for pages that need JHP processing; partials are often plain `.html`

## Example: Complete Page

```html
<!-- <your-src-dir>/index.jhp -->
<script>
    const title = 'Home Page';
    const description = 'Welcome to my site';

    $include('/head.html');
</script>

<script>
    $include('/header.html');
</script>

<main>
    <h1><script>$echo(title);</script></h1>
    <p><script>$echo(description);</script></p>
</main>

<script>
    $include('/footer.html');
</script>
```

## Learn More

For more advanced JHP features, visit the [JHP documentation](https://github.com/caboodle-tech/jhp).
