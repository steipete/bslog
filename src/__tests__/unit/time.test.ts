import { beforeEach, describe, expect, it } from "bun:test";
import { formatDateTime, parseTimeString, toClickHouseDateTime } from "../../utils/time";

describe("Time Utilities", () => {
  describe("parseTimeString", () => {
    let now: Date;

    beforeEach(() => {
      now = new Date();
    });

    it("should parse relative hours", () => {
      const result = parseTimeString("1h");
      const expected = new Date(now.getTime() - 60 * 60 * 1000);

      // Check within 1 second tolerance
      expect(Math.abs(result.getTime() - expected.getTime())).toBeLessThan(1000);
    });

    it("should parse relative days", () => {
      const result = parseTimeString("2d");
      const expected = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

      expect(Math.abs(result.getTime() - expected.getTime())).toBeLessThan(1000);
    });

    it("should parse relative minutes", () => {
      const result = parseTimeString("30m");
      const expected = new Date(now.getTime() - 30 * 60 * 1000);

      expect(Math.abs(result.getTime() - expected.getTime())).toBeLessThan(1000);
    });

    it("should parse relative weeks", () => {
      const result = parseTimeString("1w");
      const expected = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      expect(Math.abs(result.getTime() - expected.getTime())).toBeLessThan(1000);
    });

    it("should parse ISO date strings", () => {
      const dateStr = "2024-01-15T10:30:00Z";
      const result = parseTimeString(dateStr);

      expect(result.toISOString()).toBe("2024-01-15T10:30:00.000Z");
    });

    it("should parse date-only strings", () => {
      const dateStr = "2024-01-15";
      const result = parseTimeString(dateStr);

      expect(result.toISOString().startsWith("2024-01-15")).toBe(true);
    });

    it("should throw on invalid time unit", () => {
      expect(() => parseTimeString("5x")).toThrow("Unknown time unit: x");
    });

    it("should throw on invalid date format", () => {
      expect(() => parseTimeString("invalid-date")).toThrow("Invalid time format: invalid-date");
    });
  });

  describe("formatDateTime", () => {
    it("should format date to readable string", () => {
      const date = new Date("2024-01-15T10:30:45.123Z");
      const result = formatDateTime(date);

      expect(result).toBe("2024-01-15 10:30:45.123");
    });
  });

  describe("toClickHouseDateTime", () => {
    it("should format date for ClickHouse", () => {
      const date = new Date("2024-01-15T10:30:45.123Z");
      const result = toClickHouseDateTime(date);

      expect(result).toBe("2024-01-15 10:30:45");
    });

    it("should pad single digit values", () => {
      const date = new Date("2024-01-05T05:05:05.000Z");
      const result = toClickHouseDateTime(date);

      expect(result).toBe("2024-01-05 05:05:05");
    });

    it("should convert local timezone dates to UTC string", () => {
      const date = new Date("2024-01-15T05:30:45.000-05:00");
      const result = toClickHouseDateTime(date);

      expect(result).toBe("2024-01-15 10:30:45");
    });
  });
});
