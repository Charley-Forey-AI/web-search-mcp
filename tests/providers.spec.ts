import { describe, expect, it } from "vitest";
import { searchInputSchema, searchResultSchema } from "../src/providers/types.js";
import { dedupeAndDiversify } from "../src/canonicalize.js";

describe("provider schemas", () => {
  it("validates search input", () => {
    const parsed = searchInputSchema.parse({
      query: "mcp",
      max_results: 5,
    });
    expect(parsed.max_results).toBe(5);
  });

  it("validates search result shape", () => {
    const parsed = searchResultSchema.parse({
      title: "A",
      url: "https://example.com",
      snippet: "B",
    });
    expect(parsed.url).toContain("example.com");
  });
});

describe("dedupe and diversity", () => {
  it("removes tracking params and duplicates", () => {
    const out = dedupeAndDiversify([
      { title: "A", url: "http://www.example.com/a?utm_source=x", snippet: "a" },
      { title: "A  ", url: "https://example.com/a", snippet: "a" },
      { title: "B", url: "https://example.com/b", snippet: "b" },
      { title: "C", url: "https://example.com/c", snippet: "c" },
    ]);
    expect(out.length).toBeLessThanOrEqual(2);
    expect(out[0].url).toBe("https://example.com/a");
  });
});
