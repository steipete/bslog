import type { LogEntry, QueryOptions } from "../types";
import { getQueryCredentials, loadConfig, resolveSourceAlias } from "../utils/config";
import { resolveQueryLimit } from "../utils/limits";
import { parseTimeString, toClickHouseDateTime } from "../utils/time";
import { BetterStackClient } from "./client";
import { SourcesAPI } from "./sources";

const VALID_IDENTIFIER_REGEX = /^[A-Za-z_][A-Za-z0-9_]*$/;

function escapeSqlString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "''");
}

export class QueryAPI {
  private client: BetterStackClient;
  private sourcesAPI: SourcesAPI;

  constructor() {
    this.client = new BetterStackClient();
    this.sourcesAPI = new SourcesAPI();
  }

  private buildJsonPath(field: string): string {
    const trimmed = field.trim();
    if (trimmed.startsWith("$")) {
      return trimmed;
    }

    const segments: string[] = [];
    let buffer = "";
    let inBracket = false;
    let quoteChar: string | null = null;

    const flushPlain = () => {
      const segment = buffer.trim();
      if (segment) {
        segments.push(segment);
      }
      buffer = "";
    };

    const flushBracket = () => {
      if (buffer) {
        segments.push(buffer);
      }
      buffer = "";
    };

    for (let index = 0; index < trimmed.length; index += 1) {
      const char = trimmed.charAt(index);

      if (!inBracket) {
        if (char === ".") {
          flushPlain();
          continue;
        }

        if (char === "[") {
          flushPlain();
          inBracket = true;
          buffer = "[";
          quoteChar = null;
          continue;
        }

        buffer += char;
        continue;
      }

      buffer += char;

      if (char === '"' || char === "'") {
        const previous = trimmed[index - 1];
        if (quoteChar === char && previous !== "\\") {
          quoteChar = null;
        } else if (!quoteChar) {
          quoteChar = char;
        }
      } else if (char === "]" && !quoteChar) {
        flushBracket();
        inBracket = false;
      }
    }

    if (buffer) {
      if (inBracket) {
        segments.push(buffer);
      } else {
        flushPlain();
      }
    }

    let path = "$";
    for (const segment of segments) {
      if (!segment) {
        continue;
      }

      if (segment.startsWith("[")) {
        path += this.normalizeBracketSegment(segment);
      } else {
        path += this.normalizePlainSegment(segment);
      }
    }

    return path;
  }

  private buildJsonAccessor(field: string): string {
    const path = this.buildJsonPath(field);
    return `JSON_VALUE(raw, '${path}')`;
  }

  private normalizePlainSegment(segment: string): string {
    const cleaned = segment.trim();
    if (!cleaned) {
      return "";
    }

    if (VALID_IDENTIFIER_REGEX.test(cleaned)) {
      return `.${cleaned}`;
    }

    const escaped = cleaned.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    return `["${escaped}"]`;
  }

