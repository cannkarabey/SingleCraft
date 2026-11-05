import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { describe, expect, test } from "vitest";
import { config } from "@/proxy";

// Review I3: public, CDN-cacheable JSON must never pass through the session-refresh proxy,
// or a refreshed user's Set-Cookie could ride on a `public, s-maxage` response.
describe("proxy matcher", () => {
  test.each([
    "/api/discover",
    "/api/discover/some-story",
    "/api/categories",
    "/api/trending",
    "/api/email/webhook",
  ])("skips public API %s", (path) => {
    expect(
      unstable_doesMiddlewareMatch({ config, url: `http://localhost${path}` }),
    ).toBe(false);
  });

  test.each(["/", "/discover", "/radar", "/discover/some-story"])(
    "runs on page %s",
    (path) => {
      expect(
        unstable_doesMiddlewareMatch({
          config,
          url: `http://localhost${path}`,
        }),
      ).toBe(true);
    },
  );
});
