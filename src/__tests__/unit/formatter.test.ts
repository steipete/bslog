import { describe, expect, it } from "bun:test";
import { formatOutput } from "../../utils/formatter";

describe("Formatter", () => {
  const sampleData = [
    {
      dt: "2024-01-15 10:30:45.123",
      level: "error",
      message: "Test error message",
      subsystem: "api",
      userId: "12345",
    },
    {
      dt: "2024-01-15 10:31:00.456",
      level: "warning",
      message: "Test warning",
      subsystem: "database",
    },
  ];

  describe("formatOutput", () => {
    it("should format as JSON by default", () => {
      const result = formatOutput(sampleData);
      const parsed = JSON.parse(result);

      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBe(2);
      expect(parsed[0].message).toBe("Test error message");
    });

    it("should format as JSON with proper indentation", () => {
      const result = formatOutput(sampleData, "json");

      expect(result).toContain("  "); // Check for indentation
      expect(result).toContain('"dt"');
      expect(result).toContain('"level"');
      expect(result).toContain('"message"');
    });

    it("should format as pretty output", () => {
      const result = formatOutput(sampleData, "pretty");

      expect(result).toContain("2024-01-15 10:30:45.123");
      expect(result).toContain("ERROR");
      expect(result).toContain("[api]");
      expect(result).toContain("Test error message");
      expect(result).toContain("userId: 12345");
    });

    it("should format as CSV", () => {
      const result = formatOutput(sampleData, "csv");
      const lines = result.split("\n");

      // Check header
      expect(lines[0]).toContain("dt");
      expect(lines[0]).toContain("level");
      expect(lines[0]).toContain("message");

      // Check data rows
      expect(lines.length).toBe(3); // header + 2 data rows
      expect(lines[1]).toContain("2024-01-15 10:30:45.123");
      expect(lines[1]).toContain("error");
    });

    it("should escape CSV values with commas", () => {
      const dataWithComma = [
        {
          dt: "2024-01-15",
          message: "Error, with comma",
        },
      ];

      const result = formatOutput(dataWithComma, "csv");

      expect(result).toContain('"Error, with comma"');
    });

    it("should escape CSV values with quotes", () => {
      const dataWithQuote = [
        {
          dt: "2024-01-15",
          message: 'Error with "quotes"',
        },
      ];

      const result = formatOutput(dataWithQuote, "csv");

      expect(result).toContain('"Error with ""quotes"""');
    });

    it("should format as table", () => {
      const result = formatOutput(sampleData, "table");

      // Table should contain borders and data
      expect(result).toContain("│");
      expect(result).toContain("├");
      // Table wraps long content, so check for partial date
      expect(result).toContain("2024-01-15");
      expect(result).toContain("error");
    });

    it("should handle empty data array", () => {
      const result = formatOutput([], "json");
      expect(result).toBe("[]");

      const csvResult = formatOutput([], "csv");
      expect(csvResult).toBe("");

      const tableResult = formatOutput([], "table");
      expect(tableResult).toBe("No results found");
    });

    it("should extract level from raw JSON", () => {
      const dataWithRaw = [
        {
          dt: "2024-01-15",
          raw: JSON.stringify({ level: "info", message: "test" }),
        },
      ];

      const result = formatOutput(dataWithRaw, "pretty");

      expect(result).toContain("INFO");
    });

    it("should extract level from nested vercel metadata", () => {
      const dataWithVercel = [
        {
          dt: "2024-01-15",
          raw: JSON.stringify({
            vercel: {
              level: "error",
              proxy: { status_code: 500 },
            },
            message: "Nested level test",
          }),
        },
      ];

      const result = formatOutput(dataWithVercel, "pretty");

      expect(result).toContain("ERROR");
      expect(result).toContain("Nested level test");
    });

    it("should extract message from raw JSON", () => {
      const dataWithRaw = [
        {
          dt: "2024-01-15",
          raw: JSON.stringify({ msg: "Test message from raw" }),
        },
      ];

      const result = formatOutput(dataWithRaw, "pretty");

      expect(result).toContain("Test message from raw");
    });

    it("should handle nested objects in JSON output", () => {
      const dataWithNested = [
        {
          dt: "2024-01-15",
          details: {
            error: "nested error",
            code: 500,
          },
        },
      ];

      const result = formatOutput(dataWithNested, "json");
      const parsed = JSON.parse(result);

      expect(parsed[0].details.error).toBe("nested error");
      expect(parsed[0].details.code).toBe(500);
    });

    it("should color-code log levels in pretty format", () => {
      // Since we're testing with Bun which supports ANSI colors
      const data = [
        { dt: "2024-01-15", level: "error", message: "Error" },
        { dt: "2024-01-15", level: "warn", message: "Warning" },
        { dt: "2024-01-15", level: "info", message: "Info" },
        { dt: "2024-01-15", level: "debug", message: "Debug" },
      ];

      const result = formatOutput(data, "pretty");

      // Check that different levels appear (colors will be ANSI codes)
      expect(result).toContain("ERROR");
      expect(result).toContain("WARN");
      expect(result).toContain("INFO");
      expect(result).toContain("DEBUG");
    });

    it("should handle undefined and null values", () => {
      const dataWithNull = [
        {
          dt: "2024-01-15",
          level: null,
          message: undefined,
          valid: "data",
        },
      ];

      const jsonResult = formatOutput(dataWithNull, "json");
      const parsed = JSON.parse(jsonResult);

      expect(parsed[0].level).toBe(null);
      expect(parsed[0].message).toBeUndefined();
      expect(parsed[0].valid).toBe("data");

      const csvResult = formatOutput(dataWithNull, "csv");
      expect(csvResult).toContain(",,"); // Empty values for null/undefined
    });

    it("should handle raw field with non-JSON string", () => {
      const dataWithRawText = [
        {
          dt: "2024-01-15",
          raw: "Plain text log entry ERROR something went wrong",
        },
      ];

      const result = formatOutput(dataWithRawText, "pretty");

      expect(result).toContain("Plain text log entry");
      expect(result).toContain("ERROR"); // Should extract from pattern
    });

    it("should format extra fields in pretty output", () => {
      const dataWithExtras = [
        {
          dt: "2024-01-15",
          level: "info",
          message: "Main message",
          requestId: "req-123",
          responseTime: 250,
          endpoint: "/api/users",
        },
      ];

      const result = formatOutput(dataWithExtras, "pretty");

      expect(result).toContain("requestId: req-123");
      expect(result).toContain("responseTime: 250");
      expect(result).toContain("endpoint: /api/users");
    });
  });
});
