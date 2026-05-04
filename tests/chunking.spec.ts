import { describe, expect, it } from "vitest";
import { chunkText } from "../src/chunking.js";

describe("chunking", () => {
  it("splits long text into chunk anchors", () => {
    const text = "a".repeat(4000);
    const out = chunkText("https://example.com/page", text, 1000);
    expect(out.length).toBeGreaterThan(3);
    expect(out[0].id).toContain("#chunk=0");
  });
});
