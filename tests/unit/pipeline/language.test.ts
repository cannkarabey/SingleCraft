import { expect, test } from "vitest";
import { detectLanguage } from "@/lib/pipeline/language";

test("detects English", () => {
  expect(
    detectLanguage(
      "OpenAI released a new software development kit that lets developers build autonomous agents with tool use.",
    ),
  ).toBe("en");
});

test("detects Turkish", () => {
  expect(
    detectLanguage(
      "Yapay zeka şirketi bugün geliştiriciler için yeni bir yazılım geliştirme kiti yayınladığını duyurdu.",
    ),
  ).toBe("tr");
});

test("flags other languages", () => {
  expect(
    detectLanguage(
      "Das Unternehmen hat heute ein neues Entwicklungspaket für Programmierer veröffentlicht, das sehr nützlich ist.",
    ),
  ).toBe("other");
});

test("returns null when text is too short to tell", () => {
  expect(detectLanguage("Show HN: Zig SQLite")).toBeNull();
});

test.each([
  "DiffusionGemma: 4x faster text generation",
  "Build with Nano Banana Pro, our Gemini 3 Pro Image model",
])(
  "short product titles are never flagged as another language: %s",
  (title) => {
    expect(detectLanguage(title)).not.toBe("other");
  },
);
