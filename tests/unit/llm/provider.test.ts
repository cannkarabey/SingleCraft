import { describe, expect, test } from "vitest";
import { estimateCostUsd, parseModelSpec } from "@/lib/llm/provider";

describe("parseModelSpec", () => {
  test("splits provider and model", () => {
    expect(parseModelSpec("google:gemini-flash-latest")).toEqual({
      provider: "google",
      model: "gemini-flash-latest",
    });
    expect(parseModelSpec("anthropic:claude-haiku-5-5")).toEqual({
      provider: "anthropic",
      model: "claude-haiku-5-5",
    });
  });

  test("keeps colons inside the model id", () => {
    expect(parseModelSpec("google:tunedModels/x:v1").model).toBe(
      "tunedModels/x:v1",
    );
  });

  test.each(["", "gemini-flash", "google:", ":model"])(
    "rejects malformed spec %j",
    (spec) => {
      expect(() => parseModelSpec(spec)).toThrow(/provider:model/);
    },
  );

  test("rejects unknown providers", () => {
    expect(() => parseModelSpec("acme:model")).toThrow(/acme/);
  });
});

describe("estimateCostUsd", () => {
  test("uses the conservative default price per million tokens", () => {
    expect(
      estimateCostUsd({ inputTokens: 1_000_000, outputTokens: 0 }),
    ).toBeCloseTo(3);
    expect(
      estimateCostUsd({ inputTokens: 0, outputTokens: 1_000_000 }),
    ).toBeCloseTo(15);
  });

  test("missing token counts cost nothing", () => {
    expect(estimateCostUsd({})).toBe(0);
  });
});
