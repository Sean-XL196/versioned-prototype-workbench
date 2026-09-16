# Align A Prototype

1. Run `context ... --intent html` and read only the listed current snapshot, page source, capsules, and declared shared contracts.
2. Confirm `page.json.prototype.status` is `docs-ahead`. If it is already aligned, create and publish a new documented version before changing the prototype again.
3. Implement the complete released snapshot, not only its latest delta.
4. Keep one page source directory per menu. Extract shared shell code only when two or more pages genuinely reuse it. Keep page-specific data and behavior local.
5. Exercise the happy path, at least one hard rejection, and state persistence where applicable.
6. In a Git-backed project, commit the implementation and link its full SHA as described in `git-trace.md`.
7. Record alignment only after verification and cite the exact IDs implemented:

   ```bash
   node <skill-dir>/scripts/protoctl.mjs align <module>/<page> --root <project-root> --evidence CHG-001,REQ-002 --note "<verified change>"
   ```

8. Run `validate` and `build`. Inspect both the prototype and workbench at desktop and mobile widths.

Never use generated `dist/*.html` as an editing source.
