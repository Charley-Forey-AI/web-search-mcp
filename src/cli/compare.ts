import { loadConfig } from "../config.js";
import { buildProviders } from "../providers/router.js";

function parseArg(name: string): string | undefined {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

async function main() {
  const query = parseArg("--query");
  if (!query) {
    process.stderr.write('Usage: npm run compare -- --query "..."\n');
    process.exit(1);
  }
  const providers = buildProviders(loadConfig());
  const available = Object.values(providers).filter((p) => p.canUse());
  const rows = await Promise.all(
    available.map(async (provider) => {
      const results = await provider.search({
        query,
        max_results: 5,
      });
      return {
        provider: provider.name,
        urls: results.map((r) => r.url),
      };
    }),
  );
  process.stdout.write(`${JSON.stringify(rows, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${String(error)}\n`);
  process.exit(1);
});
