import { expect, test } from "vitest";
import en from "@/messages/en.json";
import tr from "@/messages/tr.json";

function flatten(obj: object, prefix = ""): Record<string, unknown> {
  return Object.entries(obj).reduce<Record<string, unknown>>((acc, [k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object") Object.assign(acc, flatten(v, key));
    else acc[key] = v;
    return acc;
  }, {});
}

test("tr and en have identical keys", () => {
  expect(Object.keys(flatten(en)).sort()).toEqual(
    Object.keys(flatten(tr)).sort(),
  );
});

test("no message is empty", () => {
  for (const [key, value] of Object.entries({
    ...flatten(tr),
    ...flatten(en),
  })) {
    expect(typeof value === "string" && value.trim().length > 0, key).toBe(
      true,
    );
  }
});
