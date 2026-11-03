# UI Redesign (Linear-style) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the existing site to look and feel like linear.app. The landing page (`/`) gets Linear's marketing layout. Discover, Radar and Studio become a Linear-style app with a left sidebar.

**Architecture:** This is a restyle, not a rebuild. Routes, data, APIs and component boundaries stay as they are. The work replaces design tokens and the font, adds two shells (a marketing shell and an app shell with a sidebar), and re-skins each page's markup. No new dependencies: the icons come from `lucide-react` and the font from `next/font/google`.

**Tech Stack:** Next.js 16 App Router, Tailwind v4 (`app/globals.css` tokens), shadcn `Button`, next-intl (TR+EN), Playwright E2E.

**Spec:** this plan; there is no separate design doc. The user's request (2026-11-03) was "Linear gibi, neredeyse aynısı; discover/radar/studio homepage haricinde bir platform; karmaşık değil, şu anki tasarım üzerinde değişiklik". The reference is https://linear.app/homepage.

## Global Constraints

- **Copy the look, not the brand.** Take Linear's colors, type scale, spacing, borders, layout and motion. Do not use Linear's name, logo, wordmark, illustrations, screenshots or marketing copy, because those are their trademark and copyright. All text is SignalCraft's own, from `messages/{tr,en}.json`.
- **Dark only,** as today. Tokens are defined once in `app/globals.css` (the `--sc-*` prefix stays):

  | Token | Value |
  | --- | --- |
  | `--sc-canvas` | `#08090a` |
  | `--sc-surface-1` | `#0f1011` |
  | `--sc-surface-2` | `#141516` |
  | `--sc-surface-3` | `#1c1d1f` |
  | `--sc-border` | `rgba(255,255,255,0.08)` |
  | `--sc-border-strong` | `rgba(255,255,255,0.14)` |
  | `--sc-text-primary` | `#f7f8f8` |
  | `--sc-text-secondary` | `#8a8f98` |
  | `--sc-text-tertiary` | `#62666d` |
  | `--sc-brand` | `#5e6ad2` |
  | `--sc-accent` (high signal, green) | `#4cb782` |
  | `--sc-warning` (early signal) | `#f2c94c` |
  | `--sc-danger` | `#eb5757` |

- **Font is Inter** (`next/font/google`, variable `--font-inter`), weights 400/510/590. Mono stays Geist Mono and is used only for metadata. Body text is 14px in the app and 16px on marketing pages.
- **Headings are tight:** marketing H1 is `text-5xl sm:text-7xl`, `tracking-[-0.04em]`, `leading-[1.05]`, `font-[590]`; app page titles are `text-sm font-medium`, Linear-style.
- **Buttons:**
  - Primary is light (`bg-[#f7f8f8] text-[#08090a]`).
  - Secondary is `surface-2` with a 1px border.
  - Radius is 8px; height is `h-8`, or `h-10` for marketing CTAs.
  - The brand indigo is used for focus rings and the selected nav item only, never for large fills.
- **Signal colors keep their meaning:** green for high, yellow for early, red for low trust.
- **Motion** lasts 120–180 ms; `prefers-reduced-motion` is respected (already in `globals.css`).
- **E2E tests rely on accessible names and copy.** Keep every existing role, landmark name, heading text and button label unless a task explicitly changes it and updates the spec that asserts it.
- Faz 4 constraints still hold: Lighthouse performance ≥ 90 on `/` and `/discover`, and no horizontal scroll at 375 px.
- **Show the user the result:**
  - Every UI task ends by saving screenshots at 1440 px and 375 px to `docs/redesign/screenshots/<task>/` with `node scripts/screenshots.mjs <task> <paths…>` (created in Task 1).
  - These are shown to the user at the end of the phase.

## Review Focus

