# Source Layout (This Repository)

This repo contains **JamsEdu** (the static site generator and tooling) **and** a **demo website** that is built with JamsEdu. If you are new here, use the map below so you know what to open for each task.

## Where Things Live

| Area | Role |
|------|------|
| **`src/`** | Primary **application source**: core generator logic, initializer and updater, packaged starter project under `src/template/` (what `jamsedu --init` copies out), and shared imports. This is the code that *is* JamsEdu when you work on the package itself. |
| **`bin/`** | **CLI entrypoint** (`cli.js`, manuals): how users run `jamsedu` (watch, build, init, and so on). Pair this with `src/` when changing behavior of the tool. |
| **`www/`** | **Demo site** for the project: a real JamsEdu project that ships with the repo so you can see how the tool behaves on a full site. |
| **`www/private/`** | **Demo source** you edit before a build. |
| **`www/public/`** | **Demo build output**: HTML, CSS, JS, and other emitted files produced when JamsEdu runs against `www/private/`. Do not treat this as the place to hand-edit long term; regenerate from `www/private/` instead. |

In `.jamsedu/config.js` (or `jamsedu.config.js`), **`templateDir`** is the folder that holds **site HTML partials** used across pages, for example a header include and a footer include. It is **not** the same thing as `src/template/` (the packaged starter project for `jamsedu --init`). **`srcDir`** and **`destDir`** are where page sources live and where the built site is written.

## What to Read Next

- **Contributing to the Generator or CLI**: start in `src/jamsedu.js` and `bin/cli.js`, then follow imports.
- **Working on the Marketing/Demo Site**: edit `www/private/`; run your usual `jamsedu --watch` / `jamsedu --build` from the repo per `package.json` scripts.
- **End-User and Configuration Docs**: see the root [README.md](../README.md) and the published site documentation.
