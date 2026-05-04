import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { MockAgent, setGlobalDispatcher } from "undici";
import { fetchAndExtract } from "../src/fetcher.js";
import { loadConfig } from "../src/config.js";

const mockAgent = new MockAgent();
mockAgent.disableNetConnect();

beforeAll(() => {
  setGlobalDispatcher(mockAgent);
  const pool = mockAgent.get("https://example.com");
  pool.intercept({ path: "/robots.txt", method: "GET" }).reply(200, "User-agent: *\nAllow: /");
  pool
    .intercept({ path: "/article", method: "GET" })
    .reply(
      200,
      "<html><head><title>Title</title></head><body><article><h1>Title</h1><p>Hello world content.</p></article></body></html>",
      {
        headers: {
          "content-type": "text/html",
        },
      },
    );
});

afterAll(async () => {
  await mockAgent.close();
});

describe("fetcher", () => {
  it("extracts html content", async () => {
    process.env.RESPECT_ROBOTS = "true";
    const config = loadConfig();
    const fetched = await fetchAndExtract("https://example.com/article", config, 5000, "text");
    expect(fetched.title.toLowerCase()).toContain("title");
    expect(fetched.content).toContain("untrusted_content");
  });
});
