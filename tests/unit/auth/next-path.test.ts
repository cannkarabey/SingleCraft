import { describe, expect, test } from "vitest";
import { isProtectedPath, safeNextPath } from "@/lib/auth/paths";

describe("safeNextPath (no open redirects)", () => {
  test.each([
    ["/radar", "/radar"],
    ["/discover?category=ai_tools", "/discover?category=ai_tools"],
    ["/studio/new?story=abc#top", "/studio/new?story=abc#top"],
  ])("keeps same-origin path %s", (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });

  test.each([
    "https://evil.test",
    "//evil.test",
    "/\\evil.test",
    "javascript:alert(1)",
    "radar",
    "",
    null,
    undefined,
    "/" + "a".repeat(600),
    "/radar\nSet-Cookie: x",
  ])("falls back for %j", (input) => {
    expect(safeNextPath(input as string | null | undefined)).toBe("/radar");
  });

  test("custom fallback", () => {
    expect(safeNextPath("//x", "/")).toBe("/");
  });
});

describe("isProtectedPath", () => {
  test.each(["/radar", "/radar/settings", "/onboarding", "/studio", "/studio/new", "/settings/account"])(
    "%s needs a session",
    (path) => expect(isProtectedPath(path)).toBe(true),
  );
  test.each(["/", "/discover", "/discover/x", "/login", "/auth/callback", "/radarx"])("%s is public", (path) =>
    expect(isProtectedPath(path)).toBe(false),
  );
});
