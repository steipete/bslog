import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, mock } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { showConfig } from "../../commands/config";
import {
  addToHistory,
  DEFAULT_QUERY_BASE_URL,
  getConfigDir,
  getConfigFile,
  loadConfig,
  saveConfig,
  updateConfig,
} from "../../utils/config";

describe("Config Utilities", () => {
  let CONFIG_DIR: string;
  let CONFIG_FILE: string;
  let originalConfigDir: string | undefined;
  const realFile = join(homedir(), ".bslog", "config.json");
  let realFileExists: boolean;
  let realFileContent: Buffer | undefined;

  beforeAll(() => {
    realFileExists = existsSync(realFile);
    if (realFileExists) {
      realFileContent = readFileSync(realFile);
    }
  });

  afterAll(() => {
    expect(existsSync(realFile)).toBe(realFileExists);
    if (realFileContent !== undefined) {
      expect(readFileSync(realFile).equals(realFileContent)).toBe(true);
    }
  });

  beforeEach(() => {
    originalConfigDir = process.env.BSLOG_CONFIG_DIR;
    CONFIG_DIR = mkdtempSync(join(tmpdir(), "bslog-test-"));
    CONFIG_FILE = join(CONFIG_DIR, "config.json");
    process.env.BSLOG_CONFIG_DIR = CONFIG_DIR;
  });

  afterEach(() => {
    try {
      rmSync(CONFIG_DIR, { recursive: true, force: true });
    } finally {
      if (originalConfigDir === undefined) {
        delete process.env.BSLOG_CONFIG_DIR;
      } else {
        process.env.BSLOG_CONFIG_DIR = originalConfigDir;
      }
    }
  });

  describe("config path isolation", () => {
    it("should use the temporary config directory instead of the real home path", () => {
      expect(getConfigDir()).toBe(CONFIG_DIR);
      expect(getConfigFile()).toBe(CONFIG_FILE);
      expect(getConfigFile().startsWith(join(homedir(), ".bslog"))).toBe(false);
    });

    it("should resolve config paths on every invocation", () => {
      saveConfig({ defaultLimit: 150 });

      const otherConfigDir = join(CONFIG_DIR, "other");
      process.env.BSLOG_CONFIG_DIR = otherConfigDir;

      expect(getConfigDir()).toBe(otherConfigDir);
      expect(getConfigFile()).toBe(join(otherConfigDir, "config.json"));
      expect(loadConfig().defaultLimit).toBe(100);

      saveConfig({ defaultLimit: 250 });
      expect(loadConfig().defaultLimit).toBe(250);

      process.env.BSLOG_CONFIG_DIR = CONFIG_DIR;
      expect(loadConfig().defaultLimit).toBe(150);
    });

    it.each([undefined, ""])("should use the default path when the override is %p", (override) => {
      if (override === undefined) {
        delete process.env.BSLOG_CONFIG_DIR;
      } else {
        process.env.BSLOG_CONFIG_DIR = override;
      }

      // Resolve paths only; never load or save the real home config.
      expect(getConfigDir()).toBe(join(homedir(), ".bslog"));
      expect(getConfigFile()).toBe(realFile);
    });
  });

  describe("loadConfig", () => {
    it("should return default config when file does not exist", () => {
      // Ensure config doesn't exist
      if (existsSync(CONFIG_FILE)) {
        rmSync(CONFIG_FILE);
      }

      const config = loadConfig();

      expect(config.defaultLimit).toBe(100);
      expect(config.outputFormat).toBe("json");
      expect(config.defaultLogLevel).toBe("all");
      expect(config.queryHistory).toEqual([]);
      expect(config.savedQueries).toEqual({});
    });

    it("should load existing config from file", () => {
      const testConfig = {
        defaultSource: "test-source",
        defaultLimit: 200,
        outputFormat: "pretty" as const,
        queryHistory: ["test query"],
        savedQueries: { test: "query" },
        defaultLogLevel: "warning",
      };

      saveConfig(testConfig);
      const loaded = loadConfig();

      expect(loaded.defaultSource).toBe("test-source");
      expect(loaded.defaultLimit).toBe(200);
      expect(loaded.outputFormat).toBe("pretty");
      expect(loaded.queryHistory).toEqual(["test query"]);
      expect(loaded.savedQueries).toEqual({ test: "query" });
      expect(loaded.defaultLogLevel).toBe("warning");
    });
  });

  describe("saveConfig", () => {
    it("should create config directory if it does not exist", () => {
      // Remove directory if it exists
      if (existsSync(CONFIG_DIR)) {
        rmSync(CONFIG_DIR, { recursive: true });
      }

      const config = {
        defaultLimit: 150,
        outputFormat: "json" as const,
      };

      saveConfig(config);

      expect(existsSync(CONFIG_DIR)).toBe(true);
      expect(existsSync(CONFIG_FILE)).toBe(true);
    });

    it("should save config as formatted JSON", () => {
      const config = {
        defaultSource: "production",
        defaultLimit: 100,
        outputFormat: "pretty" as const,
      };

      saveConfig(config);

      const content = require("node:fs").readFileSync(CONFIG_FILE, "utf-8");
      const parsed = JSON.parse(content);

      expect(parsed.defaultSource).toBe("production");
      expect(content).toContain("\n"); // Check for formatting
    });
  });

  describe("updateConfig", () => {
    it("should merge updates with existing config", () => {
      const initial = {
        defaultSource: "dev",
        defaultLimit: 100,
        outputFormat: "json" as const,
      };

      saveConfig(initial);

      updateConfig({
        defaultLimit: 200,
        outputFormat: "pretty",
      });

      const result = loadConfig();

      expect(result.defaultSource).toBe("dev"); // Unchanged
      expect(result.defaultLimit).toBe(200); // Updated
      expect(result.outputFormat).toBe("pretty"); // Updated
    });

    it("should round-trip a custom queryBaseUrl", () => {
      saveConfig({
        defaultLimit: 100,
        outputFormat: "json" as const,
      });

      updateConfig({
        queryBaseUrl: "https://us-east-1-connect.betterstackdata.com",
      });

      const result = loadConfig();

      expect(result.queryBaseUrl).toBe("https://us-east-1-connect.betterstackdata.com");
      expect(result.defaultLimit).toBe(100);
    });

    it("should add new properties", () => {
      const initial = {
        defaultLimit: 100,
        outputFormat: "json" as const,
      };

      saveConfig(initial);

      updateConfig({
        defaultSource: "new-source",
      });

      const result = loadConfig();

      expect(result.defaultSource).toBe("new-source");
      expect(result.defaultLimit).toBe(100);
    });
  });

  describe("addToHistory", () => {
    it("should add query to beginning of history", () => {
      saveConfig({
        defaultLimit: 100,
        outputFormat: "json",
        queryHistory: ["old query"],
      });

      addToHistory("new query");

      const config = loadConfig();
      expect(config.queryHistory).toEqual(["new query", "old query"]);
    });

    it("should limit history to 100 entries", () => {
      const history = Array.from({ length: 100 }, (_, i) => `query ${i}`);

      saveConfig({
        defaultLimit: 100,
        outputFormat: "json",
        queryHistory: history,
      });

      addToHistory("new query");

      const config = loadConfig();
      expect(config.queryHistory?.length).toBe(100);
      expect(config.queryHistory?.[0]).toBe("new query");
      expect(config.queryHistory?.[99]).toBe("query 98"); // Last old query kept
    });

    it("should create history array if it does not exist", () => {
      saveConfig({
        defaultLimit: 100,
        outputFormat: "json",
      });

      addToHistory("first query");

      const config = loadConfig();
      expect(config.queryHistory).toEqual(["first query"]);
    });
  });

  describe("getApiToken", () => {
    it("should throw error when BETTERSTACK_API_TOKEN is not set", async () => {
      const originalToken = process.env.BETTERSTACK_API_TOKEN;
      delete process.env.BETTERSTACK_API_TOKEN;

      // Dynamic import to reset module cache
      const { getApiToken } = await import("../../utils/config");

      expect(() => getApiToken()).toThrow("BETTERSTACK_API_TOKEN environment variable is not set");

      // Restore original token if it existed
      if (originalToken) {
        process.env.BETTERSTACK_API_TOKEN = originalToken;
      }
    });

    it("should return token when environment variable is set", async () => {
      const testToken = "test_token_123";
      process.env.BETTERSTACK_API_TOKEN = testToken;

      const { getApiToken } = await import("../../utils/config");

      expect(getApiToken()).toBe(testToken);
    });
  });

  describe("getQueryCredentials", () => {
    it("should return empty object when credentials are not set", () => {
      const originalUsername = process.env.BETTERSTACK_QUERY_USERNAME;
      const originalPassword = process.env.BETTERSTACK_QUERY_PASSWORD;

      delete process.env.BETTERSTACK_QUERY_USERNAME;
      delete process.env.BETTERSTACK_QUERY_PASSWORD;

      const { getQueryCredentials } = require("../../utils/config");
      const creds = getQueryCredentials();

      expect(creds.username).toBeUndefined();
      expect(creds.password).toBeUndefined();

      // Restore original values
      if (originalUsername) {
        process.env.BETTERSTACK_QUERY_USERNAME = originalUsername;
      }
      if (originalPassword) {
        process.env.BETTERSTACK_QUERY_PASSWORD = originalPassword;
      }
    });

    it("should return credentials when environment variables are set", () => {
      const testUsername = "test_user";
      const testPassword = "test_pass";

      process.env.BETTERSTACK_QUERY_USERNAME = testUsername;
      process.env.BETTERSTACK_QUERY_PASSWORD = testPassword;

      const { getQueryCredentials } = require("../../utils/config");
      const creds = getQueryCredentials();

      expect(creds.username).toBe(testUsername);
      expect(creds.password).toBe(testPassword);
    });

    it("should return partial credentials if only one is set", () => {
      const originalUsername = process.env.BETTERSTACK_QUERY_USERNAME;
      const originalPassword = process.env.BETTERSTACK_QUERY_PASSWORD;

      process.env.BETTERSTACK_QUERY_USERNAME = "test_user";
      delete process.env.BETTERSTACK_QUERY_PASSWORD;

      const { getQueryCredentials } = require("../../utils/config");
      const creds = getQueryCredentials();

      expect(creds.username).toBe("test_user");
      expect(creds.password).toBeUndefined();

      // Restore original values
      if (originalUsername) {
        process.env.BETTERSTACK_QUERY_USERNAME = originalUsername;
      }
      if (originalPassword) {
        process.env.BETTERSTACK_QUERY_PASSWORD = originalPassword;
      }
    });
  });

  describe("resolveSourceAlias", () => {
    const { resolveSourceAlias } = require("../../utils/config");

    it("should resolve common aliases", () => {
      expect(resolveSourceAlias("dev")).toBe("sweetistics-dev");
      expect(resolveSourceAlias("development")).toBe("sweetistics-dev");
      expect(resolveSourceAlias("prod")).toBe("sweetistics");
      expect(resolveSourceAlias("production")).toBe("sweetistics");
      expect(resolveSourceAlias("staging")).toBe("sweetistics-staging");
      expect(resolveSourceAlias("test")).toBe("sweetistics-test");
    });

    it("should be case-insensitive for aliases", () => {
      expect(resolveSourceAlias("DEV")).toBe("sweetistics-dev");
      expect(resolveSourceAlias("Dev")).toBe("sweetistics-dev");
      expect(resolveSourceAlias("PROD")).toBe("sweetistics");
      expect(resolveSourceAlias("Prod")).toBe("sweetistics");
    });

    it("should return original source if not an alias", () => {
      expect(resolveSourceAlias("custom-source")).toBe("custom-source");
      expect(resolveSourceAlias("another-bucket")).toBe("another-bucket");
      expect(resolveSourceAlias("sweetistics-custom")).toBe("sweetistics-custom");
    });

    it("should return undefined for undefined input", () => {
      expect(resolveSourceAlias(undefined)).toBeUndefined();
    });

    it("should handle empty string", () => {
      expect(resolveSourceAlias("")).toBe("");
    });
  });

  describe("showConfig", () => {
    const originalLog = console.log;
    const originalError = console.error;
    let logSpy: ReturnType<typeof mock>;
    let errorSpy: ReturnType<typeof mock>;

    beforeEach(() => {
      logSpy = mock(() => undefined);
      errorSpy = mock(() => undefined);
      console.log = logSpy as unknown as typeof console.log;
      console.error = errorSpy as unknown as typeof console.error;
    });

    afterEach(() => {
      console.log = originalLog;
      console.error = originalError;
    });

    it("should output JSON when requested", () => {
      const sampleConfig = {
        defaultSource: "api-prod",
        defaultLimit: 250,
        outputFormat: "pretty" as const,
        queryHistory: ["{ logs(limit: 10) { * } }"],
        savedQueries: { recentErrors: '{ logs(level: "error", limit: 20) { dt } }' },
      };

      saveConfig(sampleConfig);
      showConfig({ format: "json" });

      expect(logSpy.mock.calls.length).toBe(1);
      const payload = JSON.parse(logSpy.mock.calls[0][0] as string);

      expect(payload.defaultSource).toBe("api-prod");
      expect(payload.defaultLimit).toBe(250);
      expect(payload.outputFormat).toBe("pretty");
      expect(payload.queryBaseUrl).toBe(DEFAULT_QUERY_BASE_URL);
      expect(payload.savedQueries.recentErrors).toContain("limit: 20");
      expect(payload.queryHistory).toEqual(sampleConfig.queryHistory);
      expect(errorSpy.mock.calls.length).toBe(0);
    });

    it("should include custom queryBaseUrl in JSON output", () => {
      const sampleConfig = {
        defaultLimit: 100,
        outputFormat: "json" as const,
        queryBaseUrl: "https://us-east-1-connect.betterstackdata.com",
      };

      saveConfig(sampleConfig);
      showConfig({ format: "json" });

      expect(logSpy.mock.calls.length).toBe(1);
      const payload = JSON.parse(logSpy.mock.calls[0][0] as string);

      expect(payload.queryBaseUrl).toBe("https://us-east-1-connect.betterstackdata.com");
    });
  });
});
