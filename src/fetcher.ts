import dns from "node:dns/promises";
import { Readable } from "node:stream";
import { createBrotliDecompress, createGunzip, createInflate } from "node:zlib";
import { URL } from "node:url";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import TurndownService from "turndown";
import { Agent, request, setGlobalDispatcher } from "undici";
import { franc } from "franc";
import Parser from "rss-parser";
import { YoutubeTranscript } from "youtube-transcript";
import { AppConfig } from "./config.js";
import { AppError } from "./errors.js";
import { sanitizeUntrustedText, wrapUntrustedContent } from "./injection.js";
import { withHostConcurrency } from "./ratelimit.js";

const BLOCKED_IPV4 = [
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
];

const BLOCKED_IPV6 = [/^::1$/, /^fc/i, /^fd/i, /^fe80:/i];

const turndown = new TurndownService({ headingStyle: "atx" });

const fetchAgent = new Agent({
  connect: {
    timeout: 15_000,
  },
  keepAliveTimeout: 30_000,
  keepAliveMaxTimeout: 60_000,
  connections: 32,
});
setGlobalDispatcher(fetchAgent);
const robotsCache = new Map<string, { allowed: boolean; expiresAt: number }>();
let playwrightBrowser: {
  close: () => Promise<void>;
  newPage: () => Promise<{
    goto: (url: string, opts: { waitUntil: "networkidle"; timeout: number }) => Promise<unknown>;
    content: () => Promise<string>;
    close: () => Promise<void>;
  }>;
} | null = null;

type ConditionalHeaders = {
  etag?: string;
  lastModified?: string;
};

type FetchAndExtractOptions = {
  conditional?: ConditionalHeaders;
  language?: string;
  pages?: number[];
  cachedData?: FetchExtractResult;
};

export type FetchExtractResult = {
  url: string;
  canonicalUrl: string;
  title: string;
  content: string;
  format: "markdown" | "text";
  truncated: boolean;
  warnings: string[];
  contentType: string;
  lang?: string;
  archived?: boolean;
  paywalled?: boolean;
  etag?: string;
  lastModified?: string;
};

function isPrivateAddress(address: string): boolean {
  if (address.includes(":")) {
    return BLOCKED_IPV6.some((re) => re.test(address));
  }
  return BLOCKED_IPV4.some((re) => re.test(address));
}

function hostMatchesDomain(host: string, domain: string): boolean {
  const normalized = domain.replace(/^\*\./, "");
  return host === normalized || host.endsWith(`.${normalized}`);
}

async function assertSafeUrl(url: URL, allowlist: string[], blocklist: string[]): Promise<void> {
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new AppError("Only http(s) URLs are allowed", "security_error");
  }

  const host = url.hostname.toLowerCase();
  if (blocklist.some((domain) => hostMatchesDomain(host, domain))) {
    throw new AppError(`Domain ${host} is blocked`, "security_error");
  }

  if (allowlist.length > 0) {
    const allowed = allowlist.some((domain) => hostMatchesDomain(host, domain));
    if (!allowed) {
      throw new AppError(`Domain ${host} not in allowlist`, "security_error");
    }
  }

  const records = await dns.lookup(url.hostname, { all: true });
  for (const record of records) {
    if (isPrivateAddress(record.address)) {
      throw new AppError("Target resolves to a private address", "security_error");
    }
  }
}

async function robotsAllows(url: URL): Promise<boolean> {
  const cacheKey = `${url.protocol}//${url.host}`;
  const cached = robotsCache.get(cacheKey);
  const now = Date.now();
  if (cached && cached.expiresAt > now) return cached.allowed;
  try {
    const robotsUrl = new URL("/robots.txt", `${url.protocol}//${url.host}`);
    const res = await request(robotsUrl.toString(), {
      headersTimeout: 5_000,
      bodyTimeout: 5_000,
    });
    if (res.statusCode >= 400) return true;
    const text = await res.body.text();
    const lines = text.split("\n").map((l) => l.trim().toLowerCase());
    let applies = false;
    const disallow: string[] = [];
    for (const line of lines) {
      if (line.startsWith("user-agent:")) {
        const ua = line.slice("user-agent:".length).trim();
        applies = ua === "*" || ua.includes("web-search-mcp");
      } else if (applies && line.startsWith("disallow:")) {
        disallow.push(line.slice("disallow:".length).trim());
      }
    }
    const allowed = !disallow.some((path) => path && url.pathname.startsWith(path));
    robotsCache.set(cacheKey, { allowed, expiresAt: now + 60 * 60 * 1000 });
    return allowed;
  } catch {
    robotsCache.set(cacheKey, { allowed: true, expiresAt: now + 5 * 60 * 1000 });
    return true;
  }
}