1. **Mobile app shell:** at 375 px the sidebar must not cover content or cause horizontal scroll. The menu button opens it and Escape closes it. Pinned by `app-shell.spec.ts`.
2. **Signed-out Discover:** the sidebar shows a sign-in CTA, not Radar/Studio links that bounce to `/login`. Pinned by `app-shell.spec.ts`.
3. **Active nav state:** the sidebar marks the current module with `aria-current="page"`, including on nested routes such as `/studio/new` and `/discover/[id]`. Pinned by `app-shell.spec.ts`.
4. **Long titles and URLs** in dense list rows must truncate, not overflow. Pinned by the 375 px check in `discover.spec.ts`.
5. **Contrast:** tertiary text (`#62666d`) is used only for metadata, never for body copy or labels. Checked in the self-review at Task 8.

---

### Task 1: Tokens, font, buttons, screenshot script

**Files:**
- Modify: `app/globals.css`, `app/layout.tsx` (Inter replaces Geist Sans), `components/ui/button.tsx`
- Create: `scripts/screenshots.mjs`

**Interfaces:**
- Produces:
  - Tailwind colors `canvas`, `surface-1/2/3`, `border-strong`, `text-tertiary` (`--color-text-tertiary`), `brand`, `signal`, `warning`, `danger`.
  - Button variants `default` (light), `secondary`, `outline`, `ghost`, `link`; sizes `sm` (h-7), `default` (h-8), `lg` (h-10).
  - `node scripts/screenshots.mjs <name> <path...>`: uses Playwright chromium against `E2E_BASE_URL` (default `http://localhost:3100`) and writes `<path-slug>-{1440,375}.png`.

- [ ] **Step 1:** Set the tokens from Global Constraints in `:root`. Map shadcn `--primary` to `#f7f8f8` and `--primary-foreground` to `#08090a`; `--ring` to `--sc-brand`; `--radius` to `0.5rem`. Add the new `@theme inline` colors and `--font-sans: var(--font-inter)`. Set body `font-size: 14px`, `-webkit-font-smoothing: antialiased`.
- [ ] **Step 2:** In `app/layout.tsx`, swap `Geist` for `Inter({ subsets: ["latin","latin-ext"], variable: "--font-inter" })` and keep `Geist_Mono`.
- [ ] **Step 3:** Restyle the button variants and sizes as listed under Produces, with 8px radius, `font-medium`, `text-[13px]` and `transition-colors duration-150`.
- [ ] **Step 4:** Write `scripts/screenshots.mjs`. It launches chromium, takes full-page screenshots at viewports 1440×900 and 375×812, and accepts an optional `--auth` flag that signs in through the magic-link helper logic, which it imports from `tests/e2e/support/mail.ts` through `tsx`. If importing it is awkward, it copies the 10 lines it needs.
- [ ] **Step 5:** Run `npm run typecheck && npm run lint && npx playwright test tests/e2e/shell.spec.ts tests/e2e/landing.spec.ts`. Expected: PASS, since only the look changed.
- [ ] **Step 6:** Run `node scripts/screenshots.mjs task-1 / /discover`. Expected: 4 PNGs in `docs/redesign/screenshots/task-1/`.
- [ ] **Step 7:** Commit with `style(ui): linear-style tokens, inter, buttons`.

### Task 2: Marketing shell (nav + footer)

**Files:**
- Create: `components/marketing/MarketingNav.tsx`, `components/marketing/Footer.tsx`
- Modify: `app/(marketing)/layout.tsx` (uses MarketingNav and Footer instead of TopNav), `messages/{tr,en}.json` (`footer.*`)
- Test: `tests/e2e/shell.spec.ts`

**Interfaces:**
- Produces: `<MarketingNav />` and `<Footer />`. Both are server components, and the nav keeps `aria-label="SignalCraft"`.

