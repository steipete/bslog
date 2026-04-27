import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { Config } from "../types";

const CONFIG_DIR = join(homedir(), ".bslog");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");

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
  if (!existsSync(CONFIG_FILE)) {
    return {
      defaultLimit: 100,
      outputFormat: "json",
      defaultLogLevel: "all",
      queryHistory: [],
      savedQueries: {},
    };
  }

  try {
    const content = readFileSync(CONFIG_FILE, "utf-8");
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
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }

  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
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
