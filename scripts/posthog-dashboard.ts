// Creates/updates the §10 success-metrics dashboard in PostHog.
// Needs a personal API key with insight + dashboard write scope:
//   POSTHOG_PERSONAL_API_KEY=phx_… POSTHOG_PROJECT_ID=12345 npm run posthog:dashboard
import { syncDashboard } from "@/lib/analytics/dashboard";

const apiKey = process.env.POSTHOG_PERSONAL_API_KEY;
const projectId = process.env.POSTHOG_PROJECT_ID;
const host = process.env.POSTHOG_APP_HOST || "https://us.posthog.com";

if (!apiKey || !projectId) {
  console.error("Set POSTHOG_PERSONAL_API_KEY and POSTHOG_PROJECT_ID.");
  process.exit(1);
}

syncDashboard({ host, projectId, apiKey })
  .then((result) => {
    console.log(
      `Dashboard ${result.dashboardId}: ${result.created.length} created, ${result.existing.length} already there.`,
    );
    console.log(`${host}/project/${projectId}/dashboard/${result.dashboardId}`);
  })
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
