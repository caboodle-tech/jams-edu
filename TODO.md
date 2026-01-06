# TODO - Critical Issues Found During Live Testing

## 1. Updater System - Multiple Critical Bugs

### Issue: Showing "undefined → undefined" for all updates
**Problem:** The updater displays "undefined → undefined" for version information on all files.

**Root Causes:**
- **New files don't have version fields**: In `src/updater.js` lines 256-261, new files are created with only `version` field, but the display code (lines 110-113) tries to access `update.userVersion` and `update.templateVersion` which don't exist for new files.
- **Logic error in display condition**: Line 111 checks `update.templateFile` which exists for BOTH new and existing files, causing the code to try displaying version info for new files that don't have `userVersion`/`templateVersion` properties.
- **Version parsing may be failing**: If `parseVersionFromFile()` returns `null` for files without version comments, and the fallback logic isn't working correctly, versions could be undefined.

**Location:** `src/updater.js` lines 102-125 (display logic) and 247-290 (compareFiles function)

---

### Issue: srcDir showing same path in update message
**Problem:** Message shows "Updated manifest srcDir: C:\Users\...\src → C:\Users\...\src" (same path).

**Root Causes:**
- **Path format mismatch**: In `bin/cli.js` line 75, `config.srcDir` is resolved to an absolute path via `resolveUserPath()`, but the manifest stores `srcDir` as a relative path (see `src/initializer.js` line 294). When compared on line 53 of `updater.js`, they appear different even though they represent the same location.
- **Comparison happens before normalization**: The check on line 53 compares paths that may be in different formats (absolute vs relative), causing false positives.
- **Message shown even when no change**: Line 55 displays the message even when the paths are functionally the same after normalization.

**Location:** `src/updater.js` lines 52-56, `bin/cli.js` line 75, `src/initializer.js` line 294

---

### Issue: Showing update list when everything is up to date
**Problem:** On a fresh install, the updater shows a long list of files to update even though everything should be up to date.

