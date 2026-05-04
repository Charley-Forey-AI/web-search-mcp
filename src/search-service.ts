import { AppConfig } from "./config.js";
import { keyFor, queryCache } from "./cache.js";
import { dedupeAndDiversify } from "./canonicalize.js";
import { Logger } from "./logger.js";
import { rerankResults } from "./rerank.js";
import { ProviderName, resolveFallbackProviders } from "./providers/router.js";
import { SearchInput, SearchProvider, SearchResult } from "./providers/types.js";

export type SearchServiceDeps = {
  config: AppConfig;
  providers: Record<ProviderName, SearchProvider>;
  logger: Logger;
};

export type SearchServiceResult = {
  providerUsed: string;
  cached: boolean;
  results: SearchResult[];
};

async function runOneProvider(
  provider: SearchProvider,
  input: SearchInput,
  logger: Logger,
): Promise<SearchResult[]> {
  const start = Date.now();
  const results = await provider.search(input);
  logger.info({
    msg: "provider_search_done",
    provider: provider.name,
    latency_ms: Date.now() - start,
    status: "ok",
    count: results.length,
  });
  return results;
}

export async function runSearch(
  input: SearchInput,
  primaryProvider: SearchProvider,
  deps: SearchServiceDeps,
): Promise<SearchServiceResult> {
  const bypassCache = Boolean(input.freshness);
  const cacheKey = keyFor({
    type: "search",
    provider: primaryProvider.name,
    input,
    ensemble: deps.config.ENSEMBLE,
    fallback: deps.config.providerFallbacks,
  });
  if (!bypassCache && queryCache.has(cacheKey)) {
    const cached = queryCache.get(cacheKey)!;
    return {
      providerUsed: primaryProvider.name,
      cached: true,
      results: cached.data as SearchResult[],
    };
  }

  let results: SearchResult[] = [];
  let providerUsed = primaryProvider.name;

  if (deps.config.ENSEMBLE) {
    const available = Object.values(deps.providers).filter((p) => p.canUse());
    const settled = await Promise.allSettled(
      available.map((provider) => runOneProvider(provider, input, deps.logger)),
    );
    results = settled.flatMap((s) => (s.status === "fulfilled" ? s.value : []));
    providerUsed = `ensemble:${available.map((p) => p.name).join(",")}`;
  } else {
    results = await runOneProvider(primaryProvider, input, deps.logger);
  }

  if (!results.length) {
    const fallbacks = resolveFallbackProviders(deps.providers, deps.config);
    for (const fallback of fallbacks) {
      const next = await runOneProvider(fallback, input, deps.logger).catch(() => []);
      if (next.length) {
        results = next;
        providerUsed = fallback.name;
        break;
      }
    }
  }

  results = dedupeAndDiversify(results);
  const ranked = await rerankResults(input.query, results);
  const finalResults = ranked.slice(0, input.max_results).map((r) => ({
    title: r.title,
    url: r.url,
    snippet: r.snippet,
    publishedAt: r.publishedAt,
    score: r.rerankScore,
    raw: r.raw,
  }));

  queryCache.set(cacheKey, {
    data: finalResults,
    fetchedAt: new Date().toISOString(),
  });
  return {
    providerUsed,
    cached: false,
    results: finalResults,
  };
}
