"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { safeNextPath } from "@/lib/auth/paths";
import { createClient } from "@/lib/supabase/server";

/** Origin of the current request; Supabase only accepts allow-listed redirect URLs. */
async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

function callbackUrl(origin: string, next: string) {
  return `${origin}/auth/callback?next=${encodeURIComponent(next)}`;
}

const Email = z.email().max(254);

export async function sendMagicLink(formData: FormData) {
  const next = safeNextPath(formData.get("next")?.toString());
  const email = Email.safeParse(formData.get("email")?.toString().trim());
  const back = `/login?next=${encodeURIComponent(next)}`;
  if (!email.success) redirect(`${back}&error=email`);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: email.data,
    options: { emailRedirectTo: callbackUrl(await requestOrigin(), next) },
  });
  redirect(`${back}&${error ? "error=send" : "sent=1"}`);
}

const Provider = z.enum(["google", "github"]);

export async function signInWithProvider(formData: FormData) {
  const next = safeNextPath(formData.get("next")?.toString());
  const provider = Provider.safeParse(formData.get("provider"));
  if (!provider.success)
    redirect(`/login?next=${encodeURIComponent(next)}&error=provider`);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: provider.data,
    options: { redirectTo: callbackUrl(await requestOrigin(), next) },
  });
  if (error || !data.url)
    redirect(`/login?next=${encodeURIComponent(next)}&error=provider`);
  redirect(data.url);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
