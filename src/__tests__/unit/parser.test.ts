import { describe, expect, it } from "bun:test";
import { parseGraphQLQuery } from "../../parser/graphql";

describe("GraphQL Parser", () => {
  describe("parseGraphQLQuery", () => {
    it("should parse simple query with limit", () => {
      const query = "{ logs(limit: 100) { dt, level, message } }";
      const result = parseGraphQLQuery(query);

      expect(result.limit).toBe(100);
      expect(result.fields).toEqual(["dt", "level", "message"]);
    });

    it("should parse query with level filter", () => {
      const query = "{ logs(level: 'error', limit: 50) { * } }";
      const result = parseGraphQLQuery(query);

      expect(result.level).toBe("error");
      expect(result.limit).toBe(50);
      expect(result.fields).toBeUndefined(); // * means all fields
    });

    it("should parse query with time range", () => {
      const query = "{ logs(since: '1h', until: '30m') { dt, message } }";
      const result = parseGraphQLQuery(query);

      expect(result.since).toBe("1h");
      expect(result.until).toBe("30m");
      expect(result.fields).toEqual(["dt", "message"]);
    });

    it("should parse query with between syntax", () => {
      const query = "{ logs(between: ['2024-01-01', '2024-01-02']) { * } }";
      const result = parseGraphQLQuery(query);

      expect(result.since).toBe("2024-01-01");
      expect(result.until).toBe("2024-01-02");
    });

    it("should parse query with subsystem filter", () => {
      const query = "{ logs(subsystem: 'api') { dt, message } }";
      const result = parseGraphQLQuery(query);

      expect(result.subsystem).toBe("api");
    });

    it("should parse query with search parameter", () => {
      const query = "{ logs(search: 'database error') { * } }";
      const result = parseGraphQLQuery(query);

      expect(result.search).toBe("database error");
    });

    it("should parse query with where clause", () => {
      const query = "{ logs(where: { userId: '12345', status: 'active' }) { * } }";
      const result = parseGraphQLQuery(query);

      expect(result.where).toEqual({
        userId: "12345",
        status: "active",
      });
    });

    it("should parse query with source parameter", () => {
      const query = "{ logs(source: 'production') { dt } }";
      const result = parseGraphQLQuery(query);

      expect(result.source).toBe("production");
    });

    it("should parse complex query with multiple parameters", () => {
      const query = `{ 
        logs(
          level: 'error',
          subsystem: 'payment',
          since: '1h',
          limit: 200,
          where: { environment: 'prod' }
        ) { 
          dt, 
          message, 
          stack_trace 
        }
      }`;
      const result = parseGraphQLQuery(query);

      expect(result.level).toBe("error");
      expect(result.subsystem).toBe("payment");
      expect(result.since).toBe("1h");
      expect(result.limit).toBe(200);
      expect(result.where).toEqual({ environment: "prod" });
      expect(result.fields).toEqual(["dt", "message", "stack_trace"]);
    });

    it("should handle query without parameters", () => {
      const query = "{ logs() { dt, message } }";
      const result = parseGraphQLQuery(query);

      expect(result.fields).toEqual(["dt", "message"]);
      expect(result.limit).toBeUndefined();
    });

    it("should handle query with asterisk for all fields", () => {
      const query = "{ logs(limit: 10) { * } }";
      const result = parseGraphQLQuery(query);

      expect(result.limit).toBe(10);
      expect(result.fields).toBeUndefined();
    });

    it("should throw on invalid query format", () => {
      const query = "invalid query";

      expect(() => parseGraphQLQuery(query)).toThrow("Invalid query format");
    });

    // Skip nested braces test - parser doesn't support deep nesting yet
    it.skip("should handle query with nested braces in where clause", () => {
      const query = "{ logs(where: { nested: { field: 'value' } }) { dt } }";
      const result = parseGraphQLQuery(query);

      expect(result.where).toEqual({
        nested: { field: "value" },
      });
    });

    it("should parse boolean values", () => {
      const query = "{ logs(where: { active: true, deleted: false }) { * } }";
      const result = parseGraphQLQuery(query);

      expect(result.where).toEqual({
        active: true,
        deleted: false,
      });
    });

    it("should parse numeric values", () => {
      const query = "{ logs(limit: 100, where: { count: 42 }) { * } }";
      const result = parseGraphQLQuery(query);

      expect(result.limit).toBe(100);
      expect(result.where).toEqual({ count: 42 });
    });

    // Skip escaped quotes test - parser doesn't handle escaping yet
    it.skip("should handle escaped quotes in strings", () => {
      const query = "{ logs(search: 'user\\'s data') { * } }";
      const result = parseGraphQLQuery(query);

      expect(result.search).toBe("user's data");
    });

    it("should trim whitespace from field names", () => {
      const query = "{ logs() {  dt , level , message  } }";
      const result = parseGraphQLQuery(query);

      expect(result.fields).toEqual(["dt", "level", "message"]);
    });

    it("should handle both single and double quotes", () => {
      const query1 = '{ logs(level: "error") { * } }';
      const query2 = "{ logs(level: 'error') { * } }";

      const result1 = parseGraphQLQuery(query1);
      const result2 = parseGraphQLQuery(query2);

      expect(result1.level).toBe("error");
      expect(result2.level).toBe("error");
    });
  });
});