- [ ] **Step 1:** Add the test `marketing footer lists product and company links` to `shell.spec.ts`. It asserts `page.getByRole("contentinfo")` contains links named `Discover`, `Radar`, `Studio` and `Fiyatlandırma`.
- [ ] **Step 2:** Run `npx playwright test tests/e2e/shell.spec.ts`. Expected: FAIL (no contentinfo).
- [ ] **Step 3:** Build the nav:
  - It is sticky, `h-16`, `bg-canvas/80 backdrop-blur`, with a bottom border that appears only after scrolling. Do this with a 5-line client `ScrollBorder` wrapper or CSS `animation-timeline`; prefer CSS when supported.
  - Inner layout is `max-w-[1200px] px-6`. The logo text "SignalCraft" sits on the left with a small square glyph (`lucide` `Radio`).
  - Centre links are `text-[13px] text-secondary hover:text-primary`, covering the three modules and pricing.
  - On the right: LanguageSwitcher, "Giriş yap" (ghost) and the CTA (primary `size="sm"`).
- [ ] **Step 4:** Build the footer as 4 columns: brand with tagline; Ürün (modules and pricing); Kaynaklar (`/discover`, `/login`); Yasal (placeholder text, no links). Use `text-[13px]`, `border-t`, `py-16`, `max-w-[1200px]`.
- [ ] **Step 5:** Run `npx playwright test tests/e2e/shell.spec.ts tests/e2e/landing.spec.ts tests/e2e/billing.spec.ts`. Expected: PASS.
- [ ] **Step 6:** Run `node scripts/screenshots.mjs task-2 / /pricing`, then commit with `feat(ui): linear-style marketing nav and footer`.

### Task 3: Landing page

**Files:**
- Modify: `app/(marketing)/page.tsx`, `components/marketing/ExampleTabs.tsx`, `components/marketing/PricingTable.tsx`, `messages/{tr,en}.json` (`hero.badge`, `landing.modules.*.label`, `landing.cta.*`)
- Create: `components/marketing/AppFrame.tsx` (a fake app window: 3 traffic-light dots, a mini sidebar with Discover/Radar/Studio, and a `children` slot)
- Test: `tests/e2e/landing.spec.ts`

**Interfaces:**
- Consumes: Task 1 tokens and Task 2 shell.
- Produces: `<AppFrame active="discover" | "radar" | "studio">{children}</AppFrame>`.

Section order follows Linear's homepage rhythm. Section ids and accessible names stay the same.

1. **Hero:**
   - Left-aligned, `pt-32`.
   - A pill badge links to `/discover` (`hero.badge`, e.g. "Yeni: Radar kişisel açılar →").
   - Then the H1 (existing copy) and the subtitle in `text-secondary text-lg max-w-xl`.
   - Then two CTAs: primary `lg` and secondary `lg`.
2. **Product visual:** the live Discover preview (the existing `#preview` region, existing heading) rendered inside `AppFrame`, with a top radial glow (`bg-[radial-gradient(ellipse_at_top,rgba(94,106,210,0.15),transparent_60%)]`) and a 1px `border-strong` frame.
3. **Source strip:** a muted single row of source type names (Hacker News, GitHub, Product Hunt, arXiv, Reddit, RSS) as plain text, not logos.
4. **Modules (`#modules`):** three "Fig" cards with captions `1.0 Discover`, `2.0 Radar`, `3.0 Studio` in mono tertiary, a title and body. Each card is `surface-1`, `border`, `rounded-xl`, with a small illustrative mini-UI made of plain divs (rows/bars), not images.
5. **Problem, pipeline, example:** each section gets a mono section label (`landing.*.label`, e.g. `2.1 Pipeline`). The large heading is `text-3xl sm:text-5xl tracking-[-0.03em]`. Pipeline steps become a horizontal numbered timeline. Example tabs sit in an `AppFrame active="studio"`.
6. **Pricing (`#pricing`):** the PricingTable cards are restyled as `surface-1` with `border` and `rounded-xl`; the highlighted plan gets a `border-strong` and an indigo top line.
7. **FAQ:** unchanged markup, restyled.
8. **Closing CTA band (new, `#cta`):** a centered heading (`landing.cta.title`), primary and secondary buttons, and a glow.

- [ ] **Step 1:** Add the test `landing shows hero badge, module figures and closing CTA`. It asserts:
  - A link containing `landing`'s `hero.badge` text points to `/discover`.
  - `page.getByText("1.0 Discover")` is visible.
  - The region named `landing.cta.title`'s TR text contains a link to `/login?next=%2Fonboarding`.
