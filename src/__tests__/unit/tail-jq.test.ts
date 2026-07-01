import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import type { SpawnSyncReturns } from "node:child_process";
import type { LogEntry } from "../../types";

type SpawnRunner = (typeof import("node:child_process"))["spawnSync"];

const { QueryAPI } = await import("../../api/query");
const { tailLogs, __setJqRunnerForTests } = await import("../../commands/tail");

describe("tailLogs jq integration", () => {
  const originalApiToken = process.env.BETTERSTACK_API_TOKEN;
  const originalExecute = QueryAPI.prototype.execute;
  const originalStdoutWrite = process.stdout.write;
  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;

  let stdoutSpy: ReturnType<typeof mock>;
  let logSpy: ReturnType<typeof mock>;
  let errorSpy: ReturnType<typeof mock>;
  const executeMock = mock<(options: Record<string, unknown>) => Promise<LogEntry[]>>(() =>
    Promise.resolve([]),
  );

  beforeEach(() => {
    process.env.BETTERSTACK_API_TOKEN = "test-token";
    stdoutSpy = mock(() => undefined);
    logSpy = mock(() => undefined);
    errorSpy = mock(() => undefined);

    process.stdout.write = stdoutSpy as unknown as typeof process.stdout.write;
    console.log = logSpy as unknown as typeof console.log;
    console.error = errorSpy as unknown as typeof console.error;

    executeMock.mockReset();
    QueryAPI.prototype.execute = (options: Record<string, unknown>) => executeMock(options);
  });

  afterEach(() => {
    if (originalApiToken === undefined) {
      delete process.env.BETTERSTACK_API_TOKEN;
    } else {
      process.env.BETTERSTACK_API_TOKEN = originalApiToken;
    }
    process.stdout.write = originalStdoutWrite;
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    QueryAPI.prototype.execute = originalExecute;
    __setJqRunnerForTests();
  });

  it("pipes formatted JSON through jq when filter is provided", async () => {
    const jqMock = mock(
      () =>
        ({
          pid: 0,
          output: [],
          stdout: '"trimmed"\n',
          stderr: "",
          status: 0,
          signal: null,
        }) as SpawnSyncReturns<string>,
    );
    __setJqRunnerForTests(jqMock as unknown as SpawnRunner);

    executeMock.mockResolvedValueOnce([
      { dt: "2025-09-24 12:00:00.000000", raw: "{}", message: "hello" },
    ]);

    await tailLogs({ format: "json", jq: ".[]", limit: 1 });

    expect(jqMock.mock.calls.length).toBe(1);
    const args = jqMock.mock.calls[0] as unknown as [string, string[]];
    expect(args[0]).toBe("jq");
    expect(args[1]).toEqual([".[]"]);
    expect(stdoutSpy.mock.calls.map((call) => call[0])).toContain('"trimmed"\n');
    expect(logSpy.mock.calls.length).toBe(0);
    expect(errorSpy.mock.calls.length).toBe(0);
  });

  it("falls back to raw payload when jq exits with error", async () => {
    const jqMock = mock(
      () =>
        ({
          pid: 0,
          output: [],
          stdout: "",
          stderr: "parse error",
          status: 2,
          signal: null,
        }) as SpawnSyncReturns<string>,
    );
    __setJqRunnerForTests(jqMock as unknown as SpawnRunner);

    executeMock.mockResolvedValueOnce([
      { dt: "2025-09-24 12:00:00.000000", raw: "{}", message: "hello" },
    ]);

    await tailLogs({ format: "json", jq: ".[]", limit: 1 });

    expect(jqMock.mock.calls.length).toBe(1);
    expect(
      errorSpy.mock.calls.some((call) => `${call[0]}`.includes("jq exited with status 2")),
    ).toBe(true);
    expect(logSpy.mock.calls.length).toBe(1);
    const payload = logSpy.mock.calls[0][0];
    expect(typeof payload).toBe("string");
    expect(payload).toContain("hello");
    expect(stdoutSpy.mock.calls.length).toBe(0);
  });
});
