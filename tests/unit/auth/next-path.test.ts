import { describe, expect, test } from "vitest";
import { isGuestPath, isProtectedPath, safeNextPath } from "@/lib/auth/paths";

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
  test.each(["/settings", "/settings/account", "/admin"])(
    "%s needs a member account",
    (path) => expect(isProtectedPath(path)).toBe(true),
  );
  test.each([
    "/",
    "/discover",
    "/discover/x",
    "/login",
    "/auth/callback",
    "/radarx",
    "/radar",
    "/radar/settings",
    "/onboarding",
    "/studio",
    "/studio/new",
  ])("%s is not member-only", (path) =>
    expect(isProtectedPath(path)).toBe(false),
  );
});

describe("isGuestPath", () => {
  test.each(["/radar", "/onboarding", "/studio", "/studio/new", "/studio/abc"])(
    "%s opens with a guest session",
    (path) => expect(isGuestPath(path)).toBe(true),
  );
  test.each(["/settings", "/discover", "/studiox", "/"])(
    "%s does not",
    (path) => expect(isGuestPath(path)).toBe(false),
  );
});
