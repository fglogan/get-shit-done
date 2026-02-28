/**
 * GSD Tools Tests - Frontmatter
 *
 * Unit tests for extractFrontmatter, reconstructFrontmatter, spliceFrontmatter,
 * parseMustHavesBlock. Integration tests for frontmatter-get, frontmatter-set,
 * frontmatter-merge, frontmatter-validate CLI commands.
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { runGsdTools, createTempProject, cleanup } = require('./helpers.cjs');

// Direct imports for unit testing
const {
  extractFrontmatter,
  reconstructFrontmatter,
  spliceFrontmatter,
  parseMustHavesBlock,
} = require('../get-shit-done/bin/lib/frontmatter.cjs');

// ─── extractFrontmatter unit tests ──────────────────────────────────────────

describe('extractFrontmatter', () => {
  test('returns empty object for content without frontmatter', () => {
    const result = extractFrontmatter('# Just a heading\nSome text');
    assert.deepStrictEqual(result, {});
  });

  test('returns empty object for empty string', () => {
    const result = extractFrontmatter('');
    assert.deepStrictEqual(result, {});
  });

  test('parses simple key-value pairs', () => {
    const content = `---
phase: 01
plan: 01
type: implementation
wave: 1
---
# Plan content`;
    const result = extractFrontmatter(content);
    assert.strictEqual(result.phase, '01');
    assert.strictEqual(result.plan, '01');
    assert.strictEqual(result.type, 'implementation');
    assert.strictEqual(result.wave, '1');
  });

  test('strips quotes from values', () => {
    const content = `---
title: "My Plan"
tag: 'single-quoted'
---`;
    const result = extractFrontmatter(content);
    assert.strictEqual(result.title, 'My Plan');
    assert.strictEqual(result.tag, 'single-quoted');
  });

  test('parses inline arrays', () => {
    const content = `---
tags: [frontend, backend, api]
files: ["src/a.js", "src/b.js"]
---`;
    const result = extractFrontmatter(content);
    assert.deepStrictEqual(result.tags, ['frontend', 'backend', 'api']);
    assert.deepStrictEqual(result.files, ['src/a.js', 'src/b.js']);
  });

  test('parses block-style arrays', () => {
    const content = `---
depends_on:
  - plan-01
  - plan-02
  - plan-03
---`;
    const result = extractFrontmatter(content);
    assert.ok(Array.isArray(result.depends_on), 'depends_on should be array');
    assert.deepStrictEqual(result.depends_on, ['plan-01', 'plan-02', 'plan-03']);
  });

  test('parses nested objects', () => {
    const content = `---
must_haves:
  truths:
    - spec validated
  artifacts:
    - path: src/index.js
---`;
    const result = extractFrontmatter(content);
    assert.ok(typeof result.must_haves === 'object');
  });

  test('handles empty inline array', () => {
    const content = `---
depends_on: []
tags: []
---`;
    // The parser treats [] as a key starting with [ — let's test what actually happens
    const result = extractFrontmatter(content);
    // The inline array path: starts with [ and ends with ]
    assert.ok(Array.isArray(result.depends_on) || typeof result.depends_on === 'object');
  });

  test('handles boolean-like values as strings', () => {
    const content = `---
autonomous: true
verified: false
---`;
    const result = extractFrontmatter(content);
    assert.strictEqual(result.autonomous, 'true');
    assert.strictEqual(result.verified, 'false');
  });

  test('handles values with colons', () => {
    const content = `---
one-liner: "Fixed bug: parser was broken"
---`;
    const result = extractFrontmatter(content);
    assert.strictEqual(result['one-liner'], 'Fixed bug: parser was broken');
  });

  test('skips empty lines inside frontmatter', () => {
    const content = `---
phase: 01

plan: 02
---`;
    const result = extractFrontmatter(content);
    assert.strictEqual(result.phase, '01');
    assert.strictEqual(result.plan, '02');
  });

  test('handles keys with hyphens and underscores', () => {
    const content = `---
files_modified: 5
one-liner: did stuff
---`;
    const result = extractFrontmatter(content);
    assert.strictEqual(result.files_modified, '5');
    assert.strictEqual(result['one-liner'], 'did stuff');
  });

  test('handles numeric keys in key names', () => {
    const content = `---
step1: first
step2: second
---`;
    const result = extractFrontmatter(content);
    assert.strictEqual(result.step1, 'first');
    assert.strictEqual(result.step2, 'second');
  });

  test('handles frontmatter with no body after it', () => {
    const content = `---
phase: 01
---`;
    const result = extractFrontmatter(content);
    assert.strictEqual(result.phase, '01');
  });

  test('handles value starting with bracket but not ending with bracket', () => {
    const content = `---
opening: [
  - item1
  - item2
---`;
    const result = extractFrontmatter(content);
    assert.ok(Array.isArray(result.opening), 'should create array for [');
    assert.ok(result.opening.includes('item1'), 'should contain item1');
    assert.ok(result.opening.includes('item2'), 'should contain item2');
  });
});

// ─── reconstructFrontmatter unit tests ──────────────────────────────────────

describe('reconstructFrontmatter', () => {
  test('reconstructs simple key-value pairs', () => {
    const result = reconstructFrontmatter({ phase: '01', plan: '02', type: 'test' });
    assert.ok(result.includes('phase: 01'));
    assert.ok(result.includes('plan: 02'));
    assert.ok(result.includes('type: test'));
  });

  test('reconstructs inline arrays for short arrays', () => {
    const result = reconstructFrontmatter({ tags: ['a', 'b'] });
    assert.ok(result.includes('tags: [a, b]'));
  });

  test('reconstructs block arrays for long arrays', () => {
    const result = reconstructFrontmatter({ tags: ['very-long-tag-one', 'very-long-tag-two', 'very-long-tag-three', 'extra'] });
    assert.ok(result.includes('tags:'));
    assert.ok(result.includes('  - very-long-tag-one'));
  });

  test('reconstructs empty arrays', () => {
    const result = reconstructFrontmatter({ depends_on: [] });
    assert.ok(result.includes('depends_on: []'));
  });

  test('skips null and undefined values', () => {
    const result = reconstructFrontmatter({ phase: '01', skip: null, also_skip: undefined });
    assert.ok(result.includes('phase: 01'));
    assert.ok(!result.includes('skip'));
    assert.ok(!result.includes('also_skip'));
  });

  test('quotes values containing colons', () => {
    const result = reconstructFrontmatter({ title: 'Bug: fix parser' });
    assert.ok(result.includes('"Bug: fix parser"'));
  });

  test('quotes values containing hash symbols', () => {
    const result = reconstructFrontmatter({ ref: 'issue #42' });
    assert.ok(result.includes('"issue #42"'));
  });

  test('quotes values starting with bracket or brace', () => {
    const result = reconstructFrontmatter({ raw: '[not an array]' });
    assert.ok(result.includes('"[not an array]"'));
  });

  test('reconstructs nested objects', () => {
    const result = reconstructFrontmatter({
      config: { model: 'claude', timeout: '30' },
    });
    assert.ok(result.includes('config:'));
    assert.ok(result.includes('  model: claude'));
    assert.ok(result.includes('  timeout: 30'));
  });

  test('roundtrips simple frontmatter', () => {
    const original = { phase: '01', plan: '01', type: 'implementation', wave: '1' };
    const yaml = reconstructFrontmatter(original);
    const content = `---\n${yaml}\n---\n`;
    const parsed = extractFrontmatter(content);
    assert.strictEqual(parsed.phase, '01');
    assert.strictEqual(parsed.plan, '01');
    assert.strictEqual(parsed.type, 'implementation');
    assert.strictEqual(parsed.wave, '1');
  });
});

// ─── spliceFrontmatter unit tests ───────────────────────────────────────────

describe('spliceFrontmatter', () => {
  test('replaces existing frontmatter', () => {
    const content = `---\nphase: 01\n---\n\n# Content`;
    const result = spliceFrontmatter(content, { phase: '02', plan: '01' });
    assert.ok(result.startsWith('---\n'));
    assert.ok(result.includes('phase: 02'));
    assert.ok(result.includes('plan: 01'));
    assert.ok(result.includes('# Content'));
  });

  test('adds frontmatter to content without it', () => {
    const content = '# Just a heading\nSome text';
    const result = spliceFrontmatter(content, { phase: '01' });
    assert.ok(result.startsWith('---\n'));
    assert.ok(result.includes('phase: 01'));
    assert.ok(result.includes('# Just a heading'));
  });

  test('preserves body content after frontmatter', () => {
    const body = '\n\n# Title\n\nParagraph text with **bold** and *italic*.';
    const content = `---\nold: value\n---${body}`;
    const result = spliceFrontmatter(content, { new_field: 'new_value' });
    assert.ok(result.includes(body));
  });
});

// ─── parseMustHavesBlock unit tests ─────────────────────────────────────────

describe('parseMustHavesBlock', () => {
  test('returns empty array when no frontmatter', () => {
    const result = parseMustHavesBlock('# No frontmatter here', 'truths');
    assert.deepStrictEqual(result, []);
  });

  test('returns empty array when block not found', () => {
    const content = `---
must_haves:
    artifacts:
      - path: src/a.js
---`;
    const result = parseMustHavesBlock(content, 'truths');
    assert.deepStrictEqual(result, []);
  });

  test('parses simple string items from truths block', () => {
    const content = `---
must_haves:
    truths:
      - "validation passes"
      - "tests green"
---`;
    const result = parseMustHavesBlock(content, 'truths');
    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0], 'validation passes');
    assert.strictEqual(result[1], 'tests green');
  });

  test('parses key-value items from artifacts block', () => {
    const content = `---
must_haves:
    artifacts:
      - path: src/index.js
        provides: entry point
      - path: src/utils.js
        provides: helpers
---`;
    const result = parseMustHavesBlock(content, 'artifacts');
    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0].path, 'src/index.js');
    assert.strictEqual(result[0].provides, 'entry point');
    assert.strictEqual(result[1].path, 'src/utils.js');
    assert.strictEqual(result[1].provides, 'helpers');
  });

  test('parses key_links with nested arrays', () => {
    const content = `---
must_haves:
    key_links:
      - path: src/main.js
        imports: 3
        names:
          - "foo"
          - "bar"
---`;
    const result = parseMustHavesBlock(content, 'key_links');
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].path, 'src/main.js');
    assert.strictEqual(result[0].imports, 3);
    assert.ok(Array.isArray(result[0].names));
    assert.deepStrictEqual(result[0].names, ['foo', 'bar']);
  });

  test('handles empty frontmatter block', () => {
    const content = `---
must_haves:
    truths:
---`;
    const result = parseMustHavesBlock(content, 'truths');
    assert.deepStrictEqual(result, []);
  });

  // ─── 2-space indent tests (canonical template format) ───────────────────────

  test('parses truths with 2-space indent (canonical format)', () => {
    const content = `---
must_haves:
  truths:
    - "User can see existing messages"
    - "User can send a message"
    - "Messages persist across refresh"
---`;
    const result = parseMustHavesBlock(content, 'truths');
    assert.strictEqual(result.length, 3);
    assert.strictEqual(result[0], 'User can see existing messages');
    assert.strictEqual(result[1], 'User can send a message');
    assert.strictEqual(result[2], 'Messages persist across refresh');
  });

  test('parses artifacts with 2-space indent (canonical format)', () => {
    const content = `---
must_haves:
  artifacts:
    - path: src/components/Chat.tsx
      provides: Message list rendering
      min_lines: 30
    - path: src/app/api/chat/route.ts
      provides: Message CRUD operations
    - path: prisma/schema.prisma
      provides: Message model
---`;
    const result = parseMustHavesBlock(content, 'artifacts');
    assert.strictEqual(result.length, 3);
    assert.strictEqual(result[0].path, 'src/components/Chat.tsx');
    assert.strictEqual(result[0].provides, 'Message list rendering');
    assert.strictEqual(result[0].min_lines, 30);
    assert.strictEqual(result[1].path, 'src/app/api/chat/route.ts');
    assert.strictEqual(result[2].path, 'prisma/schema.prisma');
  });

  test('parses key_links with 2-space indent (canonical format)', () => {
    const content = `---
must_haves:
  key_links:
    - from: src/components/Chat.tsx
      to: /api/chat
      via: fetch in useEffect
    - from: src/app/api/chat/route.ts
      to: prisma.message
      via: database query
---`;
    const result = parseMustHavesBlock(content, 'key_links');
    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0].from, 'src/components/Chat.tsx');
    assert.strictEqual(result[0].to, '/api/chat');
    assert.strictEqual(result[0].via, 'fetch in useEffect');
    assert.strictEqual(result[1].from, 'src/app/api/chat/route.ts');
  });

  test('parses nested arrays with 2-space indent', () => {
    const content = `---
must_haves:
  key_links:
    - path: src/main.js
      imports: 3
      names:
        - "foo"
        - "bar"
---`;
    const result = parseMustHavesBlock(content, 'key_links');
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].path, 'src/main.js');
    assert.strictEqual(result[0].imports, 3);
    assert.ok(Array.isArray(result[0].names));
    assert.deepStrictEqual(result[0].names, ['foo', 'bar']);
  });

  test('handles mixed blocks — only extracts requested block (2-space)', () => {
    const content = `---
must_haves:
  truths:
    - "Feature works"
  artifacts:
    - path: src/index.js
      provides: entry point
  key_links:
    - from: src/a.js
      to: src/b.js
---`;
    const result = parseMustHavesBlock(content, 'artifacts');
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].path, 'src/index.js');
    assert.strictEqual(result[0].provides, 'entry point');
  });

  test('stops at sibling block boundary (2-space)', () => {
    const content = `---
must_haves:
  truths:
    - "First truth"
    - "Second truth"
  artifacts:
    - path: src/a.js
---`;
    const result = parseMustHavesBlock(content, 'truths');
    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0], 'First truth');
    assert.strictEqual(result[1], 'Second truth');
  });

  test('handles 3-space indent (unusual but valid)', () => {
    const content = `---
must_haves:
   truths:
      - "works with 3-space"
      - "still parses"
---`;
    const result = parseMustHavesBlock(content, 'truths');
    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0], 'works with 3-space');
    assert.strictEqual(result[1], 'still parses');
  });
});

// ─── CLI integration tests ──────────────────────────────────────────────────

describe('frontmatter get command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('reads all frontmatter fields', () => {
    const filePath = path.join(tmpDir, '.planning', 'phases', '01-setup', '01-01-PLAN.md');
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `---\nphase: 01\nplan: 01\ntype: setup\nwave: 1\n---\n# Plan`);

    const result = runGsdTools(`frontmatter get .planning/phases/01-setup/01-01-PLAN.md`, tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.phase, '01');
    assert.strictEqual(output.plan, '01');
    assert.strictEqual(output.type, 'setup');
  });

  test('reads specific field', () => {
    const filePath = path.join(tmpDir, '.planning', 'phases', '01-setup', '01-01-PLAN.md');
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `---\nphase: 01\nplan: 01\nwave: 2\n---\n# Plan`);

    const result = runGsdTools(`frontmatter get .planning/phases/01-setup/01-01-PLAN.md --field wave`, tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.wave, '2');
  });

  test('returns error for missing field', () => {
    const filePath = path.join(tmpDir, '.planning', 'phases', '01-setup', '01-01-PLAN.md');
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `---\nphase: 01\n---\n# Plan`);

    const result = runGsdTools(`frontmatter get .planning/phases/01-setup/01-01-PLAN.md --field nonexistent`, tmpDir);
    assert.ok(result.success); // still returns JSON, just with error

    const output = JSON.parse(result.output);
    assert.ok(output.error);
  });

  test('returns error for missing file', () => {
    const result = runGsdTools(`frontmatter get .planning/nonexistent.md`, tmpDir);
    assert.ok(result.success); // outputs JSON with error field

    const output = JSON.parse(result.output);
    assert.ok(output.error);
  });
});

describe('frontmatter set command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('sets a new field', () => {
    const filePath = path.join(tmpDir, '.planning', 'phases', '01-setup', '01-01-PLAN.md');
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `---\nphase: 01\n---\n# Plan`);

    const result = runGsdTools(`frontmatter set .planning/phases/01-setup/01-01-PLAN.md --field wave --value 3`, tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.updated, true);

    // Verify the file was actually updated
    const content = fs.readFileSync(filePath, 'utf-8');
    const fm = extractFrontmatter(content);
    assert.strictEqual(fm.wave, '3');
  });

  test('updates an existing field', () => {
    const filePath = path.join(tmpDir, '.planning', 'phases', '01-setup', '01-01-PLAN.md');
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `---\nphase: 01\nwave: 1\n---\n# Plan`);

    const result = runGsdTools(`frontmatter set .planning/phases/01-setup/01-01-PLAN.md --field wave --value 2`, tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const content = fs.readFileSync(filePath, 'utf-8');
    const fm = extractFrontmatter(content);
    assert.strictEqual(fm.wave, '2');
  });

  test('sets JSON array value', () => {
    const filePath = path.join(tmpDir, '.planning', 'phases', '01-setup', '01-01-PLAN.md');
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `---\nphase: 01\n---\n# Plan`);

    const result = runGsdTools(`frontmatter set .planning/phases/01-setup/01-01-PLAN.md --field tags --value '["a","b","c"]'`, tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const content = fs.readFileSync(filePath, 'utf-8');
    const fm = extractFrontmatter(content);
    assert.ok(Array.isArray(fm.tags));
  });
});

describe('frontmatter validate command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('validates plan schema - all fields present', () => {
    const filePath = path.join(tmpDir, '.planning', 'phases', '01-setup', '01-01-PLAN.md');
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `---
phase: 01
plan: 01
type: implementation
wave: 1
depends_on: []
files_modified: 5
autonomous: true
must_haves:
  truths:
    - "tests pass"
---
# Plan`);

    const result = runGsdTools(`frontmatter validate .planning/phases/01-setup/01-01-PLAN.md --schema plan`, tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.valid, true);
    assert.deepStrictEqual(output.missing, []);
  });

  test('validates plan schema - missing fields', () => {
    const filePath = path.join(tmpDir, '.planning', 'phases', '01-setup', '01-01-PLAN.md');
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `---\nphase: 01\nplan: 01\n---\n# Plan`);

    const result = runGsdTools(`frontmatter validate .planning/phases/01-setup/01-01-PLAN.md --schema plan`, tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.valid, false);
    assert.ok(output.missing.includes('type'));
    assert.ok(output.missing.includes('wave'));
  });

  test('validates summary schema', () => {
    const filePath = path.join(tmpDir, '.planning', 'phases', '01-setup', '01-01-SUMMARY.md');
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `---
phase: 01
plan: 01
subsystem: core
tags: [setup]
duration: 2h
completed: 2025-01-15
---
# Summary`);

    const result = runGsdTools(`frontmatter validate .planning/phases/01-setup/01-01-SUMMARY.md --schema summary`, tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.valid, true);
  });

  test('rejects unknown schema', () => {
    const filePath = path.join(tmpDir, '.planning', 'phases', '01-setup', '01-01-PLAN.md');
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `---\nphase: 01\n---\n# Plan`);

    const result = runGsdTools(`frontmatter validate .planning/phases/01-setup/01-01-PLAN.md --schema bogus`, tmpDir);
    assert.ok(!result.success, 'should fail with unknown schema');
  });
});

describe('frontmatter merge command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('merges new fields into existing frontmatter', () => {
    const filePath = path.join(tmpDir, '.planning', 'phases', '01-setup', '01-01-PLAN.md');
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `---\nphase: 01\n---\n# Plan`);

    const result = runGsdTools(`frontmatter merge .planning/phases/01-setup/01-01-PLAN.md --data '{"wave":"2","type":"setup"}'`, tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.merged, true);

    const content = fs.readFileSync(filePath, 'utf-8');
    const fm = extractFrontmatter(content);
    assert.strictEqual(fm.phase, '01');
    assert.strictEqual(fm.wave, '2');
    assert.strictEqual(fm.type, 'setup');
  });

  test('rejects invalid JSON data', () => {
    const filePath = path.join(tmpDir, '.planning', 'phases', '01-setup', '01-01-PLAN.md');
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `---\nphase: 01\n---\n# Plan`);

    const result = runGsdTools(`frontmatter merge .planning/phases/01-setup/01-01-PLAN.md --data 'not-json'`, tmpDir);
    assert.ok(!result.success, 'should fail with invalid JSON');
  });
});
