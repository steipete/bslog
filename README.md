# bslog 🔎 — Better Stack logs, without the SQL detour

[![CI](https://img.shields.io/github/actions/workflow/status/steipete/bslog/ci.yml?branch=main&style=flat-square&label=ci)](https://github.com/steipete/bslog/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@steipete/bslog?style=flat-square)](https://www.npmjs.com/package/@steipete/bslog)
[![Bun](https://img.shields.io/badge/Bun-%E2%89%A51.0-000000?style=flat-square&logo=bun)](https://bun.sh)
[![License](https://img.shields.io/github/license/steipete/bslog?style=flat-square)](LICENSE)

bslog is a command-line client for querying [Better Stack](https://betterstack.com) logs. It provides direct commands for common searches, a GraphQL-inspired query syntax for structured filtering, and raw ClickHouse SQL when needed.

```sh
bslog errors my-app-production --since 1h --limit 20
bslog search "timeout" my-app-production --where service=api --format json
```

## Install

Install the published package with npm:

```sh
npm install --global @steipete/bslog
```

Or use Bun:

```sh
bun add --global @steipete/bslog
```

The source build and development workflow require Bun 1.0 or newer.

## Quick start

Create a Better Stack Telemetry API token and Query API credentials, then export them in your shell:

```sh
export BETTERSTACK_API_TOKEN="your-telemetry-token"
export BETTERSTACK_QUERY_USERNAME="your-query-username"
export BETTERSTACK_QUERY_PASSWORD="your-query-password"
```

List your sources and fetch recent logs from one of them:

```sh
bslog sources list
bslog tail my-app-production --since 15m --limit 20
```

Structured queries need both credential types because bslog resolves source names through the Telemetry API before querying log data. See [Authentication](docs/authentication.md) for credential setup and regional Query API hosts.

## Everyday queries

The direct commands cover the usual debugging loop:

```sh
bslog errors my-app-production --since 1h
bslog warnings my-app-production --until 2026-08-02T12:00:00Z
bslog search "authentication failed" my-app-production
bslog tail my-app-production --follow
```

`--since` and `--until` accept relative values such as `30m`, `1h`, `2d`, and `1w`, plus dates understood by the JavaScript runtime. Add `--fields dt,message,requestId` to select fields or `--where key=value` to filter structured JSON values.

Output is available as `pretty`, `json`, `table`, or `csv`. A `--jq` filter switches output to JSON and runs the result through the local `jq` executable.

Normal queries search both hot and archived storage, so bounded historical searches include archived matches. `--limit` still caps the rows returned. Use `--hot-only` when low latency matters more than archived results. `tail --follow` is always hot-only because it polls for new entries.

## Structured queries

Use the GraphQL-inspired syntax when the query shape is easier to express in one value:

```sh
bslog query "{ logs(level: 'error', since: '1h', limit: 50) { dt, message, requestId } }" --source my-app-production
```

Queries support `limit`, `level`, `subsystem`, `since`, `until`, `between`, `search`, `where`, and `source`. Fields may use dot or bracket paths such as `metadata.proxy[0].status`.

For queries that are already written in ClickHouse SQL, use `bslog sql`. Raw SQL talks directly to the Query API and does not resolve a source name first.

## Multiple sources and traces

Pass comma-separated sources to merge results in descending timestamp order. Each merged row includes its source name.

```sh
bslog tail --sources api-production,worker-production --since 30m
bslog trace req-123 --sources api-production,worker-production
```

Follow mode polls each source independently. `trace` applies the request ID as a `requestId` structured-field filter.

## Configuration

bslog stores non-secret settings in `~/.bslog/config.json` by default. Set `BSLOG_CONFIG_DIR` to a non-empty directory path to store `config.json` elsewhere. You can set a default source, query limit, output format, log level, or regional Query API URL with `bslog config`; credentials remain in environment variables.

See the [CLI reference](docs/cli-reference.md) for every command, shared option, configuration key, time format, output mode, and built-in source alias.

## Community

Use [GitHub Issues](https://github.com/steipete/bslog/issues) for bugs, questions, and major-change proposals; pull requests are welcome. bslog is made by [Peter Steinberger](https://github.com/steipete), built with [Bun](https://bun.sh), uses Better Stack's APIs, and takes its query shape from GraphQL.

## Development

```sh
bun install --frozen-lockfile
bun run ci
bun run build:npm
```

`bun run ci` checks formatting, linting, types, tests, and the npm bundle. The standalone Bun binary is built with `bun run build`.

## License

[MIT](LICENSE) © Peter Steinberger.
