import { describe, expect, it } from "bun:test";
import { hasOutputFormat } from "../../api/query";

describe("hasOutputFormat", () => {
  it("does not treat formatDateTime as a FORMAT clause", () => {
    expect(hasOutputFormat("SELECT formatDateTime(dt, '%F') FROM logs")).toBe(false);
  });

  it("recognizes an explicit FORMAT clause", () => {
    expect(hasOutputFormat("SELECT 1 FORMAT JSONEachRow")).toBe(true);
    expect(hasOutputFormat("SELECT 1 FORMAT JSONEachRow; -- trailing comment")).toBe(true);
    expect(hasOutputFormat("SELECT 1 FORMAT JSONEachRow SETTINGS max_threads=1")).toBe(true);
  });

  it("ignores format text in strings, identifiers, and comments", () => {
    expect(hasOutputFormat("SELECT 'format JSONEachRow'")).toBe(false);
    expect(hasOutputFormat('SELECT "format JSONEachRow" FROM logs')).toBe(false);
    expect(hasOutputFormat("SELECT 1 /* FORMAT JSONEachRow */")).toBe(false);
    expect(hasOutputFormat("SELECT 1 -- FORMAT JSONEachRow")).toBe(false);
    expect(hasOutputFormat("SELECT format FROM logs")).toBe(false);
  });
});
