import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";

describe("config parsing", () => {
  it("parses lists and defaults", () => {
    process.env.DOMAIN_ALLOWLIST = "*.gov,example.com";
    process.env.DOMAIN_BLOCKLIST = "internal.local";
    const cfg = loadConfig();
    expect(cfg.domainAllowlist.length).toBeGreaterThan(0);
    expect(cfg.domainBlocklist).toContain("internal.local");
  });
});
