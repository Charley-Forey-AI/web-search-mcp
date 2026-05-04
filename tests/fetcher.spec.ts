import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { gzipSync } from "node:zlib";
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
  pool
    .intercept({ path: "/compressed", method: "GET" })
    .reply(
      200,
      gzipSync(
        "<html><head><title>Compressed Title</title></head><body><article><p>Compressed body text.</p></article></body></html>",
      ),
      {
        headers: {
          "content-type": "text/html",
          "content-encoding": "gzip",
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

  it("decompresses gzip encoded content before extraction", async () => {
    process.env.RESPECT_ROBOTS = "false";
    const config = loadConfig();
    const fetched = await fetchAndExtract("https://example.com/compressed", config, 5000, "text");
    expect(fetched.title).toContain("Compressed Title");
    expect(fetched.content).toContain("Compressed body text");
  });
});
