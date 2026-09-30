# Anti-slop provenance

## Installed source

- Installer: `install-anti-slop` skill bundled with Codex.
- Copy command: `/Users/macos/.agents/skills/install-anti-slop/scripts/install.mjs`.
- Installed path: `tools/oxlint/anti-slop/`.
- Install date: 2026-09-15.
- Generic plugin entry point: `tools/oxlint/anti-slop/index.ts`.
- Upstream repository/revision for the generic rule bundle: unknown in the bundled installer snapshot; do not infer a commit from the npm package version.
- The pristine local installer source remains available to this environment at `/Users/macos/.agents/skills/install-anti-slop/` for comparison during a future update.

## Vendored dependencies and intentional configuration

- `vendor/eslint-stylistic/UPSTREAM.md` records the exact upstream commit for the vendored padding rule and its local adaptations.
- This repository uses the generic anti-slop plugin only. The optional Effect plugin is not registered because `effect` is not a direct package-manifest dependency.
- `tools/oxlint/anti-slop/**` is ignored by the repository lint configuration because the plugin is vendored tooling, not application source.
- All generic anti-slop rules and `oxc/no-accumulating-spread` are enabled at `error` severity.
