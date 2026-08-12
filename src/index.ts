#!/usr/bin/env bun

import chalk from "chalk";
import { Command } from "commander";
import packageJson from "../package.json";
import { setConfig, showConfig } from "./commands/config";
import { runQuery, runSql } from "./commands/query";
import { getSource, listSources } from "./commands/sources";
import { searchLogs, showErrors, showWarnings, tailLogs } from "./commands/tail";
import { traceRequest } from "./commands/trace";
import { mergeWithRuntime, registerLogCommand } from "./utils/command-factory";

// Try to load .env file if it exists (for local development)
// But don't use dotenv package to avoid debug messages
try {
  const fs = require("node:fs");
  const path = require("node:path");
  const envPath = path.resolve(process.cwd(), ".env");
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf8");
    envContent.split("\n").forEach((line: string) => {
      const [key, ...valueParts] = line.split("=");
      if (key && valueParts.length > 0) {
        const value = valueParts.join("=").trim();
        if (!process.env[key.trim()]) {
          process.env[key.trim()] = value.replace(/^["']|["']$/g, "");
        }
      }
    });
  }
} catch {
  // Ignore errors, environment variables might be set elsewhere
}

const program = new Command();

const cliVersion = typeof packageJson.version === "string" ? packageJson.version : "0.0.0";

program
  .name("bslog")
  .description("Better Stack log query CLI with GraphQL-inspired syntax")
  .version(cliVersion);

function extractStringOption(options: Record<string, unknown>, key: string): string | undefined {
  const value = options[key];
  return typeof value === "string" ? value : undefined;
}

// Query command - GraphQL-like syntax
program
  .command("query")
  .argument("<query>", "GraphQL-like query string")
  .option("-s, --source <name>", "Source name")
  .option("-f, --format <type>", "Output format (json|table|csv|pretty)", "pretty")
  .option("--hot-only", "Query hot storage only (faster, excludes archived logs)")
  .option("-v, --verbose", "Show SQL query and debug information")
  .description("Query logs using GraphQL-like syntax")
  .action(async (query, options) => {
    await runQuery(query, options);
  });

// SQL command - raw ClickHouse SQL
program
  .command("sql")
  .argument("<sql>", "Raw ClickHouse SQL query")
  .option("-f, --format <type>", "Output format (json|table|csv|pretty)", "json")
  .option("-v, --verbose", "Show SQL query and debug information")
  .description("Execute raw ClickHouse SQL query")
  .action(async (sql, options) => {
    await runSql(sql, options);
  });

// Tail command - stream logs
registerLogCommand(program, {
  name: "tail",
  description:
    "Tail logs (similar to tail -f)\nExamples:\n  bslog tail                    # use default source\n  bslog tail sweetistics-dev    # use specific source\n  bslog tail prod -n 50         # tail production logs",
  arguments: [{ declaration: "[source]", description: "Source name or alias" }],
  setup: (cmd) => {
    cmd
      .option("-l, --level <level>", "Filter by log level")
      .option("--subsystem <name>", "Filter by subsystem")
      .option("-f, --follow", "Follow log output")
      .option("--interval <ms>", "Polling interval in milliseconds", "2000");
  },
  handler: async ({ args, runtime, options }) => {
    const [sourceArg] = args;
    const sourceOption = extractStringOption(options, "source");
    const merged = mergeWithRuntime(options, runtime, {
      source: sourceArg ?? sourceOption,
    }) as Parameters<typeof tailLogs>[0];
    await tailLogs(merged);
  },
});

// Errors command - show only errors
registerLogCommand(program, {
  name: "errors",
  description:
    "Show only error logs\nExamples:\n  bslog errors                  # use default source\n  bslog errors sweetistics-dev  # errors from dev\n  bslog errors prod --since 1h  # recent prod errors",
  arguments: [{ declaration: "[source]", description: "Source name or alias" }],
  handler: async ({ args, runtime, options }) => {
    const [sourceArg] = args;
    const sourceOption = extractStringOption(options, "source");
    const merged = mergeWithRuntime(options, runtime, {
      source: sourceArg ?? sourceOption,
    }) as Parameters<typeof showErrors>[0];
    await showErrors(merged);
  },
});

// Warnings command - show only warnings
registerLogCommand(program, {
  name: "warnings",
  description: "Show only warning logs",
  arguments: [{ declaration: "[source]", description: "Source name or alias" }],
  handler: async ({ args, runtime, options }) => {
    const [sourceArg] = args;
    const sourceOption = extractStringOption(options, "source");
    const merged = mergeWithRuntime(options, runtime, {
      source: sourceArg ?? sourceOption,
    }) as Parameters<typeof showWarnings>[0];
    await showWarnings(merged);
  },
});

// Search command - search logs
registerLogCommand(program, {
  name: "search",
  description:
    'Search logs for a pattern\nExamples:\n  bslog search "error"                    # search in default source\n  bslog search "error" sweetistics-dev    # search in dev\n  bslog search "timeout" prod --since 1h  # search recent prod logs',
  arguments: [
    { declaration: "<pattern>", description: "Substring or expression to search for" },
    { declaration: "[source]", description: "Source name or alias" },
  ],
  setup: (cmd) => {
    cmd.option("-l, --level <level>", "Filter by log level");
  },
  handler: async ({ args, runtime, options }) => {
    const [pattern, sourceArg] = args;
    const sourceOption = extractStringOption(options, "source");
    const merged = mergeWithRuntime(options, runtime, {
      source: sourceArg ?? sourceOption,
    }) as Parameters<typeof searchLogs>[1];
    await searchLogs(pattern, merged);
  },
});

registerLogCommand(program, {
  name: "trace",
  description: "Fetch all logs sharing a requestId across one or more sources",
  arguments: [
    { declaration: "<requestId>", description: "Request identifier to trace" },
    { declaration: "[source]", description: "Source name or alias" },
  ],
  handler: async ({ args, runtime, options }) => {
    const [requestId, sourceArg] = args;
    const sourceOption = extractStringOption(options, "source");
    const merged = mergeWithRuntime(options, runtime, {
      source: sourceArg ?? sourceOption,
    }) as Parameters<typeof traceRequest>[1];
    await traceRequest(requestId, merged);
  },
});

// Sources command group
const sources = program.command("sources").description("Manage log sources");

sources
  .command("list")
  .option("-f, --format <type>", "Output format (json|table|pretty)", "pretty")
  .description("List all available sources")
  .action(async (options) => {
    await listSources(options);
  });

sources
  .command("get")
  .argument("<name>", "Source name")
  .option("-f, --format <type>", "Output format (json|pretty)", "pretty")
  .description("Get details about a specific source")
  .action(async (name, options) => {
    await getSource(name, options);
  });

// Config command group
const config = program.command("config").description("Manage configuration");

config
  .command("set")
  .argument("<key>", "Configuration key (source|limit|format|logLevel|queryBaseUrl)")
  .argument("<value>", "Configuration value")
  .description("Set a configuration value")
  .action((key, value) => {
    setConfig(key, value);
  });

config
  .command("show")
  .option("-f, --format <type>", "Output format (json|pretty)", "pretty")
  .description("Show current configuration")
  .action((options) => {
    showConfig(options);
  });

// Default source shorthand
config
  .command("source")
  .argument("<name>", "Source name")
  .description("Set default source (shorthand for config set source)")
  .action((name) => {
    setConfig("source", name);
  });

// Help text with examples
program.on("--help", () => {
  console.log("");
  console.log(chalk.bold("Examples:"));
  console.log("");
  console.log("  # GraphQL-like queries:");
  console.log('  $ bslog query "{ logs(limit: 100) { dt, level, message } }"');
  console.log("  $ bslog query \"{ logs(level: 'error', since: '1h') { * } }\"");
  console.log("  $ bslog query \"{ logs(where: { subsystem: 'api' }) { dt, message } }\"");
  console.log("");
  console.log("  # Simple commands:");
  console.log("  $ bslog tail -n 50                    # Last 50 logs");
  console.log("  $ bslog tail -f                       # Follow logs");
  console.log("  $ bslog errors --since 1h             # Errors from last hour");
  console.log('  $ bslog search "authentication failed"');
  console.log(
    '  $ bslog search "timeline" --where module=timeline --where env=production --until 2025-09-24T18:00',
  );
  console.log("  $ bslog tail --format json --jq '.[] | {dt, message}'");
  console.log("");
  console.log("  # Sources:");
  console.log("  $ bslog sources list                  # List all sources");
  console.log("  $ bslog config source sweetistics-dev # Set default source");
  console.log("");
  console.log("  # Raw SQL:");
  console.log('  $ bslog sql "SELECT * FROM remote(t123_logs) LIMIT 10"');
  console.log("");
  console.log(chalk.bold("Authentication:"));
  console.log("  Requires environment variables for Better Stack API access:");
  console.log("  - BETTERSTACK_API_TOKEN        # For sources discovery");
  console.log("  - BETTERSTACK_QUERY_USERNAME   # For log queries");
  console.log("  - BETTERSTACK_QUERY_PASSWORD   # For log queries");
  console.log("");
  console.log("  Add to ~/.zshrc (or ~/.bashrc) then reload with:");
  console.log(chalk.dim("  $ source ~/.zshrc"));
});

// Parse and execute
program.parse();

// Show help if no command provided
if (program.args.length === 0) {
  program.help();
}
