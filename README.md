# JamsEdu

JamsEdu is a feature-rich yet user-friendly static site generator designed specifically for open-source content. Originally developed to facilitate rapid creation and deployment of university courses, JamsEdu offers an ideal solution for non-technical users to swiftly build static websites with a focus on STEM content.

### Key Features:

JamsEdu prioritizes simplicity while providing a robust set of features. It's perfect for users who need a quick static site with the following capabilities:

- :hook: Customizable build hooks
- :jigsaw: Custom elements with Element Behaviors
- :globe_with_meridians: Easy internationalization (I18n) through variable usage
- :label: Efficient short tags
- :art: Flexible templates, variables, and template chaining
- :paintbrush: Comprehensive theme support
- :computer: Local development server with live reload
- :rocket: Simple CLI for building and watching

### What JamsEdu Doesn't Offer

To maintain its simplicity and focus, JamsEdu intentionally excludes some advanced static site generator features:

- :x: Automated internationalization (I18n)
- :x: Automatic (dynamic) pagination; although with JHP you can do this yourself
- :x: Built for you custom tags or components
- :x: Collections or tags
- :x: Front Matter
- :x: Shortcodes

### Choose the Right Tool

If your project requires more advanced features or you're planning to build a blog or CMS-like **static site**, consider these alternatives:

- For advanced features and blogs: [Eleventy](https://www.11ty.dev/) or [Astro](https://astro.build/)
- If you need enhanced interactivity and reusable components: [Svelte](https://svelte.dev/)

For anything more complex, or if you need a comprehensive content management system (CMS), you might want to look beyond static site generators and use a traditional CMS platform like [WordPress](https://wordpress.org/).

> [!NOTE]
> The exclusion of frameworks like React, Next.js, or Vue.js is intentional. JamsEdu focus is on **prebuilt static sites**. If your needs extend beyond that scope, this might not be the right tool for your project.

## Basic Usage

**The rest of this page is a developers quick start guide to using JamsEdu. If you want the [full documentation](https://jamsedu.com/) or consider yourself a non-technical user [visit the website](https://jamsedu.com/) instead.**

---

#### Installation

You should have node `v22+` installed on your machine along with a node package manager, usually `npm` or `pnpm`. The preferred method of using JamsEdu is to install it globally on your machine:

```bash
# Install with PNPM
pnpm install -g @caboodle-tech/jamsedu

# OR install with NPM
npm install -g @caboodle-tech/jamsedu
```

After restarting your terminal, you should now be able to use the JamsEdu command line tool. To review the [cli manual](./bin/man.md) and see all the options available to you, run:

```bash
jamsedu --help
```

To start your first project navigate in your terminal to the location where you would like to create a project and run:

```bash
jamsedu --init
```

Change directories into the project you just created and you're ready to start developing. Run the following command to start a local server and start watching your project for changes:

```bash
jamsedu --watch

# OR to see more details that could aid in development

jamsedu --watch --verbose
```

At this point you're ready to explore more advanced features of JamsEdu:

- Adding template [processing hooks](#hooks-pre-and-post)
- Additional [configuration options](#configuration-options)
- Customizing JamsEdu components (see template `docs/` folder)

## JamsEdu Configuration File

The JamsEdu configuration file is required for every JamsEdu project. Running `jamsedu --init` creates `.jamsedu/config.js` at your project root. By default the CLI uses `.jamsedu/config.js` if present, otherwise `jamsedu.config.js`. You can use any file as the config as long as you tell JamsEdu which file, e.g. `jamsedu --config path/to/my.config.js`. All paths in the config are relative to the project root (no leading `./` or `../` needed). The following is a bare minimum configuration:

```js
export default {
    destDir: 'www',
    srcDir: 'src',
    templateDir: 'src/templates'
};
```

| Option        | Required | Explanation                                                                 |
|---------------|----------|-----------------------------------------------------------------------------|
| `destDir`     | Yes      | Where the compiled (built) site is written.                                 |
| `srcDir`      | Yes      | Where the site's source files live.                                         |
| `templateDir` | Yes      | Where template and variable files live (typically inside `srcDir`).         |
| `websiteUrl`  | No       | Base URL for the site (e.g. `https://example.com`); used e.g. for sitemap. |
| `verbose`     | No       | Set to `true` for extra CLI output.                                         |
| `pre`         | No       | Array of hook functions run before the template process.                    |
| `post`        | No       | Array of hook functions run after the template process.                     |
| `doNotCopy`   | No       | Array of file extensions to exclude from build output.                      |

### Configuration Options

#### `doNotCopy` (array)

By default, JamsEdu prevents `js`, `json`, `md`, `sass`, `scss`, and `ts` files from being copied to the built site. To modify these restrictions, add the `doNotCopy` array to your configuration:

```js
export default {
    doNotCopy: ['js', 'sass', 'scss', 'ts', 'private.json', ...],
    destDir: 'www',
    srcDir: 'src',
    templateDir: 'src/templates'
};
```

> [!WARNING]
> Setting this option overwrites JamsEdu's default settings. You must include all file extensions you want to prevent from being output. Ensure you don't accidentally expose sensitive files!

When adding file extensions to `doNotCopy`, omit the leading dot. For complex file extensions (e.g., `some-important-file.private.json`), add the entire extension without the dot: `'private.json'`.

#### Hooks (`pre` and `post`)

Hooks let you register custom processing functions at different stages of the template process. **Pre** hooks run before the primary template process; **post** hooks run after it, before output. Each hook receives a `scope` object with a `dom` property: a DOM-like tree (from [simple-html-parser](https://github.com/caboodle-tech/simple-html-parser)) that you query and mutate in place. Add `pre` and/or `post` arrays to your configuration:

```js
import myPostHook from './hooks/myPostHook.js';

export default {
    pre: [],
    post: [myPostHook],
    destDir: 'www',
    srcDir: 'src',
    templateDir: 'src/templates'
};
```

Each array holds callback functions (typically imported modules). Your hooks run in addition to JamsEdu's built-in post hooks (e.g. video embedding). For how to write a hook, what's on `scope`, and the DOM API, see **[Writing hooks](./docs/hooks.md)**.

> [!TIP]
> Your `pre` and `post` arrays are merged with JamsEdu's built-in hooks; your hooks run in addition to the defaults.

#### `verbose` (boolean)

JamsEdu provides minimal output by default. To increase verbosity, you can:

1. Use the `--verbose` command-line flag for occasional detailed output.
2. Set the `verbose` flag permanently in the configuration:

```js
export default {
    verbose: true,
    destDir: 'www',
    srcDir: 'src',
    templateDir: 'src/templates'
};
```

#### `websiteUrl` (string)

Optional website URL for your site. The website url should contain the protocol and domain name:

```js
export default {
    destDir: 'www',
    srcDir: 'src',
    templateDir: 'src/templates',
    websiteUrl: 'https://example.com'
};
```