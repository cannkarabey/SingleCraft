"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { currentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

const TIMEZONES = new Set(Intl.supportedValuesOf("timeZone").concat("UTC"));

const EmailSettings = z.object({
  digest_enabled: z.boolean(),
  digest_hour: z.coerce.number().int().min(0).max(23),
  timezone: z.string().refine((tz) => TIMEZONES.has(tz), "unknown timezone"),
  alerts_enabled: z.boolean(),
});

/** Saves email preferences through the user's client (RLS + column grants). */
export async function saveEmailSettings(formData: FormData) {
  if (!(await currentUser())) redirect("/login?next=%2Fsettings");
  const parsed = EmailSettings.safeParse({
    digest_enabled: formData.get("digest_enabled") === "on",
    digest_hour: formData.get("digest_hour"),
    timezone: formData.get("timezone"),
    alerts_enabled: formData.get("alerts_enabled") === "on",
  });
  if (!parsed.success) redirect("/settings?error=1");

  const supabase = await createClient();
  const user = await currentUser();
  const { error } = await supabase
    .from("profiles")
    .update(parsed.data)
    .eq("id", user!.id);
  redirect(error ? "/settings?error=1" : "/settings?saved=1");
}
