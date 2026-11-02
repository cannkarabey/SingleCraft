import { describe, expect, test } from "vitest";
import {
  DASHBOARD_INSIGHTS,
  DASHBOARD_NAME,
  dashboardEvents,
  syncDashboard,
} from "@/lib/analytics/dashboard";

const config = {
  host: "https://ph.test",
  projectId: "42",
  apiKey: "phx_test",
};

/** In-memory PostHog private API: dashboards and insights. */
function fakeApi(existing: { dashboard?: boolean; insights?: string[] } = {}) {
  const calls: { method: string; path: string; body?: unknown }[] = [];
  const tiles = (existing.insights ?? []).map((name, i) => ({
    insight: { id: i + 1, name },
  }));
  const fetch = async (url: string | URL | Request, init?: RequestInit) => {
    const u = new URL(String(url));
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ method, path: u.pathname + u.search, body });
    expect(new Headers(init?.headers).get("authorization")).toBe(
      "Bearer phx_test",
    );
    if (method === "GET" && u.pathname === "/api/projects/42/dashboards/")
      return Response.json({
        results: existing.dashboard ? [{ id: 7, name: DASHBOARD_NAME }] : [],
      });
    if (method === "GET" && u.pathname === "/api/projects/42/dashboards/7/")
      return Response.json({ id: 7, tiles });
    if (method === "POST" && u.pathname === "/api/projects/42/dashboards/")
      return Response.json({ id: 7 });
    if (method === "POST" && u.pathname === "/api/projects/42/insights/")
      return Response.json({ id: 100 });
    return new Response("not found", { status: 404 });
  };
  return { fetch: fetch as typeof globalThis.fetch, calls };
}

describe("PostHog dashboard (plan §10)", () => {
  test("covers every §10 metric", () => {
    expect(DASHBOARD_INSIGHTS.map((i) => i.name)).toEqual([
      "Niş kurulumu (signup → niche_created)",
      "7 gün içinde ilk brief",
      "Kuzey yıldızı: yayınlanan / üretilen brief",
      "Brief düzenleme oranı",
      "Günlük Discover açma",
      "Radar'a ekleme (story_saved)",
      "Retention (haftalık)",
      "WAU",
      "Digest açılma oranı",
    ]);
  });

  test("only uses events the app emits", () => {
    expect([...dashboardEvents()].sort()).toEqual([
      "$pageview",
      "brief_edited",
      "brief_generated",
      "brief_published",
      "digest_opened",
      "digest_sent",
      "niche_created",
      "signed_up",
      "story_saved",
    ]);
  });

  test("creates the dashboard and every insight on it", async () => {
    const api = fakeApi();
    const result = await syncDashboard(config, api.fetch);
    expect(result.created).toHaveLength(DASHBOARD_INSIGHTS.length);
    const insights = api.calls.filter(
      (c) => c.method === "POST" && c.path === "/api/projects/42/insights/",
    );
    expect(insights).toHaveLength(DASHBOARD_INSIGHTS.length);
    expect(insights[0].body).toMatchObject({
      name: DASHBOARD_INSIGHTS[0].name,
      dashboards: [7],
      query: { kind: "InsightVizNode" },
    });
  });

  test("is idempotent: existing insights are not duplicated", async () => {
    const api = fakeApi({
      dashboard: true,
      insights: DASHBOARD_INSIGHTS.slice(0, 3).map((i) => i.name),
    });
    const result = await syncDashboard(config, api.fetch);
    expect(result.existing).toHaveLength(3);
    expect(result.created).toHaveLength(DASHBOARD_INSIGHTS.length - 3);
    expect(
      api.calls.some(
        (c) => c.method === "POST" && c.path === "/api/projects/42/dashboards/",
      ),
    ).toBe(false);
  });

  test("API errors surface", async () => {
    const fetch = (async () =>
      new Response("nope", { status: 401 })) as typeof globalThis.fetch;
    await expect(syncDashboard(config, fetch)).rejects.toThrow(/401/);
  });
});
