import { z } from "zod";

export const envSchema = z.object({
  SEARCH_PROVIDER: z.enum(["tavily", "brave", "exa", "serper", "duckduckgo", "searxng"]).optional(),
  HOST: z.string().default("127.0.0.1"),
  PORT: z.coerce.number().int().min(1).max(65535).default(8080),
  MCP_BASE_PATH: z.string().default("/mcp"),
  CORS_ORIGIN: z.string().optional(),
  MCP_AUTH_TOKEN: z.string().optional(),
  SEARCH_PROVIDER_FALLBACK: z.string().optional(),
  ENSEMBLE: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  REFINE_QUERIES: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  RESPECT_ROBOTS: z
    .string()
    .optional()
    .default("true")
    .transform((v) => v !== "false"),
  JS_RENDER: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  LOG_QUERIES: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  DEBUG: z
    .string()
    .optional()
    .transform((v) => v === "1" || v === "true"),
  DOMAIN_ALLOWLIST: z.string().optional(),
  DOMAIN_BLOCKLIST: z.string().optional(),
  ALLOWED_HOSTS: z.string().optional(),
  ALLOWED_ORIGINS: z.string().optional(),
  STATE_BACKEND: z.enum(["memory", "redis", "sqlite"]).default("memory"),
  SESSION_BACKEND: z.enum(["memory", "redis"]).default("memory"),
  FETCH_HEADERS_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120000).default(15000),
  FETCH_BODY_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120000).default(15000),
  FETCH_MAX_BODY_BYTES: z.coerce.number().int().min(1024).max(50_000_000).default(5_000_000),
  HTTP_JSON_BODY_MAX_BYTES: z.coerce.number().int().min(1024).max(5_000_000).default(262144),
  SHUTDOWN_DRAIN_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120000).default(25000),
  HTTP_RATE_LIMIT_RPS: z.coerce.number().int().min(1).max(1000).default(30),
  RERANKER: z.enum(["none", "token", "local"]).default("token"),
  SQLITE_PATH: z.string().default(".cache/web-search-mcp.sqlite"),
  REDIS_URL: z.string().optional(),
  TAVILY_API_KEY: z.string().optional(),
  BRAVE_API_KEY: z.string().optional(),
  EXA_API_KEY: z.string().optional(),
  SERPER_API_KEY: z.string().optional(),
  SEARXNG_BASE_URL: z.string().optional(),
  COHERE_API_KEY: z.string().optional(),
});

export type AppConfig = z.infer<typeof envSchema> & {
  providerFallbacks: string[];
  domainAllowlist: string[];
  domainBlocklist: string[];
  allowedHosts: string[];
  allowedOrigins: string[];
  mcpBasePath: string;
};

function normalizeBasePath(path: string): string {
  const withLeadingSlash = path.startsWith("/") ? path : `/${path}`;
  const trimmed = withLeadingSlash.replace(/\/+$/, "");
  return trimmed || "/mcp";
}

export function loadConfig(): AppConfig {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(parsed.error.message);
  }
  const cfg = parsed.data;
  return {
    ...cfg,
    providerFallbacks: (cfg.SEARCH_PROVIDER_FALLBACK ?? "")
      .split(",")
      .map((v) => v.trim().toLowerCase())
      .filter(Boolean),
    domainAllowlist: (cfg.DOMAIN_ALLOWLIST ?? "")
      .split(",")
      .map((v) => v.trim().toLowerCase())
      .filter(Boolean),
    domainBlocklist: (cfg.DOMAIN_BLOCKLIST ?? "")
      .split(",")
      .map((v) => v.trim().toLowerCase())
      .filter(Boolean),
    allowedHosts: (cfg.ALLOWED_HOSTS ?? "")
      .split(",")
      .map((v) => v.trim().toLowerCase())
      .filter(Boolean),
    allowedOrigins: (cfg.ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean),
    mcpBasePath: normalizeBasePath(cfg.MCP_BASE_PATH),
  };
}