  private normalizeBracketSegment(segment: string): string {
    if (!segment.startsWith("[") || !segment.endsWith("]")) {
      return this.normalizePlainSegment(segment);
    }

    const inner = segment.slice(1, -1).trim();
    if (!inner) {
      return segment;
    }

    if (inner === "*") {
      return "[*]";
    }

    const quote = inner[0];
    const isQuoted = quote === '"' || quote === "'";
    if (isQuoted && inner[inner.length - 1] === quote) {
      const key = inner.slice(1, -1).replace(/\\(['"])/g, "$1");
      const escaped = key.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      return `["${escaped}"]`;
    }

    if (/^-?\d+$/.test(inner)) {
      return `[${inner}]`;
    }

    const escaped = inner.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    return `["${escaped}"]`;
  }

  async buildQuery(options: QueryOptions): Promise<string> {
    const config = loadConfig();
    const configLevel =
      config.defaultLogLevel && config.defaultLogLevel.toLowerCase() !== "all"
        ? config.defaultLogLevel
        : undefined;
    const effectiveLevel = options.level ?? configLevel;

    const rawSourceName = options.source || config.defaultSource;
    const sourceName = resolveSourceAlias(rawSourceName);

    if (!sourceName) {
      throw new Error(
        "No source specified. Use --source or set a default source with: bslog config source <name>",
      );
    }

    // Get source to find the table name
    const source = await this.sourcesAPI.findByName(sourceName);
    if (!source) {
      throw new Error(`Source not found: ${sourceName}`);
    }

    // Build the SQL query using team_id and table_name from the source
    const tablePrefix = `t${source.attributes.team_id}_${source.attributes.table_name}`;
    const fields =
      options.fields && options.fields.length > 0
        ? this.buildFieldSelection(options.fields)
        : "dt, raw";

    const timeConditions: string[] = [];

    if (options.since) {
      const sinceDate = parseTimeString(options.since);
      timeConditions.push(`dt >= toDateTime64('${toClickHouseDateTime(sinceDate)}', 3)`);
    }

    if (options.until) {
      const untilDate = parseTimeString(options.until);
      timeConditions.push(`dt <= toDateTime64('${toClickHouseDateTime(untilDate)}', 3)`);
    }

    // Keep non-time filters outside the storage union so both tiers expose the same rows.
    const conditions: string[] = [];

    if (effectiveLevel) {
      const escapedLevel = effectiveLevel.replace(/'/g, "''").toLowerCase();
      const levelExpression =
        `lowerUTF8(COALESCE(` +
        `JSONExtractString(raw, 'level'),` +
        `JSON_VALUE(raw, '$.level'),` +
        `JSON_VALUE(raw, '$.levelName'),` +
        `JSON_VALUE(raw, '$.vercel.level')
      ))`;
      const messageExpression = `COALESCE(JSONExtractString(raw, 'message'), JSON_VALUE(raw, '$.message'))`;
      const statusExpression = `toInt32OrZero(JSON_VALUE(raw, '$.vercel.proxy.status_code'))`;

      if (escapedLevel === "error") {
        conditions.push(
          `(${levelExpression} = '${escapedLevel}' OR ${statusExpression} >= 500 OR positionCaseInsensitive(${messageExpression}, 'error') > 0 OR JSONHas(raw, 'error'))`,
        );
      } else if (escapedLevel === "warning" || escapedLevel === "warn") {
        conditions.push(
          `(${levelExpression} IN ('${escapedLevel}', 'warning', 'warn') OR (${statusExpression} >= 400 AND ${statusExpression} < 500))`,
        );
      } else {
        conditions.push(`${levelExpression} = '${escapedLevel}'`);
      }
    }

    if (options.subsystem) {
      const subsystemAccessor = this.buildJsonAccessor("subsystem");
      conditions.push(`${subsystemAccessor} = '${escapeSqlString(options.subsystem)}'`);
    }

    if (options.search) {
      conditions.push(`raw LIKE '%${escapeSqlString(options.search)}%'`);
    }

    if (options.where) {
      for (const [key, value] of Object.entries(options.where)) {
        const accessor = this.buildJsonAccessor(key);

        if (value === null) {
          conditions.push(`${accessor} IS NULL`);
          continue;
        }

        if (typeof value === "string") {
          conditions.push(`${accessor} = '${escapeSqlString(value)}'`);
        } else {
          const serialized = typeof value === "object" ? JSON.stringify(value) : String(value);
          conditions.push(`${accessor} = '${escapeSqlString(serialized)}'`);
        }
      }
    }

    let sql: string;
    if (options.hotOnly) {
      sql = `SELECT ${fields} FROM remote(${tablePrefix}_logs)`;
      const allConditions = [...timeConditions, ...conditions];
      if (allConditions.length > 0) {
        sql += ` WHERE ${allConditions.join(" AND ")}`;
      }
    } else {
      const timeWhere = timeConditions.length > 0 ? ` WHERE ${timeConditions.join(" AND ")}` : "";
      const coldTimeWhere = timeConditions.length > 0 ? ` AND ${timeConditions.join(" AND ")}` : "";

      sql = `SELECT ${fields} FROM (SELECT dt, raw FROM remote(${tablePrefix}_logs)${timeWhere} UNION ALL SELECT dt, raw FROM s3Cluster(primary, ${tablePrefix}_s3) WHERE _row_type = 1${coldTimeWhere})`;

      if (conditions.length > 0) {
        sql += ` WHERE ${conditions.join(" AND ")}`;
      }
    }

    // Add ORDER BY and LIMIT
    sql += " ORDER BY dt DESC";
    sql += ` LIMIT ${resolveQueryLimit(options.limit, config.defaultLimit)}`;
    sql += " FORMAT JSONEachRow";

    return sql;
  }

  private buildFieldSelection(fields: string[]): string {
    const selections: string[] = ["dt"];

    for (const field of fields) {
      if (field === "*" || field === "raw") {
        selections.push("raw");
        continue;
      }

      if (field === "dt") {
        continue;
      }

      const accessor = this.buildJsonAccessor(field);
      const escapedAlias = field.replace(/"/g, '""');
      selections.push(`${accessor} AS "${escapedAlias}"`);
    }

    return selections.join(", ");
  }

  async execute(options: QueryOptions): Promise<LogEntry[]> {
    const sql = await this.buildQuery(options);

    // Only show SQL query in verbose mode
    if (options.verbose) {
      console.error(`Executing query: ${sql}`);
    }

    const { username, password } = getQueryCredentials();
    return this.client.query<LogEntry>(sql, username, password);
  }

  executeSql(sql: string): Promise<Record<string, unknown>[]> {
    let statement = sql;
    if (!statement.toLowerCase().includes("format")) {
      statement = `${statement} FORMAT JSONEachRow`;
    }

    const { username, password } = getQueryCredentials();
    return this.client.query<Record<string, unknown>>(statement, username, password);
  }
}
