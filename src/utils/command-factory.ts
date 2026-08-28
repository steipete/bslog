import type { Command } from "commander";
import type { RuntimeOptions } from "./options";
import { resolveRuntimeOptions } from "./options";

export interface CommandArgument {
  declaration: string;
  description: string;
}

export interface LogCommandConfig {
  name: string;
  description: string;
  arguments?: CommandArgument[];
  setup?: (cmd: Command) => void;
  handler: (context: {
    args: string[];
    runtime: RuntimeOptions;
    options: Record<string, unknown>;
  }) => Promise<void>;
}

const collectWhereFilters = (value: string, previous: string[] = []): string[] => [
  ...previous,
  value,
];

export function registerLogCommand(program: Command, config: LogCommandConfig): Command {
  const command = program.command(config.name);

  command.description(config.description);

  if (config.arguments) {
    for (const arg of config.arguments) {
      command.argument(arg.declaration, arg.description);
    }
  }

  applySharedLogOptions(command);

  if (config.setup) {
    config.setup(command);
  }

  command.action(async (...rawArgs: unknown[]) => {
    const options = rawArgs.pop() as Record<string, unknown>;
    const commandOptions = options as unknown as Command;
    const plainOptions =
      typeof commandOptions.opts === "function"
        ? (commandOptions.opts() as Record<string, unknown>)
        : options;
    const runtime = resolveRuntimeOptions(plainOptions);
    const filteredOptions = stripRuntimeOptionProps(plainOptions);

    await config.handler({
      args: rawArgs as string[],
      runtime,
      options: filteredOptions,
    });
  });

  return command;
}

export function mergeWithRuntime(
  options: Record<string, unknown>,
  runtime: RuntimeOptions,
  extras: Record<string, unknown> = {},
): Record<string, unknown> {
  const merged: Record<string, unknown> = {
    ...options,
    ...extras,
  };

  if (runtime.limit !== undefined) {
    merged.limit = runtime.limit;
  }

  if (runtime.sources && runtime.sources.length > 0) {
    merged.sources = runtime.sources;
  }

  if (runtime.where && Object.keys(runtime.where).length > 0) {
    merged.where = runtime.where;
  }

  if (runtime.jq) {
    merged.jq = runtime.jq;
  }

  return merged;
}

function applySharedLogOptions(command: Command): void {
  command
    .option("-n, --limit <number>", "Number of logs to fetch", "100")
    .option("--since <time>", "Time lower bound (e.g., 1h, 2d, 2024-01-01)")
    .option("--until <time>", "Time upper bound (e.g., 2024-01-01T12:00)")
    .option("--format <type>", "Output format (json|table|csv|pretty)", "pretty")
    .option("--fields <names>", "Comma-separated list of fields to select (e.g., dt,message,level)")
    .option("--sources <names>", "Comma-separated list of sources to merge")
    .option("--hot-only", "Query hot storage only (faster, excludes archived logs)")
    .option(
      "--where <filter...>",
      "Filter JSON fields (field=value). Repeat to add multiple filters",
      collectWhereFilters,
      [],
    )
    .option("--jq <filter>", "Pipe JSON output through jq (requires jq in PATH)")
    .option("-v, --verbose", "Show SQL query and debug information");
}

function stripRuntimeOptionProps(options: Record<string, unknown>): Record<string, unknown> {
  const { limit: _limit, sources: _sources, where: _where, jq: _jq, ...rest } = options;
  return rest;
}
