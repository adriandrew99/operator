# Nexus App — Page-by-Page Analysis & Improvement Plan

A systematic review of every page and shared layout, with concrete improvements to make the app feel spectacular.

---

## 1. Layout & Shell

### ClientShell
- **Current:** Sidebar (collapsible), main content area (max-w 1200px, px-6–16, py-12–16, pb-36 on mobile for nav), TopBar, MobileNav, CommandPalette, DebriefPopup, FinanceChat, FocusRefresh, ErrorBoundary.
- **Strengths:** Clear structure; mobile bottom nav; global command palette.
- **Improvements:**
  - Add a subtle “Press ⌘K to search” hint in TopBar (desktop) or on first visit.
  - Ensure content padding accounts for safe-area-inset on notched devices (already has pb-36; verify no overlap).

### Sidebar
- **Current:** Logo, Work (Today, Tasks, Planner), Business (Finance, Pipeline, Outbound), System (Knowledge, Analytics, Score, Settings). Collapse toggle; tooltips when collapsed; debrief dot on Analytics.
- **Strengths:** Logical grouping; SVG icons; debrief indicator.
- **Improvements:** None critical. Optional: remember collapse state in localStorage.

### TopBar
- **Current:** Date (desktop left); on mobile, page title + date. Theme toggle only.
- **Improvements:**
  - Add keyboard shortcut hint: “⌘K” or “Search” that opens CommandPalette.
  - Optional: breadcrumb or back link when in a sub-context (e.g. Outbound campaign detail).

### MobileNav
- **Current:** 5 tabs (Today, Tasks, Plan, Finance, Insights) + “More” (Score, Pipeline, Outbound, Knowledge, Settings).
- **Issue:** Label is “Plan” but sidebar says “Planner” — unify to “Planner” or “Plan” everywhere.
- **Improvements:** Use same label as sidebar (“Planner”); ensure “More” sheet has proper safe-area and scroll when many items.

---

## 2. Today

- **Current:** Hero (date, greeting, quote, streak, load badge), 4 metric cards (Capacity, Tasks, MRR, Habits), two-column layout (Today’s Plan + Week View | Do Next, Schedule, Fundamentals, Recurring, Insights), expandable “More tools” (Revenue Radar, Monkey Brain), pinned note, Day Complete flow, undo toast.
- **Strengths:** Rich hero; clear metrics; Energy Router and calendar; fundamentals/recurring; celebration flow.
- **Improvements:**
  - **Replace 🔥 streak indicator** with an SVG flame or icon (per UI guidelines: no emoji as UI icons).
  - Consider “What’s next?” as default expanded and “More tools” as secondary to reduce cognitive load.
  - Pinned note: add character count (e.g. 0/280) when editing.

---

## 3. Tasks

- **Current:** Header + Add Task; status pills (urgent, overdue, flagged today, due today, low sleep); tabs Active / Completed / Archive; search, sort, category and weight filters; list grouped by category; task row actions (flag, urgent, edit, archive, delete); task form modal; bulk “Archive all” and archive bulk delete.
- **Strengths:** Strong filtering and grouping; optimistic updates; bulk actions.
- **Improvements:**
  - **Replace 💤 in low-sleep pill** with an SVG moon/sleep icon.
  - Add `cursor-pointer` to task rows (click to edit) if not already on the inner div.
  - Consider “Due time” (optional time of day) for tasks, not just date.
  - Empty state: add one primary CTA (e.g. “Add your first task”) that opens the form.

---

## 4. Planner

- **Current:** Single server component that fetches calendar, scheduled/unscheduled tasks, weekly goals, day themes; renders `WeekStrategyBoard`.
- **Strengths:** Week-based view; integrates calendar and tasks.
- **Improvements:**
  - Add a short page title/description in the layout (e.g. “Planner” + “Plan your week”) for consistency with other pages.
  - Optional: “Copy previous week” or “Use template” to seed the week.

---

## 5. Pipeline

- **Current:** Header, Add Lead, 4 metric cards (Pipeline Value, Closed Value, Weighted, Active Leads), Next Action banner, stage sections (Lead → Conversation → Proposal Sent → Closed / Lost), LeadCards with Advance / Lost / Edit / Delete, Lead form modal, Convert to Client modal.
- **Strengths:** Clear stages; weighted value; next action; convert-to-client flow.
- **Improvements:**
  - Add `cursor-pointer` to lead rows (click = edit).
  - Optional: drag-and-drop between stages; pipeline value over time (sparkline or small chart).

---

## 6. Finance

- **Current:** Very large dashboard: tabs (Overview, Clients, Expenses, Forecast, Personal, Year, Banking); month picker; revenue/expenses/tax; What-If mode; overrides; bank import; charts; staff; savings goals; FY view.
- **Strengths:** Deep feature set; What-If; bank integration; multiple views.
- **Improvements:**
  - **Code health:** Split into smaller components (e.g. by tab or by feature block) to improve maintainability.
  - First-time: short onboarding tooltip or checklist (“Add your first client”, “Set monthly expenses”).
  - Mobile: ensure tab bar and key cards are usable and modals scroll.

---

## 7. Analytics

