import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import type { LogEntry } from "../../types";

const executeMock = mock<(options: Record<string, unknown>) => Promise<LogEntry[]>>(() =>
  Promise.resolve([]),
);

const { QueryAPI } = await import("../../api/query");
const { tailLogs } = await import("../../commands/tail");

type LogSpy = ReturnType<typeof mock>;

function printedMessages(logSpy: LogSpy): string[] {
  const messages: string[] = [];
  for (const call of logSpy.mock.calls) {
    const payload = JSON.parse(String(call[0])) as Array<{ message?: unknown }>;
    for (const entry of payload) {
      if (typeof entry.message === "string") {
        messages.push(entry.message);
      }
    }
  }
  return messages;
}

describe("tailLogs follow cursor", () => {
  const originalApiToken = process.env.BETTERSTACK_API_TOKEN;
  const originalConfigDir = process.env.BSLOG_CONFIG_DIR;
  const originalLog = console.log;
  const originalError = console.error;
  const originalExecute = QueryAPI.prototype.execute;
  const originalSetInterval = globalThis.setInterval;
  let logSpy: LogSpy;
  let errorSpy: LogSpy;
  let calls: Array<Record<string, unknown>>;

  beforeEach(() => {
    process.env.BETTERSTACK_API_TOKEN = "test-token";
    process.env.BSLOG_CONFIG_DIR = mkdtempSync(join(tmpdir(), "bslog-follow-"));
    calls = [];
    executeMock.mockReset();
    logSpy = mock(() => undefined);
    errorSpy = mock(() => undefined);
    console.log = logSpy as unknown as typeof console.log;
    console.error = errorSpy as unknown as typeof console.error;
    QueryAPI.prototype.execute = (options: Record<string, unknown>) => {
      calls.push(options);
      return executeMock(options);
    };
  });

  afterEach(() => {
    if (originalApiToken === undefined) {
      delete process.env.BETTERSTACK_API_TOKEN;
    } else {
      process.env.BETTERSTACK_API_TOKEN = originalApiToken;
    }
    if (originalConfigDir === undefined) {
      delete process.env.BSLOG_CONFIG_DIR;
    } else {
      process.env.BSLOG_CONFIG_DIR = originalConfigDir;
    }
    console.log = originalLog;
    console.error = originalError;
    QueryAPI.prototype.execute = originalExecute;
    globalThis.setInterval = originalSetInterval;
  });

  it("reads the rest of a full follow page before advancing the cursor", async () => {
    const baseline = "2025-09-24 12:00:00.000000";
    const newest = "2025-09-24 12:00:05.000000";
    const burst: LogEntry[] = [
      { dt: newest, raw: "{}", message: "newest" },
      { dt: "2025-09-24 12:00:04.000000", raw: "{}", message: "fourth" },
      { dt: "2025-09-24 12:00:03.000000", raw: "{}", message: "third" },
      { dt: "2025-09-24 12:00:02.000000", raw: "{}", message: "second" },
      { dt: "2025-09-24 12:00:01.000000", raw: "{}", message: "oldest-new" },
    ];

    executeMock.mockImplementation((options: Record<string, unknown>) => {
      const since = typeof options.since === "string" ? options.since : undefined;
      const limit = typeof options.limit === "number" ? options.limit : burst.length;
      if (!since) {
        return Promise.resolve([
          { dt: baseline, raw: "{}", message: "baseline" },
        ] satisfies LogEntry[]);
      }
      const visible = burst.filter((row) => row.dt >= since);
      return Promise.resolve(visible.slice(0, limit));
    });

    let poll: (() => Promise<void>) | undefined;
    globalThis.setInterval = ((handler: () => Promise<void>) => {
      poll = handler;
      return 0;
    }) as unknown as typeof setInterval;

    await tailLogs({ source: "source-a", follow: true, format: "json", limit: 2 });
    await poll?.();

    expect(printedMessages(logSpy)).toEqual([
      "baseline",
      "newest",
      "fourth",
      "third",
      "second",
      "oldest-new",
    ]);
    expect(
      calls.some(
        (options) =>
          options.since === baseline && typeof options.limit === "number" && options.limit > 2,
      ),
    ).toBe(true);

    await poll?.();

    expect(printedMessages(logSpy)).toEqual([
      "baseline",
      "newest",
      "fourth",
      "third",
      "second",
      "oldest-new",
    ]);
    expect(calls.at(-1)?.since).toBe(newest);
  });

  it("prints a new row that shares the newest follow timestamp once", async () => {
    const shared = "2025-09-24 12:00:05.000000";
    const first: LogEntry = { dt: shared, raw: '{"id":1}', message: "first" };
    const twin: LogEntry = { dt: shared, raw: '{"id":2}', message: "twin" };

    executeMock.mockImplementation((options: Record<string, unknown>) => {
      const since = typeof options.since === "string" ? options.since : undefined;
      if (!since) {
        return Promise.resolve([first]);
      }
      const visible = [twin, first].filter((row) => row.dt >= since);
      const limit = typeof options.limit === "number" ? options.limit : visible.length;
      return Promise.resolve(visible.slice(0, limit));
    });

    let poll: (() => Promise<void>) | undefined;
    globalThis.setInterval = ((handler: () => Promise<void>) => {
      poll = handler;
      return 0;
    }) as unknown as typeof setInterval;

    await tailLogs({ source: "source-a", follow: true, format: "json" });
    await poll?.();
    await poll?.();

    const messages = printedMessages(logSpy);
    expect(messages.filter((message) => message === "first")).toEqual(["first"]);
    expect(messages.filter((message) => message === "twin")).toEqual(["twin"]);
    expect(calls.at(-1)?.since).toBe(shared);
  });

  it("does not advance a source cursor past rows the merged page dropped", async () => {
    const baseline = "2025-09-24 12:00:00.000000";
    const later: Record<string, LogEntry[]> = {
      "source-a": [
        { dt: "2025-09-24 12:00:05.000000", raw: "{}", message: "a-new" },
        { dt: "2025-09-24 12:00:03.000000", raw: "{}", message: "a-mid" },
        { dt: "2025-09-24 12:00:01.000000", raw: "{}", message: "a-old" },
      ],
      "source-b": [
        { dt: "2025-09-24 12:00:04.000000", raw: "{}", message: "b-new" },
        { dt: "2025-09-24 12:00:02.000000", raw: "{}", message: "b-low" },
      ],
    };

    executeMock.mockImplementation((options: Record<string, unknown>) => {
      const source = typeof options.source === "string" ? options.source : "";
      const since = typeof options.since === "string" ? options.since : undefined;
      const limit = typeof options.limit === "number" ? options.limit : 2;
      const rows = since
        ? (later[source] ?? []).filter((row) => row.dt >= since)
        : [{ dt: baseline, raw: "{}", message: `base-${source}` }];
      return Promise.resolve(rows.slice(0, limit));
    });

    let poll: (() => Promise<void>) | undefined;
    globalThis.setInterval = ((handler: () => Promise<void>) => {
      poll = handler;
      return 0;
    }) as unknown as typeof setInterval;

    await tailLogs({
      sources: ["source-a", "source-b"],
      follow: true,
      format: "json",
      limit: 2,
    });
    await poll?.();

    expect(printedMessages(logSpy)).toEqual([
      "base-source-a",
      "base-source-b",
      "a-new",
      "b-new",
      "a-mid",
      "b-low",
      "a-old",
    ]);
    expect(
      calls.some(
        (options) =>
          options.source === "source-a" &&
          options.since === baseline &&
          typeof options.limit === "number" &&
          options.limit > 2,
      ),
    ).toBe(true);

    await poll?.();

    expect(printedMessages(logSpy)).toEqual([
      "base-source-a",
      "base-source-b",
      "a-new",
      "b-new",
      "a-mid",
      "b-low",
      "a-old",
    ]);
    const lastA = calls.filter((options) => options.source === "source-a").at(-1);
    expect(lastA?.since).toBe("2025-09-24 12:00:05.000000");
  });

  it("requests a source again when the initial merged page drops its row", async () => {
    const rows: Record<string, LogEntry> = {
      "source-a": { dt: "2025-09-24 12:00:05.000000", raw: "{}", message: "from-a" },
      "source-b": { dt: "2025-09-24 12:00:04.000000", raw: "{}", message: "from-b" },
    };

    executeMock.mockImplementation((options: Record<string, unknown>) => {
      const source = typeof options.source === "string" ? options.source : "";
      const since = typeof options.since === "string" ? options.since : undefined;
      const limit = typeof options.limit === "number" ? options.limit : 1;
      const row = rows[source];
      if (!row) {
        return Promise.resolve([]);
      }
      const sinceIsTimestamp = since !== undefined && /^\d{4}-\d{2}-\d{2}/.test(since);
      if (since !== undefined && !sinceIsTimestamp) {
        return Promise.resolve([]);
      }
      if (sinceIsTimestamp && row.dt < since) {
        return Promise.resolve([]);
      }
      return Promise.resolve([row].slice(0, limit));
    });

    let poll: (() => Promise<void>) | undefined;
    globalThis.setInterval = ((handler: () => Promise<void>) => {
      poll = handler;
      return 0;
    }) as unknown as typeof setInterval;

    await tailLogs({
      sources: ["source-a", "source-b"],
      follow: true,
      format: "json",
      limit: 1,
    });
    await poll?.();

    expect(printedMessages(logSpy)).toEqual(["from-a", "from-b"]);
  });

  it("pages through a full timestamp bucket before stopping", async () => {
    const baseline = "2025-09-24 12:00:00.000000";
    const shared = "2025-09-24 12:00:05.000000";
    const total = 10001;

    executeMock.mockImplementation((options: Record<string, unknown>) => {
      const since = typeof options.since === "string" ? options.since : undefined;
      const until = typeof options.until === "string" ? options.until : undefined;
      const limit = typeof options.limit === "number" ? options.limit : total;
      const offset = typeof options.offset === "number" ? options.offset : 0;
      if (!since) {
        return Promise.resolve([{ dt: baseline, raw: "{}", message: "baseline" }]);
      }
      if (until !== undefined && until < shared) {
        return Promise.resolve([]);
      }
      const page: LogEntry[] = [];
      for (let index = offset; index < total && page.length < limit; index += 1) {
        page.push({ dt: shared, raw: `{"i":${index}}`, message: `tie-${index}` });
      }
      return Promise.resolve(page);
    });

    let poll: (() => Promise<void>) | undefined;
    globalThis.setInterval = ((handler: () => Promise<void>) => {
      poll = handler;
      return 0;
    }) as unknown as typeof setInterval;

    await tailLogs({ source: "source-a", follow: true, format: "json" });
    await poll?.();

    const counts = messageCounts(logSpy);
    expect(counts.get("baseline")).toBe(1);
    expect(counts.get("tie-0")).toBe(1);
    expect(counts.get("tie-10000")).toBe(1);
    expect(counts.size).toBe(total + 1);

    await poll?.();

    const after = messageCounts(logSpy);
    expect(after.get("tie-0")).toBe(1);
    expect(after.get("tie-10000")).toBe(1);
    expect(after.size).toBe(total + 1);
  }, 20_000);

  it("resumes a follow backlog after the hop budget is exhausted", async () => {
    const baseline = "2025-01-01 00:00:00.000000";
    const baseEpoch = Date.parse("2025-09-24T12:00:00Z") / 1000;
    const total = 210_000;

    const burstDt = (index: number): string => {
      const iso = new Date((baseEpoch - index) * 1000).toISOString();
      return `${iso.slice(0, 19).replace("T", " ")}.000000`;
    };

    const indexForDt = (dt: string): number => {
      const epoch = Date.parse(`${dt.slice(0, 19).replace(" ", "T")}Z`) / 1000;
      return baseEpoch - epoch;
    };

    executeMock.mockImplementation((options: Record<string, unknown>) => {
      const since = typeof options.since === "string" ? options.since : undefined;
      const until = typeof options.until === "string" ? options.until : undefined;
      const limit = typeof options.limit === "number" ? options.limit : 100;
      const offset = typeof options.offset === "number" ? options.offset : 0;
      if (!since) {
        return Promise.resolve([{ dt: baseline, raw: "{}", message: "baseline" }]);
      }
      let start = 0;
      if (until !== undefined) {
        const untilIndex = indexForDt(until);
        if (untilIndex >= total) {
          return Promise.resolve([]);
        }
        start = Math.max(0, untilIndex);
      }
      start += offset;
      const page: LogEntry[] = [];
      for (let index = start; index < total && page.length < limit; index += 1) {
        const dt = burstDt(index);
        if (dt < since) {
          break;
        }
        page.push({ dt, raw: "{}", message: `row-${index}` });
      }
      return Promise.resolve(page);
    });

    let poll: (() => Promise<void>) | undefined;
    globalThis.setInterval = ((handler: () => Promise<void>) => {
      poll = handler;
      return 0;
    }) as unknown as typeof setInterval;

    await tailLogs({ source: "source-a", follow: true, format: "json" });
    await poll?.();

    const afterFirst = messageCounts(logSpy);
    expect(afterFirst.get("row-0")).toBe(1);
    expect(afterFirst.has("row-209999")).toBe(false);
    const callsAfterFirst = calls.length;

    await poll?.();

    const resumed = calls[callsAfterFirst];
    expect(typeof resumed?.until).toBe("string");
    expect(String(resumed?.until) < burstDt(0)).toBe(true);
    expect(String(resumed?.until) > burstDt(total - 1)).toBe(true);

    await poll?.();

    const afterResume = messageCounts(logSpy);
    expect(afterResume.get("row-0")).toBe(1);
    expect(afterResume.get("row-209999")).toBe(1);
    expect(afterResume.get("baseline")).toBe(1);
  }, 60_000);
});

function messageCounts(logSpy: LogSpy): Map<string, number> {
  const counts = new Map<string, number>();
  for (const message of printedMessages(logSpy)) {
    counts.set(message, (counts.get(message) ?? 0) + 1);
  }
  return counts;
}