function stripDangerousDom(document: Document): void {
  for (const selector of [
    "script",
    "style",
    "iframe",
    "object",
    "embed",
    "form",
    "nav",
    "footer",
    "aside",
  ]) {
    document.querySelectorAll(selector).forEach((n) => n.remove());
  }
  document.querySelectorAll("a[href]").forEach((a) => {
    const href = a.getAttribute("href") ?? "";
    if (/^\s*javascript:/i.test(href)) a.removeAttribute("href");
  });
  document.querySelectorAll("img[src]").forEach((img) => {
    const src = img.getAttribute("src") ?? "";
    if (/^\s*data:/i.test(src)) img.removeAttribute("src");
  });
}

function isYouTubeUrl(url: URL): boolean {
  return /(^|\.)youtube\.com$/.test(url.hostname) || url.hostname === "youtu.be";
}

async function extractYouTube(
  url: URL,
  language?: string,
): Promise<{ title: string; content: string }> {
  const transcript = await YoutubeTranscript.fetchTranscript(url.toString(), {
    lang: language,
  });
  const content = transcript
    .map((t) => {
      const sec = Math.floor(t.offset / 1000);
      const mm = String(Math.floor(sec / 60)).padStart(2, "0");
      const ss = String(sec % 60).padStart(2, "0");
      return `[${mm}:${ss}] ${t.text}`;
    })
    .join("\n");
  return {
    title: "YouTube Transcript",
    content,
  };
}

async function extractPdf(buffer: Buffer, pages?: number[]): Promise<string> {
  const pdfParseMod = await import("pdf-parse");
  const parse = (pdfParseMod.default ?? pdfParseMod) as (
    buf: Buffer,
    options?: { pagerender?: (pageData: unknown) => Promise<string> },
  ) => Promise<{
    text: string;
    numpages?: number;
  }>;
  if (!pages?.length) {
    const parsed = await parse(buffer);
    return parsed.text;
  }
  // pdf-parse doesn't expose direct page filtering, so we parse full text first.
  // The caller-provided page list is best-effort metadata for downstream consumers.
  const parsed = await parse(buffer);
  return parsed.text;
}

async function extractRss(xml: string): Promise<string> {
  const parser = new Parser();
  const feed = await parser.parseString(xml);
  return (feed.items ?? [])
    .slice(0, 20)
    .map((item) => `- ${item.title ?? "Untitled"}\n  ${item.link ?? ""}`)
    .join("\n");
}

async function maybeRenderWithPlaywright(url: string): Promise<string | null> {
  try {
    const playwright = await import("playwright-core");
    if (!playwrightBrowser) {
      playwrightBrowser = await playwright.chromium.launch({ headless: true });
    }
    const browser = playwrightBrowser;
    if (!browser) return null;
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "networkidle", timeout: 15_000 });
    const html = await page.content();
    await page.close();
    return html;
  } catch {
    return null;
  }
}

async function maybeFetchFromArchive(
  url: URL,
  maxBytes: number,
): Promise<{ body: string; contentType: string } | null> {
  const archiveUrl = `https://web.archive.org/web/${url.toString()}`;
  try {
    const res = await request(archiveUrl, {
      headersTimeout: 15_000,
      bodyTimeout: 15_000,
    });
    if (res.statusCode >= 400) return null;
    const body = await readBodyLimited(
      decodeByContentEncoding(res.body, res.headers["content-encoding"]),
      maxBytes,
    );
    const contentType = String(res.headers["content-type"] ?? "text/html").toLowerCase();
    return { body, contentType };
  } catch {
    return null;
  }
}

function parseContentEncoding(header: string | string[] | undefined): string[] {
  if (!header) return [];
  const value = Array.isArray(header) ? header.join(",") : header;
  return value
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter((part) => part.length > 0 && part !== "identity");
}

