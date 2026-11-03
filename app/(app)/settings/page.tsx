import { getLocale, getTranslations } from "next-intl/server";
import { BillingActions } from "@/components/settings/BillingActions";
import { PageHeader } from "@/components/shell/PageHeader";
import { Button } from "@/components/ui/button";
import { currentUser } from "@/lib/auth/session";
import { saveEmailSettings } from "@/lib/settings/actions";
import { createClient } from "@/lib/supabase/server";

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const TIMEZONES = [...Intl.supportedValuesOf("timeZone"), "UTC"].sort();
const field =
  "h-8 w-44 shrink-0 rounded-md border bg-surface-2 px-2 text-[13px]";
const row = "flex items-center justify-between gap-4 px-4 py-3 text-[13px]";
const group = "divide-y overflow-hidden rounded-lg border bg-surface-1";
const legend = "text-[15px] font-[590]";

export default async function SettingsPage({
  searchParams,
}: PageProps<"/settings">) {
  const user = await currentUser();
  const db = await createClient();
  const [{ data: profile }, { data: subscription }, params, t, tb, locale] =
    await Promise.all([
      db
        .from("profiles")
        .select("digest_enabled, digest_hour, timezone, alerts_enabled, plan")
        .eq("id", user!.id)
        .single(),
      db
        .from("subscriptions")
        .select("status, ends_at")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      searchParams,
      getTranslations("settings"),
      getTranslations("billing"),
      getLocale(),
    ]);
  const plan = profile?.plan ?? "free";

  return (
    <main className="flex flex-1 flex-col">
      <PageHeader title={t("title")} />
      <div className="mx-auto w-full max-w-2xl space-y-10 p-4 sm:p-8">
        {params.saved && (
          <p role="status" className="text-signal text-[13px]">
            {t("saved")}
          </p>
        )}
        {params.error && (
          <p role="alert" className="text-danger text-[13px]">
            {t("error")}
          </p>
        )}
        <section
          id="billing"
          aria-labelledby="billing-title"
          className="space-y-3"
        >
          <h2 id="billing-title" className={legend}>
            {tb("title")}
          </h2>
          <div className="bg-surface-1 space-y-3 rounded-lg border p-4">
            {params.billing === "success" && (
              <p role="status" className="text-signal text-[13px]">
                {tb("success")}
              </p>
            )}
            <p className="text-[13px]">
              {tb("current", {
                plan:
                  plan === "free" ? "Free" : plan === "pro" ? "Pro" : "Creator",
              })}
            </p>
            {subscription?.status === "cancelled" && subscription.ends_at && (
              <p className="text-muted-foreground text-[13px]">
                {tb("cancelling", {
                  date: new Date(subscription.ends_at).toLocaleDateString(
                    locale,
                  ),
                })}
              </p>
            )}
            <BillingActions paid={plan !== "free"} />
          </div>
        </section>

        <form action={saveEmailSettings} className="space-y-10">
          <fieldset className="space-y-3">
            <legend className={legend}>{t("digest.title")}</legend>
            <p className="text-muted-foreground text-[13px]">
              {t("digest.hint")}
            </p>
            <div className={group}>
              <label className={row}>
                <span>{t("digest.enabled")}</span>
                <input
                  type="checkbox"
                  name="digest_enabled"
                  defaultChecked={profile?.digest_enabled ?? true}
                />
              </label>
              <label className={row}>
                <span>{t("digest.hour")}</span>
                <select
                  name="digest_hour"
                  defaultValue={String(profile?.digest_hour ?? 8)}
                  className={field}
                >
                  {HOURS.map((h) => (
                    <option key={h} value={h}>
                      {String(h).padStart(2, "0")}:00
                    </option>
                  ))}
                </select>
              </label>
              <label className={row}>
                <span>{t("timezone")}</span>
                <select
                  name="timezone"
                  defaultValue={profile?.timezone ?? "Europe/Istanbul"}
                  className={field}
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </fieldset>
          <fieldset className="space-y-3">
            <legend className={legend}>{t("alerts.title")}</legend>
            <p className="text-muted-foreground text-[13px]">
              {t("alerts.hint")}
            </p>
            <div className={group}>
              <label className={row}>
                <span>{t("alerts.enabled")}</span>
                <input
                  type="checkbox"
                  name="alerts_enabled"
                  defaultChecked={profile?.alerts_enabled ?? true}
                />
              </label>
            </div>
          </fieldset>
          <Button type="submit">{t("save")}</Button>
        </form>
      </div>
    </main>
  );
}
