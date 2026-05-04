import { SearchInput, SearchProvider, SearchResult } from "./types.js";
import { requestJsonWithRetry } from "./base.js";

type TavilyResponse = {
  results?: Array<{
    title: string;
    url: string;
    content?: string;
    score?: number;
    published_date?: string;
  }>;
};

export class TavilyProvider implements SearchProvider {
  name = "tavily";
  constructor(private readonly apiKey?: string) {}
  canUse(): boolean {
    return Boolean(this.apiKey);
  }
  async search(input: SearchInput): Promise<SearchResult[]> {
    const body = {
      query: input.site ? `${input.query} site:${input.site}` : input.query,
      max_results: input.max_results,
      search_depth: "advanced",
      topic: input.freshness ? "news" : "general",
    };
    const json = await requestJsonWithRetry<TavilyResponse>(
      this.name,
      "https://api.tavily.com/search",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
      },
    );
    return (json.results ?? []).map((r) => ({
      title: r.title,
      url: r.url,
      snippet: r.content ?? "",
      score: r.score,
      publishedAt: r.published_date,
      raw: r,
    }));
  }
}
