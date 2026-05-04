import { SearchInput, SearchProvider, SearchResult } from "./types.js";
import { requestJsonWithRetry } from "./base.js";

type SearxngResponse = {
  results?: Array<{
    title?: string;
    url?: string;
    content?: string;
    publishedDate?: string;
    score?: number;
  }>;
};

export class SearxngProvider implements SearchProvider {
  name = "searxng";
  constructor(private readonly baseUrl?: string) {}

  canUse(): boolean {
    return Boolean(this.baseUrl);
  }

  async search(input: SearchInput): Promise<SearchResult[]> {
    const url = new URL("/search", this.baseUrl);
    url.searchParams.set("format", "json");
    url.searchParams.set("q", input.site ? `${input.query} site:${input.site}` : input.query);
    url.searchParams.set("safesearch", input.safesearch === "strict" ? "2" : "1");
    url.searchParams.set("language", "en-US");
    const json = await requestJsonWithRetry<SearxngResponse>(this.name, url.toString(), {});
    return (json.results ?? [])
      .filter((r) => r.url)
      .slice(0, input.max_results)
      .map((r) => ({
        title: r.title ?? r.url ?? "",
        url: r.url ?? "",
        snippet: r.content ?? "",
        publishedAt: r.publishedDate,
        score: r.score,
        raw: r,
      }));
  }
}
