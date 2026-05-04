import { z } from "zod";

export const searchInputSchema = z.object({
  query: z.string().min(1).max(400),
  max_results: z.number().int().min(1).max(20).default(5),
  freshness: z.enum(["day", "week", "month", "year"]).optional(),
  site: z.string().optional(),
  country: z.string().optional(),
  safesearch: z.enum(["off", "moderate", "strict"]).optional(),
});

export type SearchInput = z.infer<typeof searchInputSchema>;

export const searchResultSchema = z.object({
  title: z.string(),
  url: z.string().url(),
  snippet: z.string(),
  publishedAt: z.string().optional(),
  score: z.number().optional(),
  raw: z.unknown().optional(),
});

export type SearchResult = z.infer<typeof searchResultSchema>;

export interface SearchProvider {
  name: string;
  canUse(): boolean;
  search(input: SearchInput): Promise<SearchResult[]>;
}
