# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

- Added `BSLOG_QUERY_HOST` environment variable so teams whose data lives outside the default `eu-nbg-2` cluster can point bslog at their own Query API region without patching the binary. SQL API credentials are region-scoped (`eu-nbg-2` / `eu-fsn-3` / etc.), so credentials issued for one cluster previously returned HTTP 403 `AUTHENTICATION_FAILED` against another. Default behavior is unchanged.

## [1.4.0] - 2025-10-16

- Added a `--fields` option to tail/errors/warnings/search so you can trim responses to specific columns without dropping into SQL.
- Normalized CLI option handling to ensure runtime parsing uses Commander’s resolved values (fixes missing flags when chaining helpers).
- Documented the field-selection workflow in the README and refreshed the bundled artifacts for the new flag.

## [1.3.2] - 2025-09-25

- Added a configurable `defaultLogLevel` setting (defaults to `all`) so bslog surfaces every entry unless a command requests a narrower filter.
- Updated the query builder to honor the config fallback while keeping per-command level overrides intact, and expanded integration/unit coverage for the new behavior.
- Documented `bslog config set logLevel` in the README and refreshed tests for config persistence.

## [1.3.1] - 2025-09-24

- Documented CLI vs MCP performance trade-offs and clarified quick-rollup workflows in the README comparison table.
- Tightened formatter and API typing by eliminating `any`, introducing typed display rows, and making Better Stack queries stream structured payloads.
- Slimmed Biome's scan surface to project sources and fixed rule violations so `bun run lint` stays clean.
- Hardened parser/config helpers with explicit guards and block usage to satisfy the stricter lint profile.

## [1.3.0] - 2025-09-24

- Added `--jq <filter>` to tail/errors/warnings/search/trace for inline JSON shaping via jq.
- Results auto-switch to JSON when jq filters are present, with graceful fallbacks if jq is missing.
- Documented jq usage in README and CLI help.
- Consolidated log commands behind a shared registration helper so options and runtime parsing stay consistent.
- Tightened Biome rules (no-default-export, namespaces) and updated tests/utilities to satisfy the stricter lint pass.

## [1.2.0] - 2025-09-24

- Added `--until` flags to tail/errors/warnings/search so fixed windows can be queried without manual reruns.
- Updated CLI help and docs with bounded-window examples.

## [1.1.0] - 2025-09-24

- Added `--where field=value` filters across `tail`, `errors`, `warnings`, `search`, and `trace` so structured predicates no longer require raw SQL.
- Documented the new filters in the README and CLI help, including guidance in the MCP comparison section.
- Introduced option parsing helpers with unit tests covering limit, source, and filter normalization.
- Bumped the package version to 1.1.0 to signal the new capability.

## [1.0.4] - 2025-09-24

- Added `--sources` support to tailing commands for cross-source correlation with merged chronological output.
- Introduced `bslog trace <requestId>` to pull every log sharing a request ID across specified sources.
- Documented the new workflows and covered them with unit tests for multi-source merging and trace behavior.
- Updated CLI dependencies (chalk 5.6.2, commander 14.0.1, dotenv 17.2.2) and now rely on the native Fetch API with a default timeout to avoid hanging requests.

## [1.0.3] - 2025-09-24

- Added comprehensive JSON path normalization so dot/bracket notation, array indices, quoted keys, and root-level selectors generate valid `JSON_VALUE` expressions.
- Hardened SQL escaping for search and `where` values that contain quotes or backslashes.
- Expanded integration coverage for nested selections, array indexes, complex keys, and structured-object comparisons.
- Documented the JSON path syntax in the README and published the CLI update.
- Embedded the package version so both the Node entrypoint and compiled binary report the same release number.

## [1.0.2] - 2025-09-22

- CLI now resolves its version straight from `package.json`, keeping `bslog --version` and help output in sync with published builds.
- Touched up help text formatting after the version loader change.

## [1.0.1] - 2025-09-22

- Switched the project to Bun for both runtime and package management, updating documentation and tooling to match.
- Reworked authentication: manual `.env` loading to avoid noisy dotenv output, clearer credential diagnostics, and richer error messages when Query API secrets are missing.
- Added a `-v/--verbose` flag across commands so SQL is only echoed on demand while the formatter now dumps fully parsed JSON payloads.
- Introduced source aliases and positional source overrides (`bslog tail dev`, `bslog search prod …`) to make hopping between environments trivial.
- Refreshed docs (README, CLAUDE.md) and expanded the test suite around config handling.

## [1.0.0] - 2025-09-03

- First public release of the Better Stack log CLI with GraphQL-inspired queries, tail/errors/warnings/search helpers, source management, and pretty/JSON/CSV output formats.
- Shipped initial formatter, time utilities, configuration management, and strict Biome linting setup.
