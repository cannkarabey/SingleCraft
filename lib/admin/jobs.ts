// Jobs the admin panel can run on demand (plan §1 #10): each listed Inngest function also
// listens to `admin/<id>.run`, so a manual trigger is just an event.
export const ADMIN_JOBS = [
  "fetch-sources",
  "refresh-metrics",
  "score-stories",
  "build-stories",
  "archive-stories",
  "send-digest",
  "billing-reconcile",
] as const;

export type AdminJob = (typeof ADMIN_JOBS)[number];

export const adminRunEvent = <J extends AdminJob>(job: J) =>
  `admin/${job}.run` as const;
