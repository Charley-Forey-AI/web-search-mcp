import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SearchResult } from "./providers/types.js";

export async function refineQueryWithSampling(server: McpServer, query: string): Promise<string[]> {
  try {
    const response = await server.server.createMessage({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Generate 3 concise web-search query rewrites for: "${query}". Return one query per line.`,
          },
        },
      ],
      maxTokens: 200,
      modelPreferences: {
        hints: [{ name: "speed" }],
      },
    });
    if (response.content.type !== "text") return [query];
    const lines = response.content.text
      .split("\n")
      .map((v) => v.trim().replace(/^[-*\d.)\s]+/, ""))
      .filter(Boolean)
      .slice(0, 3);
    return lines.length ? lines : [query];
  } catch {
    return [query];
  }
}

export async function rerankWithSampling(
  server: McpServer,
  query: string,
  results: SearchResult[],
): Promise<SearchResult[]> {
  try {
    const list = results
      .map((r, i) => `${i + 1}. ${r.title}\nURL: ${r.url}\nSnippet: ${r.snippet}`)
      .join("\n\n");
    const response = await server.server.createMessage({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Rank the following search results by relevance to the query "${query}". Return only a comma-separated list of result numbers.\n\n${list}`,
          },
        },
      ],
      maxTokens: 120,
      modelPreferences: {
        hints: [{ name: "intelligence" }],
      },
    });
    if (response.content.type !== "text") return results;
    const order = response.content.text
      .split(/[,\s]+/)
      .map((v) => Number(v))
      .filter((n) => Number.isInteger(n) && n >= 1 && n <= results.length);
    if (!order.length) return results;
    const seen = new Set<number>();
    const ranked = order.filter((n) => !seen.has(n) && seen.add(n)).map((n) => results[n - 1]);
    for (const r of results) {
      if (!ranked.includes(r)) ranked.push(r);
    }
    return ranked;
  } catch {
    return results;
  }
}

export async function summarizeWithSampling(server: McpServer, content: string): Promise<string> {
  try {
    const response = await server.server.createMessage({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Summarize the following source content in 6 bullets and keep citations inline if present:\n\n${content.slice(0, 12000)}`,
          },
        },
      ],
      maxTokens: 400,
      modelPreferences: {
        hints: [{ name: "intelligence" }],
      },
    });
    if (response.content.type === "text") return response.content.text;
    return content;
  } catch {
    return content;
  }
}
