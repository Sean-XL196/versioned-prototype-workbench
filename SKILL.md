---
name: versioned-prototype-workbench
description: 生成可追溯的页面级 HTML 原型、v1.0 形式的版本化规格、成对开发与测试文档、稳定证据 ID、Git/MR 来源链和评审工作台。适用于评审原型、客户反馈变更、现网对齐或拆分多菜单大原型；除非用户明确要求，否则不用于生产界面实现。
---

# Versioned Prototype Workbench

Create reviewable HTML prototypes whose specifications, tests, evidence, and implementation commits remain traceable without loading the whole project history.

## Route The Request

Infer the route when the request is explicit. Ask one concise question only when these routes would produce materially different work:

1. **New page**: create one page-scoped prototype and its baseline specification.
2. **Documentation change**: record feedback as a new immutable version; do not edit prototype source.
3. **Prototype alignment**: implement an approved current specification and bind the revision to stable evidence IDs.
4. **History or migration**: inspect prior versions or split a legacy multi-menu prototype.

User authorization to change documentation does not authorize prototype or production-code changes. Production implementation is outside this skill unless explicitly requested.

## Start With The Project Contract

Locate `prototype.project.json`. If it does not exist, initialize a workspace with:

```bash
node <skill-dir>/scripts/protoctl.mjs init <project-root> --name "<project name>"
```

Then read only the files printed by `context` for the current intent:

```bash
node <skill-dir>/scripts/protoctl.mjs context <module>/<page> --root <project-root> --intent docs
node <skill-dir>/scripts/protoctl.mjs context <module>/<page> --root <project-root> --intent html
```

Do not scan sibling page HTML or historical versions unless the request requires cross-page behavior or history. Treat generated `dist/` files as outputs, never as editing sources.

## Required Invariants

- One user-facing menu or independently reviewable workflow has one `pageId` and one source directory.
- Page specification IDs use `v<major>.<minor>`; timestamps remain metadata and never identify versions.
- Each released specification version is immutable and contains paired dev/test deltas plus complete dev/test snapshots.
- Every requirement, change, As-Is observation, test, and alignment reference uses a stable ID from the current `evidence.json`.
- `current.json` explicitly identifies `released` and optional `draft`; never infer latest from filenames or dates.
- A documentation-only change sets the page to `docs-ahead` and leaves prototype files untouched.
- Prototype changes never outrun documentation: each revision records the exact released specification and evidence IDs it implements.
- Git-backed projects distinguish the inspected baseline commit, implementation commit, MR/PR head, and merge commit.
- A module release pins each page's specification and prototype revision; it never means all pages share one version.
- The generated workbench embeds every released development delta and complete snapshot for each page. It defaults to the selected version's delta for review, lets users switch to the complete effective specification for implementation, and keeps preview, download, and Git/MR/Diff scope synchronized without a server.
- The default working context is project manifest + module capsule + page capsule + current snapshot + relevant page source.
- Historical deltas are loaded only for comparison, provenance, migration, or audit.

## Workflow

Run `protoctl` for deterministic state transitions; edit business prose and HTML directly in the generated files.

### New Page

Read [references/create-page.md](references/create-page.md) and [references/design-standard.md](references/design-standard.md). Create a module if needed, add one page from the design template, replace draft placeholders, validate, publish the baseline, align the prototype, and build it.

### Documentation Change

Read [references/feedback-version.md](references/feedback-version.md). Create a docs-only draft. Preserve customer wording and classify changes, then update both delta documents and both complete snapshots. Publish only after validation. Do not touch `prototype/`.

### Prototype Alignment

Read [references/align-prototype.md](references/align-prototype.md), [references/design-standard.md](references/design-standard.md), and [references/git-trace.md](references/git-trace.md) for Git-backed work. Read the released snapshot and only that page's source plus explicitly declared shared contracts. Implement, verify in a browser, link the implementation commit, record alignment with evidence IDs, validate, and build.

### Migration

Read [references/migrate-legacy.md](references/migrate-legacy.md). Inventory routes and shared state first, then migrate one page at a time. Never split a shared state contract implicitly.

## Completion Evidence

Before reporting completion:

```bash
node <skill-dir>/scripts/protoctl.mjs validate --root <project-root>
node <skill-dir>/scripts/protoctl.mjs build <module>/<page> --root <project-root>
```

For interactive changes, also verify the built HTML at desktop and mobile widths. Report the released spec ID, cited evidence IDs, prototype revision/alignment state, baseline and implementation commits when configured, output HTML path, and commands actually run.

When a page has multiple released versions, verify that the workbench defaults to `current.released` and its “本版变更” view. Switching version or document view must keep preview, download label, filename, and content synchronized; switching versions preserves the selected document view. Missing MR data stays explicit, and a fixed commit-range Diff appears only when both baseline and implementation commits exist.

For a complete Chinese manual test checklist, read [references/testing-workbench.md](references/testing-workbench.md).

## Supporting Contract

Read [references/project-contract.md](references/project-contract.md) when changing manifests, version semantics, context behavior, or module releases. Read [references/design-standard.md](references/design-standard.md) before changing templates or visual foundations. The JSON schemas in `schemas/` document portable data shapes; `protoctl validate` enforces the operational invariants without third-party packages.
