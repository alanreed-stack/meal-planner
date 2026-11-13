# Family Meal Planner

A small web app for one household to plan the week's dinners and shop for them.

- **Recipes** with a keto version and a family version of the same meal, scaled to how many pounds of meat you are cooking.
- **Week plan** for home weeks and travel weeks, with a "fill the rest of the week" suggestion that avoids repeats and the same meat two nights running.
- **Shopping list** built from the plan, matched to products at your Kroger store, priced, and sent to your Kroger cart. Kroger's public API only adds to the cart. It cannot place an order, so you check out on kroger.com.
- **In-store checklist**, **cook mode** with the screen kept awake, and a **cost estimate** on each recipe.
- Two or more people share one household through an invite code, each with their own login.

Built with Next.js 16 (App Router), React 19, Tailwind CSS 4, Supabase (Postgres, row-level security, login) and deployed on Vercel.

## Run it

```bash
npm install
cp .env.example .env.local   # then fill in the values below
npm run dev                  # http://localhost:3000
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | Type check |
| `npm test` | Unit tests (Vitest) for the quantity, packaging, formatting, matching and autofill rules |

## Environment variables

| Name | Where it comes from |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project settings, API |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase project settings, API (the publishable key, safe in the browser) |
| `KROGER_CLIENT_ID` | Kroger developer portal, your application |
| `KROGER_CLIENT_SECRET` | Same place. **Keep it secret.** Set it only as a sensitive variable in Vercel (or `.env.local`), never in code or chat |
| `KROGER_REDIRECT_URI` | Optional. Must match the redirect URL registered in the Kroger portal, ending in `/api/kroger/callback` |

## Database

The schema lives in `supabase/migrations/`.

- `0001_baseline.sql` is the database as of 2026-11-13: tables, indexes, the `is_member`, `create_household` and `join_household` functions, and every row-level security policy. It is a snapshot to rebuild from, not something to run on the existing project.
- Later files are applied in order. Add a new file for every change, and also apply it to the project.
- Every household table is limited to that household's members. Kroger login tokens can be read only by the person they belong to.

Regenerate `lib/supabase/types.ts` after any schema change (Supabase's TypeScript type generator, or `supabase gen types typescript`).

## Layout

```
app/            pages and server actions (plan, shopping, recipes, settings, login)
components/     shared UI; components/ui/ has the building blocks (Button, Sheet, Field, ...)
lib/            pure logic: scale, packaging, match, autofill, format, ingredient parsing, Kroger client
lib/supabase/   Supabase clients and generated types
data/           starter recipe packs
supabase/       database migrations
tests/          unit tests
```

Design tokens (colors, radii) are in `app/globals.css`; use them instead of raw colors, and keep tap targets at least 44px.
Read `AGENTS.md` before changing Next.js code. This version differs from older Next.js.
