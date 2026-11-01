import { describe, expect, test } from "vitest";
import { DEFAULT_LOCALE, resolveLocale } from "@/lib/i18n/config";

describe("resolveLocale", () => {
  test("defaults to tr", () => {
    expect(DEFAULT_LOCALE).toBe("tr");
    expect(resolveLocale({})).toBe("tr");
  });

  test("valid cookie wins over accept-language", () => {
    expect(resolveLocale({ cookie: "en", acceptLanguage: "tr-TR" })).toBe("en");
  });

  test("invalid cookie is ignored", () => {
    expect(resolveLocale({ cookie: "de", acceptLanguage: "en-US" })).toBe("en");
  });

  test("uses primary subtag of accept-language", () => {
    expect(resolveLocale({ acceptLanguage: "en-US,en;q=0.9" })).toBe("en");
  });

  test("respects q-values", () => {
    expect(resolveLocale({ acceptLanguage: "tr;q=0.5,en;q=0.8" })).toBe("en");
  });

  test("skips unsupported languages", () => {
    expect(resolveLocale({ acceptLanguage: "de-DE,en;q=0.3" })).toBe("en");
    expect(resolveLocale({ acceptLanguage: "fr,de" })).toBe("tr");
  });
});
