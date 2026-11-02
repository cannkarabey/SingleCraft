import { describe, expect, test } from "vitest";
import {
  aiDisclosure,
  BriefOutput,
  LongPack,
  ShortPack,
  tweetLength,
} from "@/lib/studio/schema";

const shortPack = {
  hooks: Array.from({ length: 10 }, (_, i) => `Hook number ${i + 1}`),
  titles: ["Title A", "Title B", "Title C"],
  x_thread: ["1/ First tweet", "2/ Second tweet"],
  linkedin_post: "A LinkedIn post.",
  shorts_hooks: ["Hook one", "Hook two", "Hook three"],
  shorts_script: {
    hook: "Open strong",
    beats: ["Beat one", "Beat two"],
    cta: "Follow",
    duration_sec: 45,
  },
};
const longPack = {
  newsletter_section: "Newsletter paragraph.",
  blog_draft: "# Blog\n\nBody.",
};

describe("pack schemas (plan §6.2)", () => {
  test("valid packs parse", () => {
    expect(ShortPack.safeParse(shortPack).success).toBe(true);
    expect(LongPack.safeParse(longPack).success).toBe(true);
  });

  test.each([
    ["9 hooks", { ...shortPack, hooks: shortPack.hooks.slice(0, 9) }],
    ["2 titles", { ...shortPack, titles: ["a", "b"] }],
    ["tweet over 280", { ...shortPack, x_thread: ["x".repeat(281)] }],
    ["2 shorts hooks", { ...shortPack, shorts_hooks: ["a", "b"] }],
    [
      "10 s video",
      {
        ...shortPack,
        shorts_script: { ...shortPack.shorts_script, duration_sec: 10 },
      },
    ],
  ])("rejects %s", (_, bad) => {
    expect(ShortPack.safeParse(bad).success).toBe(false);
  });

  test("full output includes server-side sources and disclosure", () => {
    const parsed = BriefOutput.safeParse({
      ...shortPack,
      ...longPack,
      sources: [
        { title: "Original", url: "https://e.test/a", source: "Example" },
      ],
      ai_disclosure: aiDisclosure("en"),
    });
    expect(parsed.success).toBe(true);
  });
});

describe("aiDisclosure", () => {
  test("per language", () => {
    expect(aiDisclosure("tr")).toMatch(/yapay zek/i);
    expect(aiDisclosure("en")).toMatch(/AI/);
  });
});

describe("tweetLength", () => {
  test("counts characters, emoji as one code point", () => {
    expect(tweetLength("hello")).toBe(5);
    expect(tweetLength("hi 🚀")).toBe(4);
  });
  test("links count as 23 characters", () => {
    expect(tweetLength("see https://example.com/a/very/long/path?x=1")).toBe(
      4 + 23,
    );
  });
});
