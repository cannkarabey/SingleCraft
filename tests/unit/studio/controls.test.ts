import { describe, expect, test } from "vitest";
import { ControlsInput } from "@/lib/studio/controls";

const valid = {
  platform: "x",
  format: "thread",
  tone: "analytical",
  audience: "devs",
  length: "short",
  user_take: "My view",
};

describe("ControlsInput (Studio inputs, PDF §3.3)", () => {
  test("accepts every platform and format", () => {
    for (const platform of [
      "x",
      "linkedin",
      "youtube_shorts",
      "reels",
      "newsletter",
      "blog",
    ]) {
      expect(ControlsInput.safeParse({ ...valid, platform }).success).toBe(
        true,
      );
    }
    for (const format of [
      "thread",
      "post",
      "video_hook",
      "video_script",
      "newsletter_section",
      "blog_draft",
    ]) {
      expect(ControlsInput.safeParse({ ...valid, format }).success).toBe(true);
    }
  });

  test("optional fields may be omitted", () => {
    expect(
      ControlsInput.parse({ platform: "x", format: "thread", tone: "plain" }),
    ).toMatchObject({ platform: "x" });
  });

  test.each([
    { ...valid, platform: "myspace" },
    { ...valid, tone: "angry" },
    { ...valid, length: "epic" },
    { ...valid, user_take: "x".repeat(1001) },
    { ...valid, audience: "x".repeat(101) },
  ])("rejects %#", (bad) => {
    expect(ControlsInput.safeParse(bad).success).toBe(false);
  });
});
