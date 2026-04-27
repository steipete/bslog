export function parseTimeString(timeStr: string): Date {
  const now = new Date();

  // Check for relative time formats (1h, 30m, 2d, etc.)
  const relativeMatch = timeStr.match(/^(\d+)([hdmw])$/);
  if (relativeMatch) {
    const [, amount, unit] = relativeMatch;
    const value = Number.parseInt(amount, 10);

    switch (unit) {
      case "h": // hours
        return new Date(now.getTime() - value * 60 * 60 * 1000);
      case "d": // days
        return new Date(now.getTime() - value * 24 * 60 * 60 * 1000);
      case "m": // minutes
        return new Date(now.getTime() - value * 60 * 1000);
      case "w": // weeks
        return new Date(now.getTime() - value * 7 * 24 * 60 * 60 * 1000);
      default:
        throw new Error(`Unknown time unit: ${unit}`);
    }
  }

  // Check if it matches the pattern but with invalid unit
  if (/^\d+[a-z]$/i.test(timeStr)) {
    const unit = timeStr.match(/[a-z]$/i)?.[0];
    throw new Error(`Unknown time unit: ${unit}`);
  }

  // Try to parse as ISO date or other standard formats
  const date = new Date(timeStr);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid time format: ${timeStr}`);
  }

  return date;
}

export function formatDateTime(date: Date): string {
  return date.toISOString().replace("T", " ").replace("Z", "");
}

export function toClickHouseDateTime(date: Date): string {
  // ClickHouse expects format: YYYY-MM-DD HH:MM:SS (UTC)
  const iso = date.toISOString(); // Always UTC
  return iso.slice(0, 19).replace("T", " ");
}
