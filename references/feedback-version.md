# Record A Documentation Change

Create a draft without modifying prototype source:

```bash
node <skill-dir>/scripts/protoctl.mjs change <module>/<page> --root <project-root> --docs-only --source "<source>" --bump minor
```

Use `--bump minor` for compatible requirement or interaction changes and `--bump major` for breaking rules, flows, states, or contracts. The command copies the released snapshots and evidence index into the new draft. Edit five files:

1. `change-dev.md`: source wording, requirement/interaction/rule/removal classification, parent behavior, new behavior, impact.
2. `change-test.md`: new cases, changed expectations, removed expectations, and parent regression scope.
3. `snapshot-dev.md`: integrate the change into a complete current development specification. Remove superseded wording.
4. `snapshot-test.md`: integrate the change into a complete current test specification. Remove superseded expectations.
5. `evidence.json`: index every `SRC-*`, `ASIS-*`, `CHG-*`, `REQ-*`, and `TST-*` reference used by the documents.

Do not append the delta to the end of a snapshot. A snapshot represents the effective current truth.

Publish after checking ambiguity and provenance:

```bash
node <skill-dir>/scripts/protoctl.mjs publish <module>/<page> --root <project-root>
```

Publication deliberately leaves the prototype at its prior aligned version and marks the page `docs-ahead`. Wait for explicit authorization before editing HTML. A later prototype revision must cite IDs from this released evidence index.
