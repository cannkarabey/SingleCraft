import { describe, expect, test } from "vitest";
import { MAX_RESPONSE_BYTES, request } from "@/lib/pipeline/fetchers/http";
import { fakeFetch } from "../../helpers/fixtures";

describe("request size cap", () => {
  test("rejects a declared content-length over the cap", async () => {
    const { impl } = fakeFetch(
      new Response("x", {
        headers: { "content-length": String(MAX_RESPONSE_BYTES + 1) },
      }),
    );
    await expect(request(impl, "https://x.test")).rejects.toThrow(/too large/i);
  });

  test("rejects a streamed body over the cap without content-length", async () => {
    const chunk = new Uint8Array(1024 * 1024);
    let sent = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (sent > MAX_RESPONSE_BYTES) return controller.close();
        sent += chunk.length;
        controller.enqueue(chunk);
      },
    });
    const { impl } = fakeFetch(new Response(stream));
    await expect(request(impl, "https://x.test")).rejects.toThrow(/too large/i);
  });

  test("small bodies pass through", async () => {
    const { impl } = fakeFetch(new Response("hello"));
    await expect(request(impl, "https://x.test")).resolves.toMatchObject({
      body: "hello",
    });
  });
});
