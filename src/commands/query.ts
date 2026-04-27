import chalk from "chalk";
import { QueryAPI } from "../api/query";
import { parseGraphQLQuery } from "../parser/graphql";
import type { QueryOptions } from "../types";
import { addToHistory } from "../utils/config";
import { formatOutput, type OutputFormat } from "../utils/formatter";

export async function runQuery(
  queryStr: string,
  options: QueryOptions & { format?: OutputFormat },
): Promise<void> {
  const api = new QueryAPI();

  try {
    // Parse GraphQL-like query
    const queryOptions = parseGraphQLQuery(queryStr);

    // Merge with command-line options
    const finalOptions: QueryOptions = {
      ...queryOptions,
      ...options,
    };

    // Save to history
    addToHistory(queryStr);

    // Execute query
    const results = await api.execute(finalOptions);

    // Format and output results
    const output = formatOutput(results, options.format || "pretty");
    console.log(output);

    if (results.length === 0) {
      console.error(chalk.yellow("\nNo results found"));
    } else {
      console.error(chalk.gray(`\n${results.length} results returned`));
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(chalk.red(`Query error: ${message}`));
    process.exit(1);
  }
}

export async function runSql(sql: string, options: { format?: OutputFormat }): Promise<void> {
  const api = new QueryAPI();

  try {
    // Save to history
    addToHistory(`SQL: ${sql}`);

    // Execute raw SQL
    const results = await api.executeSql(sql);

    // Format and output results
    const output = formatOutput(results, options.format || "json");
    console.log(output);

    if (results.length === 0) {
      console.error(chalk.yellow("\nNo results found"));
    } else {
      console.error(chalk.gray(`\n${results.length} results returned`));
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(chalk.red(`SQL error: ${message}`));
    process.exit(1);
  }
}
