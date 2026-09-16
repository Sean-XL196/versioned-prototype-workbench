# Git And MR Trace

Git provenance has four distinct meanings:

- `baselineCommit`: the exact commit inspected for As-Is behavior and requirement differences.
- `implementationCommit`: the commit containing the reviewed implementation or prototype source.
- `changeRequest.headCommit`: the MR/PR head being reviewed.
- `changeRequest.mergeCommit`: the final merge commit, recorded only after merge.

Store full 40-character SHAs. User-facing views may abbreviate them. Never use an MR number as a commit and never label an unmerged head as the merge commit.

The workbench uses `baselineCommit...implementationCommit` as the immutable Diff range for a specification version. This range remains useful when an MR branch later advances. The MR/PR URL is a separate navigation target and must come from the same version's `trace.json`.

`init` discovers the enclosing repository by default. Use `--repo <path>` to bind another repository or `--repo none` for a standalone prototype workspace. `add-page` and `change` resolve the baseline from `HEAD` unless `--baseline-commit <ref>` is provided.

After committing implementation work, link it without rewriting immutable specification documents:

```bash
node <skill-dir>/scripts/protoctl.mjs link-commit <module>/<page> --root <project-root> \
  --role implementation --commit HEAD --version v1.1
```

Associate an MR or PR head:

```bash
node <skill-dir>/scripts/protoctl.mjs link-commit <module>/<page> --root <project-root> \
  --role mr-head --commit <sha> --mr-kind mr --mr-id 123 --mr-url <url>
```

Record the final merge with `--role merge --commit <sha>`. This is intentionally a later attestation: a commit cannot contain its own SHA without creating another commit.
