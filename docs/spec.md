# Better Stack Log CLI (bslog) Specification

## Overview

A TypeScript-based CLI tool for querying Better Stack (formerly Logtail) logs with an intuitive, GraphQL-inspired query syntax. The tool provides both simple commands for common queries and advanced SQL capabilities for power users.

## Core Features

### 1. Query Logs

- **Last N logs**: Get the most recent N log entries (default: 100)
- **Time-based queries**: Query logs within specific time ranges
- **Field filtering**: Filter by any JSON field in the logs
- **Level filtering**: Filter by log severity (debug, info, warn, error, fatal)
- **Subsystem filtering**: Filter by service/component name
- **Pattern matching**: Search for text patterns within logs

### 2. Source Management

- List all available log sources
- Get details about a specific source
- Set default source for queries

### 3. Output Formats

- JSON (default)
- Pretty-printed table
- CSV export
- Raw JSON Lines

## Query Syntax Design

### GraphQL-Inspired Syntax

We'll use a simplified GraphQL-like syntax that's intuitive and easy to learn:

```bash
# Basic queries
bslog query "{ logs(limit: 100) { dt, level, message } }"
bslog query "{ logs(level: 'error', limit: 50) { * } }"
bslog query "{ logs(where: { subsystem: 'api' }) { dt, message, error } }"

# Time-based queries
bslog query "{ logs(since: '1h', level: 'error') { * } }"
bslog query "{ logs(between: ['2025-01-01', '2025-01-02']) { dt, message } }"

# Pattern matching
bslog query "{ logs(search: 'user authentication') { * } }"

# Complex filtering
bslog query "{
  logs(
    where: {
      level: 'error',
      subsystem: 'payment',
      userId: '123'
    },
    limit: 200
  ) { dt, message, stack_trace }
}"
```

### Shorthand Commands

For common queries, provide simple CLI commands:

```bash
# Get last N logs
bslog tail                    # Last 100 logs
bslog tail -n 50             # Last 50 logs
bslog tail --follow          # Stream logs in real-time

# Filter by level
bslog errors                 # Show only errors
bslog errors --since 1h      # Errors from last hour
bslog warnings --limit 200   # Last 200 warnings

# Search patterns
bslog search "authentication failed"
bslog search "user:john@example.com" --level error

# List sources
bslog sources                # List all sources
bslog sources sweetistics-dev # Show specific source details

# Set default source
bslog config source sweetistics-dev
```

### Advanced SQL Mode

For power users, allow raw ClickHouse SQL:

```bash
bslog sql "SELECT dt, JSON_VALUE(raw, '$.level') AS level, raw
           FROM remote(t123456_logs)
           WHERE raw LIKE '%error%'
           ORDER BY dt DESC
           LIMIT 100"
```

## Architecture

### Directory Structure

```
apps/bslog/
├── spec.md                  # This specification
├── package.json             # Dependencies
├── tsconfig.json           # TypeScript configuration
├── bun.lockb               # Bun lock file
├── src/
│   ├── index.ts            # Main CLI entry point
│   ├── commands/           # Command implementations
│   │   ├── query.ts        # Query command
│   │   ├── tail.ts         # Tail command
│   │   ├── sources.ts      # Sources command
│   │   ├── config.ts       # Config command
│   │   └── sql.ts          # Raw SQL command
│   ├── api/                # Better Stack API client
│   │   ├── client.ts       # HTTP client
│   │   ├── sources.ts      # Sources API
│   │   └── query.ts        # Query API
│   ├── parser/             # Query parser
│   │   ├── graphql.ts      # GraphQL-like parser
│   │   └── builder.ts      # SQL query builder
│   ├── utils/              # Utilities
│   │   ├── config.ts       # Configuration management
│   │   ├── formatter.ts    # Output formatting
│   │   └── time.ts         # Time parsing utilities
│   └── types.ts            # TypeScript type definitions
├── dist/                   # Compiled output
│   └── bslog              # Compiled binary
└── tests/                  # Test files
    └── ...
```

