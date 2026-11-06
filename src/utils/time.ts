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

  const clickHouse = timeStr.match(/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?$/);
  if (clickHouse) {
    const date = new Date(`${timeStr.replace(" ", "T")}Z`);
    if (Number.isNaN(date.getTime())) {
      throw new Error(`Invalid time format: ${timeStr}`);
    }
    return date;
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

// Date drops digits past milliseconds, and toClickHouseDateTime drops the rest.
// Pagination bounds are server timestamps, so the SQL literal keeps the original fraction.
export function clickHouseDateTime64(timeStr: string): { value: string; scale: number } {
  const preserved = preserveFractionalTimestamp(timeStr);
  if (preserved) {
    return preserved;
  }
  return { value: toClickHouseDateTime(parseTimeString(timeStr)), scale: 3 };
}

function preserveFractionalTimestamp(
  timeStr: string,
): { value: string; scale: number } | undefined {
  const match =
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(\.\d{1,9})(Z|[+-]\d{2}:\d{2})?$/.exec(
      timeStr,
    );
  if (!match) {
    return undefined;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const fraction = match[7] ?? "";
  const zone = match[8];
  if (!isValidClock(year, month, day, hour, minute, second)) {
    return undefined;
  }

  let offsetMinutes = 0;
  if (zone && zone !== "Z") {
    const sign = zone.startsWith("-") ? -1 : 1;
    const zoneHour = Number(zone.slice(1, 3));
    const zoneMinute = Number(zone.slice(4, 6));
    if (zoneHour > 23 || zoneMinute > 59) {
      return undefined;
    }
    offsetMinutes = sign * (zoneHour * 60 + zoneMinute);
  }

  const utc = new Date(
    Date.UTC(year, month - 1, day, hour, minute, second) - offsetMinutes * 60_000,
  );
  let digits = fraction.slice(1);
  if (digits.length < 3) {
    digits = digits.padEnd(3, "0");
  }
  const pad = (value: number): string => String(value).padStart(2, "0");
  const value =
    `${utc.getUTCFullYear()}-${pad(utc.getUTCMonth() + 1)}-${pad(utc.getUTCDate())} ` +
    `${pad(utc.getUTCHours())}:${pad(utc.getUTCMinutes())}:${pad(utc.getUTCSeconds())}.${digits}`;
  return { value, scale: digits.length };
}

function isValidClock(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
): boolean {
  if (month < 1 || month > 12 || day < 1 || hour > 23 || minute > 59 || second > 59) {
    return false;
  }
  const probe = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  return (
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === day &&
    probe.getUTCHours() === hour &&
    probe.getUTCMinutes() === minute &&
    probe.getUTCSeconds() === second
  );
}
