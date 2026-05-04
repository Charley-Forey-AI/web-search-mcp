import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("search_and_extract implementation", () => {
  it("does not call sampling rerank or summarize helpers", async () => {
    const source = await readFile(new URL("../src/index.ts", import.meta.url), "utf-8");
    const start = source.indexOf('"search_and_extract"');
    const end = source.indexOf('"news_search"');
    const section = source.slice(start, end);
    expect(section).not.toContain("rerankWithSampling");
    expect(section).not.toContain("summarizeWithSampling");
  });
});
