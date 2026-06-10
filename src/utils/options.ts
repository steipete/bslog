import type { QueryOptions } from "../types";
import { normalizeLimitValue } from "./limits";

type MaybeString = string | undefined;

type RuntimeInput = {
  limit?: unknown;
  sources?: string | string[];
  where?: string | string[];
  jq?: unknown;
};

export type RuntimeOptions = Pick<QueryOptions, "limit" | "sources" | "where"> & {
  jq?: string;
};

export function normalizeSourcesOption(input?: string | string[]): string[] | undefined {
  if (!input) {
    return undefined;
  }

  const rawValues = Array.isArray(input) ? input : [input];
  const names = rawValues
    .flatMap((value) => value.split(","))
    .map((name) => name.trim())
    .filter((name) => name.length > 0);

  if (names.length === 0) {
    return undefined;
  }

  return Array.from(new Set(names));
}

export function parseLimitOption(rawValue: unknown): number | undefined {
  return normalizeLimitValue(rawValue);
}

export function parseWhereOption(input?: string | string[]): Record<string, unknown> | undefined {
  if (!input) {
    return undefined;
  }

  const rawValues = Array.isArray(input) ? input : [input];
  const where: Record<string, unknown> = {};

  for (const raw of rawValues) {
    if (!raw) {
      continue;
    }

    const trimmed = raw.trim();
    if (!trimmed) {
      continue;
    }

    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, equalsIndex).trim();
    if (!key) {
      continue;
    }

    let valueString: MaybeString = trimmed.slice(equalsIndex + 1).trim();

    if (valueString && valueString.length >= 2) {
      const firstChar = valueString[0];
      const lastChar = valueString[valueString.length - 1];
      if ((firstChar === '"' && lastChar === '"') || (firstChar === "'" && lastChar === "'")) {
        valueString = valueString.slice(1, -1);
      }
    }

    const parsedValue = parseWhereValue(valueString);
    where[key] = parsedValue;
  }

  return Object.keys(where).length > 0 ? where : undefined;
}

function parseWhereValue(value: MaybeString): unknown {
  if (value === undefined) {
    return undefined;
  }

  if (value.length === 0) {
    return "";
  }

  const lower = value.toLowerCase();
  if (lower === "null") {
    return null;
  }

  if (lower === "true") {
    return true;
  }

  if (lower === "false") {
    return false;
  }

  if (/^-?\d+$/.test(value)) {
    const asNumber = Number.parseInt(value, 10);
    if (!Number.isNaN(asNumber)) {
      return asNumber;
    }
  }

  if (/^-?\d*\.\d+$/.test(value)) {
    const asFloat = Number.parseFloat(value);
    if (!Number.isNaN(asFloat)) {
      return asFloat;
    }
  }

  if (
    (value.startsWith("{") && value.endsWith("}")) ||
    (value.startsWith("[") && value.endsWith("]"))
  ) {
    try {
      return JSON.parse(value);
    } catch {
      // fall through to returning raw string if JSON parsing fails
    }
  }

  return value;
}

export function resolveRuntimeOptions(options: RuntimeInput): RuntimeOptions {
  const limit = parseLimitOption(options.limit);
  const sources = normalizeSourcesOption(options.sources);
  const where = parseWhereOption(options.where);
  const jq =
    typeof options.jq === "string" && options.jq.trim().length > 0 ? options.jq.trim() : undefined;

  return {
    limit,
    sources,
    where,
    jq,
  };
}
