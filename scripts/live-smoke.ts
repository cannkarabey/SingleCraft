// Live ingestion smoke test against the REAL sources and the Gemini free tier, sized to
// small quotas. Each stage asserts invariants on real data and prints what a human should
// eyeball. Run one stage at a time:
//   npm run smoke:live -- preflight | fetch | process | cluster | build | all
import { embedDeps, pipelineDeps, storyBuildDeps } from "@/inngest/deps";
import { getEmbeddingModel, getLanguageModel } from "@/lib/llm/provider";
import { generateText } from "ai";
import { embedTexts } from "@/lib/pipeline/embed";
import {
  ingestSource,
  processItems,
  refreshHnMetrics,
} from "@/lib/pipeline/ingest";
import {
  buildStories,
  clusterItems,
  scoreStories,
} from "@/lib/pipeline/stories";
import { allPendingItemIds, dueSourceIds } from "@/lib/pipeline/store";

const EMBED_ITEMS = Number(process.env.SMOKE_EMBED_ITEMS ?? 80);
const CATEGORIES = new Set([
  "ai_models",
  "ai_tools",
  "developer_tools",
  "open_source",
  "startups",
  "security",
  "web_frontend",
  "mobile",
  "data_infra",
  "other",
]);

let failures = 0;
function check(ok: boolean, what: string, detail = "") {
  console.log(`${ok ? "  ✓" : "  ✗"} ${what}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}
const db = () => pipelineDeps().db;

/** PostgREST returns at most 1000 rows per request; read every page. */
async function readAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await page(from, from + 999);
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) return rows;
  }
}

async function preflight() {
  console.log("\n[preflight] credentials and quotas (a handful of tiny calls)");
  const gh = process.env.GITHUB_TOKEN;
  if (!gh) console.log("  - GITHUB_TOKEN not set: GitHub runs at 60 req/h");
  else {
    const res = await fetch("https://api.github.com/rate_limit", {
      headers: { authorization: `Bearer ${gh}`, "user-agent": "signalcraft" },
    });
    const body = (await res.json()) as {
      resources?: { core?: { limit: number; remaining: number } };
    };
    check(
      res.ok && (body.resources?.core?.limit ?? 0) >= 5000,
      "GitHub token valid",
      `core ${body.resources?.core?.remaining}/${body.resources?.core?.limit}`,
    );
  }

  const ph = process.env.PRODUCTHUNT_TOKEN;
  if (!ph) console.log("  - PRODUCTHUNT_TOKEN empty: Product Hunt is skipped");
  else {
    const res = await fetch("https://api.producthunt.com/v2/api/graphql", {
      method: "POST",
      headers: {
        authorization: `Bearer ${ph}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        query: "{ posts(first: 1) { edges { node { name } } } }",
      }),
    });
    check(res.ok, "Product Hunt token valid", `HTTP ${res.status}`);
  }

  const llm = getLanguageModel("story");
  const { text } = await generateText({
    model: llm.model,
    prompt: "Reply with the single word: ready",
    maxOutputTokens: 16,
  });
  check(/ready/i.test(text), `story model answers (${llm.id})`, text.trim());

  const emb = getEmbeddingModel();
  const vectors = await embedTexts(["hello", "world"], { model: emb.model });
  check(
    vectors.length === 2 && vectors[0].length === 768,
    `embedding model gives 768 dims (${emb.id})`,
  );
}

