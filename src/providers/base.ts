import { request } from "undici";
import { AppError } from "../errors.js";
import { getProviderQueue } from "../ratelimit.js";

export async function requestJsonWithRetry<T>(
  provider: string,
  url: string,
  init: {
    method?: "GET" | "POST";
    headers?: Record<string, string>;
    body?: string;
  },
  retries = 2,
): Promise<T> {
  const queue = getProviderQueue(provider);
  let attempt = 0;
  let lastError: unknown;
  while (attempt <= retries) {
    try {
      return await (queue.add(async () => {
        const res = await request(url, {
          method: init.method ?? "GET",
          headers: init.headers,
          body: init.body,
          headersTimeout: 15_000,
          bodyTimeout: 15_000,
        });
        if (res.statusCode >= 400) {
          const body = await res.body.text();
          throw new AppError(
            `${provider} request failed: ${res.statusCode} ${body.slice(0, 500)}`,
            "provider_error",
            { statusCode: res.statusCode },
          );
        }
        return (await res.body.json()) as T;
      }) as Promise<T>);
    } catch (error) {
      lastError = error;
      if (attempt >= retries) break;
      await new Promise((resolve) => setTimeout(resolve, 2 ** attempt * 300));
    }
    attempt++;
  }
  throw lastError ?? new AppError(`${provider} request failed`, "provider_error", { provider });
}
