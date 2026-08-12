import { describe, expect, it } from "bun:test";
import { Command } from "commander";
import { registerLogCommand } from "../../utils/command-factory";
import {
  normalizeSourcesOption,
  parseLimitOption,
  parseWhereOption,
  resolveRuntimeOptions,
} from "../../utils/options";

describe("CLI option helpers", () => {
  describe("normalizeSourcesOption", () => {
    it("returns undefined for empty input", () => {
      expect(normalizeSourcesOption(undefined)).toBeUndefined();
      expect(normalizeSourcesOption("")).toBeUndefined();
    });

    it("deduplicates and trims sources", () => {
      expect(normalizeSourcesOption(["prod,dev", " prod "])).toEqual(["prod", "dev"]);
    });
  });

  describe("parseLimitOption", () => {
    it("parses numeric values", () => {
      expect(parseLimitOption("200")).toBe(200);
      expect(parseLimitOption(50)).toBe(50);
      expect(parseLimitOption("10000")).toBe(10000);
    });

    it("returns undefined for invalid values", () => {
      expect(parseLimitOption("foo")).toBeUndefined();
      expect(parseLimitOption("0")).toBeUndefined();
      expect(parseLimitOption("-5")).toBeUndefined();
      expect(parseLimitOption("1.5")).toBeUndefined();
      expect(parseLimitOption("1e3")).toBeUndefined();
      expect(parseLimitOption("10001")).toBeUndefined();
      expect(parseLimitOption(1.5)).toBeUndefined();
    });
  });

  describe("parseWhereOption", () => {
    it("parses simple equality expressions", () => {
      expect(parseWhereOption(["module=timeline", "env=production"])).toEqual({
        module: "timeline",
        env: "production",
      });
    });

    it("parses typed values", () => {
      expect(
        parseWhereOption(["attempt=5", "active=true", "deleted=false", "userId=null"]),
      ).toEqual({
        attempt: 5,
        active: true,
        deleted: false,
        userId: null,
      });
    });

    it("parses quoted and JSON values", () => {
      expect(
        parseWhereOption(["route='/api/timeline'", 'meta={"flag":true}', "ids=[1,2]"]),
      ).toEqual({
        route: "/api/timeline",
        meta: { flag: true },
        ids: [1, 2],
      });
    });

    it("returns undefined when no valid filters provided", () => {
      expect(parseWhereOption([])).toBeUndefined();
      expect(parseWhereOption(["invalid"])).toBeUndefined();
    });
  });

  describe("resolveRuntimeOptions", () => {
    it("combines parsed limit, sources, and where filters", () => {
      const result = resolveRuntimeOptions({
        limit: "25",
        sources: "prod,dev",
        where: ["module=timeline"],
        jq: ".[]",
      });

      expect(result.limit).toBe(25);
      expect(result.sources).toEqual(["prod", "dev"]);
      expect(result.where).toEqual({ module: "timeline" });
      expect(result.jq).toBe(".[]");
    });
  });

  it("passes --hot-only through shared log command options", async () => {
    const program = new Command();
    let receivedOptions: Record<string, unknown> | undefined;

    registerLogCommand(program, {
      name: "logs",
      description: "Test command",
      handler: ({ options }) => {
        receivedOptions = options;
        return Promise.resolve();
      },
    });

    await program.parseAsync(["node", "test", "logs", "--hot-only"]);

    expect(receivedOptions?.hotOnly).toBe(true);
  });
});
