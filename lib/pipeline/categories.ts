import type { Database } from "@/lib/supabase/types";

export type StoryCategory = Database["public"]["Enums"]["story_category"];

// Keyword dictionary for the rule-based pre-category (IMPLEMENTATION_PLAN §5.4).
// The LLM assigns the final category in Faz 3; this only needs to be roughly right
// and to tell on-niche from off-niche items for general-purpose sources.
const KEYWORDS: Record<Exclude<StoryCategory, "other">, string[]> = {
  ai_models: [
    "model",
    "models",
    "llm",
    "llms",
    "gpt",
    "claude",
    "gemini",
    "llama",
    "mistral",
    "deepseek",
    "qwen",
    "language model",
    "foundation model",
    "context window",
    "fine-tuning",
    "fine tuning",
    "benchmark",
    "reasoning",
    "multimodal",
    "weights",
    "training run",
  ],
  ai_tools: [
    "ai",
    "artificial intelligence",
    "yapay zeka",
    "ai tool",
    "ai coding",
    "copilot",
    "assistant",
    "chatbot",
    "agent",
    "agents",
    "agentic",
    "ai-powered",
    "ai powered",
    "cursor",
    "prompt",
  ],
  developer_tools: [
    "typescript",
    "javascript",
    "python",
    "rust",
    "golang",
    "compiler",
    "ide",
    "vs code",
    "vscode",
    "git",
    "github",
    "debugger",
    "cli",
    "sdk",
    "api",
    "framework",
    "npm",
    "type checking",
    "devtools",
    "linter",
    "programming language",
    "developer tool",
    "developer tools",
  ],
  open_source: [
    "open source",
    "open-source",
    "license",
    "licence",
    "relicense",
    "relicenses",
    "apache",
    "gpl",
    "foss",
    "open weights",
    "maintainer",
    "maintainers",
    "fork",
  ],
  startups: [
    "startup",
    "startups",
    "raises",
    "funding",
    "series a",
    "series b",
    "series c",
    "seed round",
    "acquires",
    "acquisition",
    "valuation",
    "ipo",
    "y combinator",
    "founder",
    "founders",
  ],
  security: [
    "security",
    "vulnerability",
    "vulnerabilities",
    "cve",
    "exploit",
    "breach",
    "malware",
    "ransomware",
    "zero-day",
    "zero day",
    "phishing",
    "backdoor",
    "openssh",
    "attack",
  ],
  web_frontend: [
    "react",
    "server components",
    "css",
    "html",
    "frontend",
    "front-end",
    "browser",
    "next.js",
    "nextjs",
    "vue",
    "svelte",
    "tailwind",
    "web components",
    "webassembly",
    "wasm",
    "container queries",
  ],
  mobile: [
    "ios",
    "android",
    "swift",
    "swiftui",
    "kotlin",
    "react native",
    "flutter",
    "iphone",
    "app store",
    "play store",
    "mobile",
  ],
  data_infra: [
    "postgres",
    "postgresql",
    "database",
    "databases",
    "sql",
    "sqlite",
    "kubernetes",
    "docker",
    "gpu",
    "gpus",
    "cloud",
    "data center",
    "datacenter",
    "infrastructure",
    "kafka",
    "redis",
    "data warehouse",
    "vector database",
  ],
};

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const MATCHERS = Object.entries(KEYWORDS).map(([category, terms]) => ({
  category: category as StoryCategory,
  patterns: terms.map(
    (term) =>
      new RegExp(
        `(?<![\\p{L}\\p{N}])${escapeRegex(term)}(?![\\p{L}\\p{N}])`,
        "iu",
      ),
  ),
}));

/** Category with the most keyword hits; ties go to the earlier category; no hits → "other". */
export function preCategory(text: string): StoryCategory {
  let best: StoryCategory = "other";
  let bestHits = 0;
  for (const { category, patterns } of MATCHERS) {
    const hits = patterns.filter((pattern) => pattern.test(text)).length;
    if (hits > bestHits) {
      best = category;
      bestHits = hits;
    }
  }
  return best;
}
