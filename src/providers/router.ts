import { AppError } from "../errors.js";
import { AppConfig } from "../config.js";
import { BraveProvider } from "./brave.js";
import { DuckDuckGoProvider } from "./duckduckgo.js";
import { ExaProvider } from "./exa.js";
import { SerperProvider } from "./serper.js";
import { SearxngProvider } from "./searxng.js";
import { TavilyProvider } from "./tavily.js";
import { SearchProvider } from "./types.js";

export type ProviderName = "tavily" | "brave" | "exa" | "serper" | "duckduckgo" | "searxng";

export function buildProviders(config: AppConfig): Record<ProviderName, SearchProvider> {
  return {
    tavily: new TavilyProvider(config.TAVILY_API_KEY),
    brave: new BraveProvider(config.BRAVE_API_KEY),
    exa: new ExaProvider(config.EXA_API_KEY),
    serper: new SerperProvider(config.SERPER_API_KEY),
    searxng: new SearxngProvider(config.SEARXNG_BASE_URL),
    duckduckgo: new DuckDuckGoProvider(),
  };
}

export function resolvePrimaryProvider(
  providers: Record<ProviderName, SearchProvider>,
  config: AppConfig,
): SearchProvider {
  const preferred = config.SEARCH_PROVIDER as ProviderName | undefined;
  if (preferred && providers[preferred]?.canUse()) return providers[preferred];
  const order: ProviderName[] = ["tavily", "brave", "exa", "serper", "searxng", "duckduckgo"];
  const firstAvailable = order.find((name) => providers[name].canUse());
  if (!firstAvailable) {
    throw new AppError(
      "No search providers are configured. Set at least one API key or use DuckDuckGo fallback.",
      "configuration_error",
    );
  }
  return providers[firstAvailable];
}

export function resolveFallbackProviders(
  providers: Record<ProviderName, SearchProvider>,
  config: AppConfig,
): SearchProvider[] {
  return config.providerFallbacks
    .map((name) => name as ProviderName)
    .filter((name) => providers[name] && providers[name].canUse())
    .map((name) => providers[name]);
}
