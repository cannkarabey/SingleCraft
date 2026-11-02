import { expect, test } from "vitest";
import { preCategory } from "@/lib/pipeline/categories";

test.each([
  ["Anthropic releases Claude model with longer context window", "ai_models"],
  ["New AI coding assistant plugin for VS Code", "ai_tools"],
  ["TypeScript 6.0 compiler gets faster type checking", "developer_tools"],
  ["Critical vulnerability found in OpenSSH, patch now", "security"],
  ["Startup raises $40M Series B to build GPU cloud", "startups"],
  [
    "React Server Components and CSS container queries explained",
    "web_frontend",
  ],
  ["Postgres 18 brings async IO to the database", "data_infra"],
  ["iOS 20 SwiftUI changes for Android developers too", "mobile"],
  [
    "Open source license change: project relicenses under Apache 2.0",
    "open_source",
  ],
  ["Senate passes new farm bill after long debate", "other"],
])("%s → %s", (text, category) => {
  expect(preCategory(text)).toBe(category);
});

test("matches whole words only", () => {
  expect(preCategory("A brainstorming session about the farm")).toBe("other");
});
