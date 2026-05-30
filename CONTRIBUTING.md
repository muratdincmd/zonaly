# Contributing to Zonaly

## Branching strategy

| Branch | Purpose |
|--------|---------|
| `main` | Stable releases only. Direct commits are not allowed — changes arrive via tagged releases. |
| `dev` | Active development. All feature work merges here first. |
| `feature/*` | Short-lived branches forked from `dev`, PR'd back to `dev`. |

### Workflow

```
feature/my-thing  →  dev  →  (tag v*)  →  main
```

1. Fork from `dev`: `git checkout -b feature/my-thing dev`
2. Commit your work on the feature branch.
3. Open a PR targeting `dev`.
4. After review and merge, `dev` accumulates changes until a release is ready.
5. To cut a release: bump the version, tag `main`, and push the tag — GitHub Actions handles the rest.

## Versioning

Zonaly follows [Semantic Versioning](https://semver.org/): **MAJOR.MINOR.PATCH**

| Segment | Bump when |
|---------|-----------|
| `MAJOR` | Breaking change (e.g. dropped platform, removed feature) |
| `MINOR` | New backward-compatible feature |
| `PATCH` | Bug fix, dependency update, copy change |

Pre-releases use the `-beta.N` suffix, e.g. `v0.2.0-beta.1`.

## Cutting a release

1. Update the version in **three places** (must stay in sync):
   - `package.json` → `"version"`
   - `src-tauri/Cargo.toml` → `version`
   - `src-tauri/tauri.conf.json` → `"version"`
2. Commit: `git commit -m "chore: release vX.Y.Z"`
3. Merge to `main`.
4. Tag and push:
   ```bash
   git tag vX.Y.Z
   git push origin main --tags
   ```
5. GitHub Actions builds installers for Windows, macOS (Intel + Apple Silicon), and Linux, then creates a **draft** GitHub Release. Review and publish the draft.

## Development setup

See [README.md](README.md) for prerequisites and `npm run tauri dev` instructions.

## Code style

- **Rust:** `cargo fmt` before committing; `cargo clippy -- -D warnings` must pass.
- **TypeScript:** `npm run typecheck` must pass. No `any` without a comment explaining why.
- **Tests:** `npm test` (Vitest) and `cargo test` (from `src-tauri/`) must both pass. Add tests for new pure utilities and Rust parsing logic.
- **Commits:** Use [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`).
- **Co-author lines:** Do not add `Co-Authored-By:` lines to commit messages.

## Running targeted Rust tests

```bash
# All Rust tests
cd src-tauri && cargo test

# Caching & reliability (Phase 6) — bootstrap cache, HTTP classification, backoff
cargo test rdap::bootstrap
cargo test rdap::client
cargo test rdap::whois

# Run a single test by name
cargo test rdap::bootstrap::tests::fresh_cache_is_not_expired
```
