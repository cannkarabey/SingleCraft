import { z } from "zod";

type RawEnv = Record<string, string | undefined>;

// Unset and empty values are equivalent: `.env` files commonly carry `KEY=`.
function blankToUndefined(raw: RawEnv): RawEnv {
  return Object.fromEntries(
    Object.entries(raw).map(([k, v]) => [k, v === "" ? undefined : v]),
  );
}

const optionalString = z.string().optional();

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.url().default("http://localhost:3000"),
  NEXT_PUBLIC_POSTHOG_KEY: optionalString,
});

const serverSchema = publicSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  INNGEST_EVENT_KEY: optionalString,
  INNGEST_SIGNING_KEY: optionalString,
  LLM_STORY_MODEL: optionalString,
  LLM_STUDIO_MODEL: optionalString,
  LLM_EMBED_MODEL: optionalString,
  GOOGLE_GENERATIVE_AI_API_KEY: optionalString,
  ANTHROPIC_API_KEY: optionalString,
  LLM_DAILY_BUDGET_USD: z.coerce.number().nonnegative().default(1),
  STORY_BUILD_TOP_N: z.coerce.number().int().positive().default(30),
  GITHUB_TOKEN: optionalString,
  PRODUCTHUNT_TOKEN: optionalString,
  RESEND_API_KEY: optionalString,
  EMAIL_FROM: optionalString,
  BILLING_PROVIDER: z.enum(["paddle", "lemonsqueezy", "stripe"]).optional(),
  BILLING_API_KEY: optionalString,
  BILLING_WEBHOOK_SECRET: optionalString,
  SENTRY_DSN: optionalString,
});

export type PublicEnv = z.infer<typeof publicSchema>;
export type ServerEnv = z.infer<typeof serverSchema>;

function parse<T extends z.ZodType>(schema: T, raw: RawEnv): z.infer<T> {
  const result = schema.safeParse(blankToUndefined(raw));
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid environment: ${problems}`);
  }
  return result.data;
}

export function parsePublicEnv(raw: RawEnv): PublicEnv {
  return parse(publicSchema, raw);
}

export function parseServerEnv(raw: RawEnv): ServerEnv {
  return parse(serverSchema, raw);
}

// Next.js inlines NEXT_PUBLIC_* only when referenced literally, so list them explicitly.
export function publicEnv(): PublicEnv {
  return parsePublicEnv({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
  });
}

export function serverEnv(): ServerEnv {
  return parseServerEnv(process.env);
}
