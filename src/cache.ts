import { createHash } from "node:crypto";
import { LRUCache } from "lru-cache";

export type CacheEntry<T> = {
  data: T;
  etag?: string;
  lastModified?: string;
  fetchedAt: string;
};

export const queryCache = new LRUCache<string, CacheEntry<unknown>>({
  ttl: 1000 * 60 * 10,
  max: 1000,
});

export const urlCache = new LRUCache<string, CacheEntry<unknown>>({
  ttl: 1000 * 60 * 10,
  max: 1000,
});

export function keyFor(obj: unknown): string {
  return createHash("sha256").update(JSON.stringify(obj)).digest("hex");
}
