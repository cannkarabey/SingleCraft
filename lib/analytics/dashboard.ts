// PostHog dashboard for the success metrics (IMPLEMENTATION_PLAN §10). Created through
// PostHog's private API with a personal API key (scripts/posthog-dashboard.ts); safe to
// re-run: insights already on the dashboard (matched by name) are left alone.

export const DASHBOARD_NAME = "SignalCraft — başarı metrikleri";

type EventsNode = {
  kind: "EventsNode";
  event: string;
  name?: string;
  math?: "total" | "dau" | "weekly_active";
  properties?: {
    key: string;
    type: "event";
    operator: string;
    value: string;
  }[];
};
type Query =
  | {
      kind: "TrendsQuery";
      series: EventsNode[];
      interval: "day" | "week";
      dateRange: { date_from: string };
      trendsFilter?: { formula?: string; display?: string };
    }
  | {
      kind: "FunnelsQuery";
      series: EventsNode[];
      dateRange: { date_from: string };
      funnelsFilter: {
        funnelWindowInterval: number;
        funnelWindowIntervalUnit: "day";
      };
    }
  | {
      kind: "RetentionQuery";
      dateRange: { date_from: string };
      retentionFilter: {
        period: "Week";
        totalIntervals: number;
        targetEntity: { id: string; type: "events" };
        returningEntity: { id: string; type: "events" };
      };
    };

export type Insight = { name: string; description: string; query: Query };

const ev = (event: string, extra: Partial<EventsNode> = {}): EventsNode => ({
  kind: "EventsNode",
  event,
  name: event,
  math: "total",
  ...extra,
});
const last = (days: number) => ({ date_from: `-${days}d` });
const ratio = (a: string, b: string, interval: "day" | "week"): Query => ({
  kind: "TrendsQuery",
  series: [ev(a), ev(b)],
  interval,
  dateRange: last(90),
  trendsFilter: { formula: "B / A", display: "ActionsLineGraph" },
});

export const DASHBOARD_INSIGHTS: Insight[] = [
  {
    name: "Niş kurulumu (signup → niche_created)",
    description: "niche_created / signup",
    query: {
      kind: "FunnelsQuery",
      series: [ev("signed_up"), ev("niche_created")],
      dateRange: last(30),
      funnelsFilter: {
        funnelWindowInterval: 14,
        funnelWindowIntervalUnit: "day",
      },
    },
  },
  {
    name: "7 gün içinde ilk brief",
    description: "signup'tan sonraki 7 gün içinde brief_generated",
    query: {
      kind: "FunnelsQuery",
      series: [ev("signed_up"), ev("brief_generated")],
      dateRange: last(30),
      funnelsFilter: {
        funnelWindowInterval: 7,
        funnelWindowIntervalUnit: "day",
      },
    },
  },
  {
    name: "Kuzey yıldızı: yayınlanan / üretilen brief",
    description: "brief_published / brief_generated (haftalık)",
    query: ratio("brief_generated", "brief_published", "week"),
  },
  {
    name: "Brief düzenleme oranı",
    description: "brief_edited / brief_generated (haftalık)",
    query: ratio("brief_generated", "brief_edited", "week"),
  },
  {
    name: "Günlük Discover açma",
    description: "Discover sayfa görüntüleyen tekil kullanıcı",
    query: {
      kind: "TrendsQuery",
      series: [
        ev("$pageview", {
          math: "dau",
          properties: [
            {
              key: "$pathname",
              type: "event",
              operator: "icontains",
              value: "/discover",
            },
          ],
        }),
      ],
      interval: "day",
      dateRange: last(30),
    },
  },
  {
    name: "Radar'a ekleme (story_saved)",
    description: "Günlük story_saved",
    query: {
      kind: "TrendsQuery",
      series: [ev("story_saved")],
      interval: "day",
      dateRange: last(30),
    },
  },
  {
    name: "Retention (haftalık)",
    description:
      "signup kohortları, geri dönüş = herhangi bir sayfa görüntüleme",
    query: {
      kind: "RetentionQuery",
      dateRange: last(90),
      retentionFilter: {
        period: "Week",
        totalIntervals: 8,
        targetEntity: { id: "signed_up", type: "events" },
        returningEntity: { id: "$pageview", type: "events" },
      },
    },
  },
  {
    name: "WAU",
    description: "Haftalık aktif kullanıcı",
    query: {
      kind: "TrendsQuery",
      series: [ev("$pageview", { math: "weekly_active" })],
      interval: "day",
      dateRange: last(90),
    },
  },
  {
    name: "Digest açılma oranı",
    description: "digest_opened / digest_sent (haftalık)",
    query: ratio("digest_sent", "digest_opened", "week"),
  },
];

/** Every event the dashboard reads, for checking against what the app emits. */
export function dashboardEvents(): Set<string> {
  const events = new Set<string>();
  for (const { query } of DASHBOARD_INSIGHTS) {
    if (query.kind === "RetentionQuery") {
      events.add(query.retentionFilter.targetEntity.id);
      events.add(query.retentionFilter.returningEntity.id);
    } else for (const s of query.series) events.add(s.event);
  }
  return events;
}

type Config = { host: string; projectId: string; apiKey: string };

/** Creates the dashboard (if missing) and any insight not yet on it. */
export async function syncDashboard(
  config: Config,
  fetchFn: typeof fetch = fetch,
): Promise<{ dashboardId: number; created: string[]; existing: string[] }> {
  const base = `${config.host.replace(/\/$/, "")}/api/projects/${config.projectId}`;
  const call = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
    const res = await fetchFn(`${base}${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${config.apiKey}`,
        "content-type": "application/json",
      },
    });
    if (!res.ok)
      throw new Error(`PostHog ${init.method ?? "GET"} ${path}: ${res.status}`);
    return (await res.json()) as T;
  };

  const { results } = await call<{ results: { id: number; name: string }[] }>(
    `/dashboards/?search=${encodeURIComponent(DASHBOARD_NAME)}`,
  );
  let dashboardId = results.find((d) => d.name === DASHBOARD_NAME)?.id;
  let onDashboard = new Set<string>();
  if (dashboardId) {
    const { tiles } = await call<{
      tiles: { insight?: { name: string } | null }[];
    }>(`/dashboards/${dashboardId}/`);
    onDashboard = new Set(
      tiles.flatMap((t) => (t.insight ? [t.insight.name] : [])),
    );
  } else {
    ({ id: dashboardId } = await call<{ id: number }>("/dashboards/", {
      method: "POST",
      body: JSON.stringify({
        name: DASHBOARD_NAME,
        description: "IMPLEMENTATION_PLAN §10",
        pinned: true,
      }),
    }));
  }

  const created: string[] = [];
  const existing: string[] = [];
  for (const insight of DASHBOARD_INSIGHTS) {
    if (onDashboard.has(insight.name)) {
      existing.push(insight.name);
      continue;
    }
    await call("/insights/", {
      method: "POST",
      body: JSON.stringify({
        name: insight.name,
        description: insight.description,
        query: { kind: "InsightVizNode", source: insight.query },
        dashboards: [dashboardId],
      }),
    });
    created.push(insight.name);
  }
  return { dashboardId: dashboardId!, created, existing };
}
