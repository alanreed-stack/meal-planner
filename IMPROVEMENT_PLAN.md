# Meal Planner improvement plan

This picks up after Phase 11. It is written to be handed to Claude Code one step at a time.
Each step is self-contained: what is wrong today, what to build, which files, and how to tell it is done.

How to use it: start a session and say "Do Step 1 of IMPROVEMENT_PLAN.md". Review, then move to the next.
Steps are ordered so the fixes and the plumbing come first. Steps 5 to 10 can be done in any order.

## Rules for every step

- Read `AGENTS.md` first. This is Next.js 16, so check `node_modules/next/dist/docs/` before using an API from memory.
- Reuse what is in `components/ui/` and the color tokens in `app/globals.css`. No raw palette colors, no new UI library.
- Phone first. Every tap target stays at least 44px. Check both light and dark.
- Keep the existing feel: taps respond instantly (`useOptimistic`), removals are undoable (`components/removable.tsx`), results show as toasts.
- One step per commit, message in the existing style: `Phase 12: ...`, `Phase 13: ...`.
- Before committing run `npm run lint`, `npx tsc --noEmit` and `npm run build`.
- The database schema is not in this repo. Any step marked **DB** needs a Supabase migration. Save the SQL under `supabase/migrations/` as well, and make sure new tables and columns are covered by the household row-level security rules.
- Don't change the Kroger matching or packaging math unless the step says so.

---

## Step 1 (Phase 12): Fix what is broken or misleading

Small fixes, all found by reading the code. Do these first.

1. **Rebuilding the list forgets what is already in the Kroger cart.** `generateList` in `app/shopping/actions.ts` deletes every non-manual row and inserts fresh ones without `sent_at` or `picked`. So after sending, a rebuild makes every item look unsent, and the next "Send" adds them to the Kroger cart a second time. Carry `sent_at` and `picked` over for rows with the same name and unit. If the packages to buy went up since it was sent, clear `sent_at` and show a "more needed" badge instead.
2. **"Change store" goes to the wrong page.** `app/settings/page.tsx:155` and `app/recipes/[id]/page.tsx:198` link to `/shopping/store`, which is the in-store checklist. The store picker is at the bottom of `/shopping`. Give the Kroger card on the shopping page `id="kroger"` and link to `/shopping#kroger`.
3. **"Copy last week" doubles the week.** `copyLastWeek` in `app/plan/actions.ts` inserts last week's meals even when this week already has some, and the button is always in the header (`app/plan/page.tsx:211`). Only copy into day and meal slots that are empty, and toast "Copied 5 dinners" or "Last week was empty".
4. **Picking a Kroger product loses your week.** `app/shopping/match/[id]/page.tsx:54` and the redirect at `app/shopping/kroger-actions.ts:204` both go to plain `/shopping`. Look up the item's week and return to `/shopping?w=...`, scrolled to that item.
5. **Store search ZIP is hard-coded** at `app/shopping/page.tsx:35`. Add a `zip` column on `households` (**DB**), save it when a store is chosen, and use it as the default. Leave the box empty if none is saved.
6. **No "This week" button on Shopping.** The Week page has one, Shopping doesn't. Add it.
7. **"Plan tonight" on Home** drops you at the top of the Week page. Link to `/plan?add=<today>` and have `AddMeal` open itself for that day.
8. **New households land on Recipes.** `app/setup/page.tsx:24` and `:36` redirect to `/recipes`. Send them to `/` (Step 6 adds a getting-started card there).
9. Tidy up: `KIND_LABEL` is defined in both `app/page.tsx` and `app/plan/page.tsx`, and `CATEGORIES` in both shopping pages. Move them to `lib/`.

Done when: send a list, rebuild it, and the "in cart" badges are still there and nothing is offered to send again.

---

## Step 2 (Phase 13): Put the database and its types in the repo

Nothing visible changes here, but every later step is safer and faster for it.

- Pull the current schema into `supabase/migrations/0001_baseline.sql` (tables, RLS policies, and the `create_household` / `join_household` functions).
- Generate TypeScript types into `lib/supabase/types.ts` and pass them to the client in `lib/supabase/server.ts`.
- Remove the `as unknown as {...}` casts (there are several in `app/plan/page.tsx`, `app/page.tsx`, `app/shopping/page.tsx`, `lib/household.ts`).
- Add Vitest and tests for the pure functions that decide money and quantities: `lib/scale.ts`, `lib/packaging.ts`, `lib/format.ts`, `lib/autofill.ts`, `lib/match.ts`. Add `npm test`.
- Replace the stock `README.md` with a short real one: what the app does, the env vars it needs, how to run it.

Done when: `npx tsc --noEmit` passes with no `as unknown as` left in `app/`, and `npm test` is green.

---

## Step 3 (Phase 14): Stay on the week you are working on

Today the bottom tabs always point at the current week. Most planning happens on the weekend for the week ahead, so: plan next week, tap Shopping, and you are looking at this week's list. Easy to build or send the wrong one.