async function fetchStage() {
  console.log("\n[fetch] real sources, one pass (HTTP only, no LLM)");
  const due = await dueSourceIds(db());
  console.log(`  due sources: ${due.length}`);
  const results = [];
  for (let i = 0; i < due.length; i += 4) {
    results.push(
      ...(await Promise.all(
        due.slice(i, i + 4).map((id) => ingestSource(id, pipelineDeps())),
      )),
    );
  }
  const { data: sources } = await db().from("sources").select("id, name, type");
  const info = new Map((sources ?? []).map((s) => [s.id, s]));
  const byType = new Map<
    string,
    { ok: number; items: number; failed: number }
  >();
  for (const r of results) {
    const t = info.get(r.sourceId)?.type ?? "?";
    const row = byType.get(t) ?? { ok: 0, items: 0, failed: 0 };
    if (r.error) row.failed++;
    else row.ok++;
    row.items += r.inserted.length;
    byType.set(t, row);
  }
  for (const [t, v] of [...byType].sort())
    console.log(
      `  ${t.padEnd(12)} sources ok ${v.ok}, failed ${v.failed}, new items ${v.items}`,
    );
  for (const r of results.filter((x) => x.error))
    console.log(
      `  ✗ ${info.get(r.sourceId)?.name}: ${String(r.error).slice(0, 110)}`,
    );

  const total = results.reduce((n, r) => n + r.inserted.length, 0);
  check(total > 0, "items were fetched", `${total} new raw_items`);
  check(
    (byType.get("hn")?.items ?? 0) > 0 && (byType.get("rss")?.items ?? 0) > 0,
    "Hacker News and RSS both delivered items",
  );
  check(
    (byType.get("github")?.items ?? 0) > 0,
    "GitHub delivered items (token works end to end)",
  );

  // Idempotency on live data: fetching the same sources again must not duplicate rows.
  const again = results
    .filter((r) => !r.error && r.inserted.length > 0)
    .slice(0, 3);
  const before = (
    await db().from("raw_items").select("id", { count: "exact", head: true })
  ).count;
  for (const r of again) await ingestSource(r.sourceId, pipelineDeps());
  const after = (
    await db().from("raw_items").select("id", { count: "exact", head: true })
  ).count;
  check(
    (after ?? 0) - (before ?? 0) <= 3,
    "re-fetching adds no duplicates",
    `+${(after ?? 0) - (before ?? 0)} rows`,
  );
}

async function processStage() {
  console.log("\n[process] dedupe + rule filter on the fetched items");
  const pending = await allPendingItemIds(db());
  const res = await processItems(pending, pipelineDeps());
  console.log(`  processed ${pending.length}:`, JSON.stringify(res));
  console.log(
    "  hn metrics:",
    JSON.stringify(await refreshHnMetrics(pipelineDeps())),
  );

  const rejected = await readAll((from, to) =>
    db()
      .from("raw_items")
      .select("reject_reason")
      .eq("filter_status", "rejected")
      .order("id")
      .range(from, to),
  );
  const reasons = new Map<string, number>();
  for (const r of rejected)
    reasons.set(
      r.reject_reason ?? "?",
      (reasons.get(r.reject_reason ?? "?") ?? 0) + 1,
    );
  console.log(
    "  rejected by reason:",
    JSON.stringify(Object.fromEntries(reasons)),
  );

  const accepted = await readAll((from, to) =>
    db()
      .from("raw_items")
      .select("title, url, canonical_url, content_text, language, published_at")
      .eq("filter_status", "accepted")
      .order("id")
      .range(from, to),
  );
  const rows = accepted;
  check(rows.length > 0, "some items were accepted", `${rows.length} accepted`);
  check(
    rows.every(
      (r) => r.title.trim() && /^https?:\/\//.test(r.url) && r.canonical_url,
    ),
    "accepted items have a title, a http(s) url and a canonical url",
  );
  check(
    rows.every((r) => (r.content_text ?? "").length <= 4000),
    "content_text stays within 4000 chars",
  );
  const weekAgo = Date.now() - 7 * 24 * 3600_000;
  check(
    rows.every((r) => !r.published_at || Date.parse(r.published_at) > weekAgo),
    "no accepted item older than 7 days",
  );
  check(
    rows.every(
      (r) => r.language === "en" || r.language === "tr" || r.language === null,
    ),
    "only en/tr items accepted",
  );
  const pendingLeft = (await allPendingItemIds(db())).length;
  check(pendingLeft === 0, "no item left pending");
}

