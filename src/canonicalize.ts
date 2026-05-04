import { URL } from "node:url";
import { SearchResult } from "./providers/types.js";

const TRACKING_KEYS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "fbclid",
  "gclid",
  "mc_cid",
  "mc_eid",
]);

export function canonicalizeUrl(raw: string): string {
  const u = new URL(raw);
  u.hash = "";
  u.protocol = "https:";
  if (u.hostname.startsWith("www.")) u.hostname = u.hostname.slice(4);
  if (u.hostname.startsWith("m.")) u.hostname = u.hostname.slice(2);
  if (u.hostname.startsWith("amp.")) u.hostname = u.hostname.slice(4);
  for (const key of [...u.searchParams.keys()]) {
    if (TRACKING_KEYS.has(key.toLowerCase()) || key.toLowerCase().startsWith("utm_")) {
      u.searchParams.delete(key);
    }
  }
  if (u.pathname.endsWith("/") && u.pathname !== "/") {
    u.pathname = u.pathname.slice(0, -1);
  }
  return u.toString();
}

function similarTitle(a: string, b: string): boolean {
  const normalize = (v: string) =>
    v
      .toLowerCase()
      .replace(/[^a-z0-9 ]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  const aa = normalize(a);
  const bb = normalize(b);
  if (aa === bb) return true;
  if (aa.length < 10 || bb.length < 10) return false;
  return aa.includes(bb) || bb.includes(aa);
}

export function dedupeAndDiversify(results: SearchResult[], maxPerDomain = 2): SearchResult[] {
  const seen = new Set<string>();
  const domainCount = new Map<string, number>();
  const out: SearchResult[] = [];
  for (const result of results) {
    let canonical: string;
    try {
      canonical = canonicalizeUrl(result.url);
    } catch {
      continue;
    }
    const domain = new URL(canonical).hostname;
    if ((domainCount.get(domain) ?? 0) >= maxPerDomain) continue;
    const key = `${domain}|${canonical}`;
    if (seen.has(key)) continue;
    const dupByTitle = out.some(
      (r) => new URL(r.url).hostname === domain && similarTitle(r.title, result.title),
    );
    if (dupByTitle) continue;
    seen.add(key);
    domainCount.set(domain, (domainCount.get(domain) ?? 0) + 1);
    out.push({ ...result, url: canonical });
  }
  return out;
}