- When you are on `/plan?w=X` or `/shopping?w=X`, the Week and Shopping tabs in `components/nav-tabs.tsx` should keep `w=X`.
- Show a clear label when the week on screen is not the current one: "Next week" or "Last week" next to the date range, on both pages.
- From Saturday on, if next week has fewer than three dinners planned, Home shows a "Plan next week" card that links straight there.
- The Groceries card on Home (`app/page.tsx`) only looks at this week. Show whichever week has an unsent list, and say which week it is.
- On the Week page add a "Shopping list for this week" button at the bottom, carrying the same week.

Done when: you can plan next week, build its list and send it without retyping or re-picking the week anywhere.

---

## Step 4 (Phase 15): The shopping list keeps up with the plan

Today the list only changes when someone taps "Rebuild list". Add a meal on Wednesday and the list quietly stays wrong.

- **DB**: add `list_built_at` to `weeks`, and bump a `plan_changed_at` whenever a meal is added, removed, moved or its pounds change (`app/plan/actions.ts`).
- If the plan changed after the list was built, show a banner on Shopping: "Your plan changed since this list was built" with an "Update list" button. Also a small dot on the Shopping tab.
- After an update, toast what changed: "Added 6 items, removed 2".
- After building a list when a store is already chosen, run the Kroger matching automatically for new items, so "Match items" stops being a separate chore.
- Depends on Step 1.1, so updating never forgets what was sent.

Done when: adding a dinner shows the banner on Shopping, and one tap brings the list up to date with matches filled in.

---

## Step 5 (Phase 16): One clear path from list to Kroger cart

The shopping page (`app/shopping/page.tsx`) has five jobs: build, pick a store, connect, match, send. The store picker and the Connect button sit in a card at the very bottom, under the whole list. A first-time user has to find them by scrolling.

- Add a short progress strip under the header: **List built → Store chosen → Kroger connected → Items matched → Sent**. Finished steps get a check. The next unfinished step is the one big button. Once all five are done the strip collapses to one line.
- Until a store is chosen and Kroger is connected, show that setup card above the list, not below it.
- Add a "Needs a look (n)" filter chip that shows only rows with no match, low confidence, or "check quantity". Those are the only rows worth reading before sending.
- Show the product photo on each matched row and on the match page (`app/shopping/match/[id]/page.tsx`). `lib/kroger.ts` doesn't return images yet. The Kroger products response includes them, so add an image field to `Product` and store it on the item (**DB**: `kroger_image` on `shopping_items` and `kroger_matches`).
- Put plus and minus buttons for "packages to buy" on the row itself. Right now it is a number box inside the ⋯ menu.
- Typing in "Add an item" should suggest things bought before (from `kroger_matches`) so regulars like milk are one tap.
- Add "Share list": copies the checked items as plain text, grouped by aisle, through the phone's share sheet.

Done when: a brand-new household can go from an empty page to items in the Kroger cart by following only the highlighted button.

---

## Step 6 (Phase 17): Home tells you what to do next

Home (`app/page.tsx`) shows tonight, coming up and a grocery bar. It could carry more of the week.

- **Getting started card** for new households: add or pick recipes, plan the week, choose a store, connect Kroger, set "things we always have". Each line checks itself off. The card disappears when all are done.
- **This week's status in one line**: "5 of 7 dinners planned · list built · 18 of 24 in cart", each part a link.
- **Rate last night** on Home. It lives only on the Week page today (`app/plan/rate-row.tsx`). Reuse `RateRow`.
- **Heads-up for tomorrow**: if tomorrow's dinner is a slow-cooker or 2-hour-plus recipe, say "Tomorrow: start the pot roast by 1:30". If tomorrow's meat is likely frozen, "Move the chicken to the fridge tonight". Make the thaw reminder a setting, off by default.
- When nothing is planned tonight, offer three quick picks (favorites under 30 minutes, not made lately) that add with one tap, plus Leftovers and Eating out.
- Give each "Coming up" row its recipe thumbnail.

Done when: opening the app at 4pm answers "what is for dinner, when do I start, is anything left to buy" without a second tap.

---

## Step 7 (Phase 18): Week page, better on a computer and quicker on a phone

`app/plan/page.tsx` is one tall column of seven cards on every screen size, and moving a meal means opening a menu and using a dropdown.

- From the `lg` breakpoint up, lay the days out as a seven-column grid so the whole week fits on one screen.
- Drag a meal to another day with mouse or touch. Dropping onto a day that already has a dinner swaps the two. Keep the "Move to" menu for keyboard and screen-reader users.
- "Move to" should also offer next week, not just the seven days on screen.
- Add "Swap for something else" in a meal's menu: one tap replaces it using the same rules as Fill the week (`reshuffleDay` in `lib/autofill.ts`), with Undo.
- Show a small recipe photo or protein tile beside each dinner.
- Past days in the current week collapse to a single line so today is at the top without scrolling.
- "Add meal" picker (`app/plan/add-meal.tsx`): put a "Suggested" group of four at the top (same scoring as autofill), show thumbnails, and keep the search box focused on desktop.
- "Fill the week" should let you tap a suggestion to choose a specific recipe, not only shuffle.
- A week summary line under the header: "5 dinners · chicken 2, beef 2, fish 1 · about $140" using saved Kroger prices.

