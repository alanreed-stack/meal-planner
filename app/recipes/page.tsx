import Link from "next/link";
import { revalidatePath } from "next/cache";
import type { Metadata } from "next";
import { requireHousehold } from "@/lib/household";
import { Nav } from "@/components/nav";
import { missingStarterCount, seedStarterRecipes } from "@/lib/seed-recipes";
import { formatMinutes } from "@/lib/format";
import { mainProtein } from "@/lib/protein";
import { todayET } from "@/lib/dates";
import { Plus, ThumbsDown, ThumbsUp } from "lucide-react";
import { Badge, DietBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChipLink } from "@/components/ui/chip";
import { Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { FavoriteButton } from "./controls";
import { FiltersSheet, type FilterState } from "./filters";
import { RecipeTile } from "./recipe-tile";

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
    supabase.from("recipe_ingredients").select("recipe_id, name, qty, unit, category"),
    supabase.from("planned_meals").select("recipe_id, day").not("recipe_id", "is", null).lte("day", today),
  ]);

  const ingsBy = new Map<string, { name: string; qty: number | null; unit: string | null; category: string }[]>();
  for (const i of ings ?? []) {
    const list = ingsBy.get(i.recipe_id) ?? [];
    list.push({ name: i.name, qty: i.qty == null ? null : Number(i.qty), unit: i.unit, category: i.category });
    ingsBy.set(i.recipe_id, list);
  }
  const lastMade = new Map<string, string>();
  for (const m of made ?? []) {
    if (m.recipe_id && (!lastMade.has(m.recipe_id) || m.day > lastMade.get(m.recipe_id)!)) {
      lastMade.set(m.recipe_id, m.day);
    }
  }

  const total = (r: { prep_minutes: number | null; cook_minutes: number | null }) =>
    (r.prep_minutes ?? 0) + (r.cook_minutes ?? 0);
  const protein = (id: string) => mainProtein(ingsBy.get(id) ?? []);
  const term = q.trim().toLowerCase();

  const recipes = (all ?? [])
    .filter((r) => r.archived === removed)
    .filter((r) => !fav || r.favorite)
    .filter((r) => !quick || r.tags?.includes("quick") || total(r) <= 30)
    .filter((r) => !diet || r.diet === diet)
    .filter((r) => !p || protein(r.id) === p)
    .filter((r) => !term || r.name.toLowerCase().includes(term))
    .sort((a, b) => {
      if (s === "time") return total(a) - total(b) || a.name.localeCompare(b.name);
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
    if (!l) return "Never made";
    const days = Math.round((Date.parse(today + "T00:00:00Z") - Date.parse(l + "T00:00:00Z")) / 86_400_000);
    if (days <= 0) return "Made today";
    if (days < 7) return `Made ${days} day${days === 1 ? "" : "s"} ago`;
    const wk = Math.round(days / 7);
    return `Made ${wk} week${wk === 1 ? "" : "s"} ago`;
  };

  return (
    <>
      <Nav />
      <main className="mx-auto w-full max-w-5xl px-4 py-6">
        <div className="mb-3 flex items-center gap-3">
          <h1 className="flex-1 text-2xl font-bold">Recipes</h1>
          <ButtonLink href="/recipes/new" variant="primary">
            <Plus aria-hidden className="size-4" /> Add recipe
          </ButtonLink>
        </div>

        <form className="mb-3">
          {fav && <input type="hidden" name="fav" value="1" />}
          {quick && <input type="hidden" name="quick" value="1" />}
          {diet && <input type="hidden" name="diet" value={diet} />}
          {p && <input type="hidden" name="p" value={p} />}
          {s !== "name" && <input type="hidden" name="s" value={s} />}
          {removed && <input type="hidden" name="removed" value="1" />}
          <Input type="search" name="q" defaultValue={q} placeholder="Search recipes" aria-label="Search recipes" />
        </form>

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
          <ChipLink
            className="shrink-0"
            href={href({ fav: "", quick: "", diet: "", p: "", s: "name", removed: "" })}
            on={!anyFilter}
          >
            All
          </ChipLink>
          <ChipLink className="shrink-0" href={href({ fav: fav ? "" : "1" })} on={fav}>
            Favorites
          </ChipLink>
          <ChipLink className="shrink-0" href={href({ diet: diet === "both" ? "" : "both" })} on={diet === "both"}>
            Keto + family
          </ChipLink>
          <ChipLink className="shrink-0" href={href({ quick: quick ? "" : "1" })} on={quick}>
            Quick
          </ChipLink>
        </div>
        <p className="mb-4 text-xs text-muted tabular-nums">
          {recipes.length} recipe{recipes.length === 1 ? "" : "s"}
          {removed ? " (removed)" : ""}
        </p>

        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {recipes.map((r) => (
            <li key={r.id}>
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
                  </div>
                </div>
              </Card>
            </li>
          ))}
          {recipes.length === 0 && (
            <li className="text-muted sm:col-span-2 lg:col-span-3">
              {removed ? (
                "Nothing has been removed."
              ) : (
                <>
                  No recipes match.{" "}
                  <Link href="/recipes" className="text-primary-ink underline">
                    Clear filters
                  </Link>
                </>
              )}
            </li>
          )}
        </ul>
      </main>
    </>
  );
}
