# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Building and Running

```bash
# Development - run directly with Bun
bun run dev

# Build standalone executable
bun run build

# Build for npm distribution
bun run build:npm

# Install dependencies (use bun)
bun install
```

### Testing

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

### Code Quality

```bash
# Type checking - must pass before commit
bun run type-check

# Linting - uses Biome, must pass before commit
bun run lint

# Fix linting issues automatically
bun run lint:fix

# Format code
bun run format
```

## Architecture Overview

### Core Structure

The application is a CLI tool built with Bun and TypeScript that provides a GraphQL-inspired query interface for Better Stack logs.

**Key architectural decisions:**

- **Bun runtime**: Used for fast execution, native TypeScript support, and package management
- **Commander.js**: For CLI command parsing and structure
- **Dual authentication**: Requires both Telemetry API token (for source discovery) and Query API credentials (for log data access)
- **GraphQL-inspired syntax**: Custom parser in `src/parser/graphql.ts` converts user-friendly queries to ClickHouse SQL
- **Source aliases**: Built-in aliases for common environments (dev→sweetistics-dev, prod→sweetistics, etc.)

### Directory Layout

```
src/
├── api/            # API clients for Better Stack
│   ├── client.ts   # HTTP client wrapper
│   ├── query.ts    # Query API for log data (ClickHouse)
│   └── sources.ts  # Sources API for metadata
├── commands/       # CLI command implementations
│   ├── config.ts   # Configuration management
│   ├── query.ts    # GraphQL and SQL query handlers
│   ├── sources.ts  # Source listing and details
│   └── tail.ts     # Log streaming commands (tail, errors, warnings, search)
├── parser/         # Query language parser
│   └── graphql.ts  # GraphQL-to-SQL converter
├── utils/          # Shared utilities
│   ├── config.ts   # Config file management (~/.bslog/config.json)
│   ├── formatter.ts # Output formatting (pretty, json, table, csv)
│   └── time.ts     # Time parsing and conversion
├── types.ts        # TypeScript type definitions
└── index.ts        # CLI entry point (#!/usr/bin/env bun)
```

### Authentication Flow

1. **Telemetry API** (`BETTERSTACK_API_TOKEN`): Used by `SourcesAPI` to discover available log sources and get table metadata
2. **Query API** (`BETTERSTACK_QUERY_USERNAME/PASSWORD`): Used by `QueryAPI` to execute ClickHouse SQL queries against log data

The separation allows for granular access control - some users might list sources but not read logs.

### Query Processing Pipeline

1. User provides GraphQL-like query or uses convenience commands (tail, errors, etc.)
2. `parseGraphQLQuery()` converts GraphQL syntax to `QueryOptions` object
3. `QueryAPI.buildQuery()` constructs ClickHouse SQL:
   - Resolves source name to table (`t{team_id}_{table_name}_logs`)
   - Builds WHERE clauses for filters (level, subsystem, time range, search)
   - Uses `JSON_VALUE()` to extract fields from raw JSON logs
4. Query executed via HTTP to Better Stack's ClickHouse endpoint
5. Results formatted based on output format (pretty, json, table, csv)

### Key Implementation Details

**Command Structure:**

- Commands support positional source argument: `bslog tail sweetistics-dev`
- All query commands support verbose mode (`-v`) to show generated SQL
- Follow mode (`-f`) implemented via polling with configurable interval

**Configuration Management:**

- Config stored in `~/.bslog/config.json`
- Supports default source, limit, and output format
- Query history and saved queries for future features
- Source aliases for convenient environment switching

**Error Handling:**

- Detailed error messages for missing credentials
- Source validation before query execution
- Graceful handling of network timeouts

**Type Safety:**

- Strict TypeScript configuration
- No implicit any (warned by Biome)
- Comprehensive type definitions in `src/types.ts`

## Testing Strategy

- **Unit tests** (`src/__tests__/unit/`): Test utilities, parsers, formatters, config, and error handling in isolation
- **Integration tests** (`src/__tests__/integration/`): Test query building, API interactions, and verbose mode
- **Comprehensive coverage**: 86 tests covering source aliases, credentials, verbose mode, and error messages
- Tests use Bun's built-in test runner with mocking support
- Coverage reporting available via `bun test:coverage`
- All tests must pass before commit

## Code Style

- **Formatter**: Biome with 2-space indentation, 100-char line width
- **Linter**: Biome with strict rules for code quality
- **Semicolons**: "as needed" (omitted where safe)
- **Quotes**: Single quotes for strings
- **Trailing commas**: Always in multiline structures