**Root Causes:**
- **Path matching failure**: In `compareFiles()` (line 252), it tries to match `f.file === templateFile.userPath`, but:
  - `userFile.file` comes from `scanUserFiles()` which uses relative paths from `scanDirectory()` (line 478)
  - `templateFile.userPath` is constructed in `scanTemplateFiles()` (lines 190-193) and may be in a different format
  - Path separators might differ (Windows `\` vs normalized `/`)
- **Manifest not properly initialized**: On fresh installs, the manifest might not have all components properly tracked, causing files to appear as "new" when they're actually already installed.
- **Version comparison logic**: The version comparison on line 275 might be incorrectly identifying files as needing updates if version parsing fails or returns unexpected values.

**Location:** `src/updater.js` lines 247-290 (compareFiles), 169-209 (scanTemplateFiles), 211-245 (scanUserFiles)

---

### Issue: Mixed path formats (relative vs absolute)
**Problem:** Some paths shown are relative (like `eslint.config.js`) while others are absolute (like `C:\Users\...\src\css\main.css`).

**Root Causes:**
- **Inconsistent path handling**: 
  - `scanUserFiles()` uses `scanDirectory()` which returns relative paths (line 478)
  - But some files might be stored in manifest with absolute paths
  - `update.file` can be either format depending on source
- **No path normalization before display**: Line 120 displays `update.file` directly without normalizing to a consistent format (relative vs absolute).
- **Template path mapping inconsistency**: The `userPath` construction in `scanTemplateFiles()` (lines 190-193) might produce different formats for different file types.

**Location:** `src/updater.js` lines 119-120 (display), throughout path construction logic

---

### Issue: Backup prompt and update list shown even when no updates needed
**Problem:** The updater asks about backups and shows the update list even when there are no actual updates available.

**Root Causes:**
- **Check happens too late**: The check on line 78 happens AFTER the comparison, but if `compareFiles()` incorrectly identifies files as needing updates, the early return never happens.
- **Logic should exit before prompts**: The backup prompt (line 92) and update list display (line 100) should only happen if there are actual updates, but the condition check might be evaluating incorrectly.

**Location:** `src/updater.js` lines 77-100

---

## 2. Missing .gitignore in Template Directory

### Issue: .gitignore not included in template files
**Problem:** When initializing a new project, `.gitignore` is not copied to the user's project.

**Root Cause:**
- The template directory (`src/template/`) does not contain a `.gitignore` file that should be copied during initialization.
- The `copyTemplateFiles()` function in `src/initializer.js` likely skips dot-files or `.gitignore` is simply missing from the template.

**Location:** `src/template/` directory, `src/initializer.js` (copyTemplateFiles method)

**Required:** 
- Create `.gitignore` in template that at minimum ignores `node_modules/` directory
- On `--init`, also add `destDir` (default: `www`) to `.gitignore` so built files aren't committed

---

## 3. CLI Commands Not Working Without Config

### Issue: Commands like `--version` fail because config check happens too early
**Problem:** Commands that don't require a config file (like `--version`, `--help`) fail with "JamsEdu config file does not exist" error.

**Root Causes:**
- **Config check before command parsing**: In `bin/cli.js` lines 36-40, the config file existence check happens before checking for commands that don't need config.
- **No early exit for no-config commands**: Commands like `--version`, `--help` should be handled before requiring a config file, but they're not checked until after the config requirement.
- **Only `--init` is handled early**: Line 22-25 handles `--init` before config check, but other no-config commands aren't.

**Location:** `bin/cli.js` lines 21-40

**Commands that should work without config:**
- `--version` / `-v`
- `--help` / `-h`
- `--init` (already works)

---

## 4. Updater Scanning Wrong Files

### Issue: package.json, README.md, and other user files showing in update list
**Problem:** The updater is trying to update files like `package.json` and `README.md` that are user-customizable and should NEVER be updated.

**Root Causes:**
- **Overly broad template scanning**: `scanTemplateFiles()` (line 207) recursively scans the ENTIRE template directory, including root-level files like `package.json` and `README.md`.
- **Mismatch with user file scanning**: `scanUserFiles()` only scans specific JamsEdu directories (js/jamsedu, css/jamsedu, eslint, docs, .vscode), so root-level template files don't match anything and appear as "new" files.
- **No whitelist/blacklist**: There's no mechanism to exclude user-customizable files from updates. Only `jamsedu.config.js` is explicitly skipped (line 180).

**Why This Is Wrong:**
- `package.json` - Users will customize dependencies, scripts, metadata
- `README.md` - Users will write their own project documentation
- `src/main.js`, `src/main.css`, `src/index.jhp` - User's custom code
- `src/templates/*.html` - User's custom templates

**Solution - Version Tag-Based Tracking (RECOMMENDED):**
After `--init`, only track files that have `@jamsedu-version` tags in the template. This is self-documenting:
- **Files WITH version tags** = JamsEdu-managed, can be updated
- **Files WITHOUT version tags** = User-customizable, never tracked/updated

**Benefits:**
- Self-documenting: presence of tag indicates "this is a JamsEdu file"
- Flexible: You control what gets tracked by adding/removing tags
- Simple: No whitelist maintenance needed
- Clear intent: If you want a file to be updatable, add a version tag

**Current Issue:** ESLint files and `.vscode/settings.json` currently have version tags, but users should be allowed to customize these. **Decision needed:** Should we remove version tags from ESLint/.vscode files, or keep tags but allow modifications (warn before overwriting)?

---

## Deep Analysis: What MUST Be Tracked vs User-Customizable

### Core Framework Files (MUST be tracked, never customizable)
These ARE JamsEdu - users shouldn't modify them:
- `src/js/jamsedu/*.js` - Core framework components
- `src/css/jamsedu/*.css` - Core framework styles
- **These should always be updated, no exceptions**

### Default Configuration Files (Tracked by default, but customizable)
Most users use defaults, but they have the right to customize:
- `eslint.config.js` and `eslint/*.js` - Code quality config
- `.vscode/settings.json` - Editor settings
- `docs/*.md` - Documentation (users might add their own)
- `src/css/main.css` - Starting template (users will customize)

### User Files (NEVER tracked)
Always belong to the user:
- `package.json` - Dependencies and project config
- `README.md` - Project documentation
- `src/main.js` - User's custom JavaScript
- `src/templates/*.html` - User's custom templates
- `src/index.jhp` and other `.jhp` files - User's pages

---

## Proposed Simple Options

### Option 1: Two-Tier System with Auto-Detection (RECOMMENDED)
**Concept:** Track by default, but auto-detect customization and stop tracking.

**Implementation:**
- **Tier 1 (Always Tracked):** Files in `js/jamsedu/` and `css/jamsedu/` - never customizable
- **Tier 2 (Default Tracked):** Files with version tags outside core directories (ESLint, docs, main.css, .vscode)
  - Tracked by default
  - If user modifies file (current hash ≠ manifest hash), set `userCustomized: true` in manifest
  - Once `userCustomized: true`, stop offering updates (unless user explicitly allows override)

**How it works:**
1. On `--init`: Track all files with version tags
2. On `--update`: Check each Tier 2 file
   - If `userCustomized: true` in manifest → skip (don't offer update)
   - If current hash ≠ manifest hash → mark as customized, skip update
   - If current hash === manifest hash but template hash differs → offer update
3. User can explicitly allow override: `jamsedu --update --force` or prompt: "File customized, overwrite? (y/n)"

**Benefits:**
- Simple: Just add `userCustomized` flag to manifest
- Automatic: Detects customization without user action
- Respectful: Once customized, we don't touch it
- Flexible: User can still override if needed

**Manifest structure:**
```json
{
  "components": {
    "eslint-config": {
      "file": "eslint.config.js",
      "version": "1.0.0",
      "hash": "abc123...",
      "userCustomized": false  // or true if user modified it
    }
  }
}
```

---

### Option 2: Version Tags + Explicit Opt-Out
**Concept:** Track files with tags, but allow explicit opt-out.

**Implementation:**
- Track all files with `@jamsedu-version` tags
- Add comment flag: `@jamsedu-user-customized` or `@jamsedu-no-update`
- If file has this flag, don't track it
- User adds flag to file when they customize it

**How it works:**
1. User customizes `eslint.config.js`
2. User adds `// @jamsedu-user-customized` at top of file
3. Updater sees flag, skips this file
4. Or: User runs `jamsedu --untrack eslint.config.js` to add flag

**Benefits:**
- Self-documenting in the file itself
- User has explicit control
- Simple flag check

**Drawbacks:**
- Requires user action (adding flag)
- Most users won't know to do this

---

### Option 3: Smart Prompt System
**Concept:** Detect customization and ask user what to do.

**Implementation:**
- Track all files with version tags
- On update, if file is customized (hash differs):
  - Prompt: "eslint.config.js has been customized. Options:"
    - 1) Keep customized (stop tracking)
    - 2) Accept update (overwrite)
    - 3) Show diff
  - Store choice in manifest

**Benefits:**
- User makes informed decision
- Flexible per-file

**Drawbacks:**
- More complex
- Requires user interaction on every update

---

### Option 4: Directory-Based Rules (Simplest)
**Concept:** Simple rules based on file location.

**Implementation:**
- **Always track:** `js/jamsedu/*`, `css/jamsedu/*`
- **Never track:** Root files (`package.json`, `README.md`), `src/templates/*`, `src/*.jhp`
- **Default track (but customizable):** Everything else with version tags
  - If user hash ≠ manifest hash → treat as customized, skip updates
  - Add `userCustomized: true` to manifest automatically

**Benefits:**
- Very simple rules
- Automatic detection
- No user action needed

**Drawbacks:**
- Less explicit than flag system

---

## Recommendation: Option 1 (Two-Tier with Auto-Detection)

**Why:**
1. **Simple to implement:** Just add `userCustomized` boolean to manifest
2. **Automatic:** Detects customization without user needing to do anything
3. **Respectful:** Once customized, we don't touch it
4. **Flexible:** Can still override if needed
5. **Clear separation:** Core framework vs config files

**Implementation details:**
- Core files (`js/jamsedu/*`, `css/jamsedu/*`): Never check `userCustomized`, always update
- Config files (ESLint, docs, main.css, .vscode): Check `userCustomized` flag
- On update check: If current hash ≠ manifest hash → set `userCustomized: true`
- If `userCustomized: true` → skip update (unless `--force` flag)

**What about `src/css/main.css`?**
- Has version tag (1.1.0) - so it's tracked
- But it's clearly user-customizable (it's their CSS!)
- **Solution:** Keep version tag (so it gets initial template), but it's Tier 2 (customizable)
- Once user modifies it, `userCustomized: true` and we stop tracking

**Alternative: Hybrid Approach**
- Use version tags as primary indicator
- Combine with a small whitelist/blacklist for edge cases
- Example: "Track all files with version tags EXCEPT eslint/* and .vscode/*"

**Location:** `src/updater.js` lines 169-209 (scanTemplateFiles) - should only scan files that have `@jamsedu-version` tags

**Implementation Options:**

**Option A: Pure Version Tag System (Simplest)**
- Only track files with `@jamsedu-version` tags
- No whitelist/blacklist needed
- Self-documenting and flexible
- **Requires:** Remove version tags from files users should customize (ESLint, main.css)

**Option B: Hybrid System (More Control)**
- Primary: Track files with `@jamsedu-version` tags
- Secondary: Small blacklist for exceptions (e.g., "never track eslint/* even if it has tags")
- Gives you control over edge cases
- **Requires:** Maintain a small blacklist array

**Option C: Hybrid with Whitelist Override**
- Primary: Track files with `@jamsedu-version` tags
- Secondary: Small whitelist for files without tags that should be tracked (e.g., docs/*.md)
- Most flexible but more complex
- **Requires:** Maintain both whitelist and use version tags

**Recommendation: Option A (Pure Version Tag System)**
- Simplest to implement and maintain
- Self-documenting (tags indicate intent)
- Easy to change: just add/remove tags
- If you want ESLint to be customizable, remove the tags
- If you want docs tracked, add tags to them

---

## 5. Config File Location

### Issue: jamsedu.config.js should be in .jamsedu directory
**Problem:** Config file is at project root, but we're already creating a `.jamsedu` directory for the manifest.

**Proposal:**
- Move `jamsedu.config.js` to `.jamsedu/config.js`
- This keeps all JamsEdu-related files in one place
- Cleaner project root
- More organized structure

**Location:** `bin/cli.js` line 32 (config file path), `src/initializer.js` line 107 (config file creation)

---

## Summary of Required Fixes

### Critical Updater Fixes
1. **Fix updater version display**: Ensure new files show correct version info or skip version display for new files
2. **Normalize path comparisons**: Compare srcDir paths in consistent format (both relative or both absolute)
3. **Fix path matching in compareFiles**: Ensure template paths and user paths are normalized to same format before comparison
4. **Early exit for no-updates case**: Verify the check works correctly and exits before showing backup prompt
5. **Consistent path formatting**: Normalize all displayed paths to relative (or absolute) consistently
6. **Implement version tag-based tracking**: After `--init`, only track files with `@jamsedu-version` tags. Don't recursively scan entire template directory - only scan files that have version tags.
7. **Exclude package.json, README.md, etc.**: These don't have version tags, so they'll automatically be excluded
8. **Decide on ESLint and main.css**: Remove version tags from ESLint files and `src/css/main.css` if users should customize them, OR keep tags but allow modifications

### Other Fixes
8. **Add .gitignore to template**: Create and include `.gitignore` in template directory (must ignore `node_modules/`)
9. **Move config check later**: Handle no-config commands (`--version`, `--help`) before checking for config file
10. **Move config file to .jamsedu/config.js**: Keep all JamsEdu files organized in one directory

---

---

## Discussion: Simplifying the Updater System

### Current Problems with Complexity

1. **Dual Tracking System (Version + Hash)**
   - Files are tracked by both version comments (`@jamsedu-version`) AND hash
   - Version comparison is used to determine if updates are needed (line 275)
   - Hash is used to detect modifications (line 271)
   - This creates confusion: if version matches but hash differs, is it modified or up-to-date?
   - **Simplification**: Just use hash comparison. If template hash ≠ user hash, offer update.

2. **Overly Complex Path Handling**
   - Paths are normalized in multiple places with different formats
   - Template paths vs user paths vs manifest paths all use different formats
   - Windows vs Unix path separators cause matching failures
   - **Simplification**: Normalize ALL paths to relative (from project root) at a single entry point, use forward slashes consistently.

3. **Recursive Template Scanning**
   - Scans entire template directory recursively (line 207)
   - Then tries to match against a limited set of user files
   - Results in false positives for files that shouldn't be updated
   - **Simplification**: Only scan files that are explicitly whitelisted (same list as manifest creation).

4. **Component Name Parsing**
   - Tries to parse component names from file comments (`@jamsedu-component`)
   - Falls back to filename if not found
   - Creates inconsistency (some files have explicit names, others use filename)
   - **Simplification**: Use consistent naming based on file path, or require component comments for all tracked files.

### Proposed Simplified Approach: Version Tag-Based Tracking

1. **Version Tag-Based Scanning (After --init)**
   - Only scan template files that have `@jamsedu-version` tags
   - No whitelist needed - tags are self-documenting
   - No recursive scanning of entire template directory
   - Simple: if file has tag, it's trackable; if not, it's user-customizable

2. **Hash + Version Comparison**
   - Keep version tags for display ("Updated from 1.0.0 → 1.1.0")
   - Use hash for actual comparison (more reliable than version strings)
   - Compare template file hash vs user file hash
   - If hashes differ, offer update
   - If user file hash differs from manifest hash, mark as modified

3. **Single Path Normalization Point**
   - Normalize all paths when reading from manifest
   - Normalize all paths when scanning template files
   - Normalize all paths when scanning user files
   - Use relative paths (from project root) with forward slashes everywhere

4. **Simplified Update Logic**
   ```
   For each file in template directory:
     - Check if file has @jamsedu-version tag
     - If no tag: skip (user-customizable file)
     - If has tag:
       - Get template file hash and version
       - Get user file hash (if exists)
       - Get manifest hash and version (if exists)
       
       If user file doesn't exist:
         → New file, offer to add
       Else if user hash ≠ template hash:
         If user hash ≠ manifest hash:
           → Modified by user, warn before update
         Else:
           → Update available (show version: old → new)
       Else:
         → Up to date, skip
   ```

5. **Initial Setup (--init)**
   - Copy ALL template files (including those without tags)
   - Create manifest with all files that have version tags
   - Files without tags are copied but never tracked for updates

### Why So Many Files Are Tracked (Current System)

Looking at the manifest, files are currently tracked via a hardcoded whitelist:

1. **JamsEdu Core Components** (js/jamsedu/*, css/jamsedu/*)
   - Framework files that should be updated
   - **Currently tracked** ✅
   - **Have version tags** ✅

2. **ESLint Configuration** (eslint/*, eslint.config.js)
   - **Currently tracked** ✅
   - **Have version tags** ✅
   - **BUT users should be allowed to customize** ⚠️
   - **Decision needed:** Remove version tags or allow modifications?

3. **Documentation** (docs/*.md)
   - **Currently tracked** ✅
   - **Do NOT have version tags** ❌
   - Should these be tracked? If yes, need to add version tags

4. **VS Code Settings** (.vscode/settings.json)
   - **Currently tracked** ✅
   - **Do NOT have version tags** ❌
   - **Users should be allowed to customize** ⚠️
   - **Decision needed:** Should this be tracked at all?

5. **src/css/main.css**
   - **Has version tag** ✅ (1.1.0)
   - **Currently tracked** ✅
   - **BUT this is user's custom CSS** ⚠️
   - **Decision needed:** Should this be tracked?

**What Should NOT Be Tracked:**
- `package.json` - User's dependencies and project config (no version tag) ✅
- `README.md` - User's project documentation (no version tag) ✅
- `src/templates/*.html` - User's custom templates (no version tags) ✅
- `src/index.jhp` - User's page templates (no version tag) ✅

### Proposed: Version Tag-Based System

**After `--init`, only track files that have `@jamsedu-version` tags:**

**Files WITH version tags (would be tracked):**
- `src/js/jamsedu/*.js` - Core JamsEdu components ✅
- `src/css/jamsedu/*.css` - Core JamsEdu styles ✅
- `eslint.config.js` - ESLint config (but users can customize) ⚠️
- `eslint/*.js` - ESLint rules (but users can customize) ⚠️
- `src/css/main.css` - Has tag but is user's custom CSS ⚠️

**Files WITHOUT version tags (would NOT be tracked):**
- `package.json` ✅
- `README.md` ✅
- `src/templates/*.html` ✅
- `src/index.jhp` ✅
- `.vscode/settings.json` ✅
- `docs/*.md` (currently tracked but no tags) ⚠️

**Decisions Needed:**
1. **ESLint files:** Remove version tags (make them user-customizable) OR keep tags but allow modifications?
2. **src/css/main.css:** Remove version tag (it's user's custom CSS)?
3. **docs/*.md:** Add version tags if we want to track them, or stop tracking?
4. **.vscode/settings.json:** Currently not tracked (no tag), which is correct ✅

---

## Proposed Simple Options (After Deep Analysis)

### Option 1: Two-Tier System with Auto-Detection ⭐ RECOMMENDED
**Concept:** Track by default, but auto-detect customization and stop tracking.

**Tiers:**
- **Tier 1 (Always Tracked):** `js/jamsedu/*` and `css/jamsedu/*` - core framework, never customizable
- **Tier 2 (Default Tracked, Customizable):** Files with version tags outside core (ESLint, docs, main.css, .vscode)
  - Tracked by default
  - If user modifies (current hash ≠ manifest hash) → set `userCustomized: true` in manifest
  - Once customized, stop offering updates (unless `--force`)

**How it works:**
1. On `--init`: Track all files with version tags, set `userCustomized: false`
2. On `--update`: For Tier 2 files:
   - If `userCustomized: true` → skip (don't offer update)
   - If current hash ≠ manifest hash → auto-set `userCustomized: true`, skip update
   - If current hash === manifest hash but template differs → offer update
3. User can override: `jamsedu --update --force` or prompt: "File customized, overwrite? (y/n)"

**Manifest structure:**
```json
{
  "components": {
    "eslint-config": {
      "file": "eslint.config.js",
      "version": "1.0.0",
      "hash": "abc123...",
      "userCustomized": false  // auto-set to true if user modifies
    }
  }
}
```

**Benefits:**
- ✅ Simple: Just add boolean flag to manifest
- ✅ Automatic: Detects customization without user action
- ✅ Respectful: Once customized, we don't touch it
- ✅ Flexible: Can still override if needed
- ✅ Clear separation: Core vs config files

---

### Option 2: Version Tags + Explicit Opt-Out
**Concept:** Track files with tags, but allow explicit opt-out via file comment.

**Implementation:**
- Track all files with `@jamsedu-version` tags
- User adds `// @jamsedu-user-customized` or `// @jamsedu-no-update` to file when they customize
- Updater sees flag, skips this file
- Or: `jamsedu --untrack eslint.config.js` command to add flag

**Benefits:**
- ✅ Self-documenting in file
- ✅ User has explicit control
- ✅ Simple flag check

**Drawbacks:**
- ❌ Requires user action (most won't know to do this)
- ❌ Less automatic

---

### Option 3: Smart Prompt System
**Concept:** Detect customization and ask user what to do each time.

**Implementation:**
- Track all files with version tags
- On update, if file customized (hash differs):
  - Prompt: "eslint.config.js has been customized. Options:"
    - 1) Keep customized (stop tracking)
    - 2) Accept update (overwrite)
    - 3) Show diff
  - Store choice in manifest

**Benefits:**
- ✅ User makes informed decision
- ✅ Flexible per-file

**Drawbacks:**
- ❌ More complex
- ❌ Requires user interaction on every update
- ❌ Slower workflow

---

### Option 4: Directory-Based Rules (Simplest)
**Concept:** Simple rules based on file location only.

**Implementation:**
- **Always track:** `js/jamsedu/*`, `css/jamsedu/*`
- **Never track:** Root files, `src/templates/*`, `src/*.jhp`
- **Default track (customizable):** Everything else with version tags
  - If user hash ≠ manifest hash → treat as customized, skip updates
  - Auto-set `userCustomized: true` in manifest

**Benefits:**
- ✅ Very simple rules
- ✅ Automatic detection
- ✅ No user action needed

**Drawbacks:**
- ❌ Less explicit than flag system
- ❌ Doesn't use version tags as primary indicator

---

## Final Recommendation: Option 1 (Two-Tier with Auto-Detection)

**Why Option 1 is best:**
1. **Respects user customization automatically** - no action needed
2. **Simple implementation** - just one boolean flag
3. **Clear separation** - core framework vs config files
4. **Flexible** - can still override if needed
5. **Uses version tags** - self-documenting what's trackable

**Implementation details:**
- Core files (`js/jamsedu/*`, `css/jamsedu/*`): Never check `userCustomized`, always update
- Config files (ESLint, docs, main.css, .vscode): Check `userCustomized` flag
- On update check: If current hash ≠ manifest hash → set `userCustomized: true`
- If `userCustomized: true` → skip update (unless `--force` flag)

**Showing customized files with available updates:**
- When files are customized (`userCustomized: true`) but template has newer version:
  - Show in a separate "Customized Files with Updates Available" section
  - Use an alternative prompt (e.g., "Show customized files with updates? (y/N)") so users aren't annoyed
  - Only show if user explicitly requests it
  - Keep it small and simple - just list the files and versions, don't prompt for each one

**What about `src/css/main.css`?**
- Keep version tag (so it gets initial template on `--init`)
- But it's Tier 2 (customizable)
- Once user modifies it, `userCustomized: true` and we stop tracking
- This gives users a starting point but respects their customization

