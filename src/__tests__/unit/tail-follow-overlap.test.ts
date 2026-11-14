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

describe("tailLogs follow poll overlap", () => {
  const originalApiToken = process.env.BETTERSTACK_API_TOKEN;
  const originalConfigDir = process.env.BSLOG_CONFIG_DIR;
  const originalLog = console.log;
  const originalError = console.error;
  const originalExecute = QueryAPI.prototype.execute;
  const originalSetInterval = globalThis.setInterval;
  let logSpy: LogSpy;
  let releasePolls: () => void;
  let followCalls: number;

  beforeEach(() => {
    process.env.BETTERSTACK_API_TOKEN = "test-token";
    process.env.BSLOG_CONFIG_DIR = mkdtempSync(join(tmpdir(), "bslog-overlap-"));
    followCalls = 0;
    releasePolls = () => undefined;
    const gate = new Promise<void>((resolve) => {
      releasePolls = resolve;
    });
    executeMock.mockReset();
    executeMock.mockImplementation((options: Record<string, unknown>) => {
      const since = typeof options.since === "string" ? options.since : undefined;
      const source = typeof options.source === "string" ? options.source : "source-a";
      if (!since) {
        return Promise.resolve([
          { dt: "2025-09-24 12:00:00.000000", raw: "{}", message: `base-${source}` },
        ]);
      }
      followCalls += 1;
      return gate.then(() => [
        { dt: "2025-09-24 12:00:05.000000", raw: "{}", message: `new-${source}` },
      ]);
    });
    logSpy = mock(() => undefined);
    console.log = logSpy as unknown as typeof console.log;
    console.error = mock(() => undefined) as unknown as typeof console.error;
    QueryAPI.prototype.execute = (options: Record<string, unknown>) => executeMock(options);
  });

  afterEach(() => {
    releasePolls();
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

  async function followPolls(
    options: Parameters<typeof tailLogs>[0],
  ): Promise<() => Promise<void>> {
    let poll: (() => Promise<void>) | undefined;
    globalThis.setInterval = ((handler: () => Promise<void>) => {
      poll = handler;
      return 0;
    }) as unknown as typeof setInterval;
    await tailLogs(options);
    if (!poll) {
      throw new Error("follow did not schedule a poll");
    }
    return poll;
  }

  it("does not start a second single-source poll while the first query is in flight", async () => {
    const poll = await followPolls({ source: "source-a", follow: true, format: "json", limit: 10 });
    const first = poll();
    const second = poll();

    expect(followCalls).toBe(1);
    releasePolls();
    await first;
    await second;

    expect(followCalls).toBe(1);
    expect(printedMessages(logSpy).filter((message) => message === "new-source-a")).toEqual([
      "new-source-a",
    ]);

    const third = poll();
    await third;
    expect(followCalls).toBe(2);
    expect(printedMessages(logSpy).filter((message) => message === "new-source-a")).toEqual([
      "new-source-a",
    ]);
  });

  it("does not start a second multi-source poll while the first query is in flight", async () => {
    const poll = await followPolls({
      sources: ["source-a", "source-b"],
      follow: true,
      format: "json",
      limit: 10,
    });
    const first = poll();
    const second = poll();

    expect(followCalls).toBe(1);
    releasePolls();
    await first;
    await second;

    expect(followCalls).toBe(2);
    expect(printedMessages(logSpy).filter((message) => message === "new-source-a")).toEqual([
      "new-source-a",
    ]);
    expect(printedMessages(logSpy).filter((message) => message === "new-source-b")).toEqual([
      "new-source-b",
    ]);

    const third = poll();
    await third;
    expect(followCalls).toBe(4);
  });
});