- [ ] **Step 2:** Run `npx playwright test tests/e2e/landing.spec.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement the sections above, adding TR and EN messages (the i18n parity unit test must stay green).
- [ ] **Step 4:** Run `npm test && npx playwright test tests/e2e/landing.spec.ts tests/e2e/shell.spec.ts tests/e2e/billing.spec.ts`. Expected: PASS, including the existing 375 px no-scroll check.
- [ ] **Step 5:** Run `node scripts/screenshots.mjs task-3 /`, then commit with `feat(ui): linear-style landing page`.

### Task 4: App shell with sidebar

**Files:**
- Create: `components/shell/AppSidebar.tsx` (server), `components/shell/SidebarNav.tsx` (client: active state via `usePathname`), `components/shell/MobileSidebar.tsx` (client: menu button and slide-over), `components/shell/PageHeader.tsx`
- Modify: `app/(app)/layout.tsx` (sidebar layout instead of TopNav), `messages/{tr,en}.json` (`nav.app`, `nav.menu`, `nav.admin`)
- Delete: nothing. `TopNav.tsx` is still used by `(auth)`; Task 7 decides its fate.
- Test: create `tests/e2e/app-shell.spec.ts`; update `tests/e2e/shell.spec.ts` only where it asserts the old app nav.

**Interfaces:**
- Produces:
  - `<PageHeader title: string; actions?: ReactNode; children?: ReactNode />` renders an `h-12 border-b px-4` bar. The title is `<h1 className="text-sm font-medium">`; `children` is a second row for filters.
  - The sidebar is `<nav aria-label={t("nav.app")}>`.

Layout:
- **Desktop (`md+`):** a fixed `w-60` sidebar with `bg-canvas` and `border-r`, and main content in `bg-surface-1` with `md:rounded-l-xl md:border`, inset like Linear's app.
- **Sidebar contents:**
  - Top: the logo row, then a search button labelled `nav.search` that focuses `/discover`'s search (it links to `/discover?focus=search`).
  - Groups:
    - Modules: Discover (`Compass`), Radar (`Radar`), Studio (`PenLine`).
    - Hesap: Ayarlar (`Settings`), plus Admin (`Shield`) only when `requireAdmin()` returns a user.
  - Bottom: LanguageSwitcher and the user's email with a sign-out button.
  - Signed out: a "Giriş yap" button and the CTA instead of the Account group and the Radar/Studio links.
- **Items:** `h-7 rounded-md px-2 text-[13px] text-secondary`; hover `surface-2`; active `surface-3 text-primary` with `aria-current="page"` (prefix match on the module path).
- **Mobile (`< md`):** a top bar with the logo and a menu button (`aria-label={t("nav.menu")}`, `aria-expanded`). The button opens the same nav in a left slide-over; Escape or a backdrop click closes it, and focus returns to the button.

- [ ] **Step 1:** Write `app-shell.spec.ts`:
  - Signed out, `/discover` shows the nav `Uygulama` with links Discover and "Giriş yap", and no Studio link.
  - Signed in (`signIn(page, "/studio/new")`), Studio has `aria-current="page"` and Radar does not.
  - At 375 px the nav is hidden. Clicking `Menü` shows it; Escape hides it and focus is back on `Menü`. There is no horizontal scroll.
  - A non-admin sees no Admin link.
- [ ] **Step 2:** Run `npx playwright test tests/e2e/app-shell.spec.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement the components and the layout. FeedbackWidget stays mounted in the layout.
- [ ] **Step 4:** Run `npx playwright test`. Expected: all PASS. Update assertions only where a spec targeted the old TopNav inside app pages, and list each change in the commit body.
- [ ] **Step 5:** Run `node scripts/screenshots.mjs task-4 /discover --auth /radar /studio`, then commit with `feat(ui): linear-style app shell with sidebar`.

### Task 5: Discover in the app shell

