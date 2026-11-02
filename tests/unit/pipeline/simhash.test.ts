import { describe, expect, test } from "vitest";
import { hammingDistance, simhash } from "@/lib/pipeline/simhash";

const INT64_MIN = -(2n ** 63n);
const INT64_MAX = 2n ** 63n - 1n;

describe("simhash", () => {
  test("identical text has distance 0", () => {
    const text =
      "OpenAI releases a new agent SDK for developers building autonomous tools";
    expect(hammingDistance(simhash(text), simhash(text))).toBe(0);
  });

  test("fits a signed 64-bit integer", () => {
    for (const text of ["a b c", "Anthropic ships Claude", "x y z w v u t s"]) {
      const value = simhash(text);
      expect(value >= INT64_MIN && value <= INT64_MAX).toBe(true);
    }
  });

  test("empty text hashes to 0", () => {
    expect(simhash("")).toBe(0n);
    expect(simhash("   ")).toBe(0n);
  });

  test("ignores case and punctuation", () => {
    expect(simhash("OpenAI launches Agent SDK!")).toBe(
      simhash("openai launches agent sdk"),
    );
  });

  test("near-identical headlines are closer than unrelated ones", () => {
    const a = simhash(
      "OpenAI releases a new agent SDK for developers building autonomous tools today",
    );
    const b = simhash(
      "OpenAI releases a new agents SDK for developers building autonomous tools today",
    );
    const c = simhash(
      "Postgres 18 adds asynchronous IO and faster vacuum for large production databases",
    );
    expect(hammingDistance(a, b)).toBeLessThan(hammingDistance(a, c));
  });

  test("unrelated headlines are not near duplicates", () => {
    const pairs: [string, string][] = [
      [
        "Rust 2.0 roadmap published by the core team",
        "Apple unveils new MacBook Pro with M6 chip",
      ],
      [
        "Show HN: a tiny SQLite clone in Zig",
        "Stripe raises prices for international cards",
      ],
    ];
    for (const [x, y] of pairs)
      expect(hammingDistance(simhash(x), simhash(y))).toBeGreaterThan(3);
  });
});

describe("hammingDistance", () => {
  test("counts differing bits including the sign bit", () => {
    expect(hammingDistance(0n, 7n)).toBe(3);
    expect(hammingDistance(0n, -1n)).toBe(64);
  });
});
