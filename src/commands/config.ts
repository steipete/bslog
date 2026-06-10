import chalk from "chalk";
import { DEFAULT_QUERY_BASE_URL, loadConfig, updateConfig } from "../utils/config";
import type { OutputFormat } from "../utils/formatter";
import { MAX_QUERY_LIMIT, normalizeLimitValue } from "../utils/limits";

type ShowConfigOptions = {
  format?: string;
};

export function setConfig(key: string, value: string): void {
  const validKeys = ["source", "limit", "format", "logLevel", "queryBaseUrl"];

  if (!validKeys.includes(key)) {
    console.error(chalk.red(`Invalid config key: ${key}`));
    console.error(`Valid keys: ${validKeys.join(", ")}`);
    process.exit(1);
  }

  switch (key) {
    case "source":
      updateConfig({ defaultSource: value });
      console.log(chalk.green(`Default source set to: ${value}`));
      break;

    case "limit": {
      const limit = normalizeLimitValue(value);
      if (limit === undefined) {
        console.error(chalk.red(`Limit must be an integer between 1 and ${MAX_QUERY_LIMIT}`));
        process.exit(1);
      }
      updateConfig({ defaultLimit: limit });
      console.log(chalk.green(`Default limit set to: ${limit}`));
      break;
    }

    case "format": {
      const validFormats: readonly OutputFormat[] = ["json", "table", "csv", "pretty"];
      const isOutputFormat = (candidate: string): candidate is OutputFormat =>
        (validFormats as readonly string[]).includes(candidate);

      if (!isOutputFormat(value)) {
        console.error(chalk.red(`Invalid format: ${value}`));
        console.error(`Valid formats: ${validFormats.join(", ")}`);
        process.exit(1);
      }
      updateConfig({ outputFormat: value });
      console.log(chalk.green(`Default output format set to: ${value}`));
      break;
    }

    case "logLevel": {
      const normalized = value.trim().toLowerCase();
      const aliases: Record<string, string> = {
        warn: "warning",
      };

      const resolved = aliases[normalized] ?? normalized;
      const validLevels = new Set(["all", "debug", "info", "warning", "error", "fatal", "trace"]);

      if (!validLevels.has(resolved)) {
        console.error(chalk.red(`Invalid log level: ${value}`));
        console.error(`Valid levels: ${Array.from(validLevels).join(", ")}`);
        process.exit(1);
      }

      updateConfig({ defaultLogLevel: resolved });
      console.log(chalk.green(`Default log level set to: ${resolved}`));
      break;
    }

    case "queryBaseUrl": {
      const url = value.trim();
      if (!url.startsWith("http://") && !url.startsWith("https://")) {
        console.error(chalk.red("queryBaseUrl must start with http:// or https://"));
        process.exit(1);
      }

      updateConfig({ queryBaseUrl: url });
      console.log(chalk.green(`Query base URL set to: ${url}`));
      break;
    }
  }
}

export function showConfig(options: ShowConfigOptions = {}): void {
  const config = loadConfig();

  if (options.format === "json") {
    const normalized = {
      defaultSource: config.defaultSource ?? null,
      defaultLimit: config.defaultLimit ?? 100,
      defaultLogLevel: config.defaultLogLevel ?? "all",
      outputFormat: config.outputFormat ?? "json",
      queryBaseUrl: config.queryBaseUrl ?? DEFAULT_QUERY_BASE_URL,
      savedQueries: config.savedQueries ?? {},
      queryHistory: config.queryHistory ?? [],
    };

    console.log(JSON.stringify(normalized, null, 2));
    return;
  }

  console.log(chalk.bold("\nCurrent Configuration:\n"));
  console.log(`Default Source: ${config.defaultSource || chalk.gray("(not set)")}`);
  console.log(`Default Limit: ${config.defaultLimit || 100}`);
  console.log(`Default Log Level: ${config.defaultLogLevel || "all"}`);
  console.log(`Output Format: ${config.outputFormat || "json"}`);
  console.log(`Query Base URL: ${config.queryBaseUrl || DEFAULT_QUERY_BASE_URL}`);

  if (config.savedQueries && Object.keys(config.savedQueries).length > 0) {
    console.log(chalk.bold("\nSaved Queries:"));
    for (const [name, query] of Object.entries(config.savedQueries)) {
      console.log(`  ${chalk.cyan(name)}: ${query}`);
    }
  }

  console.log();
}
