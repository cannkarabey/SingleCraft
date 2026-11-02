// Plan limits — the single source for API checks and UI copy (plan §1 #7, PDF §15).
// `null` means unlimited.

export type Plan = "free" | "creator" | "pro";

export type PlanLimits = {
  niches: number;
  /** Radar rows shown in full; the rest are locked server-side (plan §1 #19). */
  radarRows: number | null;
  briefsPerDay: number | null;
  anglesPerDay: number | null;
  /** Daily digest email (PDF §15: a Creator feature). */
  digest: boolean;
};

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  free: {
    niches: 1,
    radarRows: 3,
    briefsPerDay: 2,
    anglesPerDay: 5,
    digest: false,
  },
  creator: {
    niches: 3,
    radarRows: null,
    briefsPerDay: null,
    anglesPerDay: 50,
    digest: true,
  },
  pro: {
    niches: 10,
    radarRows: null,
    briefsPerDay: null,
    anglesPerDay: 200,
    digest: true,
  },
};

export function limitsFor(plan: string | null | undefined): PlanLimits {
  return plan && plan in PLAN_LIMITS
    ? PLAN_LIMITS[plan as Plan]
    : PLAN_LIMITS.free;
}
