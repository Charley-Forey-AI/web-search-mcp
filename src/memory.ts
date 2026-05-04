import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { FetchExtractResult } from "./fetcher.js";
import { loadConfig } from "./config.js";
import { SearchResult } from "./providers/types.js";

export type SearchHistory = {
  id: string;
  query: string;
  at: string;
  provider: string;
  results: SearchResult[];
};

const pageCache = new Map<string, FetchExtractResult>();
const searches = new Map<string, SearchHistory>();
const cfg = loadConfig();
const useSqlite = cfg.STATE_BACKEND === "sqlite";
let db: Database.Database | null = null;

if (useSqlite) {
  const sqlitePath = path.resolve(process.cwd(), cfg.SQLITE_PATH);
  fs.mkdirSync(path.dirname(sqlitePath), { recursive: true });
  db = new Database(sqlitePath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS page_cache (
      id TEXT PRIMARY KEY,
      canonical_url TEXT NOT NULL,
      title TEXT NOT NULL,
      json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS search_history (
      id TEXT PRIMARY KEY,
      query TEXT NOT NULL,
      provider TEXT NOT NULL,
      at TEXT NOT NULL,
      json TEXT NOT NULL
    );
  `);
}

export function storePage(page: FetchExtractResult): string {
  const contentHash = createHash("sha256").update(page.content).digest("hex").slice(0, 16);
  const id = createHash("sha256")
    .update(`${page.canonicalUrl}:${page.format}:${contentHash}`)
    .digest("hex");
  if (db) {
    db.prepare(
      "INSERT OR REPLACE INTO page_cache (id, canonical_url, title, json, updated_at) VALUES (?, ?, ?, ?, ?)",
    ).run(id, page.canonicalUrl, page.title, JSON.stringify(page), new Date().toISOString());
    return id;
  }
  pageCache.set(id, page);
  return id;
}

export function getPage(id: string): FetchExtractResult | undefined {
  if (db) {
    const row = db.prepare("SELECT json FROM page_cache WHERE id = ?").get(id) as
      | { json: string }
      | undefined;
    if (!row) return undefined;
    return JSON.parse(row.json) as FetchExtractResult;
  }
  return pageCache.get(id);
}

export function listPages(): Array<{ id: string; url: string; title: string }> {
  if (db) {
    return (
      db
        .prepare(
          "SELECT id, canonical_url, title FROM page_cache ORDER BY updated_at DESC LIMIT 100",
        )
        .all() as Array<{ id: string; canonical_url: string; title: string }>
    ).map((row) => ({
      id: row.id,
      url: row.canonical_url,
      title: row.title,
    }));
  }
  return [...pageCache.entries()].map(([id, page]) => ({
    id,
    url: page.canonicalUrl,
    title: page.title,
  }));
}

export function storeSearch(
  query: string,
  provider: string,
  results: SearchResult[],
): SearchHistory {
  const id = createHash("sha256")
    .update(`${query}:${provider}:${Date.now()}`)
    .digest("hex")
    .slice(0, 16);
  const record: SearchHistory = {
    id,
    query,
    at: new Date().toISOString(),
    provider,
    results,
  };
  if (db) {
    db.prepare(
      "INSERT OR REPLACE INTO search_history (id, query, provider, at, json) VALUES (?, ?, ?, ?, ?)",
    ).run(id, query, provider, record.at, JSON.stringify(record));
    return record;
  }
  searches.set(id, record);
  return record;
}

export function getSearch(id: string): SearchHistory | undefined {
  if (db) {
    const row = db.prepare("SELECT json FROM search_history WHERE id = ?").get(id) as
      | { json: string }
      | undefined;
    if (!row) return undefined;
    return JSON.parse(row.json) as SearchHistory;
  }
  return searches.get(id);
}

export function listSearches(): SearchHistory[] {
  if (db) {
    return (
      db.prepare("SELECT json FROM search_history ORDER BY at DESC LIMIT 100").all() as Array<{
        json: string;
      }>
    ).map((row) => JSON.parse(row.json) as SearchHistory);
  }
  return [...searches.values()].sort((a, b) => (a.at < b.at ? 1 : -1));
}
