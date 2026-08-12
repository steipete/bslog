import { spawnSync } from "node:child_process";
import chalk from "chalk";
import { QueryAPI } from "../api/query";
import type { LogEntry, QueryOptions } from "../types";
import { loadConfig, resolveSourceAlias } from "../utils/config";
import { formatOutput, type OutputFormat } from "../utils/formatter";
import { DEFAULT_QUERY_LIMIT, normalizeLimitValue } from "../utils/limits";

type JqRunner = typeof spawnSync;
let jqRunner: JqRunner = spawnSync;

export function __setJqRunnerForTests(runner?: JqRunner): void {
  jqRunner = runner ?? spawnSync;
}

type TailRuntimeOptions = {
  follow?: boolean;
  interval?: number;
  format?: string;
  jq?: string;
};

type TailOptions = Omit<QueryOptions, "fields"> &
  TailRuntimeOptions & {
    fields?: string | string[];
  };

type LogEntryWithSource = LogEntry & { source: string };

export async function tailLogs(options: TailOptions): Promise<void> {
  const api = new QueryAPI();
  const config = loadConfig();

  const {
    follow,
    interval,
    format,
    jq,
    sources: multiSourceOption,
    fields: rawFields,
    ...remainingOptions
  } = options;

  const queryOptions: QueryOptions = {
    ...(remainingOptions as QueryOptions),
  };

  if (follow) {
    queryOptions.hotOnly = true;
  }

  const normalizedFields = normalizeFieldsOption(rawFields);
  if (normalizedFields) {
    queryOptions.fields = normalizedFields;
  } else {
    delete queryOptions.fields;
  }

  const limit = normalizeLimit(queryOptions.limit);
  queryOptions.limit = limit;

  const resolvedSource = resolveSourceAlias(queryOptions.source);
  if (resolvedSource) {
    queryOptions.source = resolvedSource;
  }

  const resolvedSources = new Set<string>();
  if (resolvedSource) {
    resolvedSources.add(resolvedSource);
  }

  if (multiSourceOption?.length) {
    for (const candidate of multiSourceOption) {
      const resolved = resolveSourceAlias(candidate);
      if (resolved) {
        resolvedSources.add(resolved);
      }
    }
  }

  if (resolvedSources.size === 0) {
    const defaultSource = resolveSourceAlias(config.defaultSource);
    if (defaultSource) {
      resolvedSources.add(defaultSource);
    }
  }

  try {
    if (resolvedSources.size <= 1) {
      if (resolvedSources.size === 1) {
        queryOptions.source = [...resolvedSources][0];
      }

      if (queryOptions.source === undefined) {
        queryOptions.source = resolvedSource;
      }

      await runSingleSource(api, queryOptions, { follow, interval, format, jq });
      return;
    }

    queryOptions.source = undefined;
    await runMultiSource(api, queryOptions, { follow, interval, format, jq }, [...resolvedSources]);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(chalk.red(`Tail error: ${message}`));
    process.exit(1);
  }
}

async function runSingleSource(
  api: QueryAPI,
  options: QueryOptions,
  runtime: TailRuntimeOptions,
): Promise<void> {
  const outputFormat = resolveFormat(runtime.format, runtime.jq);
  let lastTimestamp: string | null = null;

  const results = await api.execute(options);

  if (results.length > 0) {
    printResults(results, outputFormat, runtime.jq);
    lastTimestamp = results[0].dt;
  }

  if (!runtime.follow) {
    return;
  }

  console.error(chalk.gray("\nFollowing logs... (Press Ctrl+C to stop)"));
  const intervalMs = resolveInterval(runtime.interval);
  const pollLimit = Math.max(1, Math.min(50, options.limit ?? 50));
  const sinceFallback = options.since ?? "1m";

  setInterval(async () => {
    try {
      const pollOptions: QueryOptions = {
        ...options,
        limit: pollLimit,
        since: lastTimestamp || sinceFallback,
      };

      const newResults = await api.execute(pollOptions);
      if (newResults.length === 0) {
        return;
      }

      const previousTimestamp = lastTimestamp;
      const filtered = previousTimestamp
        ? newResults.filter((entry) => entry.dt > previousTimestamp)
        : newResults;
      if (filtered.length === 0) {
        return;
      }

      printResults(filtered, outputFormat, runtime.jq);
      lastTimestamp = filtered[0].dt;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(chalk.red(`Polling error: ${message}`));
    }
  }, intervalMs);

  process.stdin.resume();
}

