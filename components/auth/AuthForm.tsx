import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { sendMagicLink, signInWithProvider } from "@/lib/auth/actions";
import { safeNextPath } from "@/lib/auth/paths";

/** OAuth buttons only for providers configured in this deployment (comma list). */
function enabledProviders(): ("google" | "github")[] {
  return (process.env.NEXT_PUBLIC_AUTH_PROVIDERS ?? "")
    .split(",")
    .map((p) => p.trim())
    .filter((p): p is "google" | "github" => p === "google" || p === "github");
}

/** Local Supabase delivers auth mail to Mailpit, not to a real inbox. */
const localMailbox = /^https?:\/\/(127\.0\.0\.1|localhost)[:/]/.test(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
);

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Shared by /login and /signup: magic-link form, optional OAuth buttons, link to the other page. */
export async function AuthForm({
  mode,
  searchParams,
}: {
  mode: "login" | "signup";
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const next = safeNextPath(one(searchParams.next));
  const error = one(searchParams.error);
  const sent = one(searchParams.sent) === "1";
  const t = await getTranslations("auth");
  const p = mode === "login" ? "" : "signup.";
  const other = mode === "login" ? "signup" : "login";
  const errorKey =
    error === "email"
      ? "errors.email"
      : error === "provider"
        ? "errors.provider"
        : error === "noAccount"
          ? "errors.noAccount"
          : "errors.generic";

  return (
    <main className="bg-surface-1 w-full max-w-sm space-y-6 rounded-xl border p-6">
      <div className="space-y-1.5">
        <h1 className="text-xl font-[590] tracking-tight">
          {t(`${p}title` as "title")}
        </h1>
        <p className="text-muted-foreground text-[13px]">
          {t(`${p}subtitle` as "subtitle")}
        </p>
      </div>

      {sent && (
        <p
          role="status"
          className="border-signal/40 bg-signal/10 rounded-md border p-3 text-[13px]"
        >
          {t(`${p}sent` as "sent")}
          {localMailbox && (
            <>
              {" "}
              {t("localMail")}{" "}
              <a
                href="http://127.0.0.1:54324"
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                Mailpit
              </a>
            </>
          )}
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="border-danger/40 bg-danger/10 rounded-md border p-3 text-[13px]"
        >
          {t(errorKey)}
        </p>
      )}

      <form action={sendMagicLink} className="space-y-3">
        <input type="hidden" name="next" value={next} />
        <input type="hidden" name="mode" value={mode} />
        <label className="block space-y-1.5 text-[13px]">
          <span className="text-muted-foreground">{t("email")}</span>
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            maxLength={254}
            className="bg-surface-2 focus-visible:ring-ring h-9 w-full rounded-md border px-3 text-[13px] focus-visible:ring-2 focus-visible:outline-none"
          />
        </label>
        <Button type="submit" size="lg" className="w-full">
          {t(`${p}sendLink` as "sendLink")}
        </Button>
      </form>

      {enabledProviders().length > 0 && (
        <div className="space-y-2">
          <p className="text-text-tertiary text-center text-xs">{t("or")}</p>
          {enabledProviders().map((provider) => (
            <form key={provider} action={signInWithProvider}>
              <input type="hidden" name="next" value={next} />
              <input type="hidden" name="mode" value={mode} />
              <input type="hidden" name="provider" value={provider} />
              <Button
                type="submit"
                variant="secondary"
                size="lg"
                className="w-full"
              >
                {t(`providers.${provider}`)}
              </Button>
            </form>
          ))}
        </div>
      )}

      <p className="text-muted-foreground text-center text-[13px]">
        {t(`${p}switch` as "switch")}{" "}
        <Link
          href={`/${other}?next=${encodeURIComponent(next)}`}
          className="text-foreground underline-offset-4 hover:underline"
        >
          {t(`${p}switchCta` as "switchCta")}
        </Link>
      </p>
    </main>
  );
}
