import { describe, expect, test } from "vitest";
import { sentryOptions } from "@/lib/observability/sentry";

describe("sentryOptions", () => {
  test("disabled without a DSN", () => {
    expect(sentryOptions(undefined, "production")).toMatchObject({
      enabled: false,
    });
  });

  test("enabled with a DSN, sampled traces, no PII", () => {
    expect(
      sentryOptions("https://k@o1.ingest.sentry.io/1", "production"),
    ).toEqual({
      dsn: "https://k@o1.ingest.sentry.io/1",
      enabled: true,
      environment: "production",
      tracesSampleRate: 0.1,
      sendDefaultPii: false,
    });
  });
});
