# CSS Architecture for the Modern Cascade

## Course Notes — Advanced CSS

---

## What This Document Covers

This document defines the CSS architecture used in the course project. It
explains the folder structure, layer strategy, naming conventions, and how
native CSS features (`@layer`, `@import`, `@scope`, `:has()`, `color-scheme`)
replace the mechanical enforcement that methodologies like ITCSS and BEM were
invented to provide.

This is not a history lesson — it is a working architecture. But understanding
*why* it is structured this way requires knowing what came before.

---

## The Architecture at a Glance

```
css/
├── base/
│   ├── reset.css
│   └── elements.css
├── components/
│   ├── callouts.css
│   ├── details.css
│   └── color-mode-toggle.css
├── fonts/
│   └── ...
├── layout/
│   ├── content-grid.css
│   ├── columns-grid.css
│   ├── header.css
│   ├── footer.css
│   └── primary.css
├── tokens/
│   ├── colors.css
│   └── variables.css
├── utilities/
│   └── utilities.css
├── vendor/
│   └── ...
└── main.css
```

### `main.css` — The Entry Point

```css
@layer tokens, base, layout, components, utilities, vendor;

@import 'tokens/colors.css' layer(tokens);
@import 'tokens/variables.css' layer(tokens);

@import 'base/reset.css' layer(base);
@import 'base/elements.css' layer(base);

@import 'layout/primary.css' layer(layout);
@import 'layout/content-grid.css' layer(layout);
@import 'layout/columns-grid.css' layer(layout);

@import 'components/callouts.css' layer(components);
@import 'components/details.css' layer(components);
@import 'components/color-mode-toggle.css' layer(components);

@import 'utilities/utilities.css' layer(utilities);

@import 'vendor/example-vendor-library.css' layer(vendor);
```

The `@layer` declaration at the top establishes cascade priority. Every
`@import` assigns its file to a specific layer. The browser enforces the
order — no human discipline required.

---

## Layer Definitions

Each layer has a clear purpose. Folder names match layer names so the
architecture is self-documenting.

### `tokens` — Design Tokens (No Selectors)

Custom properties only. Colors, spacing, typography scales, border radii,
breakpoints. These files produce no CSS rules — they declare variables that
other layers consume.

**What belongs here:** `--color-bg`, `--spacing-md`, `--font-family-base`,
`--radius-sm`

**What does not belong here:** Any selector, any rule block, any `@font-face`

### `base` — Resets and Element Defaults

Two files: a reset/normalize and bare element styling. These set the default
appearance of `a`, `p`, `h1`–`h6`, `table`, `code`, `blockquote`, etc.

**Guidelines:**
- Use `:where()` for element defaults when possible — this keeps specificity
  at zero so component styles never fight with base styles.
- Avoid nesting under `html body`. With `@layer` controlling cascade order,
  flat selectors like `a` or `table` in the `base` layer are sufficient.
  Deep nesting like `html body a` creates specificity `0,0,3` that is
  unnecessary and painful to override.
- `@font-face` declarations belong here (in `reset.css` or a dedicated
  `fonts.css`), not in tokens.

### `layout` — Structural Patterns

Page-level layout: headers, footers, grid systems, content wrappers. These
define *where things go*, not *what they look like*.

**What belongs here:** Content grids, column systems, header/footer structure,
sidebar layouts, sticky positioning

**What does not belong here:** Colors, typography, decorative borders — those
are component or token concerns

### `components` — UI Blocks

Self-contained, reusable pieces of interface: callouts, cards, toggles,
modals, navigation menus, buttons. Each component file should be
independently understandable.

**Test for "is this a component?":** Could you move this CSS file to a
different project and have it work with minimal changes? If yes, it is a
component.

### `utilities` — Override Helpers

High-priority, single-purpose classes: `.visually-hidden`, `.text-center`,
`.flow > * + *`, `.full-bleed`. Utilities win over components because they
appear in a later layer.

**What belongs here:** Small, composable classes that override one or two
properties.

**What does not belong here:** Multi-property styled blocks. If it has more
than 3–4 declarations and describes a visual unit, it is a component.

### `vendor` — Third-Party Code

Styles from libraries, CMS outputs, or shared dependencies. Isolating vendor
code in its own layer prevents it from unexpectedly overriding your styles
(or vice versa).

### Where Visual Effects CSS Belongs

Gradients, filters, blend modes, and backdrop effects don't get their own
layer — they live within the layer that matches their scope:

- **A frosted glass card, a blended hero image, a gradient-patterned section
  background** — these are styled UI blocks. They belong in `components`.
- **A reusable `.frosted-glass` or `.grayscale-hover` helper class** — single-
  purpose, composable, applied via markup. These belong in `utilities`.
- **A gradient or filter applied to a bare element like `body` or `img`** —
  element-level default styling. This belongs in `base`.

The distinction is the same as any other CSS: is it a self-contained block
(component), a small override (utility), or a document-level default (base)?
The visual technique doesn't change where it goes — the role it plays does.

---

## How This Maps to ITCSS

The folder/layer structure is a modernized version of ITCSS with native
cascade enforcement replacing convention-based ordering.

