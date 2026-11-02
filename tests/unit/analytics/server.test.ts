import { describe, expect, test, vi } from "vitest";
import { capture } from "@/lib/analytics/server";

const config = { key: "phc_test", host: "https://ph.test" };

describe("capture (plan §10)", () => {
  test("posts the event with the user id as distinct_id", async () => {
    const fetch = vi.fn(async () => new Response("{}"));
    await capture(
      { event: "brief_published", distinctId: "u1", properties: { a: 1 } },
      { config, fetch },
    );
    expect(fetch).toHaveBeenCalledOnce();
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://ph.test/i/v0/e/");
    expect(JSON.parse(init.body as string)).toMatchObject({
      api_key: "phc_test",
      event: "brief_published",
      distinct_id: "u1",
      properties: { a: 1, $lib: "signalcraft-server" },
    });
  });

  test("no-op without a key", async () => {
    const fetch = vi.fn();
    await capture(
      { event: "niche_created", distinctId: "u1" },
      { config: { key: undefined, host: config.host }, fetch },
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  test("never throws when PostHog fails", async () => {
    const fetch = vi.fn(async () => {
      throw new Error("down");
    });
    await expect(
      capture({ event: "story_saved", distinctId: "u1" }, { config, fetch }),
    ).resolves.toBeUndefined();
  });
});