**Files:**
- Modify:
  - `app/(app)/discover/page.tsx` and `app/(app)/discover/[storyId]/page.tsx`
  - In `components/discover/`: `CategoryNav.tsx` (becomes a horizontal filter bar), `RangeTabs.tsx` (segmented control), `SearchBox.tsx`, `SidePanels.tsx`, `LoadMore.tsx`
  - In `components/story/`: `StoryCard.tsx`, `SignalBar.tsx`, `PlatformSignals.tsx`, `ScoreBreakdown.tsx`, `SourceList.tsx`
- Test: `tests/e2e/discover.spec.ts`, `tests/e2e/story.spec.ts`

**Interfaces:**
- Consumes: `PageHeader` (Task 4).

Layout:
- `PageHeader` has the title (existing H1 text). Its actions are RangeTabs (a segmented control: `surface-2` track, `surface-3` active pill, `h-7`) and SearchBox (`h-7`, `⌘K` hint chip). Its children are the CategoryNav row of filter chips with counts.
- Body: the story list fills the width, with SidePanels as a right column at `xl` only.
- StoryCard becomes a Linear issue-row style list item inside one bordered `rounded-lg` container with `divide-y`:
  - Row 1: a signal dot (color from `signalLevel`), the title (`text-[14px] font-medium`, truncated on a single line at `sm+`), and the right-aligned mono score.
  - Row 2: summary (`text-secondary`, 2-line clamp) and the mono meta line (tertiary).
  - Actions show on hover or focus at `md+` and always on touch.
  - Keep every existing accessible name: headings, the "why it matters" disclosure, action buttons.
- Story detail is a two-column page: content on the left and a properties panel on the right (score breakdown, sources, sparkline), like Linear's issue view.

- [ ] **Step 1:** Add to `discover.spec.ts` the test `story titles truncate at 375 px`. It seeds a story with a 200-character title, then asserts `scrollWidth <= innerWidth` and that the title element has `text-overflow: ellipsis` or a line clamp.
- [ ] **Step 2:** Run `npx playwright test tests/e2e/discover.spec.ts`. Expected: the new test FAILS.
- [ ] **Step 3:** Implement the layout above.
- [ ] **Step 4:** Run `npx playwright test tests/e2e/discover.spec.ts tests/e2e/story.spec.ts tests/e2e/landing.spec.ts`. Expected: PASS. Landing uses StoryCard in the preview.
- [ ] **Step 5:** Run `node scripts/screenshots.mjs task-5 /discover /discover/<seeded-slug>`, then commit with `feat(ui): discover as linear-style list`.

### Task 6: Radar and Studio in the app shell

**Files:**
- Modify:
  - `app/(app)/radar/page.tsx`, `app/(app)/radar/settings/page.tsx`
  - In `components/radar/`: `RadarRow.tsx`, `RadarActions.tsx`, `AngleButton.tsx`, `NicheForm.tsx`, `TermInput.tsx`
  - `app/(app)/studio/page.tsx`, `app/(app)/studio/new/page.tsx`, `app/(app)/studio/[briefId]/page.tsx`
  - In `components/studio/`: `BriefEditor.tsx`, `ControlFields.tsx`, `NewBriefForm.tsx`
- Test: `tests/e2e/radar.spec.ts`, `radar-done.spec.ts`, `studio.spec.ts`, `studio-done.spec.ts`, `onboarding.spec.ts`

**Interfaces:**
- Consumes: `PageHeader` (Task 4) and the StoryCard row styling (Task 5) as reference.

**Radar:**
- The `PageHeader` title is "Radar" and its actions are the niche selector (`h-7` select styled as a Linear dropdown) and a settings link.
- The three buckets are Linear-style groups: a sticky group header row (`h-9 surface-2`) with a colored status icon (green for high, yellow for early, indigo for gap), the label and a count. Rows inside are dense (`h-auto py-2`).
- Locked rows show a blurred placeholder line and an inline "Yükselt" chip linking to `/pricing`.

