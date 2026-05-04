import { describe, expect, it } from "vitest";
import { redactSecrets } from "../src/errors.js";

describe("error redaction", () => {
  it("redacts bearer and key-like patterns", () => {
    const msg = "Authorization: Bearer abc.def.ghi and token sk_live_abcdef123456";
    const out = redactSecrets(msg);
    expect(out).toContain("[REDACTED]");
    expect(out).not.toContain("abc.def.ghi");
  });
});
