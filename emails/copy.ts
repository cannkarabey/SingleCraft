import en from "@/messages/en.json";
import tr from "@/messages/tr.json";

export type EmailLocale = "tr" | "en";
type Key = keyof typeof en.email;

/** Email copy from messages/*.json (same parity test as the app UI). */
export function emailCopy(locale: EmailLocale) {
  const strings = (locale === "tr" ? tr : en).email;
  return (key: Key, vars: Record<string, string | number> = {}) =>
    strings[key].replace(/\{(\w+)\}/g, (_, name: string) =>
      String(vars[name] ?? ""),
    );
}
