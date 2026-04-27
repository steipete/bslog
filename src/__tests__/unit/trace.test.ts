import { describe, expect, it, mock } from "bun:test";
import type { QueryOptions } from "../../types";

type TraceTestOptions = QueryOptions & { format?: string; sources?: string[]; jq?: string };

const tailLogsMock = mock((_options: TraceTestOptions) => Promise.resolve());

const { traceRequest } = await import("../../commands/trace");

describe("traceRequest", () => {
  it("adds the requestId to the where clause without mutating the original options", async () => {
    const originalWhere = { module: "api" };

    await traceRequest(
      "abc-123",
      {
        where: originalWhere,
        sources: ["dev"],
        format: "json",
      },
      tailLogsMock,
    );

    expect(tailLogsMock.mock.calls.length).toBe(1);
    const callOptions = tailLogsMock.mock.calls[0][0] as {
      where?: Record<string, unknown>;
      sources?: unknown;
    };

    expect(callOptions.where).toEqual({ module: "api", requestId: "abc-123" });
    expect(callOptions.sources).toEqual(["dev"]);
    expect(originalWhere).toEqual({ module: "api" });
  });
});
