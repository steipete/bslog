import { spawnSync } from "node:child_process";
import chalk from "chalk";
import { QueryAPI } from "../api/query";
import type { LogEntry, QueryOptions } from "../types";
import { loadConfig, resolveSourceAlias } from "../utils/config";
import { formatOutput, type OutputFormat } from "../utils/formatter";
import { DEFAULT_QUERY_LIMIT, MAX_QUERY_LIMIT, normalizeLimitValue } from "../utils/limits";

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
  const cursor = emptyFollowCursor();

  const results = await api.execute(options);

  if (results.length > 0) {
    printResults(results, outputFormat, runtime.jq);
    adoptCompletePage(cursor, results);
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
      const window = await fetchFollowWindow(
        api,
        {
          ...options,
          since: cursor.dt || sinceFallback,
        },
        pollLimit,
      );
      const unseen = selectUnseen(window.rows, cursor);
      if (unseen.length > 0) {
        printResults(unseen, outputFormat, runtime.jq);
      }
      if (!window.complete || window.rows.length === 0) {
        if (!window.complete && unseen.length > 0) {
          rememberPrinted(cursor, unseen);
        }
        return;
      }
      adoptCompletePage(cursor, window.rows);
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
  const cursors = new Map<string, FollowCursor>();

  const collect = async (
    sinceMap?: Map<string, string>,
    limitOverride?: number,
    fallbackSince?: string,
    drain = false,
  ): Promise<{
    combined: LogEntryWithSource[];
    rowsBySource: Map<string, LogEntry[]>;
    completeBySource: Map<string, boolean>;
  }> => {
    const limitPerSource = Math.max(1, limitOverride ?? limit);
    const combined: LogEntryWithSource[] = [];
    const rowsBySource = new Map<string, LogEntry[]>();
    const completeBySource = new Map<string, boolean>();

    for (const source of sources) {
      const perSourceOptions: QueryOptions = {
        ...baseOptions,
        source,
        limit: limitPerSource,
      };

      const sinceCandidate = sinceMap?.get(source) ?? baseOptions.since ?? fallbackSince;
      perSourceOptions.since = sinceCandidate || undefined;

      const window = drain
        ? await fetchFollowWindow(api, perSourceOptions, limitPerSource)
        : {
            rows: await api.execute(perSourceOptions),
            complete: true,
          };
      rowsBySource.set(source, window.rows);
      completeBySource.set(source, window.complete);
      for (const entry of window.rows) {
        combined.push({ ...entry, source });
      }
    }

    combined.sort(compareNewestFirst);

    return {
      combined: drain ? combined : combined.slice(0, limitPerSource),
      rowsBySource,
      completeBySource,
    };
  };

  const { combined: initialCombined, rowsBySource } = await collect();
  if (initialCombined.length > 0) {
    printResults(initialCombined, outputFormat, runtime.jq);
  }

  if (!runtime.follow) {
    return;
  }

  for (const source of sources) {
    const fetched = rowsBySource.get(source) ?? [];
    const printed = initialCombined.filter((entry) => entry.source === source);
    if (fetched.length === 0) {
      continue;
    }
    const missing = entriesNotCovered(fetched, printed);
    if (missing.length === 0) {
      const cursor = emptyFollowCursor();
      adoptCompletePage(cursor, fetched);
      cursors.set(source, cursor);
      continue;
    }
    const oldest = missing.reduce((min, entry) => (entry.dt < min ? entry.dt : min), missing[0].dt);
    cursors.set(source, {
      dt: oldest,
      seen: countKeys(printed),
      holdAll: true,
    });
  }

  console.error(chalk.gray("\nFollowing logs... (Press Ctrl+C to stop)"));
  const intervalMs = resolveInterval(runtime.interval);
  const pollLimit = Math.max(1, Math.min(50, limit));
  const fallbackSince = baseOptions.since ? undefined : "1m";

  setInterval(async () => {
    try {
      const sinceMap = new Map<string, string>();
      for (const [source, cursor] of cursors) {
        if (cursor.dt) {
          sinceMap.set(source, cursor.dt);
        }
      }
      const { rowsBySource: followRows, completeBySource } = await collect(
        sinceMap,
        pollLimit,
        fallbackSince,
        true,
      );

      const fresh: LogEntryWithSource[] = [];
      const unseenBySource = new Map<string, LogEntry[]>();
      for (const source of sources) {
        const page = followRows.get(source) ?? [];
        const unseen = selectUnseen(page, cursors.get(source) ?? emptyFollowCursor());
        unseenBySource.set(source, unseen);
        for (const entry of unseen) {
          fresh.push({ ...entry, source });
        }
      }
      fresh.sort(compareNewestFirst);
      if (fresh.length > 0) {
        printResults(fresh, outputFormat, runtime.jq);
      }

      for (const source of sources) {
        const page = followRows.get(source) ?? [];
        if (page.length === 0) {
          continue;
        }
        const cursor = cursors.get(source) ?? emptyFollowCursor();
        if (completeBySource.get(source) !== true) {
          rememberPrinted(cursor, unseenBySource.get(source) ?? []);
          cursors.set(source, cursor);
          continue;
        }
        adoptCompletePage(cursor, page);
        cursors.set(source, cursor);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(chalk.red(`Polling error: ${message}`));
    }
  }, intervalMs);

  process.stdin.resume();
}

type FollowCursor = {
  dt: string | null;
  seen: Map<string, number>;
  holdAll: boolean;
};

function emptyFollowCursor(): FollowCursor {
  return { dt: null, seen: new Map(), holdAll: false };
}

function compareNewestFirst(left: LogEntry, right: LogEntry): number {
  if (left.dt === right.dt) {
    return 0;
  }
  return left.dt < right.dt ? 1 : -1;
}

function followKey(entry: LogEntry): string {
  const extras = Object.keys(entry)
    .filter((key) => key !== "dt" && key !== "raw" && key !== "source")
    .sort()
    .map((key) => `${key}=${JSON.stringify(entry[key])}`);
  return `${entry.dt}\u0000${String(entry.raw)}\u0000${extras.join("\u0000")}`;
}

function countKeys(entries: LogEntry[], dt?: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    if (dt !== undefined && entry.dt !== dt) {
      continue;
    }
    const key = followKey(entry);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function entriesNotCovered(fetched: LogEntry[], printed: LogEntry[]): LogEntry[] {
  const remaining = countKeys(printed);
  const missing: LogEntry[] = [];
  for (const entry of fetched) {
    const key = followKey(entry);
    const left = remaining.get(key) ?? 0;
    if (left > 0) {
      remaining.set(key, left - 1);
      continue;
    }
    missing.push(entry);
  }
  return missing;
}

function selectUnseen(entries: LogEntry[], cursor: FollowCursor): LogEntry[] {
  const remaining = new Map(cursor.seen);
  const unseen: LogEntry[] = [];
  for (const entry of entries) {
    const key = followKey(entry);
    if (cursor.holdAll || (cursor.dt !== null && entry.dt === cursor.dt)) {
      const left = remaining.get(key) ?? 0;
      if (left > 0) {
        remaining.set(key, left - 1);
        continue;
      }
    }
    if (!cursor.holdAll && cursor.dt !== null && entry.dt < cursor.dt) {
      continue;
    }
    unseen.push(entry);
  }
  return unseen;
}

function rememberPrinted(cursor: FollowCursor, entries: LogEntry[]): void {
  cursor.holdAll = true;
  for (const entry of entries) {
    const key = followKey(entry);
    cursor.seen.set(key, (cursor.seen.get(key) ?? 0) + 1);
  }
}

function adoptCompletePage(cursor: FollowCursor, entries: LogEntry[]): void {
  const newest = entries.reduce((max, entry) => (entry.dt > max ? entry.dt : max), entries[0].dt);
  cursor.dt = newest;
  cursor.seen = countKeys(entries, newest);
  cursor.holdAll = false;
}

function mergeNewRows(existing: LogEntry[], page: LogEntry[]): LogEntry[] {
  const counts = countKeys(existing);
  const merged = existing.slice();
  for (const entry of page) {
    const key = followKey(entry);
    const left = counts.get(key) ?? 0;
    if (left > 0) {
      counts.set(key, left - 1);
      continue;
    }
    merged.push(entry);
  }
  return merged;
}

// A newest-first page that fills the limit can hide older rows still inside since.
async function fetchFollowWindow(
  api: QueryAPI,
  options: QueryOptions,
  pollLimit: number,
): Promise<{ rows: LogEntry[]; complete: boolean }> {
  let rows: LogEntry[] = [];
  let until = options.until;
  let complete = false;

  for (let hop = 0; hop < 20; hop += 1) {
    let limit = pollLimit;
    let page = await api.execute({ ...options, until, limit });
    while (page.length >= limit && limit < MAX_QUERY_LIMIT) {
      const nextLimit = Math.min(MAX_QUERY_LIMIT, limit * 2);
      if (nextLimit === limit) {
        break;
      }
      limit = nextLimit;
      page = await api.execute({ ...options, until, limit });
    }

    if (page.length === 0) {
      complete = true;
      break;
    }

    rows = mergeNewRows(rows, page);
    if (page.length < limit) {
      complete = true;
      break;
    }

    const oldest = page.reduce((min, entry) => (entry.dt < min ? entry.dt : min), page[0].dt);
    if (until === oldest) {
      break;
    }
    until = oldest;
  }

  rows.sort(compareNewestFirst);
  return { rows, complete };
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