- **Current:** Tabs (Overview, Clients, Trends, Data); charts; Revenue Radar; Weekly Debrief; Scope Creep; layout customiser; collapsible sections; export.
- **Strengths:** Rich insights; configurable layout; export.
- **Improvements:**
  - **Replace 📊 emoji** in section headers with an SVG chart icon.
  - Ensure all chart tooltips use the shared `chart-tooltip` styling and are readable in light/dark.

---

## 8. Knowledge

- **Current:** Stats (Entries, Readings, Completed, Applied, Takeaways); search; type tabs (All, Reading, Ideas, Lessons, Quotes, Models, Content Hooks); entry cards with edit/applied/delete; form modal.
- **Strengths:** Clear types; search; applied flag.
- **Improvements:**
  - Empty state: “Add your first entry” with clear type explanation.
  - Optional: markdown or rich-text preview in cards; tag autocomplete; export (CSV/JSON).

---

## 9. Outbound

- **Current:** Overview (metrics, campaign cards), Compare (table), Detail (single campaign). New campaign form; campaign cards with open action.
- **Strengths:** Funnel metrics; compare view; clear navigation.
- **Improvements:**
  - Add `cursor-pointer` to table rows (click = open campaign).
  - Optional: small funnel viz (Sends → Responses → Calls → Closes); goal targets per campaign.

---

## 10. Review (Weekly Review)

- **Current:** Six reflection prompts (revenue, deep work, training, drift, time waste, meaning); Operator Score trend bar chart; three focus areas; past reviews list.
- **Strengths:** Structured reflection; score trend; focus areas; history.
- **Improvements:**
  - Prompt icons use symbols (◎ ▲ ◇ ⊗ ◈ £). Consider replacing with small SVG icons for consistency and a11y.
  - Optional: “Send to Slack” or “Export week” for sharing.

---

## 11. Score

- **Current:** Bento grid: ScoreHero, DailyCheckIn, RetroactiveCheckIn, 30-day trend, Dimension breakdown, Weekly averages, Milestones.
- **Strengths:** Clear hierarchy; check-in; retroactive; milestones.
- **Improvements:** Minor: ensure dimension labels have sufficient contrast; optional “What affects my score?” explainer.

---

## 12. Settings

- **Current:** Tabs (Profile, Dashboard, Finance, Integrations); profile, goals, fundamentals (with emoji picker), calendar, Slack, notifications, layout, finance settings.
- **Strengths:** Comprehensive; emoji picker for fundamentals is discoverable.
- **Improvements:**
  - **Replace tab icons 👤 📊 💰 🔗** with SVG icons (per UI guidelines).
  - Consider accordion or sub-sections within tabs to reduce scroll.
  - Sign out: ensure button is clearly visible and has hover/active state.

---

## 13. Auth (Login / Signup)

- **Current:** Logo, title, form (email/password), error message, submit, link to signup/login.
- **Strengths:** Simple; clear CTA.
- **Improvements:**
  - Add “Forgot password?” link and flow if not present.
  - Optional: OAuth (Google/GitHub) if product roadmap supports it.
  - Ensure auth layout has same theme (light/dark) as app for consistency.

---

## 14. Home

- **Current:** Redirect to `/today`.
- **Improvements:** If user is not logged in, show a short landing (value prop + Sign in / Sign up) instead of redirecting to login from `/`. If logged in, redirect to `/today` is fine.

---

## 15. Command Palette

- **Current:** Cmd+K opens; navigation + quick actions; uses emojis (🏠 ⚡ 📋 etc.) for command icons.
- **Improvements:**
  - **Replace emoji icons with SVG** for consistency and professionalism.
  - Ensure “Toggle theme” and “Add task” work when palette is open (focus management).

---

## Cross-Cutting Improvements

| Area | Action |
|------|--------|
| **Icons** | Replace all emoji used as UI icons with SVG (Lucide/Heroicons style). Key files: TodayDashboard (streak), TasksDashboard (sleep), SettingsDashboard (tabs), CommandPalette (all), AnalyticsDashboard, HabitInsights, insights actions. |
| **Labels** | Unify “Plan” vs “Planner” in MobileNav and Sidebar. |
| **Discoverability** | Show “⌘K” or “Search” in TopBar (desktop) or once on first visit. |
| **Clickability** | Ensure every clickable row/card has `cursor-pointer` and hover feedback. |
| **Empty states** | Standardise: icon, short message, one primary CTA. |
| **Loading** | Use existing skeleton patterns consistently; avoid layout shift. |
| **Accessibility** | Focus styles on all interactive elements; aria-labels where needed; reduce motion respected (already in globals.css). |
| **Mobile** | Test bottom nav overlap (pb-36), modal scroll, and tap targets (min 44px). |

---

## Priority Order for Implementation

1. **High impact, low effort:** Replace emoji with SVG in Today (streak), Tasks (sleep), Settings (tabs), CommandPalette. Unify Plan/Planner label. Add ⌘K hint to TopBar.
2. **Medium effort:** Replace remaining emoji (Analytics, HabitInsights, insights). Improve empty states with single CTA.
3. **Larger:** Finance dashboard split; optional features (due time, pipeline chart, Knowledge export); auth “Forgot password” and landing for logged-out users.

This document can be updated as improvements are shipped.
