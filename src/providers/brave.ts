import { SearchInput, SearchProvider, SearchResult } from "./types.js";
import { requestJsonWithRetry } from "./base.js";

type BraveResponse = {
  web?: {
    results?: Array<{
      title: string;
      url: string;
      description?: string;
      age?: string;
    }>;
  };
};

export class BraveProvider implements SearchProvider {
  name = "brave";
  constructor(private readonly apiKey?: string) {}
  canUse(): boolean {
    return Boolean(this.apiKey);
  }
  async search(input: SearchInput): Promise<SearchResult[]> {
    const q = input.site ? `${input.query} site:${input.site}` : input.query;
    const url = new URL("https://api.search.brave.com/res/v1/web/search");
    url.searchParams.set("q", q);
    url.searchParams.set("count", String(input.max_results));
    if (input.country) url.searchParams.set("country", input.country);
    if (input.safesearch) url.searchParams.set("safesearch", input.safesearch);
    const json = await requestJsonWithRetry<BraveResponse>(this.name, url.toString(), {
      headers: {
        Accept: "application/json",
        "X-Subscription-Token": this.apiKey ?? "",
      },
    });
    return (json.web?.results ?? []).map((r) => ({
      title: r.title,
      url: r.url,
      snippet: r.description ?? "",
      publishedAt: r.age,
      raw: r,
    }));
  }
}
