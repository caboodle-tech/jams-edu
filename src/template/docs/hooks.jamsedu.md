<!-- @jamsedu-version: 5.0.0 -->
<!-- @jamsedu-component: docs-hooks -->
# Writing Hooks for JamsEdu

Hooks let you run custom logic during the template build. **Pre** hooks run before the main template process; **post** hooks run after it, right before the final HTML is written. Both receive the same `scope` object and work by mutating the DOM in place.

## Hook signature

Each hook is a function that receives one argument, `scope`:

```js
/**
 * @param {object} scope - The scope for the current file being processed.
 * @param {object} scope.dom - The document DOM (SOM tree). See "The DOM" below.
 * @param {string} scope.cwd - Absolute path to the directory of the current source file.
 * @param {string} scope.relPath - Relative path of the current file from the project root.
 */
const myHook = (scope) => {
    // Mutate scope.dom; no return value needed.
};
```

Hooks do **not** return a value. You change the document by calling methods on `scope.dom` and its nodes.

## The DOM: Simple HTML Parser (SOM)

The DOM your hooks interact with is produced by [simple-html-parser](https://github.com/caboodle-tech/simple-html-parser). It's a lightweight, DOM-like tree (Simple Object Model, or SOM) for parsing and modifying HTML.

- **Parser**: [simple-html-parser](https://github.com/caboodle-tech/simple-html-parser) on GitHub.

`scope.dom` is the root of the parsed document. You use it to query and mutate the tree, then the engine serializes it back to HTML. Key concepts:

- **Node types**: `'root' | 'tag-open' | 'tag-close' | 'text' | 'comment'`
- **Tree shape**: Opening and closing tags are siblings; element content lives in the opening tag's `children` array.

### Querying

| Method | Description |
|--------|-------------|
| `scope.dom.querySelector(selector)` | First element matching a CSS-like selector. |
| `scope.dom.querySelectorAll(selector)` | All elements matching a CSS-like selector. |
| `scope.dom.findAllByTag(tagName)` | All elements with the given tag name. |
| `scope.dom.findAllByAttr(attrName)` | All nodes that have the given attribute. |

CSS-like selectors support tags (`div`, `p`), IDs (`#id`), classes (`.class`), attributes (`[data-x]`, `[href="..."]`), descendants (`div p`), and `:not(selector)`. You can call these methods on any node, not only `scope.dom`.

### Node properties

- `type` – One of the node types above.
- `name` – Tag name (e.g. `'div'`, `'table'`) for element nodes.
- `attributes` – Object of attribute names to values.
- `children` – Array of child nodes.
- `parent` – Parent node reference.
- `content` – Text content for text/comment nodes.

### Attributes

- `node.getAttribute(name)` – Get attribute value.
- `node.setAttribute(name, value)` – Set attribute value.
- `node.removeAttribute(name)` – Remove an attribute.
- `node.updateAttribute(name, value, separator?)` – Append a value to an existing attribute. The optional `separator` is the string inserted between the current value and the new one (e.g. use `' '` for `class` so you get `class="container active"` instead of `class="containeractive"`).

### Manipulation

- `node.appendChild(...nodes)` – Append child nodes.
- `node.insertBefore(...nodes)` – Insert nodes before this node (sibling level).
- `node.insertAfter(...nodes)` – Insert nodes after this node (sibling level).
- `node.insertAdjacentHTML(position, html)` – Insert an HTML string at a position relative to this element. Mimics the browser's `insertAdjacentHTML` API. `position` is one of: `'beforebegin'` (before the element, outside), `'afterbegin'` (at the start of the element's children, inside), `'beforeend'` (at the end of the element's children, inside), `'afterend'` (after the element, outside). `html` is the string to parse and insert.
- `node.replaceWith(...nodes)` – Replace this node with others.
- `node.remove()` – Remove this node from the tree.
- `node.createNode(tagName, attributes?)` – **Experimental, intended for internal use.** Creates new element(s); returns an array of nodes (e.g. open/close pair). Use destructuring when you need a single logical element, e.g. `const [wrapperOpen] = node.createNode('div', { class: 'container' });` Prefer creating nodes via `insertAdjacentHTML(position, html)` or other DOM methods when possible.

### Output

- `node.toHtml(showComments?)` – Serialize node (and subtree) to HTML.
- `node.innerHtml()` – Inner HTML of the element (content only).

For more details and CSS-related APIs (e.g. for `<style>` nodes), see the [simple-html-parser README](https://github.com/caboodle-tech/simple-html-parser).

## Configuration

Register hooks in `.jamsedu/config.js` with `pre` and/or `post` arrays:

```js
import myPreHook from './hooks/myPreHook.js';
import myPostHook from './hooks/myPostHook.js';

export default {
    pre: [myPreHook],
    post: [myPostHook],
    destDir: '<your-output-dir>',
    srcDir: '<your-source-dir>',
    templateDir: '<your-template-partials-dir>'
};
```

Your hooks are merged with JamsEdu's built-in hooks; they run in addition to them (built-in post hooks include video embedding).

## Example: replace elements by selector

```js
const replaceVideos = (scope) => {
    const videoNodes = scope.dom.querySelectorAll('video[src]');

    for (const videoNode of videoNodes) {
        const url = videoNode.getAttribute('src');
        const replacementHtml = `<figure class="video"><iframe src="${url}"></iframe></figure>`;
        videoNode.insertAdjacentHTML('beforebegin', replacementHtml);
        videoNode.remove();
    }
};

export default replaceVideos;
```

## Built-in hooks

JamsEdu registers post hooks from the `@caboodle-tech/jamsedu` package (e.g. in `jamsedu-hooks`): they handle things like turning `<video src="...">` into embedded iframes. You can add your own `pre` and `post` hooks alongside these; execution order is defined by the order in the merged arrays.
