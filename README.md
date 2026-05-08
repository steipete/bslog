# bslog - Better Stack Log CLI

[![npm version](https://img.shields.io/npm/v/@steipete/bslog.svg)](https://www.npmjs.com/package/@steipete/bslog)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Bun Version](https://img.shields.io/badge/bun-%3E%3D1.0.0-000000.svg?style=flat&logo=bun)](https://bun.sh)

A powerful, intuitive CLI tool for querying Better Stack logs with GraphQL-inspired syntax. Query your logs naturally without memorizing complex SQL or API endpoints.

## Features

- **GraphQL-inspired query syntax** - Write queries that feel natural and are easy to remember
- **Simple commands** - Common operations like `tail`, `errors`, `search` work out of the box
- **Smart filtering** - Filter by level, subsystem, time ranges, or any JSON field
- **Beautiful output** - Color-coded, formatted logs that are easy to read
- **Multiple formats** - Export as JSON, CSV, or formatted tables
- **Fast** - Built with Bun for maximum performance
- **Real-time following** - Tail logs in real-time with `-f` flag
- **Query history** - Saves your queries for quick re-use
- **Configurable** - Set defaults for source, output format, and more
- **Responsive networking** - Uses the native Fetch API with sane timeouts so hung connections never stall your session

## Better Stack MCP vs bslog CLI

Better Stack's MCP (Model Context Protocol) endpoints expose the same log storage that bslog queries, but they serve different workflows. Reference the [official MCP integration guide](https://betterstack.com/docs/getting-started/integrations/mcp/) for setup, and use the two side by side:

- **Token footprint matters.** The stock MCP ships ~50 tools and consumes roughly 7 k tokens of system context before it does any useful work. If you need lean prompts or run on constrained models, that overhead is noticeable.
- **Latency favors the CLI.** bslog keeps a single HTTP session alive and streams JSON rows immediately; in practice a 5 000-row fetch finished ~40 % faster than the MCP round-tripping small SQL snippets through the assistant shell.
- **Lean on MCP for quick context in chat-based tooling.** Assistants can run small ClickHouse snippets via MCP to summarize recent events without leaving the conversation.
- **Reach for bslog when you need the full payload.** CLI commands stream nested JSON fields, respect your saved defaults, and integrate with pipes/`jq` for deeper debugging.
- **Consider credential flow.** MCP sessions often require short-lived "Connect remotely" credentials, while bslog reads long-lived environment variables once per machine.
- **Collaborate with both.** Share MCP snapshots with teammates for at-a-glance status, then dive into bslog to follow requests, inspect stack traces, or automate reporting.

| Reach for MCP when you need...                                  | Reach for bslog CLI when you need...                                        |
| --------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Lightweight, conversational context inline with an AI assistant | Full-fidelity log payloads, streaming output, and piping into local tooling |
| Quick summaries or counts across a narrow time window           | Chronological drill-down across multiple sources with `--sources dev,prod`  |
| Built-in helpers for quick aggregated snapshots                 | Explicit SQL, `--format json`, or `--jq` when you need rollups              |
| Temporary credentials you can rotate per debugging session      | Long-lived local credentials stored in your shell profile                   |
| Remote teammates to reproduce a query in their chat workspace   | Automation or scripting from CI/cron with reproducible output formats       |

### Field-aware filters built in

Skip raw SQL when you need structured filters—every tail/search/errors/warnings/trace command now accepts `--where key=value`. Repeat the flag to chain predicates:

```bash
bslog search "timeline" --where module=timeline --where env=production --since 1h
bslog tail prod --where userId='0199abc' --where attempt=3 --until 2025-09-24T18:00
```

Filters perform equality matches; values auto-detect booleans (`true`/`false`), numbers, `null`, quoted strings, and JSON objects/arrays.

### Bounded windows

Combine `--since` and the new `--until` flag on any tail/errors/warnings/search/trace command to capture a fixed time window.

```bash
bslog tail prod --since 2025-09-24T13:00 --until 2025-09-24T14:00
```

### Lightweight shaping with jq

Use `--format json --jq '<filter>'` to trim or reshape large payloads without leaving the terminal.

```bash
bslog tail prod --format json --jq '.[].message' --limit 20
bslog search "timeout" --format json --jq '[.[] | {dt, message}]'
```

The CLI automatically switches to JSON when `--jq` is provided; if `jq` is missing, the raw JSON payload is printed instead with an error message.

## Installation

### Global Installation (Recommended)

```bash
# Using bun (recommended)
bun add -g @steipete/bslog

# Or using npm
npm install -g @steipete/bslog
```

### Local Development

```bash
git clone https://github.com/steipete/bslog.git
cd bslog
bun install   # Uses Bun for package management
bun run build # Uses Bun for building and running
bun link      # Link globally for testing
```

### Prerequisites

- **[Bun](https://bun.sh)** >= 1.0.0 - JavaScript runtime, bundler, and package manager

```bash
# Install Bun
curl -fsSL https://bun.sh/install | bash
```

## Authentication Setup

Better Stack uses two different authentication systems, and **both are required** for full functionality:

### Why Two Authentication Systems?

Better Stack separates authentication for security and access control:

- **Telemetry API Token**: Manages sources and metadata (read-only access to source configuration)
- **Query API Credentials**: Provides access to actual log data (sensitive information)

This separation allows teams to grant different access levels - for example, someone might be able to list sources but not read the actual logs.

### 1. Telemetry API Token (Required)

**What it's used for:**

- Listing available log sources (`bslog sources list`)
- Getting source metadata (team ID, table names)
- Resolving source names to table identifiers
- Required for ALL commands that reference sources by name

**How to get it:**

1. Log into [Better Stack](https://betterstack.com)
2. Navigate to **Settings > API Tokens**
3. Create or copy your **Telemetry API token**
4. Add to your shell configuration (`~/.zshrc`, `~/.bashrc`, etc.):

```bash
export BETTERSTACK_API_TOKEN="your_telemetry_token_here"
```

### 2. Query API Credentials (Required for querying logs)

**What it's used for:**

- Actually reading log data (`bslog tail`, `bslog errors`, etc.)
- Executing SQL queries against log tables
- Any command that retrieves log content

**How to get them:**

1. Go to Better Stack > **Logs > Dashboards**
2. Click **"Connect remotely"**
3. Click **"Create credentials"**
4. **Important**: Copy the password immediately (it won't be shown again)
5. Add to your shell configuration:

```bash
export BETTERSTACK_QUERY_USERNAME="your_username_here"
export BETTERSTACK_QUERY_PASSWORD="your_password_here"
```

#### Custom Query API region (optional)

Better Stack runs Query API endpoints in multiple clusters (e.g. `eu-nbg-2`, `eu-fsn-3`, `us-…`). bslog defaults to `https://eu-nbg-2-connect.betterstackdata.com`. **Credentials are region-scoped** — a username/password issued for one cluster returns HTTP 403 `AUTHENTICATION_FAILED` against another, even when the values are otherwise valid.

If your team's data lives outside the default cluster, set the host explicitly for
the current shell:

```bash
export BSLOG_QUERY_HOST="https://eu-fsn-3-connect.betterstackdata.com"
```

Or save it in bslog's config:

```bash
bslog config set queryBaseUrl https://eu-fsn-3-connect.betterstackdata.com
```

`BSLOG_QUERY_HOST` takes precedence over `queryBaseUrl`, so direnv/CI can override
a saved default. The cluster URL is shown next to your credentials under
**Logs > Dashboards > Connect remotely** (the SQL API tab in the latest UI).

### 3. Complete Setup Example

Add all three environment variables to your shell configuration:

```bash
# ~/.zshrc or ~/.bashrc

# For source discovery and metadata
export BETTERSTACK_API_TOKEN="your_telemetry_token_here"

# For querying log data
export BETTERSTACK_QUERY_USERNAME="your_username_here"
export BETTERSTACK_QUERY_PASSWORD="your_password_here"
```

Then reload your shell:

```bash
source ~/.zshrc  # or ~/.bashrc
```

### Verification

Test that both authentication systems are working:

```bash
# Test Telemetry API (should list your sources)
bslog sources list

# Test Query API (should retrieve recent logs)
bslog tail -n 5
```

## Quick Start

### First-Time Setup

```bash
# Verify installation
bslog --version

# List all your log sources
bslog sources list

# Set your default source
bslog config source my-app-production

# Optional: capture every log level by default or tighten filtering later
bslog config set logLevel all

# Check your configuration
bslog config show
```

### Basic Usage

```bash
# Get last 100 logs
bslog tail

# Get last 50 error logs
bslog errors -n 50

# Search for specific text
bslog search "user authentication failed"

# Follow logs in real-time (like tail -f)
bslog tail -f

# Get logs from the last hour
bslog tail --since 1h

# Get warnings from the last 2 days
bslog warnings --since 2d
```

## GraphQL-Inspired Query Syntax

The killer feature of bslog is its intuitive query language that feels like GraphQL:

### Basic Queries

```bash
# Simple query with field selection
bslog query "{ logs(limit: 100) { dt, level, message } }"

# Filter by log level
bslog query "{ logs(level: 'error', limit: 50) { * } }"

# Time-based filtering
bslog query "{ logs(since: '1h') { dt, message, error } }"
bslog query "{ logs(since: '2024-01-01', until: '2024-01-02') { * } }"
```

### Advanced Filtering

```bash
# Filter by subsystem
bslog query "{ logs(subsystem: 'api', limit: 100) { dt, message } }"

# Filter by custom fields
bslog query "{ logs(where: { userId: '12345' }) { * } }"

# Complex filters
bslog query "{
  logs(
    level: 'error',
    subsystem: 'payment',
    since: '1h',
    limit: 200
  ) {
    dt,
    message,
    userId,
    error_details
  }
}"

# Search within logs
bslog query "{ logs(search: 'database connection') { dt, message } }"
```

### Field Selection

- Use `*` to get all fields
- Specify individual fields: `dt, level, message, customField`
- Access nested JSON fields directly (dot + bracket paths) e.g. `metadata.proxy[0].status`, `metadata["complex key"].value`
- CLI shortcut: combine `--fields` with compact formatters when you just want to confirm counts, e.g. `bslog errors -n 5 --fields dt,message`.

## Command Reference

### Core Commands

#### `tail` - Stream logs

```bash
bslog tail [options]

Options:
  -n, --limit <number>    Number of logs to fetch (default: 100)
  -s, --source <name>     Source name
  -l, --level <level>     Filter by log level
  --subsystem <name>      Filter by subsystem
  --since <time>          Show logs since (e.g., 1h, 2d, 2024-01-01)
  --fields <names>        Comma-separated list of fields to select (e.g., dt,message,level)
  -f, --follow            Follow log output
  --interval <ms>         Polling interval in milliseconds (default: 2000)
  --format <type>         Output format (json|table|csv|pretty)
  --sources <names>       Comma-separated list of sources to merge chronologically
  -v, --verbose           Show SQL query and debug information

Examples:
  bslog tail -n 50                     # Last 50 logs
  bslog tail -f                        # Follow logs
  bslog tail -v                        # Show SQL queries
  bslog tail --since 1h --level error  # Errors from last hour
  bslog tail --sources dev,prod        # Merge logs from multiple sources chronologically
```

When you pass multiple names to `--sources`, bslog issues concurrent queries, merges the results in strict timestamp order, and augments every row with a `source` field. The combined output works with all formatters (`pretty`, `json`, `table`, `csv`) and keeps follow mode responsive by polling each source independently.

#### `errors` - Show only error logs

```bash
bslog errors [options]

Options:
  -n, --limit <number>    Number of logs to fetch (default: 100)
  -s, --source <name>     Source name
  --fields <names>        Comma-separated list of fields to select (e.g., dt,message,level)
  --since <time>          Show errors since
  --format <type>         Output format
  --sources <names>       Comma-separated list of sources to merge chronologically

Examples:
  bslog errors --since 1h              # Errors from last hour
  bslog errors -n 200 --format json    # Last 200 errors as JSON
```

#### `warnings` - Show only warning logs

```bash
bslog warnings [options]

# Same options as errors command
```

#### `search` - Search logs for patterns

```bash
bslog search <pattern> [options]

Options:
  -n, --limit <number>    Number of logs to fetch (default: 100)
  -s, --source <name>     Source name
  -l, --level <level>     Filter by log level
  --since <time>          Search logs since
  --fields <names>        Comma-separated list of fields to select (e.g., dt,message,level)
  --format <type>         Output format
  --sources <names>       Comma-separated list of sources to merge chronologically

Examples:
  bslog search "authentication failed"
  bslog search "user:john@example.com" --level error
  bslog search "timeout" --since 1h --subsystem api
```

#### `trace` - Follow a request ID across sources

```bash
bslog trace <requestId> [options]

Options:
  -n, --limit <number>    Number of logs to fetch (default: 100)
  -s, --source <name>     Source name
  --since <time>          Show logs since
  --until <time>          Show logs until
  --format <type>         Output format (json|table|csv|pretty)
  --sources <names>       Comma-separated list of sources to merge chronologically
  -v, --verbose           Show SQL query and debug information

Examples:
  bslog trace 01HXABCDEF --sources dev,prod
  bslog trace req-123 --since 1h
```

#### `query` - GraphQL-inspired queries

```bash
bslog query <query> [options]

Options:
  -s, --source <name>     Source name
  -f, --format <type>     Output format (default: pretty)
  -v, --verbose           Show SQL query and debug information

Examples:
  bslog query "{ logs(limit: 100) { dt, level, message } }"
  bslog query "{ logs(level: 'error', since: '1h') { * } }" --verbose
```

#### `sql` - Raw SQL queries (Advanced)

```bash
bslog sql <sql> [options]

Options:
  -f, --format <type>     Output format (default: json)
  -v, --verbose           Show SQL query and debug information

Example:
  bslog sql "SELECT dt, raw FROM remote(t123_logs) WHERE raw LIKE '%error%' LIMIT 10"
```

### Source Management

#### `sources list` - List all available sources

```bash
bslog sources list [options]

Options:
  -f, --format <type>     Output format (json|table|pretty)

Example:
  bslog sources list --format table
```

#### `sources get` - Get source details

```bash
bslog sources get <name> [options]

Options:
  -f, --format <type>     Output format (json|pretty)

Example:
  bslog sources get my-app-production
```

### Source Aliases

For convenience, common source aliases are available:

- `dev`, `development` → `sweetistics-dev`
- `prod`, `production` → `sweetistics`
- `staging` → `sweetistics-staging`
- `test` → `sweetistics-test`

```bash
# These are equivalent:
bslog tail prod
bslog tail production
bslog tail sweetistics

# Use in any command:
bslog errors dev --since 1h
bslog query "{ logs(limit: 10) { * } }" --source staging
```

### Configuration

#### `config set` - Set configuration values

```bash
bslog config set <key> <value>

Keys:
  source        Default source name
  limit         Default query limit
  format        Default output format (json|table|csv|pretty)
  logLevel      Default log level fallback (all|debug|info|warning|error|fatal|trace)
  queryBaseUrl  ClickHouse Query API endpoint URL (default: https://eu-nbg-2-connect.betterstackdata.com)

Examples:
  bslog config set source my-app-production
  bslog config set limit 200
  bslog config set format pretty
  bslog config set logLevel warning
  bslog config set queryBaseUrl https://eu-fsn-3-connect.betterstackdata.com
```

#### `config show` - Show current configuration

```bash
bslog config show
bslog config show --format json
```

#### `config source` - Shorthand for setting default source

```bash
bslog config source <name>

Example:
  bslog config source my-app-staging
```

## Time Format Reference

The `--since` and `--until` options support various time formats:

- **Relative time**: `1h` (1 hour), `30m` (30 minutes), `2d` (2 days), `1w` (1 week)
- **ISO 8601**: `2024-01-15T10:30:00Z`
- **Date only**: `2024-01-15`
- **DateTime**: `2024-01-15 10:30:00`

## Output Formats

Choose the output format that works best for your use case:

### `pretty` (Default for most commands)

Color-coded, human-readable format with proper formatting:

```
[2024-01-15 10:30:45.123] ERROR [api] User authentication failed
  userId: 12345
  ip: 192.168.1.1
```

### `json` (Default for SQL queries)

Standard JSON output, perfect for piping to other tools:

```json
[
  {
    "dt": "2024-01-15 10:30:45.123",
    "level": "error",
    "message": "User authentication failed"
  }
]
```

### `table`

Formatted table output for structured viewing:

```
┌──────────────────────┬───────┬──────────────────────────┐
│ dt                   │ level │ message                  │
├──────────────────────┼───────┼──────────────────────────┤
│ 2024-01-15 10:30:45  │ error │ User authentication fail │
└──────────────────────┴───────┴──────────────────────────┘
```

### `csv`

CSV format for spreadsheet import:

```csv
dt,level,message
"2024-01-15 10:30:45.123","error","User authentication failed"
```

## Configuration File

Configuration is stored in `~/.bslog/config.json`:

```json
{
  "defaultSource": "my-app-production",
  "defaultLimit": 100,
  "outputFormat": "pretty",
  "queryHistory": [
    "{ logs(level: 'error', limit: 50) { * } }",
    "{ logs(search: 'timeout') { dt, message } }"
  ],
  "savedQueries": {
    "recent-errors": "{ logs(level: 'error', limit: 100) { * } }",
    "api-logs": "{ logs(subsystem: 'api', limit: 50) { dt, message } }"
  }
}
```

## Advanced Usage

### Combining Filters

You can combine multiple filters for precise queries:

```bash
# Errors from API subsystem in the last hour
bslog query "{
  logs(
    level: 'error',
    subsystem: 'api',
    since: '1h'
  ) { dt, message, stack_trace }
}"

# Search for timeouts in production, excluding certain users
bslog query "{
  logs(
    search: 'timeout',
    where: {
      environment: 'production',
      userId: { not: 'test-user' }
    }
  ) { * }
}"
```

### Piping and Integration

```bash
# Export errors to CSV for analysis
bslog errors --since 1d --format csv > errors.csv

# Pipe to jq for JSON processing
bslog query "{ logs(limit: 100) { * } }" --format json | jq '.[] | select(.level == "error")'

# Count errors by type
bslog errors --format json | jq -r '.[] | .error_type' | sort | uniq -c

# Watch for specific errors
watch -n 5 'bslog errors --since 5m | grep "DatabaseError"'
```

### Using with Other Tools

```bash
# Send critical errors to Slack
bslog errors --since 5m --format json | \
  jq -r '.[] | select(.level == "critical") | .message' | \
  xargs -I {} curl -X POST -H 'Content-type: application/json' \
    --data "{\"text\":\"{}\"}" \
    YOUR_SLACK_WEBHOOK_URL

# Generate daily error report
bslog errors --since 1d --format json | \
  jq -r '[.[] | {time: .dt, error: .message}]' > daily-errors.json
```

## Troubleshooting

### "BETTERSTACK_API_TOKEN environment variable is not set"

Make sure you've added the token to your shell configuration and reloaded it:

```bash
echo 'export BETTERSTACK_API_TOKEN="your_token_here"' >> ~/.zshrc
source ~/.zshrc
```

### "Query failed: 403 - Authentication failed"

This error occurs when trying to query logs. You need to create Query API credentials in the Better Stack dashboard (different from the Telemetry API token).

### "Source not found"

List your available sources and ensure you're using the correct name:

```bash
bslog sources list
bslog config source correct-source-name
```

### Connection timeouts

If you're experiencing timeouts, try:

- Reducing the `--limit` parameter
- Using more specific time ranges with `--since` and `--until`
- Checking your network connection

## Development

### Building from Source

```bash
git clone https://github.com/steipete/bslog.git
cd bslog
bun install
bun run build
```

### Running Tests

```bash
# Run all tests
bun test

# Run unit tests only
bun test:unit

# Run integration tests only
bun test:integration

# Watch mode for development
bun test:watch

# With coverage report
bun test:coverage
```

The test suite includes:

- **Unit tests** for utilities, parsers, and formatters
- **Integration tests** for query building and API interactions
- **70+ test cases** ensuring reliability

### Type Checking

```bash
bun run type-check
```

### Development Mode

```bash
bun run dev
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built with [Bun](https://bun.sh) for blazing fast performance
- Powered by [Better Stack](https://betterstack.com) logging infrastructure
- Inspired by GraphQL's intuitive query syntax

## Support

- **Issues**: [GitHub Issues](https://github.com/steipete/bslog/issues)
- **Discussions**: [GitHub Discussions](https://github.com/steipete/bslog/discussions)
- **Email**: steipete@gmail.com

---

Made by [steipete](https://github.com/steipete)
