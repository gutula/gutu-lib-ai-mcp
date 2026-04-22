# Contributing

This repository is a standalone first-party Gutu package repo.

## Rules

- Keep package manifests, exports, docs, and verification lanes aligned in the same change.
- Keep cross-repo integration explicit through declared contracts and published package boundaries rather than hidden workspace-only coupling.
- Update `README.md`, `DEVELOPER.md`, `TODO.md`, and `SECURITY.md` whenever shipped behavior or operational boundaries change.

## Verification

Run:

```bash
bun install
bun run docs:check
bun run build
bun run typecheck
bun run lint
bun run test
```
