import { SearchInput, SearchProvider, SearchResult } from "./types.js";
import { requestJsonWithRetry } from "./base.js";

type DDGResponse = {
  RelatedTopics?: Array<{
    Text?: string;
    FirstURL?: string;
    Topics?: Array<{ Text?: string; FirstURL?: string }>;
  }>;
};

function flattenRelatedTopics(json: DDGResponse): Array<{ Text?: string; FirstURL?: string }> {
  const out: Array<{ Text?: string; FirstURL?: string }> = [];
  for (const topic of json.RelatedTopics ?? []) {
    if (topic.FirstURL) out.push(topic);
    if (topic.Topics) out.push(...topic.Topics);
  }
  return out;
}

export class DuckDuckGoProvider implements SearchProvider {
  name = "duckduckgo";
  canUse(): boolean {
    return true;
  }
  async search(input: SearchInput): Promise<SearchResult[]> {
    const query = input.site ? `${input.query} site:${input.site}` : input.query;
    const url = new URL("https://api.duckduckgo.com/");
    url.searchParams.set("q", query);
    url.searchParams.set("format", "json");
    url.searchParams.set("no_redirect", "1");
    url.searchParams.set("no_html", "1");
    const json = await requestJsonWithRetry<DDGResponse>(this.name, url.toString(), {});
    return flattenRelatedTopics(json)
      .filter((t) => t.FirstURL && t.Text)
      .slice(0, input.max_results)
      .map((t) => ({
        title: (t.Text ?? "").split("-")[0].trim() || t.FirstURL!,
        url: t.FirstURL!,
        snippet: t.Text ?? "",
        raw: t,
      }));
  }
}
