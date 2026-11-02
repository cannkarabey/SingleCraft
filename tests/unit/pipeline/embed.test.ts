import { describe, expect, test } from "vitest";
import { MockEmbeddingModelV4 } from "ai/test";
import { EMBEDDING_DIMENSIONS, embedTexts } from "@/lib/pipeline/embed";

const vector = (seed: number) =>
  Array.from({ length: 768 }, (_, i) => (i === seed ? 1 : 0));

function mockModel(dims = 768) {
  return new MockEmbeddingModelV4({
    maxEmbeddingsPerCall: 2,
    doEmbed: async ({ values }) => ({
      embeddings: values.map((v: string) =>
        dims === 768 ? vector(v.length % 768) : [1, 2, 3],
      ),
      usage: { tokens: values.length * 10 },
      warnings: [],
    }),
  });
}

describe("embedTexts", () => {
  test("returns one 768-dim vector per text, in order, batching as needed", async () => {
    const model = mockModel();
    const usage: number[] = [];
    const result = await embedTexts(["a", "bb", "ccc"], {
      model,
      onUsage: (tokens) => usage.push(tokens),
    });
    expect(EMBEDDING_DIMENSIONS).toBe(768);
    expect(result).toHaveLength(3);
    expect(result.map((v) => v.indexOf(1))).toEqual([1, 2, 3]);
    expect(model.doEmbedCalls).toHaveLength(2);
    expect(usage.reduce((a, b) => a + b, 0)).toBe(30);
  });

  test("requests 768 dimensions from the provider", async () => {
    const model = mockModel();
    await embedTexts(["a"], { model });
    expect(JSON.stringify(model.doEmbedCalls[0])).toContain("768");
  });

  test("rejects vectors of the wrong size", async () => {
    await expect(embedTexts(["a"], { model: mockModel(3) })).rejects.toThrow(
      /768/,
    );
  });

  test("no texts, no call", async () => {
    const model = mockModel();
    expect(await embedTexts([], { model })).toEqual([]);
    expect(model.doEmbedCalls).toHaveLength(0);
  });
});
