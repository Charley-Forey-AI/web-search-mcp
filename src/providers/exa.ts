import { SearchInput, SearchProvider, SearchResult } from "./types.js";
import { requestJsonWithRetry } from "./base.js";

type ExaResponse = {
  results?: Array<{
    title?: string;
    url: string;
    text?: string;
    publishedDate?: string;
    score?: number;
  }>;
};

export class ExaProvider implements SearchProvider {
  name = "exa";
  constructor(private readonly apiKey?: string) {}
  canUse(): boolean {
    return Boolean(this.apiKey);
  }
  async search(input: SearchInput): Promise<SearchResult[]> {
    const body = {
      query: input.site ? `${input.query} site:${input.site}` : input.query,
      numResults: input.max_results,
      useAutoprompt: true,
      type: input.freshness ? "neural" : "keyword",
      contents: { text: true, highlights: { numSentences: 2 } },
    };
    const json = await requestJsonWithRetry<ExaResponse>(this.name, "https://api.exa.ai/search", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.apiKey ?? "",
      },
      body: JSON.stringify(body),
    });
    return (json.results ?? []).map((r) => ({
      title: r.title ?? r.url,
      url: r.url,
      snippet: (r.text ?? "").slice(0, 500),
      score: r.score,
      publishedAt: r.publishedDate,
      raw: r,
    }));
  }
}
