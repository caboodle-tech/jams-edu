<!-- @jamsedu-version: 2.2.2 -->
<!-- @jamsedu-component: docs-quarto -->
# Quarto (`.qmd`) Guide

## What this covers

This guide explains how to use Quarto files (`.qmd`) in JamsEDU projects, how to configure Quarto in `.jamsedu/config.js`, and which JamsEDU built-ins are available in `.qmd` content.

## Quarto setup in config

Add a `quarto` object in `.jamsedu/config.js`:

```js
export default {
    srcDir: 'www/private',
    destDir: 'www/public',
    templateDir: 'www/private/templates',
    quarto: {
        template: 'www/private/templates/quarto.jhp',
        assetsDir: 'quarto-assets',
        workingDir: '.quarto'
    }
};
```

- `quarto.template`: wrapper template used when rendering `.qmd` output.
- `quarto.assetsDir`: destination namespace for Quarto-generated `_files` assets.
- `quarto.workingDir`: local Quarto staging folder used during builds.

## How JamsEDU renders `.qmd`

1. JamsEDU stages `.qmd` content in `quarto.workingDir`.
2. Quarto renders to markdown.
3. JamsEDU converts that markdown to an HTML fragment and merges JamsEDU fenced-block output.
4. The fragment is injected into `quarto.template`.

If Quarto CLI is missing, JamsEDU writes a fallback page for each `.qmd` file and continues the rest of the build.

## Quarto project YAML

Optional Quarto project YAML can be placed under `.jamsedu/`.
First match wins in this order:

1. `quarto.yml`
2. `_quarto.yml`
3. `quarto-project.yml`

JamsEDU keeps required built-in keys (for example `filters`, `engine`, `project`) so the pipeline remains valid.

## Using JamsEDU features in `.qmd`

These fenced blocks work in `.qmd` files:

- Mermaid/diagrams: `::: {.jams-mermaid}` and `::: {.jams-diagram}`
- Math: `::: {.jams-math}` and `::: {.jams-katex .macro}`
- PDF: `::: {.jams-pdf}`
- Video: `::: {.jams-video}` (optional `cite="..."`)
- Rich text: `::: {.jams-rich}`
- Tiny Document: `::: {.jams-document}`

You can also use Quarto include shortcodes:

```markdown
{{< include /features/snippets/quarto-shared-note.qmd >}}
```

## Authoring notes

- Keep `.qmd` pages under your configured `srcDir`.
- Keep shared wrappers and partials under `templateDir`.
- Use the Quarto guide page in site docs (`/features/builtins/quarto-jamsedu.html`) for complete live examples.