async function clusterStage() {
  console.log(
    `\n[cluster] embed ≤${EMBED_ITEMS} newest non-arXiv items, cluster, score`,
  );
  // arXiv delivers ~1000 papers per fetch and, being newest by id, would fill the whole
  // sample. Park them as `pending` for this stage so the sample mixes sources, then restore.
  const { data: arxivSources } = await db()
    .from("sources")
    .select("id")
    .eq("type", "arxiv");
  const parked = await readAll((from, to) =>
    db()
      .from("raw_items")
      .select("id, story_sources!left(id)")
      .eq("filter_status", "accepted")
      .is("story_sources", null)
      .in(
        "source_id",
        (arxivSources ?? []).map((x) => x.id),
      )
      .order("id")
      .range(from, to),
  );
  const parkedIds = parked.map((x) => x.id);
  for (let i = 0; i < parkedIds.length; i += 200)
    await db()
      .from("raw_items")
      .update({ filter_status: "pending" })
      .in("id", parkedIds.slice(i, i + 200));
  console.log(`  parked ${parkedIds.length} arXiv items for this stage`);
  let r;
  try {
    r = await clusterItems({ ...embedDeps(), maxItems: EMBED_ITEMS });
  } finally {
    const back = await processItems(parkedIds, pipelineDeps());
    console.log("  restored parked items:", JSON.stringify(back));
  }
  console.log("  clustered:", JSON.stringify(r));
  check(
    r.embedded > 0,
    "items were embedded (Gemini embedding call worked)",
    `${r.embedded}`,
  );
  const { data: clusters } = await db()
    .from("story_clusters")
    .select("item_count, story_id")
    .order("item_count", { ascending: false });
  const multi = (clusters ?? []).filter((c) => c.item_count > 1);
  console.log(
    `  clusters: ${clusters?.length}, with >1 item: ${multi.length}, largest: ${clusters?.[0]?.item_count}`,
  );
  if (multi.length > 0) {
    for (const c of multi.slice(0, 3)) {
      const { data: members } = await db()
        .from("story_sources")
        .select("raw_items(title), sources(name)")
        .eq("story_id", c.story_id)
        .limit(4);
      console.log(`  cluster of ${c.item_count}:`);
      for (const m of members ?? [])
        console.log(
          `    - [${m.sources?.name}] ${m.raw_items?.title?.slice(0, 90)}`,
        );
    }
  }
  console.log("  scored:", JSON.stringify(await scoreStories(pipelineDeps())));
}

async function buildStage() {
  console.log(
    "\n[build] story builder on the top few clusters (LLM calls = STORY_BUILD_TOP_N)",
  );
  const before =
    (await db().from("llm_usage").select("id", { count: "exact", head: true }))
      .count ?? 0;
  // The builder paces itself across the UTC day (about one story per run early on). For a
  // quality sample, pretend it is the end of the day so the pacing lets TOP_N through.
  const eod = new Date();
  eod.setUTCHours(23, 59, 0, 0);
  const res = await buildStories({ ...storyBuildDeps(), now: eod });
  console.log("  built:", JSON.stringify(res));
  check(
    res.built > 0,
    "at least one story was built",
    `${res.built} built, ${res.failed} failed, ${res.skipped} skipped`,
  );

  const { data: stories } = await db()
    .from("stories")
    .select(
      "id, title, summary, why_it_matters, category, suggested_angles, entities, status, slug, source_count",
    )
    .eq("status", "published")
    .not("last_built_at", "is", null)
    .order("last_built_at", { ascending: false })
    .limit(Math.max(res.built, 5));
  for (const s of stories ?? []) {
    const angles = Array.isArray(s.suggested_angles) ? s.suggested_angles : [];
    const { count } = await db()
      .from("story_sources")
      .select("id", { count: "exact", head: true })
      .eq("story_id", s.id);
    check(
      Boolean(s.title && s.summary && s.why_it_matters && s.slug) &&
        CATEGORIES.has(String(s.category)) &&
        angles.length === 3 &&
        (count ?? 0) >= 1,
      `story is complete: ${s.title?.slice(0, 60)}`,
      `${s.category}, ${count} source(s)`,
    );
  }
  const usage =
    (await db().from("llm_usage").select("id", { count: "exact", head: true }))
      .count ?? 0;
  console.log(`  LLM calls recorded this stage: ${usage - before}`);

  console.log("\n  --- read these by hand (quality, not correctness) ---");
  for (const s of stories ?? []) {
    console.log(
      `\n  [${s.category}] ${s.title}\n  summary: ${s.summary}\n  why: ${s.why_it_matters}\n  angles: ${JSON.stringify(s.suggested_angles)}`,
    );
  }
}

const STAGES = {
  preflight,
  fetch: fetchStage,
  process: processStage,
  cluster: clusterStage,
  build: buildStage,
};

async function main() {
  const arg = process.argv[2] ?? "all";
  const run = arg === "all" ? Object.keys(STAGES) : [arg];
  for (const name of run) {
    const stage = STAGES[name as keyof typeof STAGES];
    if (!stage) throw new Error(`unknown stage "${name}"`);
    await stage();
  }
  console.log(
    failures ? `\n${failures} check(s) FAILED` : "\nall checks passed",
  );
  process.exit(failures ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
