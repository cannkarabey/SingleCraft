import { getLocale, getTranslations } from "next-intl/server";
import { BillingActions } from "@/components/settings/BillingActions";
import { Button } from "@/components/ui/button";
import { currentUser } from "@/lib/auth/session";
import { saveEmailSettings } from "@/lib/settings/actions";
import { createClient } from "@/lib/supabase/server";

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const TIMEZONES = [...Intl.supportedValuesOf("timeZone"), "UTC"].sort();
const field = "h-9 w-full rounded-md border bg-surface-1 px-2 text-sm";

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
    <main className="mx-auto w-full max-w-xl flex-1 space-y-6 px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      {params.saved && (
        <p role="status" className="text-signal text-sm">
          {t("saved")}
        </p>
      )}
      {params.error && (
        <p role="alert" className="text-danger text-sm">
          {t("error")}
        </p>
      )}
      <section
        id="billing"
        aria-labelledby="billing-title"
        className="bg-card space-y-3 rounded-lg border p-4"
      >
        <h2 id="billing-title" className="font-semibold">
          {tb("title")}
        </h2>
        {params.billing === "success" && (
          <p role="status" className="text-signal text-sm">
            {tb("success")}
          </p>
        )}
        <p className="text-sm">
          {tb("current", {
            plan: plan === "free" ? "Free" : plan === "pro" ? "Pro" : "Creator",
          })}
        </p>
        {subscription?.status === "cancelled" && subscription.ends_at && (
          <p className="text-muted-foreground text-sm">
            {tb("cancelling", {
              date: new Date(subscription.ends_at).toLocaleDateString(locale),
            })}
          </p>
        )}
        <BillingActions paid={plan !== "free"} />
      </section>

      <form action={saveEmailSettings} className="space-y-5">
        <fieldset className="space-y-3">
          <legend className="font-semibold">{t("digest.title")}</legend>
          <p className="text-muted-foreground text-sm">{t("digest.hint")}</p>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="digest_enabled"
              defaultChecked={profile?.digest_enabled ?? true}
            />
            {t("digest.enabled")}
          </label>
          <label className="block space-y-1 text-sm">
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
          <label className="block space-y-1 text-sm">
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
        </fieldset>
        <fieldset className="space-y-3">
          <legend className="font-semibold">{t("alerts.title")}</legend>
          <p className="text-muted-foreground text-sm">{t("alerts.hint")}</p>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="alerts_enabled"
              defaultChecked={profile?.alerts_enabled ?? true}
            />
            {t("alerts.enabled")}
          </label>
        </fieldset>
        <Button type="submit">{t("save")}</Button>
      </form>
    </main>
  );
}
