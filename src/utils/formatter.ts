import chalk from "chalk";
import Table from "cli-table3";

export type OutputFormat = "json" | "table" | "csv" | "pretty";

export type DisplayRow = Record<string, unknown>;

export function formatOutput(data: DisplayRow[], format: OutputFormat = "json"): string {
  switch (format) {
    case "json":
      return JSON.stringify(data, null, 2);

    case "pretty":
      return formatPretty(data);

    case "table":
      return formatTable(data);

    case "csv":
      return formatCSV(data);

    default:
      return JSON.stringify(data, null, 2);
  }
}

function formatPretty(data: DisplayRow[]): string {
  const output: string[] = [];

  for (const entry of data) {
    const timestampValue = typeof entry.dt === "string" ? entry.dt : "No timestamp";
    const timestamp = chalk.gray(timestampValue);
    let level = typeof entry.level === "string" ? entry.level : extractLevel(entry);

    // Color-code log levels
    if (level) {
      switch (level.toLowerCase()) {
        case "error":
        case "fatal":
          level = chalk.red(level.toUpperCase());
          break;
        case "warn":
        case "warning":
          level = chalk.yellow(level.toUpperCase());
          break;
        case "info":
          level = chalk.blue(level.toUpperCase());
          break;
        case "debug":
          level = chalk.gray(level.toUpperCase());
          break;
        default:
          level = chalk.white(level.toUpperCase());
      }
    } else {
      level = chalk.gray("LOG");
    }

    const message = extractMessage(entry);
    const subsystem =
      typeof entry.subsystem === "string" && entry.subsystem.length > 0
        ? entry.subsystem
        : extractSubsystem(entry);

    let line = `[${timestamp}] ${level}`;
    if (subsystem) {
      line += ` ${chalk.cyan(`[${subsystem}]`)}`;
    }
    line += ` ${message}`;

    output.push(line);

    // Add extra fields if present
    const extraFields = getExtraFields(entry);
    if (Object.keys(extraFields).length > 0) {
      const extras = Object.entries(extraFields)
        .map(([key, value]) => `  ${chalk.gray(key)}: ${formatValue(value)}`)
        .join("\n");
      output.push(extras);
    }
  }

  return output.join("\n");
}

function formatTable(data: DisplayRow[]): string {
  if (data.length === 0) {
    return "No results found";
  }

  // Extract all unique keys from the data
  const allKeys = new Set<string>();
  for (const entry of data) {
    for (const key of Object.keys(entry)) {
      allKeys.add(key);
    }
  }

  // Create table with headers
  const headers = Array.from(allKeys);
  const table = new Table({
    head: headers,
    wordWrap: true,
    colWidths: headers.map((h) => {
      if (h === "dt") {
        return 20;
      }
      if (h === "raw") {
        return 50;
      }
      if (h === "message") {
        return 40;
      }
      return null;
    }),
  });

  // Add rows
  for (const entry of data) {
    const row = headers.map((header) => {
      const value = entry[header];
      if (value === undefined || value === null) {
        return "";
      }
      if (typeof value === "object") {
        return JSON.stringify(value);
      }
      return String(value);
    });
    table.push(row);
  }

  return table.toString();
}

function formatCSV(data: DisplayRow[]): string {
  if (data.length === 0) {
    return "";
  }

  // Extract all unique keys
  const allKeys = new Set<string>();
  for (const entry of data) {
    for (const key of Object.keys(entry)) {
      allKeys.add(key);
    }
  }

  const headers = Array.from(allKeys);
  const lines: string[] = [];

  // Add header row
  lines.push(headers.map((h) => escapeCSV(h)).join(","));

  // Add data rows
  for (const entry of data) {
    const row = headers.map((header) => {
      const value = entry[header];
      if (value === undefined || value === null) {
        return "";
      }
      if (typeof value === "object") {
        return escapeCSV(JSON.stringify(value));
      }
      return escapeCSV(String(value));
    });
    lines.push(row.join(","));
  }

  return lines.join("\n");
}

function escapeCSV(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function extractLevel(entry: DisplayRow): string | null {
  if (typeof entry.level === "string" && entry.level.length > 0) {
    return entry.level;
  }

  const parsed = parseRaw(entry.raw);
  if (parsed) {
    const level = parsed.level;
    if (typeof level === "string" && level.length > 0) {
      return level;
    }

    const severity = parsed.severity;
    if (typeof severity === "string" && severity.length > 0) {
      return severity;
    }

    const vercel = parsed.vercel;
    if (vercel && typeof vercel === "object") {
      const vercelLevel = (vercel as Record<string, unknown>).level;
      if (typeof vercelLevel === "string" && vercelLevel.length > 0) {
        return vercelLevel;
      }
    }
    return null;
  }

  if (typeof entry.raw === "string") {
    const match = entry.raw.match(/\b(ERROR|WARN|WARNING|INFO|DEBUG|FATAL)\b/i);
    return match ? (match[1] ?? null) : null;
  }

  return null;
}

function extractMessage(entry: DisplayRow): string {
  if (typeof entry.message === "string" && entry.message.length > 0) {
    return entry.message;
  }

  const parsed = parseRaw(entry.raw);
  if (parsed) {
    const primary = parsed.message ?? parsed.msg;
    if (typeof primary === "string" && primary.length > 0) {
      return primary;
    }
    return JSON.stringify(parsed);
  }

  if (typeof entry.raw === "string" && entry.raw.length > 0) {
    return entry.raw;
  }

  return JSON.stringify(entry);
}

function extractSubsystem(entry: DisplayRow): string | null {
  if (typeof entry.subsystem === "string" && entry.subsystem.length > 0) {
    return entry.subsystem;
  }

  const parsed = parseRaw(entry.raw);
  if (parsed) {
    const subsystem = parsed.subsystem ?? parsed.service ?? parsed.component;
    if (typeof subsystem === "string" && subsystem.length > 0) {
      return subsystem;
    }
  }

  return null;
}

function getExtraFields(entry: DisplayRow): Record<string, unknown> {
  const excludeKeys = new Set(["dt", "raw", "level", "message", "subsystem", "time", "severity"]);
  const extras: Record<string, unknown> = {};

  // First, check if raw contains parsed JSON data
  if (entry.raw !== undefined) {
    const parsed = parseRaw(entry.raw);
    if (parsed) {
      for (const [key, value] of Object.entries(parsed)) {
        if (!excludeKeys.has(key)) {
          extras[key] = value;
        }
      }
    } else {
      extras.raw = entry.raw;
    }
  }

  for (const [key, value] of Object.entries(entry)) {
    if (!excludeKeys.has(key) && key !== "raw") {
      extras[key] = value;
    }
  }

  return extras;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return String(value);
  }

  if (typeof value === "object") {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }

  return String(value);
}

function parseRaw(raw: unknown): Record<string, unknown> | null {
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return null;
    }
    return null;
  }

  if (raw && typeof raw === "object") {
    return raw as Record<string, unknown>;
  }

  return null;
}
