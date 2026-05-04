import { describe, expect, it } from "vitest";
import { rerankResults } from "../src/rerank.js";

describe("rerank", () => {
  it("boosts query-overlap matches", async () => {
    process.env.RERANKER = "token";
    const ranked = await rerankResults("model context protocol", [
      { title: "Random recipe", url: "https://a.com", snippet: "food and cooking" },
      {
        title: "Model Context Protocol docs",
        url: "https://modelcontextprotocol.io",
        snippet: "MCP specification",
      },
    ]);
    expect(ranked[0].url).toContain("modelcontextprotocol.io");
  });
});
