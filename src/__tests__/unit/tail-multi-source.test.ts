import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import type { LogEntry } from "../../types";

const executeMock = mock<(options: Record<string, unknown>) => Promise<LogEntry[]>>(() =>
  Promise.resolve([]),
);

const { QueryAPI } = await import("../../api/query");
const { tailLogs } = await import("../../commands/tail");

describe("tailLogs multi-source correlation", () => {
  const originalApiToken = process.env.BETTERSTACK_API_TOKEN;
  const originalLog = console.log;
  const originalError = console.error;
  const originalExecute = QueryAPI.prototype.execute;
  const originalSetInterval = globalThis.setInterval;
  let logSpy: ReturnType<typeof mock>;
  let errorSpy: ReturnType<typeof mock>;

  beforeEach(() => {
    process.env.BETTERSTACK_API_TOKEN = "test-token";
    executeMock.mockReset();
    logSpy = mock(() => undefined);
    errorSpy = mock(() => undefined);
    console.log = logSpy as unknown as typeof console.log;
    console.error = errorSpy as unknown as typeof console.error;

    // Override QueryAPI execute
    QueryAPI.prototype.execute = (options: Record<string, unknown>) => executeMock(options);
  });

  afterEach(() => {
    if (originalApiToken === undefined) {
      delete process.env.BETTERSTACK_API_TOKEN;
    } else {
      process.env.BETTERSTACK_API_TOKEN = originalApiToken;
    }
    console.log = originalLog;
    console.error = originalError;
    QueryAPI.prototype.execute = originalExecute;
    globalThis.setInterval = originalSetInterval;
  });

  it("merges multiple sources and annotates each entry with its origin", async () => {
    executeMock.mockImplementation((options: Record<string, unknown>) => {
      const fixtures: Record<string, LogEntry[]> = {
        "source-a": [
          { dt: "2025-09-24 12:00:05.000000", raw: "{}", message: "A newest" },
          { dt: "2025-09-24 11:59:00.000000", raw: "{}", message: "A older" },
        ],
        "source-b": [
          { dt: "2025-09-24 12:00:07.000000", raw: "{}", message: "B newest" },
          { dt: "2025-09-24 12:00:01.000000", raw: "{}", message: "B older" },
        ],
      };

      const sourceName = typeof options.source === "string" ? options.source : undefined;
      const dataset = sourceName ? (fixtures[sourceName] ?? []) : [];
      const limitValue = typeof options.limit === "number" ? options.limit : Number.NaN;
      const limited = Number.isFinite(limitValue) ? dataset.slice(0, limitValue) : dataset;
      return Promise.resolve(limited);
    });

    await tailLogs({ sources: ["source-a", "source-b"], format: "json", limit: 3 });

    expect(executeMock.mock.calls.length).toBe(2);
    const calledSources = executeMock.mock.calls.map(([callOptions]) => {
      const value = callOptions.source;
      return typeof value === "string" ? value : "";
    });
    expect(new Set(calledSources)).toEqual(new Set(["source-a", "source-b"]));

    expect(logSpy.mock.calls.length).toBe(1);
    const payload = JSON.parse(logSpy.mock.calls[0][0] as string);

    expect(Array.isArray(payload)).toBe(true);
    expect(payload).toHaveLength(3);
    const typedPayload = payload as Array<{ source: string; dt: string }>;
    expect(typedPayload.map((entry) => entry.source)).toEqual(["source-b", "source-a", "source-b"]);
    expect(typedPayload[0].dt).toBe("2025-09-24 12:00:07.000000");
    expect(errorSpy.mock.calls.length).toBe(0);
  });

  it("uses hot storage for initial reads and polling across sources in follow mode", async () => {
    let poll: (() => Promise<void>) | undefined;
    globalThis.setInterval = ((handler: () => Promise<void>) => {
      poll = handler;
      return 0;
    }) as unknown as typeof setInterval;
    executeMock.mockResolvedValue([]);

    await tailLogs({ sources: ["source-a", "source-b"], follow: true, format: "json", limit: 1 });
    await poll?.();

    expect(executeMock.mock.calls.length).toBe(4);
    expect(executeMock.mock.calls.every(([options]) => options.hotOnly === true)).toBe(true);
  });
});