Done when: on a laptop the whole week is visible at once and a dinner can be moved by dragging; on a phone a dinner can be replaced in two taps.

---

## Step 8 (Phase 19): Cook mode that survives a messy kitchen

`app/recipes/[id]/cook/cook-mode.tsx` keeps progress only in memory. If the phone locks or the page reloads, the checked steps are gone.

- Save checked steps in `localStorage`, keyed by recipe and date. Clear it the next day.
- Make ingredients tappable to tick off while gathering them.
- Find times in step text ("simmer 20 minutes", "bake 1 hour") and show a "Start 20 min timer" button on that step. Running timers stay in the sticky header, and ring with a sound and vibration when done. Several can run at once.
- Add a text size toggle (normal / large) that is remembered.
- A "Next step" button fixed at the bottom so a knuckle can hit it. It marks the current step done and scrolls to the next.
- When the last step is checked, ask thumbs up or down right there and save it against tonight's planned meal (`rateMeal`).
- Pass the planned meal id from Home so the rating and pounds match what was planned.

Done when: lock the phone mid-recipe, unlock it, and you are on the same step with timers still running.

---

## Step 9 (Phase 20): In-store list for two shoppers and bad signal

`app/shopping/store/store-list.tsx` keeps ticks in local state and undoes them if a save fails. With two people in the store, neither sees the other's ticks, and one dropped request un-ticks an item.

- Subscribe to `shopping_items` changes for the week with Supabase Realtime so ticks appear on both phones (**DB**: enable realtime on the table).
- If a save fails, keep the tick, queue it in `localStorage`, and retry when the connection is back. Show a small "Offline, 3 changes waiting" line.
- Add a service worker that caches the in-store page and the app shell so it opens with no signal. The manifest already exists (`app/manifest.ts`).
- Keep the screen awake on this page (same wake-lock code as cook mode; pull it into a shared hook).
- Show how many packages to buy and the matched product name under each item ("2 × Kroger shredded cheddar 8 oz"), plus the aisle number if Kroger returns one for the chosen store.
- A progress line in the header: "12 of 30".
- Use the same realtime on the main shopping page and the Week page so two people planning at once don't overwrite each other.

Done when: two phones on the same list see each other's ticks within a couple of seconds, and ticking still works in airplane mode.

---

## Step 10 (Phase 21): Recipes that are easier to find and add

- **Search as you type.** `app/recipes/page.tsx` already loads every recipe, but the search box is a form you have to submit. Filter in the browser as letters are typed, and also match ingredient names and tags ("what can I make with ground turkey").
- **Photos from the phone.** The form (`app/recipes/new/form.tsx`) only takes a photo web address. Add upload from camera or library to Supabase Storage (**DB**: a storage bucket with household rules), resized in the browser first.
- **Paste a recipe.** Next to "Import from a link", add "Paste recipe text" that splits a pasted block into ingredients and steps using the parser in `lib/recipe-import.ts`.
- **Check ingredients before saving.** Under the ingredients box, show how each line was read (amount, unit, name, aisle) so a bad parse is caught now and not on the shopping list.
- **Family notes** on a recipe ("double the sauce", "kids pick out the peppers"), shown on the recipe page and in cook mode (**DB**: `notes` on `recipes`).
- **Duplicate recipe** button, for making a variation.
- Recipe page: show "Made 6 times, last on Oct 12" and move "Estimated cost" below the steps so ingredients and steps sit together.
- Sort options: add "Highest rated" and "Cheapest".

Done when: typing "turk" narrows the grid instantly, and a recipe can be added with a photo taken on the spot.

---

## Step 11 (Phase 22): Polish

- Appearance setting in Settings: Light, Dark, or Match my phone. Today it only follows the phone (`app/globals.css`).
- Per-person "eats keto" can't be changed after setup. Add an edit control on the members list in `app/settings/page.tsx`, plus rename and a way to leave the household.
- Short page-to-page transitions with the View Transitions API, off when reduced motion is on.
- Pull to refresh on Home, Week and Shopping when installed as an app.
- A friendly error page (`app/error.tsx`) and not-found page (`app/not-found.tsx`) with a way back, instead of the Next.js defaults.
- Add password reset to the login page (`app/login/page.tsx`); there is none today.
- Run an accessibility pass on each page with a screen reader and keyboard only, and fix what turns up.

---

## Later, if you want them

Not planned in detail. Each would be its own step.

- Dinner reminder push notification at the "start by" time.
- Kids' requests: a simple "I want this" button per family member that feeds Fill the week.
- Leftovers that point at the meal they came from, and scale that meal up.
- Weekly grocery spend history with a simple chart.
- Calendar feed (ICS) so dinners show up in the family calendar.
- Breakfast and lunch defaults that repeat every week without re-adding.
