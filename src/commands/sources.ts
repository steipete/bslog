import chalk from "chalk";
import { SourcesAPI } from "../api/sources";
import { formatOutput, type DisplayRow, type OutputFormat } from "../utils/formatter";

export async function listSources(options: { format?: OutputFormat }): Promise<void> {
  const api = new SourcesAPI();

  try {
    const sources = await api.listAll();

    if (options.format === "table" || options.format === "pretty") {
      console.log(chalk.bold("\nAvailable Sources:\n"));

      for (const source of sources) {
        const { name, platform, messages_count, bytes_count, ingesting_paused } = source.attributes;

        console.log(chalk.cyan(`  ${name}`));
        console.log(`    Platform: ${platform}`);
        console.log(`    Messages: ${messages_count ? messages_count.toLocaleString() : "0"}`);
        console.log(`    Size: ${formatBytes(bytes_count || 0)}`);
        console.log(
          `    Status: ${ingesting_paused ? chalk.red("Paused") : chalk.green("Active")}`,
        );
        console.log(`    ID: ${source.id}`);
        console.log();
      }
    } else {
      const output = formatOutput(sources as unknown as DisplayRow[], options.format || "json");
      console.log(output);
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(chalk.red(`Error listing sources: ${message}`));
    process.exit(1);
  }
}

export async function getSource(name: string, options: { format?: OutputFormat }): Promise<void> {
  const api = new SourcesAPI();

  try {
    const source = await api.findByName(name);

    if (!source) {
      console.error(chalk.red(`Source not found: ${name}`));
      process.exit(1);
    }

    if (options.format === "pretty") {
      const { attributes } = source;

      console.log(chalk.bold(`\nSource: ${attributes.name}\n`));
      console.log(`ID: ${source.id}`);
      console.log(`Platform: ${attributes.platform}`);
      console.log(`Token: ${attributes.token ? `${attributes.token.substring(0, 10)}...` : "N/A"}`);
      console.log(
        `Messages: ${attributes.messages_count ? attributes.messages_count.toLocaleString() : "0"}`,
      );
      console.log(`Size: ${formatBytes(attributes.bytes_count || 0)}`);
      console.log(
        `Status: ${attributes.ingesting_paused ? chalk.red("Paused") : chalk.green("Active")}`,
      );
      console.log(
        `Created: ${attributes.created_at ? new Date(attributes.created_at).toLocaleString() : "N/A"}`,
      );
      console.log(
        `Updated: ${attributes.updated_at ? new Date(attributes.updated_at).toLocaleString() : "N/A"}`,
      );
    } else {
      const output = formatOutput([source as unknown as DisplayRow], options.format || "json");
      console.log(output);
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(chalk.red(`Error getting source: ${message}`));
    process.exit(1);
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) {
    return "0 Bytes";
  }

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${(bytes / k ** i).toFixed(2)} ${sizes[i]}`;
}
