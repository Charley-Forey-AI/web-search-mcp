import fs from "node:fs/promises";
import path from "node:path";
import { loadConfig } from "../config.js";
import { buildProviders } from "../providers/router.js";

type EvalQuery = {
  query: string;
  expected_url_patterns: string[];
};

function recallAtK(urls: string[], expected: string[], k: number): number {
  const top = urls.slice(0, k);
  const hits = expected.filter((pattern) => top.some((u) => u.includes(pattern)));
  return expected.length ? hits.length / expected.length : 0;
}

function mrr(urls: string[], expected: string[]): number {
  for (let i = 0; i < urls.length; i++) {
    if (expected.some((pattern) => urls[i].includes(pattern))) {
      return 1 / (i + 1);
    }
  }
  return 0;
}

async function main() {
  const datasetPath = path.join(process.cwd(), "tests", "eval", "queries.jsonl");
  const content = await fs.readFile(datasetPath, "utf-8");
  const rows = content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as EvalQuery);

  const providers = buildProviders(loadConfig());
  const available = Object.values(providers).filter((p) => p.canUse());

  const report: Record<string, { recallAt5: number; mrr10: number }> = {};
  for (const provider of available) {
    let recallTotal = 0;
    let mrrTotal = 0;
    for (const row of rows) {
      const results = await provider.search({ query: row.query, max_results: 10 });
      const urls = results.map((r) => r.url);
      recallTotal += recallAtK(urls, row.expected_url_patterns, 5);
      mrrTotal += mrr(urls.slice(0, 10), row.expected_url_patterns);
    }
    report[provider.name] = {
      recallAt5: Number((recallTotal / rows.length).toFixed(4)),
      mrr10: Number((mrrTotal / rows.length).toFixed(4)),
    };
  }

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${String(error)}\n`);
  process.exit(1);
});
