import { expandIngredients } from "@/lib/components";
import { loadComponentMap } from "@/lib/load-components";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import type { Metadata } from "next";
import { requireHousehold } from "@/lib/household";
import { Nav } from "@/components/nav";
import { missingStarterCount, seedStarterRecipes } from "@/lib/seed-recipes";
import { formatMinutes } from "@/lib/format";
import { mainProtein } from "@/lib/protein";
import { searchText } from "@/lib/recipe-search";
import { costIfKnown, estimateCost, money, type SavedMatch } from "@/lib/recipe-cost";
import { scaleFactor } from "@/lib/scale";
import { addDays, todayET, weekStartOf } from "@/lib/dates";
import { Plus, ThumbsDown, ThumbsUp } from "lucide-react";
import { Badge, DietBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { FavoriteButton } from "./controls";
import { FiltersSheet, type FilterState } from "./filters";
import { RecipeTile } from "./recipe-tile";
import { ResultList, SearchBox, SearchChipLink, SearchProvider, type SearchItem } from "./search";

export const metadata: Metadata = { title: "Recipes" };

async function addStarterRecipes() {
  "use server";
  const { supabase, householdId, user } = await requireHousehold();
  await seedStarterRecipes(supabase, householdId, user.id);
  revalidatePath("/recipes");
}

async function setArchived(formData: FormData) {
  "use server";
  const { supabase } = await requireHousehold();
  await supabase
    .from("recipes")
    .update({ archived: formData.get("archive") === "true", favorite: false })
    .eq("id", String(formData.get("id")));
  revalidatePath("/recipes");
}

async function deleteForever(formData: FormData) {
  "use server";
  const { supabase } = await requireHousehold();
  await supabase.from("recipes").delete().eq("id", String(formData.get("id")));
  revalidatePath("/recipes");
}

type Params = {
  q?: string;
  fav?: string;
  quick?: string;
  diet?: string;
  p?: string;
  s?: string;
  removed?: string;
  f?: string; // older links: ?f=favorites etc.
};

export default async function RecipesPage({ searchParams }: { searchParams: Promise<Params> }) {
  const raw = await searchParams;
  // Older bookmarks used a single ?f=... value; translate them.
  const legacy = raw.f ?? "";
  const q = raw.q ?? "";
  const fav = raw.fav === "1" || legacy === "favorites";
  const quick = raw.quick === "1" || legacy === "quick";
  const diet = raw.diet || (["both", "keto", "family"].includes(legacy) ? legacy : "");
  const p = raw.p ?? "";
  const s = raw.s || "name";
  const removed = raw.removed === "1" || legacy === "archived";

  const { supabase, householdId } = await requireHousehold();
  const today = todayET();

  const [missing, { data: all }, { data: ings }, { data: made }] = await Promise.all([
    missingStarterCount(supabase, householdId),
    supabase
      .from("recipes")
      .select(
        "id, name, description, diet, prep_minutes, cook_minutes, difficulty, tags, favorite, archived, rating, image_url"
      ),
    supabase.from("recipe_ingredients").select("recipe_id, name, qty, unit, category, family_only, component_id, from_scratch"),
    // Every meal on the plan through the end of this week counts, so planning a week is what adds to the total.
    supabase.from("planned_meals").select("recipe_id, day").not("recipe_id", "is", null).eq("kind", "recipe").lte("day", addDays(weekStartOf(today), 6)),
  ]);

  const comps = await loadComponentMap(supabase);
  const rawBy = new Map<string, NonNullable<typeof ings>>();
  for (const i of ings ?? []) rawBy.set(i.recipe_id, [...(rawBy.get(i.recipe_id) ?? []), i]);
  const ingsBy = new Map(
    [...rawBy].map(([id, rows]) => [
      id,
      expandIngredients(rows.map((r) => ({ ...r, qty: r.qty == null ? null : Number(r.qty) })), comps),
    ])
  );
  const lastMade = new Map<string, string>();
  const timesMade = new Map<string, number>();
  for (const m of made ?? []) {
    if (!m.recipe_id) continue;
    timesMade.set(m.recipe_id, (timesMade.get(m.recipe_id) ?? 0) + 1);
    // "Made 3 days ago" only looks at days that have happened, not the rest of this week's plan.
    if (m.day <= today && (!lastMade.has(m.recipe_id) || m.day > lastMade.get(m.recipe_id)!)) {
      lastMade.set(m.recipe_id, m.day);
    }
  }
  const timesOf = (id: string) => timesMade.get(id) ?? 0;

  const total = (r: { prep_minutes: number | null; cook_minutes: number | null }) =>
    (r.prep_minutes ?? 0) + (r.cook_minutes ?? 0);
  const protein = (id: string) => mainProtein(ingsBy.get(id) ?? []);
  const term = q.trim().toLowerCase();

  // "Cheapest" ranks by the saved Kroger prices. A recipe with too few priced ingredients has no honest number, so it goes last.
  const costOf = new Map<string, number | null>();
  if (s === "cheapest") {
    const [{ data: saved }, { data: stapleRows }, { data: hh }] = await Promise.all([
      supabase.from("kroger_matches").select("name_key, price, size, description").eq("household_id", householdId),
      supabase.from("pantry_staples").select("name_key").eq("household_id", householdId),
      supabase.from("households").select("default_protein_lbs").eq("id", householdId).single(),
    ]);
    const matches = new Map<string, SavedMatch>(
      (saved ?? []).map((m) => [m.name_key, { price: m.price == null ? null : Number(m.price), size: m.size, description: m.description }])
    );
    const staples = new Set((stapleRows ?? []).map((x) => x.name_key));
    const lbs = Number(hh?.default_protein_lbs ?? 2);
    for (const r of all ?? []) {
      const list = ingsBy.get(r.id) ?? [];
      costOf.set(r.id, costIfKnown(estimateCost(list, scaleFactor(list, lbs), 1, matches, staples)));
    }
  }

  const recipes = (all ?? [])
    .filter((r) => r.archived === removed)
    .filter((r) => !fav || r.favorite)
    .filter((r) => !quick || r.tags?.includes("quick") || total(r) <= 30)
    .filter((r) => !diet || r.diet === diet)
    .filter((r) => !p || protein(r.id) === p)
    .filter((r) => s !== "frequent" || timesOf(r.id) > 0)
    .sort((a, b) => {
      if (s === "frequent") {
        // Most often first. A tie goes to the one made more recently.
        return timesOf(b.id) - timesOf(a.id) || (lastMade.get(b.id) ?? "").localeCompare(lastMade.get(a.id) ?? "") || a.name.localeCompare(b.name);
      }
      if (s === "time") return total(a) - total(b) || a.name.localeCompare(b.name);
      if (s === "rating") {
        // Liked first, then not yet rated, then not-a-fan; favorites win a tie.
        return (b.rating ?? 0) - (a.rating ?? 0) || Number(b.favorite) - Number(a.favorite) || a.name.localeCompare(b.name);
      }
      if (s === "cheapest") {
        const ca = costOf.get(a.id) ?? null;
        const cb = costOf.get(b.id) ?? null;
        if (ca != null && cb != null) return ca - cb || a.name.localeCompare(b.name);
        if (ca != null) return -1;
        if (cb != null) return 1;
        return a.name.localeCompare(b.name);
      }
      if (s === "recent") {
        // Never made first, then the longest ago.
        const la = lastMade.get(a.id) ?? "";
        const lb = lastMade.get(b.id) ?? "";
        return la.localeCompare(lb) || a.name.localeCompare(b.name);
      }
      return a.name.localeCompare(b.name);
    });

  // A link that flips one choice and keeps the rest.
  const state = { q, fav: fav ? "1" : "", quick: quick ? "1" : "", diet, p, s, removed: removed ? "1" : "" };
  const href = (over: Partial<typeof state>) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...state, ...over })) {
      if (v && !(k === "s" && v === "name")) params.set(k, v);
    }
    const qs = params.toString();
    return qs ? `/recipes?${qs}` : "/recipes";
  };

  // The count on the Filters chip: only choices that live inside the sheet (not the chips you can already see).
  const sheetCount = [p, diet === "keto" || diet === "family" ? diet : "", s !== "name" ? s : "", removed ? "1" : ""].filter(Boolean).length;
  const anyFilter = fav || quick || !!diet || !!p || removed || s !== "name";
  const filterState: FilterState = { q, fav, quick, diet, p, s, removed };

  const madeLabel = (id: string) => {
    const l = lastMade.get(id);
    if (!l) return timesOf(id) ? "On this week's plan" : "Never made";
    const days = Math.round((Date.parse(today + "T00:00:00Z") - Date.parse(l + "T00:00:00Z")) / 86_400_000);
    if (days <= 0) return "Made today";
    if (days < 7) return `Made ${days} day${days === 1 ? "" : "s"} ago`;
    const wk = Math.round(days / 7);
    return `Made ${wk} week${wk === 1 ? "" : "s"} ago`;
  };

  const items: SearchItem[] = recipes.map((r) => ({
    id: r.id,
    text: searchText(r, (ingsBy.get(r.id) ?? []).map((i) => i.name)),
    node: (
            <li>
              <Card padded={false} className="relative flex h-full flex-col overflow-hidden">
                <div className="relative">
                  {r.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={r.image_url}
                      alt=""
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      className="h-36 w-full object-cover"
                    />
                  ) : (
                    <RecipeTile protein={protein(r.id)} />
                  )}
                  <FavoriteButton
                    id={r.id}
                    favorite={r.favorite}
                    className="absolute top-2 right-2 z-10 rounded-md bg-surface/85 backdrop-blur"
                  />
                </div>
                <div className="flex flex-1 flex-col p-4">
                  <Link
                    href={`/recipes/${r.id}`}
                    className="flex items-center gap-1.5 font-semibold after:absolute after:inset-0 hover:underline"
                  >
                    {r.rating === 1 && <ThumbsUp aria-label="Liked" className="size-4 shrink-0 text-primary-ink" />}
                    {r.rating === -1 && <ThumbsDown aria-label="Not a fan" className="size-4 shrink-0 text-danger-ink" />}
                    {r.name}
                  </Link>
                  <p className="mt-1 line-clamp-2 text-sm text-muted">{r.description}</p>
                  {removed && (
                    <div className="relative z-10 mt-3 flex flex-wrap items-center gap-3 text-sm">
                      <form action={setArchived}>
                        <input type="hidden" name="id" value={r.id} />
                        <input type="hidden" name="archive" value="false" />
                        <SubmitButton>Restore</SubmitButton>
                      </form>
                      <details>
                        <summary className="cursor-pointer py-2 text-danger-ink">Delete forever</summary>
                        <form action={deleteForever} className="mt-2 flex items-center gap-2">
                          <input type="hidden" name="id" value={r.id} />
                          <span className="text-xs">This can&apos;t be undone.</span>
                          <SubmitButton variant="danger">Yes, delete</SubmitButton>
                        </form>
                      </details>
                    </div>
                  )}
                  <div className="mt-auto flex flex-wrap gap-1.5 pt-3">
                    <DietBadge diet={r.diet} />
                    <Badge className="tabular-nums">{formatMinutes(total(r))}</Badge>
                    <Badge>{r.difficulty}</Badge>
                    <Badge>{madeLabel(r.id)}</Badge>
                    {timesOf(r.id) > 0 && (
                      <Badge tone={s === "frequent" ? "info" : "neutral"} className="tabular-nums">
                        {timesOf(r.id)}× total
                      </Badge>
                    )}
                    {s === "cheapest" && (
                      <Badge tone={costOf.get(r.id) != null ? "info" : "neutral"} className="tabular-nums">
                        {costOf.get(r.id) != null ? `about ${money(costOf.get(r.id)!)}` : "no price yet"}
                      </Badge>
                    )}
                  </div>
                </div>
              </Card>
            </li>
    ),
  }));

  return (
    <>
      <Nav />
      <SearchProvider initialQ={q}>
      <main id="main" className="mx-auto w-full max-w-5xl px-4 py-6">
        <div className="mb-3 flex items-center gap-3">
          <h1 className="flex-1 text-2xl font-bold">Recipes</h1>
          <ButtonLink href="/recipes/components" variant="ghost">
            Components
          </ButtonLink>
          <ButtonLink href="/recipes/new" variant="primary">
            <Plus aria-hidden className="size-4" /> Add recipe
          </ButtonLink>
        </div>

        <SearchBox
          keep={{
            ...(fav ? { fav: "1" } : {}),
            ...(quick ? { quick: "1" } : {}),
            ...(diet ? { diet } : {}),
            ...(p ? { p } : {}),
            ...(s !== "name" ? { s } : {}),
            ...(removed ? { removed: "1" } : {}),
          }}
        />

        {/* threshold keeps the banner away if you delete a couple of starters for good */}
        {missing >= 10 && !anyFilter && !term && (
          <form
            action={addStarterRecipes}
            className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-primary/40 bg-primary-soft p-3 text-sm"
          >
            <span className="flex-1">
              {missing} more starter recipes are available: Peruvian, Asian, Indian, Greek, Italian
              and more, all with keto and family versions.
            </span>
            <SubmitButton variant="primary">Add them</SubmitButton>
          </form>
        )}

        {/* One row that scrolls sideways. Everything else is behind the Filters chip. */}
        <div className="-mx-4 mb-2 flex gap-2 overflow-x-auto px-4 pb-1">
          <FiltersSheet state={filterState} count={sheetCount} />
          <SearchChipLink
            className="shrink-0"
            href={href({ fav: "", quick: "", diet: "", p: "", s: "name", removed: "" })}
            on={!anyFilter}
          >
            All
          </SearchChipLink>
          <SearchChipLink className="shrink-0" href={href({ fav: fav ? "" : "1" })} on={fav}>
            Favorites
          </SearchChipLink>
          <SearchChipLink className="shrink-0" href={href({ s: s === "frequent" ? "name" : "frequent" })} on={s === "frequent"}>
            Frequent
          </SearchChipLink>
          <SearchChipLink className="shrink-0" href={href({ diet: diet === "both" ? "" : "both" })} on={diet === "both"}>
            Keto + family
          </SearchChipLink>
          <SearchChipLink className="shrink-0" href={href({ quick: quick ? "" : "1" })} on={quick}>
            Quick
          </SearchChipLink>
        </div>
        <ResultList
          items={items}
          suffix={removed ? " (removed)" : ""}
          empty={
            removed ? (
              "Nothing has been removed."
            ) : (
              <>
                No recipes match.{" "}
                <Link href="/recipes" className="text-primary-ink underline">
                  Clear filters
                </Link>
              </>
            )
          }
        />
      </main>
      </SearchProvider>
    </>
  );
}
