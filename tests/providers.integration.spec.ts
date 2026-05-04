import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MockAgent, setGlobalDispatcher } from "undici";
import { TavilyProvider } from "../src/providers/tavily.js";

const mockAgent = new MockAgent();
mockAgent.disableNetConnect();

beforeAll(() => {
  setGlobalDispatcher(mockAgent);
  const pool = mockAgent.get("https://api.tavily.com");
  pool
    .intercept({
      path: "/search",
      method: "POST",
    })
    .reply(200, {
      results: [
        {
          title: "Model Context Protocol",
          url: "https://modelcontextprotocol.io",
          content: "MCP docs",
          score: 0.98,
        },
      ],
    });
});

afterAll(async () => {
  await mockAgent.close();
});

describe("provider integration", () => {
  it("normalizes tavily response", async () => {
    const provider = new TavilyProvider("test-key");
    const results = await provider.search({ query: "mcp", max_results: 1 });
    expect(results[0].title).toContain("Model Context Protocol");
    expect(results[0].url).toContain("modelcontextprotocol.io");
  });
});
