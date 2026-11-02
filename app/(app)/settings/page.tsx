import { getTranslations } from "next-intl/server";
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
  const [{ data: profile }, params, t] = await Promise.all([
    (await createClient())
      .from("profiles")
      .select("digest_enabled, digest_hour, timezone, alerts_enabled, plan")
      .eq("id", user!.id)
      .single(),
    searchParams,
    getTranslations("settings"),
  ]);

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
