import { afterEach, expect, test } from "vitest";
import { authCallbackUrl } from "@/lib/auth/paths";

const original = process.env.NEXT_PUBLIC_APP_URL;
afterEach(() => {
  process.env.NEXT_PUBLIC_APP_URL = original;
});

// Review I7: the redirect origin comes from configuration, never from request headers.
test("builds the callback on the configured app URL", () => {
  process.env.NEXT_PUBLIC_APP_URL = "https://signalcraft.example";
  expect(authCallbackUrl("/radar?niche=1")).toBe(
    "https://signalcraft.example/auth/callback?next=%2Fradar%3Fniche%3D1",
  );
});

test("drops a trailing slash on the app URL", () => {
  process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3100/";
  expect(authCallbackUrl("/discover")).toBe(
    "http://localhost:3100/auth/callback?next=%2Fdiscover",
  );
});
