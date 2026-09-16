# Create A Page

1. Confirm the user-facing menu or independently reviewable workflow that owns the page.
2. Add the module when absent:

   ```bash
   node <skill-dir>/scripts/protoctl.mjs add-module <module> --root <project-root> --title "<title>"
   ```

3. Add one page:

   ```bash
   node <skill-dir>/scripts/protoctl.mjs add-page <module> <page> --root <project-root> --title "<title>"
   ```

4. The baseline is always `v1.0`. Edit both complete snapshots and `evidence.json`; keep `REQ-*`, `INT-*`, `RULE-*`, and `TST-*` references consistent.
5. Implement only this page under `prototype/` using the generated operational UI template. Put reusable foundations under `shared/`; put cross-page state behind a named contract and declare it in `page.json`.
6. Remove every `TODO(VPW)` marker, publish, verify the prototype, then align with `--evidence <ID[,ID]>`, validate, and build. For Git-backed projects, link the implementation commit before alignment.

Baseline snapshots must be self-contained. A developer and tester should be able to act without reading the prototype source.
