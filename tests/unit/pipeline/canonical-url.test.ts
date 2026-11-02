import { describe, expect, test } from "vitest";
import { canonicalizeUrl } from "@/lib/pipeline/canonical-url";

describe("canonicalizeUrl", () => {
  test("lowercases host and strips www.", () => {
    expect(canonicalizeUrl("https://WWW.Example.COM/Post")).toBe(
      "https://example.com/Post",
    );
  });

  test("keeps path case", () => {
    expect(canonicalizeUrl("https://example.com/A/B")).toBe(
      "https://example.com/A/B",
    );
  });

  test("drops fragment", () => {
    expect(canonicalizeUrl("https://example.com/a#section")).toBe(
      "https://example.com/a",
    );
  });

  test("removes trailing slash except root", () => {
    expect(canonicalizeUrl("https://example.com/a/")).toBe(
      "https://example.com/a",
    );
    expect(canonicalizeUrl("https://example.com/")).toBe(
      "https://example.com/",
    );
  });

  test("removes tracking params", () => {
    expect(
      canonicalizeUrl(
        "https://example.com/a?utm_source=x&utm_medium=y&ref=hn&fbclid=1&gclid=2&mc_cid=3&mc_eid=4&id=7",
      ),
    ).toBe("https://example.com/a?id=7");
  });

  test("sorts remaining params", () => {
    expect(canonicalizeUrl("https://example.com/a?b=2&a=1")).toBe(
      "https://example.com/a?a=1&b=2",
    );
  });

  test("drops default port", () => {
    expect(canonicalizeUrl("https://example.com:443/a")).toBe(
      "https://example.com/a",
    );
  });

  test("keeps the scheme", () => {
    expect(canonicalizeUrl("http://example.com/a")).toBe(
      "http://example.com/a",
    );
  });

  test("throws on invalid url", () => {
    expect(() => canonicalizeUrl("not a url")).toThrow();
  });

  test("rejects non-http schemes", () => {
    expect(() => canonicalizeUrl("javascript:alert(1)")).toThrow();
  });
});
