"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { authCallbackUrl, safeNextPath } from "@/lib/auth/paths";
import { createClient } from "@/lib/supabase/server";

const Email = z.email().max(254);
const Mode = z.enum(["login", "signup"]).catch("login");
const Provider = z.enum(["google", "github"]);

const pageFor = (mode: "login" | "signup", next: string) =>
  `/${mode}?next=${encodeURIComponent(next)}`;

/**
 * Magic link. Sign-in only reaches existing accounts (`shouldCreateUser: false`); sign-up
 * creates the account on first use.
 */
export async function sendMagicLink(formData: FormData) {
  const next = safeNextPath(formData.get("next")?.toString());
  const mode = Mode.parse(formData.get("mode"));
  const back = pageFor(mode, next);
  const email = Email.safeParse(formData.get("email")?.toString().trim());
  if (!email.success) redirect(`${back}&error=email`);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: email.data,
    options: {
      emailRedirectTo: authCallbackUrl(next),
      shouldCreateUser: mode === "signup",
    },
  });
  if (!error) redirect(`${back}&sent=1`);
  const noAccount =
    mode === "login" &&
    (error.code === "otp_disabled" ||
      /signups? not allowed/i.test(error.message));
  redirect(`${back}&error=${noAccount ? "noAccount" : "send"}`);
}

export async function signInWithProvider(formData: FormData) {
  const next = safeNextPath(formData.get("next")?.toString());
  const mode = Mode.parse(formData.get("mode"));
  const provider = Provider.safeParse(formData.get("provider"));
  if (!provider.success) redirect(`${pageFor(mode, next)}&error=provider`);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: provider.data,
    options: { redirectTo: authCallbackUrl(next) },
  });
  if (error || !data.url) redirect(`${pageFor(mode, next)}&error=provider`);
  redirect(data.url);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
