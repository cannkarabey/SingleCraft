import { describe, expect, test } from "vitest";
import {
  compactNumber,
  relativeTime,
  signalLevel,
} from "@/lib/discover/format";

describe("signalLevel", () => {
  const base = { global_score: 50, is_early_signal: false, trust_score: 0.8 };
  test("high at global score 75+", () => {
    expect(signalLevel({ ...base, global_score: 75 })).toBe("high");
  });
  test("early signal", () => {
    expect(signalLevel({ ...base, is_early_signal: true })).toBe("early");
  });
  test("high wins over early", () => {
    expect(
      signalLevel({ ...base, global_score: 80, is_early_signal: true }),
    ).toBe("high");
  });
  test("low trust wins over everything", () => {
    expect(
      signalLevel({
        global_score: 90,
        is_early_signal: true,
        trust_score: 0.3,
      }),
    ).toBe("low");
  });
  test("unscored trust (0) is not low", () => {
    expect(signalLevel({ ...base, trust_score: 0 })).toBe("normal");
  });
  test("otherwise normal", () => {
    expect(signalLevel(base)).toBe("normal");
  });
});

describe("compactNumber", () => {
  test("small numbers stay as is", () => {
    expect(compactNumber(412, "en")).toBe("412");
  });
  test("thousands are compact", () => {
    expect(compactNumber(1200, "en")).toBe("1.2K");
  });
  test("null renders nothing", () => {
    expect(compactNumber(null, "en")).toBe("");
  });
});

describe("relativeTime", () => {
  const now = new Date("2026-11-02T12:00:00Z");
  const fmt = (
    locale: string,
    value: number,
    unit: Intl.RelativeTimeFormatUnit,
  ) =>
    new Intl.RelativeTimeFormat(locale, {
      style: "narrow",
      numeric: "always",
    }).format(value, unit);

  test("minutes under an hour", () => {
    expect(relativeTime("2026-11-02T11:30:00Z", now, "en")).toBe(
      fmt("en", -30, "minute"),
    );
  });
  test("hours under a day", () => {
    expect(relativeTime("2026-11-02T10:00:00Z", now, "en")).toBe(
      fmt("en", -2, "hour"),
    );
  });
  test("days after that", () => {
    expect(relativeTime("2026-10-30T12:00:00Z", now, "tr")).toBe(
      fmt("tr", -3, "day"),
    );
  });
  test("future or just now clamps to 0 minutes", () => {
    expect(relativeTime("2026-11-02T12:05:00Z", now, "en")).toBe(
      fmt("en", -0, "minute"),
    ); // "0m ago"
  });
});
