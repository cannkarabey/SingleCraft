import { createHash } from "node:crypto";
import { describe, expect, test } from "vitest";
import {
  contentHash,
  normalizeTitle,
  stripHtml,
  truncate,
} from "@/lib/pipeline/text";

describe("stripHtml", () => {
  test("removes tags and collapses whitespace", () => {
    expect(stripHtml("<p>Hello <b>world</b></p>\n\n<p>again</p>")).toBe(
      "Hello world again",
    );
  });

  test("decodes entities", () => {
    expect(
      stripHtml(
        "Tom &amp; Jerry&#39;s &#x27;show&#x27;&nbsp;now &lt;3 &quot;ok&quot;",
      ),
    ).toBe("Tom & Jerry's 'show' now <3 \"ok\"");
  });

  test("drops script and style content", () => {
    expect(stripHtml("a<script>alert(1)</script>b<style>p{}</style>c")).toBe(
      "abc",
    );
  });

  test("handles empty input", () => {
    expect(stripHtml(undefined)).toBe("");
    expect(stripHtml("")).toBe("");
  });
});

describe("normalizeTitle", () => {
  test("lowercases, strips punctuation, collapses spaces", () => {
    expect(normalizeTitle("  OpenAI   launches: Agent-SDK!! ")).toBe(
      "openai launches agent sdk",
    );
  });

  test("keeps Turkish letters", () => {
    expect(normalizeTitle("Yapay Zekâ Gündemi: Şubat")).toBe(
      "yapay zekâ gündemi şubat",
    );
  });
});

describe("contentHash", () => {
  test("is sha256 of normalized title + first 500 chars", () => {
    const body = "x".repeat(600);
    const expected = createHash("sha256")
      .update("hello world" + "x".repeat(500))
      .digest("hex");
    expect(contentHash("Hello, World!", body)).toBe(expected);
  });

  test("ignores title punctuation differences", () => {
    expect(contentHash("Hello world", "body")).toBe(
      contentHash("Hello, world!", "body"),
    );
  });
});

describe("truncate", () => {
  test("cuts to max length", () => {
    expect(truncate("abcdef", 4)).toBe("abcd");
    expect(truncate("abc", 4)).toBe("abc");
  });
});
