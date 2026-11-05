import type { QueryOptions } from "../types";
import { normalizeLimitValue } from "../utils/limits";

const NUMERIC_LITERAL_PATTERN = /^[+-]?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?$/;

export function parseGraphQLQuery(query: string): QueryOptions {
  // Remove outer braces and whitespace
  let normalizedQuery = query.trim();
  if (normalizedQuery.startsWith("{") && normalizedQuery.endsWith("}")) {
    normalizedQuery = normalizedQuery.slice(1, -1).trim();
  }

  const logsMatch = matchLogsQuery(normalizedQuery);
  if (!logsMatch) {
    throw new Error("Invalid query format. Expected: { logs(...) { ... } }");
  }

  const { args: argsStr, fields: fieldsStr } = logsMatch;

  // Parse arguments
  const options: QueryOptions = {};

  if (argsStr) {
    // Parse arguments like: limit: 100, level: 'error', where: { ... }
    const args = parseArguments(argsStr);

    if (typeof args.limit === "number") {
      options.limit = args.limit;
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
    const fields = splitTopLevel(fieldsStr, ",")
      .map((field) => field.trim())
      .map((field) => parseQuotedString(field) ?? field)
      .filter((field) => field.length > 0);
    if (fields.length > 0 && fields[0] !== "*") {
      options.fields = fields;
    }
  }

  return options;
}

function matchLogsQuery(source: string): { args: string; fields: string } | null {
  const start = source.search(/\blogs\s*\(/);
  if (start < 0) {
    return null;
  }
  const openParen = source.indexOf("(", start);
  const closeParen = indexOfMatchingParen(source, openParen);
  if (closeParen < 0) {
    return null;
  }
  let cursor = closeParen + 1;
  while (cursor < source.length && /\s/.test(source[cursor] ?? "")) {
    cursor += 1;
  }
  if (source[cursor] !== "{") {
    return null;
  }
  const closeBrace = indexOfMatchingBrace(source, cursor);
  if (closeBrace < 0) {
    return null;
  }
  return {
    args: source.slice(openParen + 1, closeParen),
    fields: source.slice(cursor + 1, closeBrace),
  };
}

function indexOfMatchingParen(input: string, openIndex: number): number {
  let quote: string | null = null;
  let paren = 0;
  let brace = 0;
  let bracket = 0;
  for (let index = openIndex; index < input.length; index += 1) {
    const char = input[index];
    if (quote) {
      if (char === "\\") {
        index += 1;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
    } else if (char === "(") {
      paren += 1;
    } else if (char === ")") {
      paren -= 1;
      if (paren === 0 && brace === 0 && bracket === 0) {
        return index;
      }
    } else if (char === "{") {
      brace += 1;
    } else if (char === "}") {
      brace = Math.max(0, brace - 1);
    } else if (char === "[") {
      bracket += 1;
    } else if (char === "]") {
      bracket = Math.max(0, bracket - 1);
    }
  }
  return -1;
}

function indexOfMatchingBrace(input: string, openIndex: number): number {
  let quote: string | null = null;
  let depth = 0;
  for (let index = openIndex; index < input.length; index += 1) {
    const char = input[index];
    if (quote) {
      if (char === "\\") {
        index += 1;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
    } else if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }
  return -1;
}

function parseArguments(argsStr: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const argument of splitTopLevel(argsStr, ",")) {
    const [key, value] = splitTopLevel(argument, ":", 2).map((part) => part.trim());
    if (key && value) {
      result[key] = parseArgumentValue(key, value);
    }
  }
  return result;
}

function parseArgumentValue(key: string, value: string): unknown {
  if (key === "limit") {
    return parseLimitValue(value);
  }

  return parseValue(value);
}

function parseLimitValue(value: string): number | undefined {
  return normalizeLimitValue(parseQuotedString(value) ?? value);
}

function splitTopLevel(input: string, separator: string, maxParts = Infinity): string[] {
  const parts: string[] = [];
  let start = 0;
  let quote: string | null = null;
  let depth = 0;
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (quote) {
      if (char === "\\") {
        index += 1;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
    } else if (char === "{" || char === "[") {
      depth += 1;
    } else if (char === "}" || char === "]") {
      depth -= 1;
    } else if (char === separator && depth === 0) {
      parts.push(input.slice(start, index));
      start = index + 1;
      if (parts.length === maxParts - 1) {
        break;
      }
    }
  }
  if (input.slice(start).trim()) {
    parts.push(input.slice(start));
  }
  return parts;
}

function parseValue(value: string): unknown {
  // Remove quotes from strings
  const quotedString = parseQuotedString(value);
  if (quotedString !== undefined) {
    return quotedString;
  }

  // Parse numbers (integers, negatives, decimals, exponents)
  if (NUMERIC_LITERAL_PATTERN.test(value)) {
    return Number(value);
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
      const pairs = splitTopLevel(objStr, ",");

      for (const pair of pairs) {
        const keyValue = splitTopLevel(pair, ":", 2).map((part) => part.trim());
        if (keyValue.length !== 2) {
          continue;
        }
        const [key, val] = keyValue;
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
      return splitTopLevel(arrStr, ",").map((s) => parseValue(s.trim()));
    } catch {
      return value;
    }
  }

  return value;
}

function parseQuotedString(value: string): string | undefined {
  if (
    (value.startsWith("'") && value.endsWith("'")) ||
    (value.startsWith('"') && value.endsWith('"'))
  ) {
    return value.slice(1, -1);
  }

  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
