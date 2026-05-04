import { SearchInput, SearchProvider, SearchResult } from "./types.js";
import { requestJsonWithRetry } from "./base.js";

type SerperResponse = {
  organic?: Array<{
    title: string;
    link: string;
    snippet?: string;
    date?: string;
  }>;
};

export class SerperProvider implements SearchProvider {
  name = "serper";
  constructor(private readonly apiKey?: string) {}
  canUse(): boolean {
    return Boolean(this.apiKey);
  }
  async search(input: SearchInput): Promise<SearchResult[]> {
    const body = {
      q: input.site ? `${input.query} site:${input.site}` : input.query,
      num: input.max_results,
      gl: input.country,
      autocorrect: true,
    };
    const json = await requestJsonWithRetry<SerperResponse>(
      this.name,
      "https://google.serper.dev/search",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "X-API-KEY": this.apiKey ?? "",
        },
        body: JSON.stringify(body),
      },
    );
    return (json.organic ?? []).map((r) => ({
      title: r.title,
      url: r.link,
      snippet: r.snippet ?? "",
      publishedAt: r.date,
      raw: r,
    }));
  }
}
