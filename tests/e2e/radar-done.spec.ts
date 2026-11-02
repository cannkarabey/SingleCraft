import { expect, test } from "@playwright/test";
import { signIn } from "./support/auth";
import { nicheFor, seedRadarStories, setPlan } from "./support/radar-seed";

// IMPLEMENTATION_PLAN §9 Faz 5 "Bitti" criteria.
test("different niches see different Radar orders; hidden and excluded stories never show", async ({
  browser,
}) => {
  const seed = await seedRadarStories([
    { topic: "agents", title: "Agent framework", velocity: 95, engagement: 90 },
    { topic: "agents", title: "Agent benchmark", velocity: 93, engagement: 90 },
    {
      topic: "css",
      title: "CSS anchor positioning",
      velocity: 96,
      engagement: 90,
    },
    {
      topic: "css",
      title: "CSS container queries",
      velocity: 94,
      engagement: 90,
    },
    {
      topic: "agents blockchain",
      title: "Agents on chain",
      velocity: 100,
      engagement: 99,
    },
  ]);
  const [agentFramework, agentBenchmark, cssAnchor, , blockchain] =
    seed.stories;

  const agentsCtx = await browser.newContext({ locale: "tr-TR" });
  const webCtx = await browser.newContext({ locale: "tr-TR" });
  try {
    const agents = await agentsCtx.newPage();
    const web = await webCtx.newPage();
    const agentsEmail = await signIn(agents, "/discover");
    const webEmail = await signIn(web, "/discover");
    await setPlan(
      await nicheFor(agentsEmail, {
        name: "AI agents",
        keywords: [seed.tag, "agents"],
        excluded_keywords: ["blockchain"],
      }),
      "creator",
    );
    await setPlan(
      await nicheFor(webEmail, {
        name: "Web frontend",
        keywords: [seed.tag, "css"],
      }),
      "creator",
    );

    await agents.goto("/radar");
    await web.goto("/radar");
    const titles = async (page: typeof agents) =>
      (
        await page.getByRole("article").getByRole("heading").allTextContents()
      ).filter((t) => t.includes(seed.tag));

    const agentsOrder = await titles(agents);
    const webOrder = await titles(web);
    expect(agentsOrder[0]).toBe(agentFramework.title);
    expect(webOrder[0]).toBe(cssAnchor.title);
    expect(agentsOrder).not.toEqual(webOrder);

    // Negative keyword: never shown, despite the highest scores.
    expect(agentsOrder).not.toContain(blockchain.title);

    // Hide: gone now and after reload.
    await agents
      .getByRole("article")
      .filter({ hasText: agentBenchmark.title })
      .getByRole("button", { name: "Gizle" })
      .click();
    await expect(
      agents.getByRole("article").filter({ hasText: agentBenchmark.title }),
    ).toHaveCount(0);
    await agents.reload();
    expect(await titles(agents)).not.toContain(agentBenchmark.title);
  } finally {
    await agentsCtx.close();
    await webCtx.close();
    await seed.cleanup();
  }
});
