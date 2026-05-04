import { describe, expect, it } from "vitest";
import { storePage, getPage, storeSearch, getSearch } from "../src/memory.js";

describe("memory store", () => {
  it("stores and retrieves pages", () => {
    const id = storePage({
      url: "https://example.com",
      canonicalUrl: "https://example.com",
      title: "Example",
      content: "hello",
      format: "text",
      truncated: false,
      warnings: [],
      contentType: "text/html",
    });
    const page = getPage(id);
    expect(page?.title).toBe("Example");
  });

  it("stores and retrieves searches", () => {
    const item = storeSearch("mcp", "duckduckgo", [
      { title: "MCP", url: "https://modelcontextprotocol.io", snippet: "docs" },
    ]);
    const found = getSearch(item.id);
    expect(found?.query).toBe("mcp");
  });
});
