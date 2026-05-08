import { afterAll, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import { QueryAPI } from "../../api/query";

// Mock the sources API
mock.module("../../api/sources", () => ({
  SourcesAPI: class {
    findByName(name: string) {
      if (name === "test-source") {
        return {
          id: "123456",
          attributes: {
            name: "test-source",
            platform: "javascript",
            team_id: 123456,
            table_name: "test_source",
          },
        };
      }
      return null;
    }
  },
}));

// Mock the config
const mockConfig = {
  defaultSource: "test-source",
  defaultLimit: 100,
  outputFormat: "json",
  defaultLogLevel: "all" as string,
};

mock.module("../../utils/config", () => ({
  loadConfig: () => mockConfig,
  getApiToken: () => "test-token",
  getQueryCredentials: () => ({ username: "test-user", password: "test-pass" }),
  saveConfig: () => undefined,
  updateConfig: () => undefined,
  addToHistory: () => undefined,
  resolveSourceAlias: (source?: string) => source, // Pass through for tests
}));

// Mock the client
mock.module("../../api/client", () => ({
  BetterStackClient: class {
    query(_sql: string) {
      return Promise.resolve([{ dt: "2024-01-15", level: "info", message: "test" }]);
    }
  },
}));

describe("Query Builder Integration", () => {
  let queryAPI: QueryAPI;

  afterAll(() => {
    mock.restore();
  });

  beforeEach(() => {
    queryAPI = new QueryAPI();
    mockConfig.defaultLogLevel = "all";
  });

  describe("buildQuery", () => {
    it("should build basic query with source and limit", async () => {
      const sql = await queryAPI.buildQuery({
        source: "test-source",
        limit: 50,
      });

      expect(sql).toContain("SELECT dt, raw FROM remote(t123456_test_source_logs)");
      expect(sql).toContain("ORDER BY dt DESC");
      expect(sql).toContain("LIMIT 50");
      expect(sql).toContain("FORMAT JSONEachRow");
    });

    it("should build query with field selection", async () => {
      const sql = await queryAPI.buildQuery({
        source: "test-source",
        fields: ["dt", "level", "message"],
      });

      expect(sql).toContain(
        "SELECT dt, JSON_VALUE(raw, '$.level') AS \"level\", JSON_VALUE(raw, '$.message') AS \"message\"",
      );
    });

    it("should build query with nested field selection", async () => {
      const sql = await queryAPI.buildQuery({
        source: "test-source",
        fields: ["vercel.proxy.status_code", "metadata['odd key']"],
      });

      expect(sql).toContain(
        `JSON_VALUE(raw, '$.vercel.proxy.status_code') AS "vercel.proxy.status_code"`,
      );
      expect(sql).toContain(`JSON_VALUE(raw, '$.metadata["odd key"]') AS "metadata['odd key']"`);
    });

    it("should build query with array index field selection", async () => {
      const sql = await queryAPI.buildQuery({
        source: "test-source",
        fields: ["metadata.proxy[0].status"],
      });

      expect(sql).toContain(
        `JSON_VALUE(raw, '$.metadata.proxy[0].status') AS "metadata.proxy[0].status"`,
      );
    });

    it("should build query with root-level bracket selection", async () => {
      const sql = await queryAPI.buildQuery({
        source: "test-source",
        fields: ['["root key"].value'],
      });

      expect(sql).toContain(`JSON_VALUE(raw, '$["root key"].value') AS "[""root key""].value"`);
    });

    it("should handle asterisk field selection", async () => {
      const sql = await queryAPI.buildQuery({
        source: "test-source",
        fields: ["*"],
      });

      expect(sql).toContain("SELECT dt, raw FROM");
    });

    it("should build query with level filter", async () => {
      const sql = await queryAPI.buildQuery({
        source: "test-source",
        level: "error",
      });

      expect(sql).toContain("JSON_VALUE(raw, '$.vercel.level')");
      expect(sql).toContain(
        "positionCaseInsensitive(COALESCE(JSONExtractString(raw, 'message'), JSON_VALUE(raw, '$.message')), 'error') > 0",
      );
      expect(sql).toContain("JSONHas(raw, 'error')");
      expect(sql).toContain("toInt32OrZero(JSON_VALUE(raw, '$.vercel.proxy.status_code')) >= 500");
      expect(sql).toContain("= 'error'");
    });

    it("should use config default log level when none is provided", async () => {
      mockConfig.defaultLogLevel = "debug";

      const sql = await queryAPI.buildQuery({
        source: "test-source",
      });

      expect(sql).toContain("JSON_VALUE(raw, '$.vercel.level')");
      expect(sql).toContain("= 'debug'");
    });

    it("should allow explicit level to override config default", async () => {
      mockConfig.defaultLogLevel = "debug";

      const sql = await queryAPI.buildQuery({
        source: "test-source",
        level: "info",
      });

      expect(sql).toContain("= 'info'");
      expect(sql).not.toContain("= 'debug'");
    });

    it("should build query with subsystem filter", async () => {
      const sql = await queryAPI.buildQuery({
        source: "test-source",
        subsystem: "api",
      });

      expect(sql).toContain("JSON_VALUE(raw, '$.subsystem') = 'api'");
    });

    it("should build query with search pattern", async () => {
      const sql = await queryAPI.buildQuery({
        source: "test-source",
        search: "error message",
      });

      expect(sql).toContain("WHERE raw LIKE '%error message%'");
    });

    it("should escape single quotes in search pattern", async () => {
      const sql = await queryAPI.buildQuery({
        source: "test-source",
        search: "user's data",
      });

      expect(sql).toContain("WHERE raw LIKE '%user''s data%'");
    });

    it("should build query with time range", async () => {
      const sql = await queryAPI.buildQuery({
        source: "test-source",
        since: "2024-01-01T00:00:00Z",
        until: "2024-01-02T00:00:00Z",
      });

      expect(sql).toContain("WHERE dt >= toDateTime64");
      expect(sql).toContain("AND dt <= toDateTime64");
    });

    it("should build query with where clause", async () => {
      const sql = await queryAPI.buildQuery({
        source: "test-source",
        where: {
          userId: "12345",
          status: "active",
        },
      });

      expect(sql).toContain(`JSON_VALUE(raw, '$.userId') = '12345'`);
      expect(sql).toContain(`JSON_VALUE(raw, '$.status') = 'active'`);
    });

    it("should build query with nested where clause", async () => {
      const sql = await queryAPI.buildQuery({
        source: "test-source",
        where: {
          "vercel.proxy.status_code": 200,
          "metadata['odd key']": null,
        },
      });

      expect(sql).toContain(`JSON_VALUE(raw, '$.vercel.proxy.status_code') = '200'`);
      expect(sql).toContain(`JSON_VALUE(raw, '$.metadata["odd key"]') IS NULL`);
    });

    it("should build query with array index where clause", async () => {
      const sql = await queryAPI.buildQuery({
        source: "test-source",
        where: {
          "metadata.proxy[0].status": "ok",
        },
      });

      expect(sql).toContain(`JSON_VALUE(raw, '$.metadata.proxy[0].status') = 'ok'`);
    });

    it("should build query with complex key characters", async () => {
      const sql = await queryAPI.buildQuery({
        source: "test-source",
        where: {
          "metadata['key\"with\"quotes']": "value",
        },
      });

      expect(sql).toContain(`JSON_VALUE(raw, '$.metadata["key\\"with\\"quotes"]') = 'value'`);
    });

    it("should build query with object values in where clause", async () => {
      const sql = await queryAPI.buildQuery({
        source: "test-source",
        where: {
          metadata: { feature: "timeline", enabled: true },
        },
      });

      expect(sql).toContain(
        `JSON_VALUE(raw, '$.metadata') = '{"feature":"timeline","enabled":true}'`,
      );
    });

    it("should handle where clause with non-string values", async () => {
      const sql = await queryAPI.buildQuery({
        source: "test-source",
        where: {
          count: 42,
          active: true,
        },
      });

      expect(sql).toContain("JSON_VALUE(raw, '$.count') = '42'");
      expect(sql).toContain("JSON_VALUE(raw, '$.active') = 'true'");
    });

    it("should combine multiple filters with AND", async () => {
      const sql = await queryAPI.buildQuery({
        source: "test-source",
        level: "error",
        subsystem: "api",
        search: "timeout",
      });

      expect(sql).toContain("WHERE");
      expect(sql).toContain("AND");
      expect(sql.match(/AND/g)?.length).toBe(2); // Two ANDs for three conditions
    });

    it("should use default source from config when not specified", async () => {
      const sql = await queryAPI.buildQuery({
        limit: 10,
      });

      expect(sql).toContain("t123456_test_source_logs");
    });

    it("should use default limit from config when not specified", async () => {
      const sql = await queryAPI.buildQuery({
        source: "test-source",
      });

      expect(sql).toContain("LIMIT 100");
    });

    it("should throw error when source is not found", async () => {
      await expect(
        queryAPI.buildQuery({
          source: "non-existent-source",
        }),
      ).rejects.toThrow("Source not found: non-existent-source");
    });

    it("should throw error when no source is specified and no default", async () => {
      // Override mock to return no default source
      mock.module("../../utils/config", () => ({
        loadConfig: () => ({
          defaultLimit: 100,
          outputFormat: "json",
        }),
        getApiToken: () => "test-token",
      }));

      const api = new QueryAPI();

      await expect(api.buildQuery({})).rejects.toThrow("No source specified");
    });

    it("should handle source names with hyphens", async () => {
      const sql = await queryAPI.buildQuery({
        source: "test-source",
        limit: 1,
      });

      expect(sql).toContain("t123456_test_source_logs");
    });

    it("should build complex query with all options", async () => {
      const sql = await queryAPI.buildQuery({
        source: "test-source",
        fields: ["dt", "level", "message", "userId"],
        level: "error",
        subsystem: "payment",
        since: "2024-01-01T00:00:00Z",
        until: "2024-01-02T00:00:00Z",
        search: "failed transaction",
        where: {
          environment: "production",
          region: "us-east-1",
        },
        limit: 500,
      });

      expect(sql).toContain("SELECT dt, JSON_VALUE(raw, '$.level') AS \"level\"");
      expect(sql).toContain("JSON_VALUE(raw, '$.message') AS \"message\"");
      expect(sql).toContain("JSON_VALUE(raw, '$.userId') AS \"userId\"");
      expect(sql).toContain("JSON_VALUE(raw, '$.vercel.level')");
      expect(sql).toContain("JSON_VALUE(raw, '$.subsystem') = 'payment'");
      expect(sql).toContain("dt >= toDateTime64");
      expect(sql).toContain("dt <= toDateTime64");
      expect(sql).toContain("raw LIKE '%failed transaction%'");
      expect(sql).toContain("JSON_VALUE(raw, '$.environment') = 'production'");
      expect(sql).toContain("JSON_VALUE(raw, '$.region') = 'us-east-1'");
      expect(sql).toContain("LIMIT 500");
    });
  });

  describe("execute with verbose mode", () => {
    it("should log SQL query when verbose is true", async () => {
      const consoleSpy = spyOn(console, "error").mockImplementation(() => undefined);

      await queryAPI.execute({
        source: "test-source",
        verbose: true,
        limit: 10,
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          "Executing query: SELECT dt, raw FROM remote(t123456_test_source_logs)",
        ),
      );

      consoleSpy.mockRestore();
    });

    it("should not log SQL query when verbose is false", async () => {
      const consoleSpy = spyOn(console, "error").mockImplementation(() => undefined);

      await queryAPI.execute({
        source: "test-source",
        verbose: false,
        limit: 10,
      });

      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it("should not log SQL query when verbose is undefined", async () => {
      const consoleSpy = spyOn(console, "error").mockImplementation(() => undefined);

      await queryAPI.execute({
        source: "test-source",
        limit: 10,
      });

      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe("source alias resolution", () => {
    beforeEach(() => {
      // Override the mock to test source alias resolution
      mock.module("../../utils/config", () => ({
        loadConfig: () => ({
          defaultSource: "test-source",
          defaultLimit: 100,
          outputFormat: "json",
        }),
        getApiToken: () => "test-token",
        getQueryCredentials: () => ({ username: "test-user", password: "test-pass" }),
        saveConfig: () => undefined,
        updateConfig: () => undefined,
        addToHistory: () => undefined,
        resolveSourceAlias: (source?: string) => {
          const aliases: Record<string, string> = {
            dev: "test-source",
            prod: "test-source",
          };
          return source ? aliases[source.toLowerCase()] || source : source;
        },
      }));
    });

    it("should resolve source aliases in buildQuery", async () => {
      const sql = await queryAPI.buildQuery({
        source: "dev",
        limit: 10,
      });

      expect(sql).toContain("t123456_test_source_logs");
    });
  });
});