### Core Components

#### 1. API Client

- Handles authentication using Bearer token
- Manages HTTP requests to Better Stack API
- Implements retry logic and error handling
- Supports both Telemetry API and Query API

#### 2. Query Parser

- Parses GraphQL-like syntax into an AST
- Converts AST to ClickHouse SQL
- Validates query structure
- Handles field selection and filtering

#### 3. SQL Builder

- Constructs ClickHouse SQL queries
- Handles JSON field extraction
- Manages time range filters
- Optimizes query performance

#### 4. Configuration Manager

- Reads API token from environment variable
- Manages default source configuration
- Stores user preferences in `~/.bslog/config.json`

#### 5. Output Formatter

- Formats results based on output type
- Pretty-prints tables for terminal
- Exports to CSV/JSON
- Handles streaming output for tail command

## Implementation Details

### Authentication

- Read `BETTERSTACK_API_TOKEN` from environment
- Support `.env` file for local development
- Validate token on first use

### Query Optimization

- Always include LIMIT clause (default: 100, max: 10000)
- Use time-based partitioning for better performance
- Cache source metadata locally

### Error Handling

- Graceful handling of network errors
- Clear error messages for invalid queries
- Helpful suggestions for common mistakes
- Retry logic with exponential backoff

### Performance

- Use Bun's native HTTP client for speed
- Stream large result sets
- Implement pagination for large queries
- Cache frequently used queries

## Configuration

### Environment Variables

```bash
BETTERSTACK_API_TOKEN=Bbu9CBf9JxuePAqTdhETDQZu  # API token
BSLOG_DEFAULT_SOURCE=sweetistics-dev              # Default source
BSLOG_DEFAULT_LIMIT=100                          # Default query limit
BSLOG_OUTPUT_FORMAT=json                         # Default output format
```

### Config File (`~/.bslog/config.json`)

```json
{
  "defaultSource": "sweetistics-dev",
  "defaultLimit": 100,
  "outputFormat": "json",
  "queryHistory": [],
  "savedQueries": {
    "errors": "{ logs(level: 'error', limit: 100) { * } }",
    "recent-api": "{ logs(subsystem: 'api', limit: 50) { dt, message } }"
  }
}
```

## Testing Strategy

1. **Unit Tests**: Test individual components (parser, builder, formatter)
2. **Integration Tests**: Test API client with mocked responses
3. **E2E Tests**: Test complete workflows with real API (limited)
4. **Manual Testing**: Test with actual Better Stack account

## Build & Distribution

### Build Process

1. TypeScript compilation with Bun
2. Bundle into single executable
3. Create shell wrapper for global installation

### Installation

```bash
# Development
bun install
bun run dev

# Build
bun build ./src/index.ts --compile --outfile dist/bslog

# Install globally
ln -s $(pwd)/dist/bslog /usr/local/bin/bslog
```

## Future Enhancements

1. **Interactive Mode**: REPL for exploring logs
2. **Aggregations**: Support for COUNT, AVG, SUM operations
3. **Alerts**: Set up alerts based on query conditions
4. **Export**: Export to various formats (Excel, PDF)
5. **Visualization**: Basic charts for log trends
6. **Multi-source Queries**: Query across multiple sources
7. **Query Templates**: Save and reuse common queries
8. **Autocomplete**: Shell completions for better UX

## Security Considerations

1. Never log or display the API token
2. Use secure storage for configuration
3. Validate all user inputs
4. Sanitize SQL queries to prevent injection
5. Implement rate limiting for API calls

## Success Criteria

1. ✅ Query logs with intuitive syntax
2. ✅ Filter by level, subsystem, and any JSON field
3. ✅ List and manage sources
4. ✅ Multiple output formats
5. ✅ Fast performance with Bun
6. ✅ Clear error messages
7. ✅ Comprehensive documentation
