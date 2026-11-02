"use client";

import { useEffect } from "react";
import type { PostHog } from "posthog-js";

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

let client: Promise<PostHog> | null = null;

/** Loads and initialises posthog-js once; never loaded at all without a key. */
function posthog(): Promise<PostHog> | null {
  if (!KEY) return null;
  client ??= import("posthog-js").then(({ default: ph }) => {
    ph.init(KEY, {
      api_host: HOST,
      // App Router navigations are client-side history changes.
      capture_pageview: "history_change",
      capture_pageleave: true,
      person_profiles: "identified_only",
    });
    return ph;
  });
  return client;
}

/**
 * Client analytics (plan §10): `$pageview` for every navigation and the signed-in user
 * identified by their Supabase id, the same distinct_id server events use. Signing out
 * (userId becomes null) resets the identity so the next visitor is anonymous.
 */
export function AnalyticsProvider({ userId }: { userId: string | null }) {
  useEffect(() => {
    void posthog()?.then((ph) => {
      if (userId) {
        if (ph.get_distinct_id() !== userId) ph.identify(userId);
      } else if (ph._isIdentified()) {
        ph.reset();
      }
    });
  }, [userId]);
  return null;
}
