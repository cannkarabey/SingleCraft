import { describe, expect, test } from "vitest";
import {
  filterItem,
  type FilterInput,
  type FilterSource,
} from "@/lib/pipeline/filter";

const now = new Date("2026-11-02T12:00:00Z");
const editorial: FilterSource = {
  type: "rss",
  trust_weight: 0.9,
  config: { niche_specific: true },
};
const press: FilterSource = {
  type: "rss",
  trust_weight: 0.75,
  config: { niche_specific: false },
};
const hn: FilterSource = {
  type: "hn",
  trust_weight: 0.75,
  config: { niche_specific: false },
};

const item = (overrides: Partial<FilterInput> = {}): FilterInput => ({
  title: "Anthropic releases a new Claude model for developers",
  contentText:
    "The new model improves coding, tool use and long context reasoning, and ships today in the API.",
  publishedAt: new Date("2026-11-02T08:00:00Z"),
  language: "en",
  ...overrides,
});

describe("filterItem", () => {
  test("accepts a fresh, on-niche, long enough item", () => {
    expect(filterItem(item(), editorial, now)).toEqual({
      status: "accepted",
      category: "ai_models",
    });
  });

  test("rejects other languages", () => {
    expect(
      filterItem(item({ language: "other" }), editorial, now),
    ).toMatchObject({
      status: "rejected",
      reason: "language",
    });
  });

  test("unknown language passes", () => {
    expect(filterItem(item({ language: null }), editorial, now).status).toBe(
      "accepted",
    );
  });

  test("rejects items older than 7 days", () => {
    expect(
      filterItem(
        item({ publishedAt: new Date("2026-10-25T11:00:00Z") }),
        editorial,
        now,
      ),
    ).toMatchObject({ status: "rejected", reason: "stale" });
  });

  test("missing publishedAt is not stale", () => {
    expect(filterItem(item({ publishedAt: null }), editorial, now).status).toBe(
      "accepted",
    );
  });

  test("editorial items need 80 chars of title + content", () => {
    expect(
      filterItem(
        item({ title: "Claude update", contentText: "Short." }),
        editorial,
        now,
      ),
    ).toMatchObject({ status: "rejected", reason: "too_short" });
  });

  test("community items only need a 15-char title", () => {
    expect(
      filterItem(
        item({ title: "Show HN: Claude agent CLI", contentText: "" }),
        hn,
        now,
      ).status,
    ).toBe("accepted");
    expect(
      filterItem(item({ title: "AI agents", contentText: "" }), hn, now),
    ).toMatchObject({
      status: "rejected",
      reason: "too_short",
    });
  });

  test("rejects spam", () => {
    expect(
      filterItem(
        item({ title: "Free crypto airdrop for Claude developers today only" }),
        editorial,
        now,
      ),
    ).toMatchObject({ status: "rejected", reason: "spam" });
  });

  test.each([
    "Show HN: AirFlick Drop – AirDrop for Windows with zero mobile app installs",
    "Investors are betting on AI agents to replace legacy developer tools",
    "GitHub giveaway of free Copilot seats for open source maintainers",
  ])("does not flag ordinary tech headlines as spam: %s", (title) => {
    expect(filterItem(item({ title }), hn, now).status).toBe("accepted");
  });

  test.each([
    ["github", "v17.0.0", "Highlights: a new compiler and faster builds."],
    ["github", "vercel/next.js", "The React framework for the web"],
    [
      "producthunt",
      "Raycast AI",
      "Your AI assistant in every app on your Mac.",
    ],
  ] as const)(
    "%s items with short titles but a body are kept: %s",
    (type, title, contentText) => {
      expect(
        filterItem(
          item({ title, contentText }),
          { type, trust_weight: 0.8, config: {} },
          now,
        ).status,
      ).toBe("accepted");
    },
  );

  test("community items with neither title nor body are too short", () => {
    expect(
      filterItem(
        item({ title: "v1", contentText: "" }),
        { type: "github", trust_weight: 0.8, config: {} },
        now,
      ),
    ).toMatchObject({ status: "rejected", reason: "too_short" });
  });

  test("rejects low-trust sources", () => {
    expect(
      filterItem(item(), { ...editorial, trust_weight: 0.2 }, now),
    ).toMatchObject({
      status: "rejected",
      reason: "low_trust",
    });
  });

  test("general-purpose sources reject off-niche items", () => {
    expect(
      filterItem(
        item({
          title: "Senate passes new farm bill after long debate",
          contentText:
            "Lawmakers voted on agricultural subsidies late on Tuesday night in Washington.",
        }),
        press,
        now,
      ),
    ).toMatchObject({ status: "rejected", reason: "off_niche" });
  });

  test("niche-specific sources keep uncategorized items", () => {
    expect(
      filterItem(
        item({
          title: "Our team offsite recap and what we learned this year",
          contentText:
            "A look back at the people, the places and the plans we made for next year together.",
        }),
        editorial,
        now,
      ),
    ).toEqual({ status: "accepted", category: "other" });
  });
});
