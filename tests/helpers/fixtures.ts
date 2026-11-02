import { readFileSync } from "node:fs";
import { join } from "node:path";

export function fixture(path: string): string {
  return readFileSync(join(process.cwd(), "tests/fixtures", path), "utf8");
}

export type RecordedRequest = { url: string; init?: RequestInit };

/** fetch stand-in that serves canned responses in order and records every request. */
export function fakeFetch(...responses: Response[]) {
  const requests: RecordedRequest[] = [];
  const impl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    requests.push({ url: String(input), init });
    const next = responses.shift();
    if (!next) throw new Error(`unexpected request: ${String(input)}`);
    return next;
  }) as typeof fetch;
  return { impl, requests };
}