async function runMultiSource(
  api: QueryAPI,
  baseOptions: QueryOptions,
  runtime: TailRuntimeOptions,
  sources: string[],
): Promise<void> {
  const outputFormat = resolveFormat(runtime.format, runtime.jq);
  const limit = baseOptions.limit ?? 100;
  const perSourceLatest = new Map<string, string>();

  const collect = async (
    sinceMap?: Map<string, string>,
    limitOverride?: number,
    fallbackSince?: string,
  ): Promise<{ combined: LogEntryWithSource[]; latestBySource: Map<string, string> }> => {
    const limitPerSource = Math.max(1, limitOverride ?? limit);
    const combined: LogEntryWithSource[] = [];
    const latestBySource = new Map<string, string>();

    for (const source of sources) {
      const perSourceOptions: QueryOptions = {
        ...baseOptions,
        source,
        limit: limitPerSource,
      };

      const sinceCandidate = sinceMap?.get(source) ?? baseOptions.since ?? fallbackSince;
      perSourceOptions.since = sinceCandidate || undefined;

      const result = await api.execute(perSourceOptions);
      if (result.length > 0) {
        latestBySource.set(source, result[0].dt);
        for (const entry of result) {
          combined.push({ ...entry, source });
        }
      }
    }

    combined.sort((a, b) => {
      if (a.dt === b.dt) {
        return 0;
      }
      return a.dt < b.dt ? 1 : -1;
    });

    return {
      combined: combined.slice(0, limitPerSource),
      latestBySource,
    };
  };

  const { combined: initialCombined, latestBySource } = await collect();
  for (const [source, dt] of latestBySource) {
    perSourceLatest.set(source, dt);
  }

  if (initialCombined.length > 0) {
    printResults(initialCombined, outputFormat, runtime.jq);
  }

  if (!runtime.follow) {
    return;
  }

  console.error(chalk.gray("\nFollowing logs... (Press Ctrl+C to stop)"));
  const intervalMs = resolveInterval(runtime.interval);
  const pollLimit = Math.max(1, Math.min(50, limit));
  const fallbackSince = baseOptions.since ? undefined : "1m";

  setInterval(async () => {
    try {
      const { combined, latestBySource: followLatest } = await collect(
        perSourceLatest,
        pollLimit,
        fallbackSince,
      );

      if (combined.length > 0) {
        const newEntries = combined.filter((entry) => {
          const previous = perSourceLatest.get(entry.source);
          return !previous || entry.dt > previous;
        });

        if (newEntries.length > 0) {
          printResults(newEntries, outputFormat, runtime.jq);
        }
      }

      for (const [source, dt] of followLatest) {
        const previous = perSourceLatest.get(source);
        if (!previous || dt > previous) {
          perSourceLatest.set(source, dt);
        }
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(chalk.red(`Polling error: ${message}`));
    }
  }, intervalMs);

  process.stdin.resume();
}

function resolveFormat(format: string | undefined, jqFilter?: string): OutputFormat {
  if (jqFilter) {
    return "json";
  }

  if (format === "json" || format === "table" || format === "csv" || format === "pretty") {
    return format;
  }
  return "pretty";
}

function resolveInterval(value?: number | string): number {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return 2000;
}

function normalizeLimit(limit?: number): number {
  return normalizeLimitValue(limit) ?? DEFAULT_QUERY_LIMIT;
}

function normalizeFieldsOption(fields?: string | string[]): string[] | undefined {
  if (!fields) {
    return undefined;
  }

  const rawValues = Array.isArray(fields) ? fields : [fields];
  const names = rawValues
    .flatMap((value) => value.split(","))
    .map((name) => name.trim())
    .filter((name) => name.length > 0);

  if (names.length === 0) {
    return undefined;
  }

  return Array.from(new Set(names));
}

export function showErrors(
  options: QueryOptions & { format?: string; sources?: string[]; jq?: string },
): Promise<void> {
  return tailLogs({
    ...options,
    level: "error",
  });
}

export function showWarnings(
  options: QueryOptions & { format?: string; sources?: string[]; jq?: string },
): Promise<void> {
  return tailLogs({
    ...options,
    level: "warning",
  });
}

export function searchLogs(
  pattern: string,
  options: QueryOptions & { format?: string; sources?: string[]; jq?: string },
): Promise<void> {
  return tailLogs({
    ...options,
    search: pattern,
  });
}

function printResults(entries: LogEntry[], format: OutputFormat, jqFilter?: string): void {
  const payload = formatOutput(entries, format);

  if (!jqFilter) {
    console.log(payload);
    return;
  }

  try {
    const result = jqRunner("jq", [jqFilter], {
      input: payload,
      encoding: "utf8",
    });

    if (result.error) {
      console.error(chalk.red(`jq execution failed: ${result.error.message}`));
      console.log(payload);
      return;
    }

    if (result.status !== 0) {
      const stderr = result.stderr?.trim();
      if (stderr) {
        console.error(chalk.red(`jq exited with status ${result.status}: ${stderr}`));
      } else {
        console.error(chalk.red(`jq exited with status ${result.status}`));
      }
      console.log(payload);
      return;
    }

    const output = result.stdout ?? "";
    process.stdout.write(output);
    if (!output.endsWith("\n")) {
      process.stdout.write("\n");
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(chalk.red(`jq integration error: ${message}`));
    console.log(payload);
  }
}
