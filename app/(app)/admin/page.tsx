import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { JobButtons } from "@/components/admin/JobButtons";
import { SourceRow } from "@/components/admin/SourceRow";
import { requireAdmin } from "@/lib/admin/auth";
import { ADMIN_JOBS } from "@/lib/admin/jobs";
import { adminOverview } from "@/lib/admin/queries";
import { relativeTime } from "@/lib/discover/format";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = { robots: { index: false } };

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby={`${id}-title`}
      className="bg-card space-y-3 rounded-lg border p-4"
    >
      <h2 id={`${id}-title`} className="font-semibold">
        {title}
      </h2>
      <div className="overflow-x-auto">{children}</div>
    </section>
  );
}

const th = "text-muted-foreground py-1 pr-3 text-left text-xs font-medium";

/** Operator panel (plan §8.2); 404 for everyone but `profiles.is_admin`. */
export default async function AdminPage() {
  if (!(await requireAdmin())) notFound();
  const now = new Date();
  const [o, t, locale] = await Promise.all([
    adminOverview(createAdminClient(), now),
    getTranslations("admin"),
    getLocale(),
  ]);
  const usd = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 4,
  });
  const ago = (iso: string | null) =>
    iso ? relativeTime(new Date(iso), now, locale) : t("never");
  const budget = Number(process.env.LLM_DAILY_BUDGET_USD ?? 1);

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>

      <Section id="jobs" title={t("jobs")}>
        <JobButtons jobs={ADMIN_JOBS} />
      </Section>

      <Section id="spend" title={t("spend")}>
        <p className="text-muted-foreground text-sm">
          {t("budget", { budget: usd.format(budget) })}
        </p>
        {o.spend.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("noSpend")}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className={th}>{t("day")}</th>
                <th className={th}>{t("cost")}</th>
                <th className={th}>{t("calls")}</th>
              </tr>
            </thead>
            <tbody>
              {o.spend.map((d) => (
                <tr key={d.day} className="border-t">
                  <td className="py-1 pr-3 font-mono">{d.day}</td>
                  <td
                    className={`py-1 pr-3 font-mono ${d.cost_usd > budget ? "text-danger" : ""}`}
                  >
                    {usd.format(d.cost_usd)}
                  </td>
                  <td className="py-1 pr-3 font-mono">{d.calls}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section id="sources" title={t("sources")}>
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className={th}>{t("source")}</th>
              <th className={th}>{t("active")}</th>
              <th className={th}>{t("trust")}</th>
              <th className={th}>{t("lastFetched")}</th>
              <th className={th}>{t("lastError")}</th>
              <th className={th} />
            </tr>
          </thead>
          <tbody>
            {o.sources.map((s) => (
              <SourceRow
                key={s.id}
                source={{ ...s, lastFetched: ago(s.last_fetched_at) }}
              />
            ))}
          </tbody>
        </table>
      </Section>

      <Section id="runs" title={t("runs")}>
        {o.runs.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("noRuns")}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className={th}>{t("fn")}</th>
                <th className={th}>{t("started")}</th>
                <th className={th}>{t("duration")}</th>
                <th className={th}>{t("stats")}</th>
              </tr>
            </thead>
            <tbody>
              {o.runs.map((r) => (
                <tr key={r.id} className="border-t align-top">
                  <td className="py-1 pr-3 font-mono">{r.fn}</td>
                  <td className="text-muted-foreground py-1 pr-3 font-mono text-xs">
                    {ago(r.started_at)}
                  </td>
                  <td className="py-1 pr-3 font-mono text-xs">
                    {r.finished_at
                      ? `${Math.round((Date.parse(r.finished_at) - Date.parse(r.started_at)) / 1000)}s`
                      : "—"}
                  </td>
                  <td className="py-1 font-mono text-xs break-all">
                    {r.error ? (
                      <span className="text-danger">{r.error}</span>
                    ) : (
                      JSON.stringify(r.stats)
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section id="feedback" title={t("feedback")}>
        {o.feedback.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("noFeedback")}</p>
        ) : (
          <ul className="divide-y text-sm">
            {o.feedback.map((f) => (
              <li key={f.id} className="space-y-1 py-2">
                <p className="whitespace-pre-wrap">{f.message}</p>
                <p className="text-muted-foreground font-mono text-xs">
                  {f.page ?? "—"} · {ago(f.created_at)} ·{" "}
                  {f.user_id.slice(0, 8)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section id="rejected" title={t("rejected")}>
        {o.rejectReasons.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("noRejected")}</p>
        ) : (
          <>
            <table className="text-sm">
              <thead>
                <tr>
                  <th className={th}>{t("reason")}</th>
                  <th className={th}>{t("count")}</th>
                </tr>
              </thead>
              <tbody>
                {o.rejectReasons.map((r) => (
                  <tr key={r.reason} className="border-t">
                    <td className="py-1 pr-3 font-mono">{r.reason}</td>
                    <td className="py-1 pr-3 font-mono">{r.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <h3 className="pt-2 text-sm font-medium">{t("recentRejected")}</h3>
            <ul className="divide-y text-sm">
              {o.rejected.map((r) => (
                <li key={r.id} className="flex gap-3 py-1">
                  <span className="text-muted-foreground w-24 shrink-0 font-mono text-xs">
                    {r.reject_reason}
                  </span>
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noreferrer"
                    className="min-w-0 truncate hover:underline"
                  >
                    {r.title}
                  </a>
                  <span className="text-muted-foreground ml-auto shrink-0 text-xs">
                    {r.sources?.name}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </Section>
    </main>
  );
}