function decodeByContentEncoding(
  body: AsyncIterable<Uint8Array> | null,
  encodingHeader: string | string[] | undefined,
): AsyncIterable<Uint8Array> | null {
  if (!body) return null;
  const encodings = parseContentEncoding(encodingHeader);
  if (!encodings.length) return body;

  let stream = Readable.from(body);
  for (const encoding of encodings.reverse()) {
    if (encoding === "gzip" || encoding === "x-gzip") {
      stream = stream.pipe(createGunzip());
      continue;
    }
    if (encoding === "deflate") {
      stream = stream.pipe(createInflate());
      continue;
    }
    if (encoding === "br") {
      stream = stream.pipe(createBrotliDecompress());
      continue;
    }
    throw new AppError(`Unsupported content encoding: ${encoding}`, "fetch_error");
  }
  return stream;
}

async function readBodyLimited(
  body: AsyncIterable<Uint8Array> | null,
  maxBytes: number,
): Promise<string> {
  const bytes = await readBufferLimited(body, maxBytes);
  return bytes.toString("utf-8");
}

async function readBufferLimited(
  body: AsyncIterable<Uint8Array> | null,
  maxBytes: number,
): Promise<Buffer> {
  if (!body) return Buffer.alloc(0);
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of body) {
    const b = Buffer.from(chunk);
    total += b.length;
    if (total > maxBytes) {
      throw new AppError(`Response exceeded max size ${maxBytes} bytes`, "fetch_error");
    }
    chunks.push(b);
  }
  return Buffer.concat(chunks);
}

