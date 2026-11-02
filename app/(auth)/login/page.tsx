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

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const one = (v: string | string[] | undefined) =>
    Array.isArray(v) ? v[0] : v;
  const next = safeNextPath(one(params.next));
  const error = one(params.error);
  const sent = one(params.sent) === "1";
  const t = await getTranslations("auth");

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <p className="text-muted-foreground">{t("subtitle")}</p>

      {sent && (
        <p
          role="status"
          className="border-signal/40 bg-signal/10 rounded-md border p-3 text-sm"
        >
          {t("sent")}
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="border-danger/40 bg-danger/10 rounded-md border p-3 text-sm"
        >
          {t(
            error === "email"
              ? "errors.email"
              : error === "provider"
                ? "errors.provider"
                : "errors.generic",
          )}
        </p>
      )}

      <form action={sendMagicLink} className="space-y-3">
        <input type="hidden" name="next" value={next} />
        <label className="block space-y-1.5 text-sm">
          <span>{t("email")}</span>
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            maxLength={254}
            className="bg-surface-1 focus-visible:ring-ring h-10 w-full rounded-md border px-3 focus-visible:ring-2 focus-visible:outline-none"
          />
        </label>
        <Button type="submit" className="w-full">
          {t("sendLink")}
        </Button>
      </form>

      {enabledProviders().length > 0 && (
        <div className="space-y-2">
          <p className="text-muted-foreground text-center text-xs">{t("or")}</p>
          {enabledProviders().map((provider) => (
            <form key={provider} action={signInWithProvider}>
              <input type="hidden" name="next" value={next} />
              <input type="hidden" name="provider" value={provider} />
              <Button type="submit" variant="outline" className="w-full">
                {t(`providers.${provider}`)}
              </Button>
            </form>
          ))}
        </div>
      )}
    </main>
  );
}