| ITCSS Layer    | Our Layer      | What Changed                          |
|----------------|----------------|---------------------------------------|
| Settings       | `tokens`       | Same concept, now uses `@layer`       |
| Tools          | (removed)      | Native CSS has `calc()`, `min()`,     |
|                |                | `clamp()` — Sass mixins less needed   |
| Generic        | `base` (reset) | Same concept                          |
| Elements       | `base` (elements) | Same concept                       |
| Objects        | `layout`       | Renamed for clarity                   |
| Components     | `components`   | Same concept                          |
| Utilities      | `utilities`    | Same concept, enforced by `@layer`    |
| (none)         | `vendor`       | New — isolates third-party code       |

The key difference: ITCSS relied on developers maintaining file order
manually and trusting that no one would introduce a high-specificity selector
in the wrong layer. `@layer` makes that structurally impossible — a rule in
`base` cannot beat a rule in `components` regardless of specificity.

---

## How This Maps to CUBE CSS

CUBE CSS (Composition, Utility, Block, Exception) influenced the naming
and separation of concerns:

- **Composition** → Our `layout` layer. Defines how elements are arranged.
- **Utility** → Our `utilities` layer. Single-purpose overrides.
- **Block** → Our `components` layer. Self-contained UI pieces.
- **Exception** → Handled via `:has()`, data attributes, or ARIA states
  within component files rather than a separate folder.

CUBE's emphasis on "the CSS cascade is your friend, not your enemy" aligns
perfectly with the `@layer` approach. We are not fighting specificity — we
are using it intentionally at each tier.

---

## Common Mistakes and How to Avoid Them

### Putting Components in Utilities

If a file defines a styled block with multiple properties, a background,
borders, padding, and semantic structure — it is a **component**, not a
utility. Callouts, detail/summary blocks, and toggle switches are components.

Utilities are small: `.visually-hidden`, `.flow > * + *`, `.sr-only`.

### Nesting Everything Under `html body`

```css
/* Avoid — creates unnecessary specificity */
html {
    body {
        a {
            color: var(--link-clr);
            /* Specificity: 0,0,3 */
        }
    }
}

/* Prefer — flat selectors, let @layer handle priority */
a {
    color: var(--link-clr);
    /* Specificity: 0,0,1 */
}
```

With `@layer`, the `base` layer's `a` rule will never accidentally override
a component's link styling because components live in a later layer. You do
not need extra specificity as insurance.

### Splitting One Concern Across Multiple Layers

If a vendor library's CSS is imported into both `base` and `components`
layers, its internal cascade assumptions break. Keep each dependency in a
single layer.

### Naming Conflicts

Avoid having files with the same name in different folders (e.g., `main.css`
at the root and `main.css` inside `layout/`). Build tools and human readers
both struggle with this.

---

## Color Architecture: From Duplication to Derivation

The `tokens/colors.css` file is where the biggest architectural win lives.
See the companion document **"Modern CSS Dark/Light Mode: From Duplication
to Derivation"** for the full pattern, but here is the summary:

**Old approach (what our `colors.css` currently does):**
Every color token is defined three times — once for light default, once
inside `&.dark`, and once inside `@media (prefers-color-scheme: dark)`.

**New approach:**
Define light tokens once. Derive dark tokens using `oklch(from ...)` relative
color syntax inside a `@container style(--theme: ...)` query. The toggle
uses `:has()` on radio buttons — no JavaScript needed.

```css
body {
    --clr-bg: #FAFBFC;
    --clr-text: #1E293B;

    @container style(--theme: 🌑) {
        color-scheme: dark;
        --clr-bg: oklch(from var(--clr-bg) calc(l - 0.82) c h);
        --clr-text: oklch(from var(--clr-text) calc(l + 0.60) c h);
    }
}
```

One source of truth. No duplication. Dark values derived from light values.

---

## PostCSS and the Production Pipeline

During development, the `@import` statements and `@layer` declarations work
natively in modern browsers. For production:

- **PostCSS** bundles the `@import` chain into a single file
- **Autoprefixer** adds vendor prefixes where still needed
- **cssnano** (or similar) minifies the output
- Source maps connect the bundled output back to individual files for
  debugging

The `@layer` declarations survive bundling — they are native CSS that the
browser interprets. PostCSS does not need to transform them.

---

## AI and Architecture

AI tools generate CSS that is syntactically correct but architecturally
naive. Common issues:

- Everything in one file with no layer awareness
- Deep nesting that inflates specificity unnecessarily
- Duplicated token blocks for dark/light themes
- `:is()` where `:where()` would be more appropriate
- Missing `@layer` declarations entirely

A student who understands this architecture can take AI-generated CSS and
refactor it into the right layer, flatten unnecessary specificity, and
replace duplicated tokens with derived values. The architecture is the
**quality filter** through which all CSS — human or AI-generated — should
pass.

---

## References

- [MDN: @layer](https://developer.mozilla.org/en-US/docs/Web/CSS/@layer)
- [MDN: @scope](https://developer.mozilla.org/en-US/docs/Web/CSS/@scope)
- [MDN: @import](https://developer.mozilla.org/en-US/docs/Web/CSS/@import)
- [ITCSS: Scalable and Maintainable CSS Architecture — Xfive](https://www.xfive.co/blog/itcss-scalable-maintainable-css-architecture)
- [CUBE CSS — Andy Bell](https://cube.fyi/)
- [Every Layout — Heydon Pickering & Andy Bell](https://every-layout.dev/)
- Companion doc: **Modern CSS Dark/Light Mode: From Duplication to Derivation**
- Companion doc: **Specificity, Selectors, and Cascade Strategy**