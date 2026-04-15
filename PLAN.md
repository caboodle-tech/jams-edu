# JamsEDU Template Migration Plan

## Goal
Move all template-related work from `www/private` into `src/template`, restore required version header tags, enforce one blank line after headers, and validate `init` and `build` in an isolated temporary project.

## Confirmed Decisions
- Source of truth priority is `www/private`; prefer private-dir content when it conflicts with older `src/template` content.
- Version updates will be selective per file; keep current version numbers when acceptable.
- Existing `@jamsedu-component` IDs should stay stable where present, but all IDs must remain unique across template files.
- Copy all relevant files, including all `features` content and all assets.
- The template is both starter site content and the live documentation site baseline.

## Safety Principles
- Do all migration work in small, reviewable commits or checkpoints.
- Do not run `--init` in this repository root.
- Test only in a temporary directory outside this repository.
- Keep a clear mapping between source paths in `www/private` and destination paths in `src/template`.
- Preserve user-facing behavior while adding/normalizing template metadata comments.

## Header and Formatting Rules
- Every migratable template file must start with two version metadata lines.
- CSS format example:
  - `/* @jamsedu-version: x.y.z */`
  - `/* @jamsedu-component: component-id */`
- JS format example:
  - `// @jamsedu-version: x.y.z`
  - `// @jamsedu-component: component-id`
- HTML and JHP format example:
  - `<!-- @jamsedu-version: x.y.z -->`
  - `<!-- @jamsedu-component: component-id -->`
- Insert exactly one empty line after the second metadata line before file content starts.
- Keep Markdown and other non-runtime docs untagged unless we explicitly decide they are update-managed components.

## Manifest and Update System Findings
- `--init` and `--update` only track template files that include `@jamsedu-version`.
- Component identity in `.jamsedu/manifest.json` is keyed by `@jamsedu-component`.
- Duplicate component IDs would collide in the manifest, so uniqueness is required across all tagged files.
- Build/init/update strip these metadata comments from copied user project output; tags remain only in template source.
- Conclusion: tag only files we want update-managed by JamsEDU.

## Tagging Policy for This Migration
- Tag update-managed framework files:
  - `src/template/src/css/**`
  - `src/template/src/js/**`
  - `src/template/src/templates/**`
  - `src/template/docs/**` only when those docs are intended to be update-managed.
- Do not tag starter content pages by default:
  - `src/template/src/index.jhp`
  - `src/template/src/features/**` (after mapping from `www/private/features/**`)
- If we later want page-level updates, we can opt in per page by adding tags intentionally.

## Path Mapping Strategy
- Treat `www/private/assets` as the working-site equivalent of `src/template/src`.
- Treat `www/private/templates` as the working-site equivalent of `src/template/src/templates`.
- Treat `www/private/index.jhp` and `www/private/features/**` as required migration inputs, to be mapped into `src/template` paths.
- Classify files into:
  - Existing template file with updates.
  - New file that should be added to template.
  - Exceptional file that should remain outside template (only when explicitly approved).

## Migration Workflow
1. Inventory and map files:
   - Build a side-by-side list of `www/private` files and nearest `src/template` counterparts.
   - Mark each file as update, add, or approved exception.
2. Perform content migration in batches:
   - Batch by area, such as CSS, JS, templates, docs, and images.
   - For each updated file, use `www/private` as the primary source, then normalize header tags and blank line placement.
3. Metadata normalization pass:
   - Ensure all required template files have metadata comments and blank line separation.
   - Keep component IDs stable for existing files unless explicitly renamed, and verify no duplicate IDs exist.
4. Validation pass:
   - Confirm no expected file was missed.
   - Confirm metadata comments are present and correctly formatted.
   - Confirm all component IDs are unique.
5. Functional test in isolated temp project:
   - Create temp folder under repo root, such as `TEST/jamsedu-init-check`.
   - Run `node "<repo>/bin/cli.js" --init` inside that folder.
   - Run `node "<repo>/bin/cli.js" --build` in the initialized project.
   - Spot-check generated output and key migrated features.
6. Final verification:
   - Review diff for unintended edits.
   - Run any local lint checks applicable to changed template files.

## Suggested Test Commands
From `TEST/jamsedu-init-check` in this repository:
- `node "C:/Users/ckeers/Documents/Git/jams-edu/bin/cli.js" --init`
- `node "C:/Users/ckeers/Documents/Git/jams-edu/bin/cli.js" --build`

If needed for deeper validation:
- `node "C:/Users/ckeers/Documents/Git/jams-edu/bin/cli.js" --watch`

## Future Work, Self-Hosting Safe Mode
To support running JamsEDU commands in this repository without clobbering source-repo files, plan a guarded mode:
1. Detect source-repo execution context:
   - Add explicit detection, such as presence of a repo marker file or known root signature.
2. Define protected files and paths:
   - Block overwrite of files like repository `README.md`, root `package.json`, and other maintainers-only files.
3. Introduce explicit mode controls:
   - Add a safe flag or config mode, such as `--source-repo-mode`, to activate protections intentionally.
4. Dry-run and prompt behavior:
   - Show a preview of write operations in protected mode, and require confirm for risky writes.
5. Automated regression coverage:
   - Add tests for both normal project mode and source-repo protected mode.

## Remaining Questions To Confirm Before Implementation
- None currently; implementation has begun with agreed tagging policy.

## Execution Order Once Questions Are Answered
1. Confirm scope and metadata rules.
2. Create migration map.
3. Apply file updates in batches.
4. Normalize headers and blank lines.
5. Run isolated `init` and `build` tests.
6. Report results and any follow-up fixes.
