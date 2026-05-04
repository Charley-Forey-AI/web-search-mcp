import { SearchResult } from "./providers/types.js";
import { loadConfig } from "./config.js";

type RankedResult = SearchResult & { rerankScore: number };
type Embedder = (text: string) => Promise<number[]>;
let embedderPromise: Promise<Embedder | null> | null = null;

function tokenSet(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9 ]+/g, " ")
      .split(/\s+/)
      .filter((v) => v.length > 2),
  );
}

function overlapScore(query: string, text: string): number {
  const q = tokenSet(query);
  const t = tokenSet(text);
  if (!q.size) return 0;
  let hits = 0;
  for (const token of q) if (t.has(token)) hits++;
  return hits / q.size;
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (!a.length || !b.length || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

async function getLocalEmbedder(): Promise<Embedder | null> {
  if (!embedderPromise) {
    embedderPromise = (async () => {
      try {
        const mod = await import("@xenova/transformers");
        const featureExtractor = await mod.pipeline(
          "feature-extraction",
          "Xenova/all-MiniLM-L6-v2",
        );
        return async (text: string) => {
          const output = await featureExtractor(text, {
            pooling: "mean",
            normalize: true,
          });
          return Array.from((output as { data: Float32Array }).data);
        };
      } catch {
        return null;
      }
    })();
  }
  return embedderPromise;
}

export async function rerankResults(
  query: string,
  results: SearchResult[],
): Promise<RankedResult[]> {
  const cfg = loadConfig();
  const freshnessHint = /(latest|today|news|update|released|202\d)/i.test(query);
  let queryEmbedding: number[] | null = null;
  let localEmbedder: Embedder | null = null;
  if (cfg.RERANKER === "local") {
    localEmbedder = await getLocalEmbedder();
    if (localEmbedder) {
      queryEmbedding = await localEmbedder(query);
    }
  }
  return [...results]
    .map(async (r) => {
      let score = overlapScore(query, `${r.title} ${r.snippet}`);
      if (r.score) score += r.score * 0.2;
      if (freshnessHint && r.publishedAt) score += 0.1;
      if (localEmbedder && queryEmbedding) {
        const emb = await localEmbedder(`${r.title}\n${r.snippet}`);
        score += cosineSimilarity(queryEmbedding, emb) * 0.8;
      }
      return { ...r, rerankScore: score };
    })
    .reduce(
      async (promiseAcc, nextPromise) => {
        const acc = await promiseAcc;
        acc.push(await nextPromise);
        return acc;
      },
      Promise.resolve([] as RankedResult[]),
    )
    .then((ranked) => ranked.sort((a, b) => b.rerankScore - a.rerankScore));
}
