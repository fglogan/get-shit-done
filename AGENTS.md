# AGENTS.md — genesis-gsd-planning

## Project Overview

Rust-bound Node.js CLI tool for spec-driven development with multi-agent orchestration.
Pure CommonJS, zero runtime dependencies, file-system-as-database (`.planning/` directory).
Entry point: `get-shit-done/bin/gsd-tools.cjs` dispatches to 11 library modules.

## Build & Test

```bash
# Run all tests (156 tests, 34 suites, ~5s)
npm test

# Run a single test file
node --test tests/state.test.cjs

# Run a single test by name (substring match)
node --test --test-name-pattern="missing STATE.md" tests/state.test.cjs

# Build hooks (only needed before npm publish)
npm run build:hooks
```

- Test runner: Node.js built-in `node:test` (NOT Jest/Mocha). Output is TAP v13.
- No compilation step for source — `.cjs` files execute directly.
- No linter or formatter is configured. Follow existing patterns exactly.

## Project Structure

```
get-shit-done/bin/gsd-tools.cjs    CLI router (585 lines) — switch-case dispatch
get-shit-done/bin/lib/             11 library modules (5,033 lines total)
  core.cjs      Output helpers, config, git utils, phase utils, model resolution
  state.cjs     STATE.md operations (14 exported functions)
  phase.cjs     Phase CRUD, numbering, completion (~870 lines, most complex)
  frontmatter.cjs  Hand-rolled YAML subset parser (known fragility hotspot)
  roadmap.cjs   ROADMAP.md parsing and mutation
  verify.cjs    Verification suite — consistency, health, summary validation
  milestone.cjs Milestone archival, requirements lifecycle
  init.cjs      Context file collection for plan-phase/execute-phase
  commands.cjs  Standalone utility commands (list-todos, todo-complete)
  template.cjs  Template rendering
  config.cjs    Config section CRUD
tests/             7 test files + helpers.cjs
agents/            11 agent definition markdown files (gsd-*.md)
commands/gsd/      32 slash-command markdown files
get-shit-done/workflows/   33 workflow definitions
get-shit-done/templates/   26 templates
get-shit-done/references/  14 reference docs
hooks/             3 hook JS files (statusline, context-monitor, update-check)
bin/install.js     npm entry point — interactive installer (2,090 lines)
```

## Code Style

### Language & Module System
- **100% CommonJS** — `require()` imports, `module.exports = { ... }` at file bottom.
- **All source files use `.cjs` extension.** Never use `.js` or `.mjs`.
- **Node.js >= 16.7.0.** No transpilation. No TypeScript. No ESM.
- **Zero runtime dependencies.** Only `fs`, `path`, `child_process`, `os`, `crypto` from stdlib.

### Naming Conventions
- `camelCase` for functions and local variables.
- `UPPER_SNAKE_CASE` for module-level constants (e.g., `MODEL_PROFILES`).
- `snake_case` for JSON output keys (e.g., `{ phase_number, phase_name }`).
- `kebab-case` for filenames and CLI command names (e.g., `find-phase`, `state.cjs`).
- **`cmd` prefix** on all command handler functions: `cmdStateLoad`, `cmdPhaseAdd`, `cmdFindPhase`.

### Functions & Formatting
- **Function declarations** for all named functions. Never `const foo = function()`.
- **Arrow functions** only in short callbacks: `.filter(f => ...)`, `.map(e => e.name)`.
- **No classes.** Purely functional style throughout.
- **Single quotes** for strings. Template literals for interpolation. Double quotes only inside strings containing single quotes.
- **2-space indentation.** No tabs.
- **Section dividers** use Unicode box-drawing: `// --- Section Name ---` (with `U+2500` dashes).

### Error Handling
Two canonical helpers in `core.cjs` — every command uses these:

```javascript
function output(result, raw, rawValue) {
  // JSON to stdout (2-space indent), or raw string if --raw flag
  // Calls process.exit(0)
}

function error(message) {
  // JSON { error: message } to stderr
  // Calls process.exit(1)
}
```

- Commands receive `(cwd, ...args, raw)` — `raw` is the `--raw` flag boolean.
- On success: call `output(resultObject, raw, rawString)`.
- On expected failure: call `error('descriptive message')`.
- For optional/fallback operations: empty `catch {}` is acceptable (existing pattern).
- Functions return `null` on lookup failure rather than throwing.

### The `@file:` Protocol
When JSON output exceeds ~50KB, write to `/tmp/gsd-<timestamp>.json` and output
`@file:/tmp/gsd-<timestamp>.json` instead. This works around Claude Code's Bash buffer limit.

## Test Patterns

Tests are **integration tests** that spawn `gsd-tools.cjs` as a child process:

```javascript
const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const { runGsdTools, createTempProject, cleanup } = require('./helpers.cjs');

describe('command name', () => {
  let tmpDir;
  beforeEach(() => { tmpDir = createTempProject(); });
  afterEach(() => { cleanup(tmpDir); });

  test('descriptive name of behavior', () => {
    // Setup: write files into tmpDir/.planning/
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), content);

    // Execute: run CLI command
    const result = runGsdTools('state-snapshot', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    // Assert: parse JSON output, check values
    const output = JSON.parse(result.output);
    assert.strictEqual(output.field, 'expected');
  });
});
```

- `runGsdTools(args, cwd)` returns `{ success, output, error }`.
- `createTempProject()` creates a temp dir with `.planning/phases/` pre-created.
- Always `cleanup(tmpDir)` in `afterEach`.
- Exception: `phase.test.cjs` also has **unit tests** that import functions directly.

## Issue Tracking

This project uses `br` (genesis-issues) for task management:

```bash
br list                    # List all issues
br ready                   # Show unblocked, actionable issues
br show <id>               # Show issue details
br dep tree <id>           # Show dependency graph
br create "title" -t task  # Create new task
```

The `.beads/` directory contains the SQLite database and JSONL export.

## Key Warnings

1. **`.gitignore` excludes `CLAUDE.md` and `.claude/`** — this is intentional. Do not modify.
2. **`.planning/` is gitignored** — it's runtime project state, not source.
3. **`frontmatter.cjs`** is the most fragile module — hand-rolled YAML parser with
   hardcoded indent levels (4/6/8/10 spaces) in `parseMustHavesBlock()`.
4. **`cmdPhaseRemove`** in `phase.cjs` is the most complex function — regex-based
   renumbering across directories, filenames, and markdown content.
5. **Silent `catch {}` blocks** exist in `milestone.cjs`, `state.cjs`, `verify.cjs`.
   These swallow errors intentionally for optional operations but are a hardening target.
6. **Non-atomic writes** — all `fs.writeFileSync()` write directly to target files.
   No write-to-temp-then-rename pattern.
