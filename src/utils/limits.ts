export const DEFAULT_QUERY_LIMIT = 100;
export const MAX_QUERY_LIMIT = 10000;

export function normalizeLimitValue(rawValue: unknown): number | undefined {
  const value = typeof rawValue === "string" ? rawValue.trim() : rawValue;

  if (typeof value === "string") {
    if (!/^\d+$/.test(value)) {
      return undefined;
    }

    return normalizeLimitNumber(Number(value));
  }

  if (typeof value === "number") {
    return normalizeLimitNumber(value);
  }

  return undefined;
}

export function resolveQueryLimit(limit: unknown, defaultLimit?: number): number {
  return normalizeLimitValue(limit) ?? normalizeLimitValue(defaultLimit) ?? DEFAULT_QUERY_LIMIT;
}

function normalizeLimitNumber(value: number): number | undefined {
  if (!Number.isSafeInteger(value) || value < 1 || value > MAX_QUERY_LIMIT) {
    return undefined;
  }

  return value;
}
