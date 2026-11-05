// Daily and per-account usage limits: one set for everyone (the app is free). They protect
// the free LLM quotas, not a business model. `null` means unlimited.

export const LIMITS = {
  /** Niches per account. */
  niches: 3,
  /** Studio briefs (generate or regenerate) per account per UTC day. */
  briefsPerDay: 5 as number | null,
  /** Personal Radar angles per account per UTC day. */
  anglesPerDay: 20 as number | null,
};
