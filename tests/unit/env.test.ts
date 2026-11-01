import { describe, expect, test } from "vitest";
import { parsePublicEnv, parseServerEnv } from "@/lib/env";

const publicEnv = {
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
};

describe("parsePublicEnv", () => {
  test("accepts valid values", () => {
    expect(parsePublicEnv(publicEnv).NEXT_PUBLIC_SUPABASE_URL).toBe(
      "http://127.0.0.1:54321",
    );
  });

  test("names the missing variable", () => {
    const withoutKey = {
      ...publicEnv,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: undefined,
    };
    expect(() => parsePublicEnv(withoutKey)).toThrow(
      /NEXT_PUBLIC_SUPABASE_ANON_KEY/,
    );
  });

  test("rejects a non-URL supabase url", () => {
    expect(() =>
      parsePublicEnv({ ...publicEnv, NEXT_PUBLIC_SUPABASE_URL: "nope" }),
    ).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });
});

describe("parseServerEnv", () => {
  const serverEnv = { ...publicEnv, SUPABASE_SERVICE_ROLE_KEY: "service" };

  test("applies numeric defaults", () => {
    const env = parseServerEnv(serverEnv);
    expect(env.LLM_DAILY_BUDGET_USD).toBe(1);
    expect(env.STORY_BUILD_TOP_N).toBe(30);
  });

  test("coerces numeric strings", () => {
    const env = parseServerEnv({
      ...serverEnv,
      LLM_DAILY_BUDGET_USD: "2.5",
      STORY_BUILD_TOP_N: "10",
    });
    expect(env.LLM_DAILY_BUDGET_USD).toBe(2.5);
    expect(env.STORY_BUILD_TOP_N).toBe(10);
  });

  test("rejects a negative budget", () => {
    expect(() =>
      parseServerEnv({ ...serverEnv, LLM_DAILY_BUDGET_USD: "-1" }),
    ).toThrow(/LLM_DAILY_BUDGET_USD/);
  });

  test("requires the service role key", () => {
    expect(() => parseServerEnv(publicEnv)).toThrow(
      /SUPABASE_SERVICE_ROLE_KEY/,
    );
  });

  test("treats empty strings as unset", () => {
    expect(
      parseServerEnv({ ...serverEnv, STORY_BUILD_TOP_N: "" }).STORY_BUILD_TOP_N,
    ).toBe(30);
  });
});
