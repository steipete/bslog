import type { QueryOptions } from "../types";

export function parseGraphQLQuery(query: string): QueryOptions {
  // Remove outer braces and whitespace
  let normalizedQuery = query.trim();
  if (normalizedQuery.startsWith("{") && normalizedQuery.endsWith("}")) {
    normalizedQuery = normalizedQuery.slice(1, -1).trim();
  }

  // Match the logs query pattern
  const logsMatch = normalizedQuery.match(/logs\s*\((.*?)\)\s*\{(.*?)\}/s);
  if (!logsMatch) {
    throw new Error("Invalid query format. Expected: { logs(...) { ... } }");
  }

  const [, argsStr = "", fieldsStr = ""] = logsMatch;

  // Parse arguments
  const options: QueryOptions = {};

  if (argsStr) {
    // Parse arguments like: limit: 100, level: 'error', where: { ... }
    const args = parseArguments(argsStr);

    const limit =
      typeof args.limit === "number"
        ? args.limit
        : typeof args.limit === "string"
          ? Number.parseInt(args.limit, 10)
          : undefined;
    if (limit !== undefined) {
      options.limit = limit;
    }

    if (typeof args.level === "string") {
      options.level = args.level;
    }

    if (typeof args.subsystem === "string") {
      options.subsystem = args.subsystem;
    }

    if (typeof args.since === "string") {
      options.since = args.since;
    }

    if (typeof args.until === "string") {
      options.until = args.until;
    }

    if (args.between && Array.isArray(args.between) && args.between.length === 2) {
      const [since, until] = args.between;
      if (typeof since === "string" && typeof until === "string") {
        options.since = since;
        options.until = until;
      }
    }

    if (typeof args.search === "string") {
      options.search = args.search;
    }

    if (isRecord(args.where)) {
      options.where = args.where;
    }

    if (typeof args.source === "string") {
      options.source = args.source;
    }
  }

  // Parse fields
  if (fieldsStr) {
    const fields = fieldsStr
      .split(",")
      .map((f) => f.trim())
      .filter((f) => f.length > 0);
    if (fields.length > 0 && fields[0] !== "*") {
      options.fields = fields;
    }
  }

  return options;
}

function parseArguments(argsStr: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  // Simple regex-based parser for arguments
  // This handles: key: value, key: 'string', key: 123, key: { ... }, key: [ ... ]

  let currentKey = "";
  let currentValue = "";
  let depth = 0;
  let inString = false;
  let stringChar = "";

  for (let i = 0; i < argsStr.length; i++) {
    const char = argsStr[i];

    if (inString) {
      if (char === stringChar && argsStr[i - 1] !== "\\") {
        inString = false;
      }
      currentValue += char;
    } else if (char === '"' || char === "'") {
      inString = true;
      stringChar = char;
      currentValue += char;
    } else if (char === "{" || char === "[") {
      depth++;
      currentValue += char;
    } else if (char === "}" || char === "]") {
      depth--;
      currentValue += char;
    } else if (char === ":" && depth === 0 && !currentKey) {
      currentKey = currentValue.trim();
      currentValue = "";
    } else if (char === "," && depth === 0) {
      if (currentKey) {
        result[currentKey] = parseValue(currentValue.trim());
        currentKey = "";
        currentValue = "";
      }
    } else {
      currentValue += char;
    }
  }

  // Handle last key-value pair
  if (currentKey && currentValue) {
    result[currentKey] = parseValue(currentValue.trim());
  }

  return result;
}

function parseValue(value: string): unknown {
  // Remove quotes from strings
  if (
    (value.startsWith("'") && value.endsWith("'")) ||
    (value.startsWith('"') && value.endsWith('"'))
  ) {
    return value.slice(1, -1);
  }

  // Parse numbers
  if (/^\d+$/.test(value)) {
    return Number.parseInt(value, 10);
  }

  // Parse booleans
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }

  // Parse objects
  if (value.startsWith("{") && value.endsWith("}")) {
    try {
      // Simple object parser
      const objStr = value.slice(1, -1);
      const obj: Record<string, unknown> = {};
      const pairs = objStr.split(",");

      for (const pair of pairs) {
        const [key, val] = pair.split(":").map((s) => s.trim());
        if (key && val) {
          obj[key] = parseValue(val);
        }
      }

      return obj;
    } catch {
      return value;
    }
  }

  // Parse arrays
  if (value.startsWith("[") && value.endsWith("]")) {
    try {
      const arrStr = value.slice(1, -1);
      return arrStr.split(",").map((s) => parseValue(s.trim()));
    } catch {
      return value;
    }
  }

  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
