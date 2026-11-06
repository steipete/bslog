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
          until: cursor.resumeUntil ?? options.until,
        },
        pollLimit,
        cursor.resumeSkip ?? 0,
      );
      const unseen = selectUnseen(window.rows, cursor);
      if (unseen.length > 0) {
        printResults(unseen, outputFormat, runtime.jq);
      }
      applyFollowWindow(cursor, window, unseen);
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
    windows: Map<string, FollowWindow>;
  }> => {
    const limitPerSource = Math.max(1, limitOverride ?? limit);
    const combined: LogEntryWithSource[] = [];
    const rowsBySource = new Map<string, LogEntry[]>();
    const windows = new Map<string, FollowWindow>();

    for (const source of sources) {
      const perSourceOptions: QueryOptions = {
        ...baseOptions,
        source,
        limit: limitPerSource,
      };

      const cursor = cursors.get(source);
      const sinceCandidate = sinceMap?.get(source) ?? baseOptions.since ?? fallbackSince;
      perSourceOptions.since = sinceCandidate || undefined;
      if (cursor?.resumeUntil) {
        perSourceOptions.until = cursor.resumeUntil;
      }

      const window = drain
        ? await fetchFollowWindow(api, perSourceOptions, limitPerSource, cursor?.resumeSkip ?? 0)
        : {
            rows: await api.execute(perSourceOptions),
            complete: true,
            resumeSkip: 0,
          };
      rowsBySource.set(source, window.rows);
      windows.set(source, window);
      for (const entry of window.rows) {
        combined.push({ ...entry, source });
      }
    }

    combined.sort(compareNewestFirst);

    return {
      combined: drain ? combined : combined.slice(0, limitPerSource),
      rowsBySource,
      windows,
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
      const { windows: followWindows } = await collect(sinceMap, pollLimit, fallbackSince, true);

      const fresh: LogEntryWithSource[] = [];
      const unseenBySource = new Map<string, LogEntry[]>();
      for (const source of sources) {
        const page = followWindows.get(source)?.rows ?? [];
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
        const window = followWindows.get(source);
        if (!window || (window.rows.length === 0 && window.complete)) {
          continue;
        }
        const cursor = cursors.get(source) ?? emptyFollowCursor();
        applyFollowWindow(cursor, window, unseenBySource.get(source) ?? []);
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
  resumeUntil?: string;
  resumeSkip?: number;
  pendingDt?: string;
  pendingSeen?: Map<string, number>;
};

type FollowWindow = {
  rows: LogEntry[];
  complete: boolean;
  resumeUntil?: string;
  resumeSkip: number;
};

function emptyFollowCursor(): FollowCursor {
  return { dt: null, seen: new Map(), holdAll: false, resumeSkip: 0 };
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
  const newest = maxDt(entries);
  cursor.dt = newest;
  cursor.seen = countKeys(entries, newest);
  cursor.holdAll = false;
  clearFollowResume(cursor);
}

function maxDt(entries: LogEntry[]): string {
  return entries.reduce((max, entry) => (entry.dt > max ? entry.dt : max), entries[0].dt);
}

function clearFollowResume(cursor: FollowCursor): void {
  cursor.resumeUntil = undefined;
  cursor.resumeSkip = 0;
  cursor.pendingDt = undefined;
  cursor.pendingSeen = undefined;
}

function notePendingHighWater(
  cursor: FollowCursor,
  windowRows: LogEntry[],
  printed: LogEntry[],
): void {
  if (windowRows.length === 0) {
    return;
  }
  const newest = maxDt(windowRows);
  if (!cursor.pendingDt || newest > cursor.pendingDt) {
    const seen = countKeys(printed, newest);
    if (cursor.dt === newest) {
      for (const [key, count] of cursor.seen) {
        seen.set(key, (seen.get(key) ?? 0) + count);
      }
    }
    cursor.pendingDt = newest;
    cursor.pendingSeen = seen;
    return;
  }
  if (newest !== cursor.pendingDt || !cursor.pendingSeen) {
    return;
  }
  for (const [key, count] of countKeys(printed, newest)) {
    cursor.pendingSeen.set(key, (cursor.pendingSeen.get(key) ?? 0) + count);
  }
}

function commitPendingHighWater(cursor: FollowCursor): void {
  if (!cursor.pendingDt || !cursor.pendingSeen) {
    clearFollowResume(cursor);
    return;
  }
  cursor.dt = cursor.pendingDt;
  cursor.seen = cursor.pendingSeen;
  cursor.holdAll = false;
  clearFollowResume(cursor);
}

function applyFollowWindow(cursor: FollowCursor, window: FollowWindow, unseen: LogEntry[]): void {
  if (!window.complete) {
    notePendingHighWater(cursor, window.rows, unseen);
    rememberPrinted(cursor, unseen);
    if (window.resumeUntil) {
      cursor.resumeUntil = window.resumeUntil;
    }
    cursor.resumeSkip = window.resumeSkip;
    return;
  }

  if (cursor.pendingDt) {
    notePendingHighWater(cursor, window.rows, unseen);
    commitPendingHighWater(cursor);
    return;
  }

  if (window.rows.length === 0) {
    return;
  }

  adoptCompletePage(cursor, window.rows);
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

const MAX_FOLLOW_HOPS = 20;

// Newest-first LIMIT hides older rows inside since. The bound keeps the
// server timestamp's fraction; a full bucket continues with OFFSET. An
// unfinished hop returns that bound so the next poll does not restart.
async function fetchFollowWindow(
  api: QueryAPI,
  options: QueryOptions,
  pollLimit: number,
  resumeSkip = 0,
): Promise<FollowWindow> {
  let rows: LogEntry[] = [];
  let until = options.until;
  let skip = resumeSkip;
  let complete = false;

  for (let hop = 0; hop < MAX_FOLLOW_HOPS; hop += 1) {
    let limit = Math.max(1, pollLimit);
    let page = await api.execute(followPageOptions(options, until, limit, skip));
    while (page.length >= limit && limit < MAX_QUERY_LIMIT) {
      const nextLimit = Math.min(MAX_QUERY_LIMIT, limit * 2);
      if (nextLimit === limit) {
        break;
      }
      limit = nextLimit;
      page = await api.execute(followPageOptions(options, until, limit, skip));
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
    const sameBucket = page.every((entry) => entry.dt === oldest);
    if (sameBucket || until === oldest) {
      until = oldest;
      skip += page.length;
      continue;
    }
    until = oldest;
    skip = 0;
  }

  rows.sort(compareNewestFirst);
  if (complete || !until) {
    return { rows, complete, resumeSkip: 0 };
  }
  return { rows, complete: false, resumeUntil: until, resumeSkip: skip };
}

function followPageOptions(
  options: QueryOptions,
  until: string | undefined,
  limit: number,
  skip: number,
): QueryOptions {
  const next: QueryOptions = { ...options, until, limit };
  if (skip > 0) {
    next.offset = skip;
  } else {
    delete next.offset;
  }
  return next;
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