export async function fetchAndExtract(
  rawUrl: string,
  config: AppConfig,
  maxChars = 12_000,
  format: "markdown" | "text" = "markdown",
  options: FetchAndExtractOptions = {},
): Promise<FetchExtractResult> {
  const { conditional, language, pages, cachedData } = options;
  const url = new URL(rawUrl);
  await assertSafeUrl(url, config.domainAllowlist, config.domainBlocklist);
  if (config.RESPECT_ROBOTS && !(await robotsAllows(url))) {
    throw new AppError("Blocked by robots.txt policy", "security_error");
  }

  return withHostConcurrency(url.hostname, async () => {
    if (isYouTubeUrl(url)) {
      const yt = await extractYouTube(url, language);
      const scan = sanitizeUntrustedText(yt.content);
      const wrapped = wrapUntrustedContent(rawUrl, scan.sanitized);
      const content = wrapped.slice(0, maxChars);
      return {
        url: rawUrl,
        canonicalUrl: url.toString(),
        title: yt.title,
        content,
        format,
        truncated: wrapped.length > content.length,
        warnings: scan.warnings,
        contentType: "text/youtube-transcript",
      };
    }

    const headers: Record<string, string> = {
      "user-agent": "web-search-mcp/0.1 (+https://github.com/)",
      accept: "text/html,application/xhtml+xml,application/pdf,application/xml;q=0.9",
      "accept-encoding": "gzip, deflate, br",
    };
    if (conditional?.etag) headers["if-none-match"] = conditional.etag;
    if (conditional?.lastModified) headers["if-modified-since"] = conditional.lastModified;

    const res = await request(url.toString(), {
      headers,
      headersTimeout: config.FETCH_HEADERS_TIMEOUT_MS,
      bodyTimeout: config.FETCH_BODY_TIMEOUT_MS,
    });

    let archived = false;
    let rawBody = "";
    let contentType = "text/plain";

    if (res.statusCode === 304) {
      if (cachedData) return cachedData;
      throw new AppError("Received 304 but no cache entry exists", "fetch_error", {
        statusCode: 304,
      });
    }

    if ([403, 404, 429, 502, 503, 504].includes(res.statusCode)) {
      const archiveBody = await maybeFetchFromArchive(url, config.FETCH_MAX_BODY_BYTES);
      if (archiveBody?.body) {
        rawBody = archiveBody.body;
        contentType = archiveBody.contentType;
        archived = true;
      } else {
        throw new AppError(`Could not fetch URL: ${res.statusCode}`, "fetch_error", {
          statusCode: res.statusCode,
        });
      }
    }

    if (!rawBody && res.statusCode >= 400) {
      throw new AppError(`Could not fetch URL: ${res.statusCode}`, "fetch_error", {
        statusCode: res.statusCode,
      });
    }

    if (!archived) {
      const contentTypeHeader = res.headers["content-type"];
      contentType =
        (Array.isArray(contentTypeHeader)
          ? contentTypeHeader[0]
          : contentTypeHeader
        )?.toLowerCase() ?? "text/plain";
      const contentLengthHeader = res.headers["content-length"];
      const contentLength = Number(
        Array.isArray(contentLengthHeader) ? contentLengthHeader[0] : contentLengthHeader,
      );
      const hasCompressedEncoding = parseContentEncoding(res.headers["content-encoding"]).length > 0;
      if (
        !hasCompressedEncoding &&
        Number.isFinite(contentLength) &&
        contentLength > config.FETCH_MAX_BODY_BYTES
      ) {
        throw new AppError(
          `Response exceeds max size ${config.FETCH_MAX_BODY_BYTES} bytes`,
          "fetch_error",
        );
      }
    }
    const decodedBody = archived
      ? null
      : decodeByContentEncoding(res.body, res.headers["content-encoding"]);
    const etag = res.headers.etag;
    const lastModified = res.headers["last-modified"];

    let extracted = "";
    let title = url.toString();
    const warnings: string[] = [];

    if (!rawBody && contentType.includes("application/pdf")) {
      const bytes = await readBufferLimited(decodedBody, config.FETCH_MAX_BODY_BYTES);
      extracted = await extractPdf(bytes, pages);
      title = "PDF Document";
    } else if (
      !rawBody &&
      (contentType.includes("application/rss+xml") || contentType.includes("application/atom+xml"))
    ) {
      rawBody = await readBodyLimited(decodedBody, config.FETCH_MAX_BODY_BYTES);
      extracted = await extractRss(rawBody);
      title = "RSS Feed";
    } else {
      if (!rawBody) rawBody = await readBodyLimited(decodedBody, config.FETCH_MAX_BODY_BYTES);
      let html = rawBody;
      const dom = new JSDOM(html, { url: url.toString() });
      const doc = dom.window.document;
      stripDangerousDom(doc);
      const readable = new Readability(doc).parse();
      title = readable?.title ?? doc.title ?? title;
      extracted = readable?.textContent?.trim() ?? "";
      if (!extracted || extracted.length < 200) {
        if (config.JS_RENDER) {
          const rendered = await maybeRenderWithPlaywright(url.toString());
          if (rendered) {
            html = rendered;
            const renderedDom = new JSDOM(html, { url: url.toString() });
            const renderedDoc = renderedDom.window.document;
            stripDangerousDom(renderedDoc);
            const renderedReadable = new Readability(renderedDoc).parse();
            extracted = renderedReadable?.textContent?.trim() ?? extracted;
            title = renderedReadable?.title ?? title;
          }
        }
        if (!extracted) {
          extracted = doc.body?.textContent?.replace(/\s+/g, " ").trim() ?? "";
        }
      }
      if (format === "markdown") {
        extracted = turndown.turndown(extracted);
      }
    }

    const scan = sanitizeUntrustedText(extracted);
    warnings.push(...scan.warnings);
    const wrapped = wrapUntrustedContent(url.toString(), scan.sanitized);
    const content = wrapped.slice(0, maxChars);
    const truncated = wrapped.length > content.length;
    const lang = franc(scan.sanitized.slice(0, 1500), { minLength: 30 });
    const paywalled = /(nytimes|wsj|ft\.com|bloomberg)/i.test(url.hostname);

    return {
      url: rawUrl,
      canonicalUrl: url.toString(),
      title,
      content,
      format,
      truncated,
      warnings,
      contentType,
      lang: lang === "und" ? undefined : lang,
      archived,
      paywalled,
      etag: typeof etag === "string" ? etag : undefined,
      lastModified: typeof lastModified === "string" ? lastModified : undefined,
    };
  });
}

export async function closeFetcherResources(): Promise<void> {
  if (!playwrightBrowser) return;
  try {
    await (playwrightBrowser as { close: () => Promise<void> }).close();
  } catch {
    // Best effort cleanup.
  } finally {
    playwrightBrowser = null;
  }
}
