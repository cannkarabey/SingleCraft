export type FetchImpl = typeof fetch;

export const USER_AGENT =
  "SignalCraftBot/0.1 (+https://github.com/cannkarabey/SingleCraft)";
const TIMEOUT_MS = 15_000;
/** Largest body we read; real feeds are far smaller, this guards serverless memory. */
export const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;

export class HttpError extends Error {
  constructor(
    readonly status: number,
    url: string,
  ) {
    super(`HTTP ${status} for ${url}`);
  }
}

type RequestOptions = {
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: string;
  etag?: string | null;
  lastModified?: string | null;
};

export type HttpResult =
  | { notModified: true }
  | {
      notModified: false;
      body: string;
      etag: string | null;
      lastModified: string | null;
    };

/** GET/POST with our User-Agent, a timeout and optional conditional-request validators. */
export async function request(
  fetchImpl: FetchImpl,
  url: string,
  options: RequestOptions = {},
): Promise<HttpResult> {
  const headers: Record<string, string> = {
    "user-agent": USER_AGENT,
    ...options.headers,
  };
  if (options.etag) headers["if-none-match"] = options.etag;
  if (options.lastModified) headers["if-modified-since"] = options.lastModified;

  const response = await fetchImpl(url, {
    method: options.method ?? "GET",
    headers,
    body: options.body,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (response.status === 304) return { notModified: true };
  if (!response.ok) throw new HttpError(response.status, url);
  return {
    notModified: false,
    body: await readCapped(response, url),
    etag: response.headers.get("etag"),
    lastModified: response.headers.get("last-modified"),
  };
}

export async function requestJson<T>(
  fetchImpl: FetchImpl,
  url: string,
  options: Omit<RequestOptions, "etag" | "lastModified"> = {},
): Promise<T> {
  const result = await request(fetchImpl, url, {
    ...options,
    headers: { accept: "application/json", ...options.headers },
  });
  if (result.notModified) throw new Error(`Unexpected 304 for ${url}`);
  return JSON.parse(result.body) as T;
}

async function readCapped(response: Response, url: string): Promise<string> {
  const tooLarge = () =>
    new Error(`Response too large (> ${MAX_RESPONSE_BYTES} bytes) for ${url}`);
  if (Number(response.headers.get("content-length")) > MAX_RESPONSE_BYTES)
    throw tooLarge();
  if (!response.body) return "";

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw tooLarge();
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}
