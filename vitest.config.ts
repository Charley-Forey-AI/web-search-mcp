import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 70,
        statements: 80,
      },
      include: [
        "src/canonicalize.ts",
        "src/chunking.ts",
        "src/config.ts",
        "src/injection.ts",
        "src/ratelimit.ts",
        "src/providers/tavily.ts",
        "src/providers/types.ts",
      ],
    },
  },
});
