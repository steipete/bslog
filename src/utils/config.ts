import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { Config } from "../types";

export function getConfigDir(): string {
  return process.env.BSLOG_CONFIG_DIR || join(homedir(), ".bslog");
}

export function getConfigFile(): string {
  return join(getConfigDir(), "config.json");
}

export const DEFAULT_QUERY_BASE_URL = "https://eu-nbg-2-connect.betterstackdata.com";

export function getApiToken(): string {
  const token = process.env.BETTERSTACK_API_TOKEN;
  if (!token) {
    throw new Error(
      "BETTERSTACK_API_TOKEN environment variable is not set.\n" +
        "Please add it to your shell configuration:\n" +
        'export BETTERSTACK_API_TOKEN="your_token_here"',
    );
  }
  return token;
}

export function getQueryCredentials(): { username?: string; password?: string } {
  const username = process.env.BETTERSTACK_QUERY_USERNAME;
  const password = process.env.BETTERSTACK_QUERY_PASSWORD;

  return { username, password };
}

export function loadConfig(): Config {
  const configFile = getConfigFile();
  if (!existsSync(configFile)) {
    return {
      defaultLimit: 100,
      outputFormat: "json",
      defaultLogLevel: "all",
      queryHistory: [],
      savedQueries: {},
    };
  }

  try {
    const content = readFileSync(configFile, "utf-8");
    const parsed = JSON.parse(content) as Config;

    if (!parsed.defaultLogLevel) {
      parsed.defaultLogLevel = "all";
    }

    return parsed;
  } catch {
    console.warn("Failed to load config, using defaults");
    return {
      defaultLimit: 100,
      outputFormat: "json",
      defaultLogLevel: "all",
    };
  }
}

export function saveConfig(config: Config): void {
  const configDir = getConfigDir();
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }

  writeFileSync(getConfigFile(), JSON.stringify(config, null, 2));
}

export function updateConfig(updates: Partial<Config>): void {
  const config = loadConfig();
  const newConfig = { ...config, ...updates };
  saveConfig(newConfig);
}

export function addToHistory(query: string): void {
  const config = loadConfig();
  const history = config.queryHistory || [];

  // Add to beginning and limit to 100 entries
  history.unshift(query);
  if (history.length > 100) {
    history.pop();
  }

  updateConfig({ queryHistory: history });
}

// Common source aliases for convenience
const SOURCE_ALIASES: Record<string, string> = {
  dev: "sweetistics-dev",
  development: "sweetistics-dev",
  prod: "sweetistics",
  production: "sweetistics",
  staging: "sweetistics-staging",
  test: "sweetistics-test",
};

export function resolveSourceAlias(source: string | undefined): string | undefined {
  if (source === undefined || source === null) {
    return undefined;
  }

  // Check if it's an alias
  const aliased = SOURCE_ALIASES[source.toLowerCase()];
  if (aliased) {
    return aliased;
  }

  // Return as-is if not an alias
  return source;
}
