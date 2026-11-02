import { beforeEach, describe, expect, test } from "vitest";
import {
  signUnsubscribe,
  unsubscribeUrl,
  verifyUnsubscribe,
} from "@/lib/email/unsubscribe";

beforeEach(() => {
  process.env.EMAIL_UNSUBSCRIBE_SECRET = "test-secret";
});

describe("unsubscribe tokens", () => {
  const user = "11111111-1111-1111-1111-111111111111";

  test("a signed token verifies for the same user and list", () => {
    expect(
      verifyUnsubscribe(user, "digest", signUnsubscribe(user, "digest")),
    ).toBe(true);
  });

  test("tokens are bound to user and list", () => {
    const token = signUnsubscribe(user, "digest");
    expect(verifyUnsubscribe(user, "alerts", token)).toBe(false);
    expect(
      verifyUnsubscribe(
        "22222222-2222-2222-2222-222222222222",
        "digest",
        token,
      ),
    ).toBe(false);
    expect(verifyUnsubscribe(user, "digest", "nope")).toBe(false);
    expect(verifyUnsubscribe(user, "digest", "")).toBe(false);
  });

  test("a different secret invalidates old tokens", () => {
    const token = signUnsubscribe(user, "digest");
    process.env.EMAIL_UNSUBSCRIBE_SECRET = "rotated";
    expect(verifyUnsubscribe(user, "digest", token)).toBe(false);
  });

  test("URL carries user, list and token", () => {
    const url = new URL(unsubscribeUrl("https://app.test", user, "alerts"));
    expect(url.origin + url.pathname).toBe(
      "https://app.test/api/email/unsubscribe",
    );
    expect(url.searchParams.get("u")).toBe(user);
    expect(url.searchParams.get("list")).toBe("alerts");
    expect(verifyUnsubscribe(user, "alerts", url.searchParams.get("t")!)).toBe(
      true,
    );
  });
});
