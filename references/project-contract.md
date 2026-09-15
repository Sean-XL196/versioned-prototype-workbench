# Project Contract

## Ownership

`prototype.project.json` is the root locator and module registry. Each module owns pages and releases. Each page owns its specification versions and prototype source.

```text
prototype.project.json
shared/
modules/<module>/
  module.json
  context.md
  releases/
  pages/<page>/
    page.json
    context.md
    prototype/
    versions/<version>/
      evidence.json
      trace.json
    current.json
dist/
```

Paths in manifests are relative to the manifest that contains them. Project/module/page IDs use lowercase letters, digits, and hyphens. Specification versions use `v<major>.<minor>`.

## Specification Versions

A version directory contains:

- `version.json`: identity, parent, lifecycle state, source, mode, hashes.
- `change-dev.md`: development delta from the parent.
- `change-test.md`: test delta and parent regression obligations.
- `snapshot-dev.md`: complete effective development specification at this version.
- `snapshot-test.md`: complete effective test specification at this version.
- `evidence.json`: complete current stable-ID index for sources, As-Is observations, changes, requirements, rules, interactions, and tests.
- `trace.json`: baseline, implementation, MR/PR head, and merge commits.

The draft snapshots initially copy the released parent snapshots. The author integrates the new rules into those complete snapshots and records only the delta in `change-*`.

`v1.0` is the baseline. A compatible change increments the minor component; a breaking rule, flow, state, or contract increments the major component and resets minor to zero. Dates are lifecycle metadata only.

`publish` refuses unresolved template markers, validates document IDs against `evidence.json`, verifies snapshot version headers, stores SHA-256 hashes, marks the version released, and atomically moves `current.json.released`. Released documents and evidence indexes are immutable; `trace.json` remains appendable because implementation and merge commits exist only after their source commits.

## Evidence Index

Stable IDs are page-local and monotonic by prefix:

- `SRC-*`: source wording or authority.
- `ASIS-*`: observed current behavior, optionally anchored to source path and symbol.
- `CHG-*`: difference between parent or live behavior and the requested behavior.
- `REQ-*`, `INT-*`, `RULE-*`: effective requirements and behavior.
- `TST-*`: executable acceptance or regression cases.
- `ALN-*`: explicit alignment observations when needed.

Every ID used in Markdown or a prototype revision must exist in the current complete `evidence.json`. References expressed through `*Ids` arrays must resolve to another entry.

## Prototype State

`page.json.prototype` records:

- `revision`: monotonically increasing page-local prototype revision.
- `alignedToSpec`: exact released specification implemented.
- `status`: `aligned`, `docs-ahead`, or `draft`.
- `entry`: page-local HTML source.

Documentation-only publication sets `docs-ahead` when its released spec is newer than `alignedToSpec`. `align` requires stable evidence IDs, increments the prototype revision, and records the exact specification after the author changes and verifies the page. A second revision against an already aligned specification is rejected; document the correction as a new version first.

## Module Releases

A module release is a lockfile, not a shared page version. It records for every page:

- released specification id;
- prototype revision;
- aligned specification id;
- alignment status.
- baseline and implementation commits plus MR/PR metadata when configured.

Normal releases reject `docs-ahead` pages. Use an explicit override only when the release is intentionally specification-only.

## Context Policy

For `docs`, load manifests, capsules, current pointer, released snapshot, current evidence/trace, and draft delta/snapshot when present.

For `html`, load manifests, capsules, current released snapshot, current evidence/trace, page source, and declared shared contracts.

For `history`, additionally load the version manifests and deltas on the released chain. Do not load sibling pages unless declared in `page.json.dependencies.pages` or the user asks for module-wide analysis.

Keep `context.md` short and current. It records objective, hard constraints, decisions, dependencies, implementation anchors, verification, and blockers. It must not reproduce version history.