**Studio:**
- The list is a table-like list: title, platform chip, status chip (queued/generating/ready/failed with colored dots), published check, and relative time.
- `/studio/new` and `/studio/[id]` are two-pane: a left `w-80` panel with ControlFields and the right output with a tab bar.
- The editor uses `surface-2` textareas with no visible borders until focus.

Shared: forms (`NicheForm`, onboarding steps) use one input style: `h-8 surface-2 border rounded-md text-[13px]`, focus `ring-brand`.

- [ ] **Step 1:** Add to `radar.spec.ts` the test `bucket groups show counts`. It asserts each bucket heading row contains a number equal to the count of rows in that section.
- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3:** Implement Radar, then Studio.
- [ ] **Step 4:** Run `npx playwright test tests/e2e/radar.spec.ts tests/e2e/radar-done.spec.ts tests/e2e/studio.spec.ts tests/e2e/studio-done.spec.ts tests/e2e/onboarding.spec.ts`. Expected: PASS.
- [ ] **Step 5:** Run `node scripts/screenshots.mjs task-6 --auth /radar /studio /studio/new /onboarding`, then commit with `feat(ui): radar and studio in linear style`.

### Task 7: Remaining pages

**Files:**
- Modify: `app/(auth)/layout.tsx`, `app/(auth)/login/page.tsx`, `app/(app)/settings/page.tsx`, `app/(app)/admin/page.tsx`, `app/(app)/onboarding/page.tsx`, `app/(marketing)/pricing/page.tsx`, `app/(marketing)/unsubscribed/page.tsx`, `components/feedback/FeedbackWidget.tsx`, `components/settings/BillingActions.tsx`, `components/admin/*`, `components/shell/EmptyPage.tsx`
- Delete: `components/shell/TopNav.tsx` once nothing imports it.
- Test: `tests/e2e/auth.spec.ts`, `settings.spec.ts`, `billing.spec.ts`, `admin.spec.ts`, `feedback.spec.ts`

Changes:
- **Login:** a centered `max-w-sm` card on canvas with a logo glyph on top, `surface-1`, `border`, `rounded-xl`; OAuth buttons are secondary and full width. No nav.
- **Settings and admin:** `PageHeader`, then Linear settings style: left-aligned `max-w-2xl` sections with a heading, a description and a divided list of setting rows (label left, control right).
- **Pricing:** inside the marketing shell, with a hero heading and the Task 3 PricingTable.
- **Feedback widget:** a `surface-2` bordered pill button with a `MessageSquare` icon; the panel restyled.

- [ ] **Step 1:** Run `npx playwright test tests/e2e/auth.spec.ts tests/e2e/settings.spec.ts tests/e2e/billing.spec.ts tests/e2e/admin.spec.ts tests/e2e/feedback.spec.ts` before changing anything. Expected: PASS (baseline).
- [ ] **Step 2:** Restyle the pages and delete TopNav.
- [ ] **Step 3:** Rerun the same command. Expected: PASS.
- [ ] **Step 4:** Run `node scripts/screenshots.mjs task-7 /login /pricing --auth /settings /admin`, then commit with `feat(ui): login, settings, admin, pricing restyle`.

### Task 8: Polish and full check

- [ ] **Step 1:** Run the self-review against Global Constraints:
  - No Linear name, logo or copy.
  - Grep `text-\[#62666d\]|text-text-tertiary` and confirm every hit is metadata.
  - Grep for leftover `bg-card` or `max-w-6xl` from the old design.
  - Fix anything found.
- [ ] **Step 2:** Run Lighthouse (mobile) on `/` and `/discover` against `npm run build && npm start`. Expected: performance ≥ 90.
- [ ] **Step 3:** Run the full suite: `npm run lint && npm test && npm run typecheck && npm run test:integration && npx supabase test db && npx playwright test && npm run build`. Expected: exit 0.
- [ ] **Step 4:** Run `node scripts/screenshots.mjs final / /pricing /discover --auth /radar /studio /studio/new /settings`, and write `docs/redesign/README.md` listing the screenshots for the user.
- [ ] **Step 5:** Commit with `chore(ui): redesign polish and screenshots`.
