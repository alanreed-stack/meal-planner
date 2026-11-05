"use client";

import { useActionState } from "react";
import { importRecipe, saveRecipe } from "./actions";

const input = "w-full rounded-lg border px-3 py-2 text-sm";

export type RecipeFormInitial = {
  id: string;
  name: string;
  description: string;
  diet: string;
  keto_swap: string;
  prep_minutes: number | null;
  cook_minutes: number | null;
  servings: number;
  difficulty: string;
  ingredients: string; // one per line
  steps: string; // one per line
  tags: string;
  image_url: string;
};

export function NewRecipeForm({ edit }: { edit?: RecipeFormInitial }) {
  const [imp, importAction, importing] = useActionState(importRecipe, {});
  const [save, saveAction, saving] = useActionState(saveRecipe, undefined);
  const d = imp.draft;

  return (
    <div className="space-y-8">
      {!edit && (
        <form action={importAction} className="rounded-xl border bg-white p-4">
          <h2 className="font-semibold">Import from a link</h2>
          <p className="mb-3 text-sm text-neutral-600">
            Paste a recipe page address. We&apos;ll fill in the form below so you can check it and save.
          </p>
          <div className="flex gap-2">
            <input
              name="url"
              type="url"
              placeholder="https://www.allrecipes.com/recipe/..."
              className={input}
            />
            <button
              disabled={importing}
              className="shrink-0 rounded-lg bg-green-700 px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              {importing ? "Reading…" : "Import"}
            </button>
          </div>
          {imp.error && <p className="mt-2 text-sm text-red-700">{imp.error}</p>}
          {d && <p className="mt-2 text-sm text-green-800">Imported. Check the details below, then save.</p>}
        </form>
      )}

      {/* key remounts the form with new defaults after each import */}
      <form key={imp.n ?? "manual"} action={saveAction} className="space-y-4">
        <h2 className="font-semibold">{edit ? "Edit recipe" : "Recipe details"}</h2>
        {edit && <input type="hidden" name="recipe_id" value={edit.id} />}
        <input
          name="name"
          required
          placeholder="Recipe name"
          defaultValue={d?.name ?? edit?.name}
          className={input}
        />
        <input
          name="description"
          placeholder="Short description (optional)"
          defaultValue={d?.description ?? edit?.description}
          className={input}
        />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <label className="text-xs">
            Prep (min)
            <input
              name="prep_minutes"
              type="number"
              min={0}
              defaultValue={d?.prep_minutes ?? edit?.prep_minutes ?? ""}
              className={input}
            />
          </label>
          <label className="text-xs">
            Cook (min)
            <input
              name="cook_minutes"
              type="number"
              min={0}
              defaultValue={d?.cook_minutes ?? edit?.cook_minutes ?? ""}
              className={input}
            />
          </label>
          <label className="text-xs">
            Servings
            <input
              name="servings"
              type="number"
              min={1}
              defaultValue={d?.servings ?? edit?.servings ?? 4}
              className={input}
            />
          </label>
          <label className="text-xs">
            Difficulty
            <select name="difficulty" defaultValue={edit?.difficulty ?? "easy"} className={input}>
              <option>easy</option>
              <option>medium</option>
              <option>hard</option>
            </select>
          </label>
        </div>

        <label className="block text-xs">
          Who is it for?
          <select name="diet" defaultValue={edit?.diet ?? "both"} className={input}>
            <option value="both">Keto and family (with swaps)</option>
            <option value="family">Family only</option>
            <option value="keto">Keto only</option>
          </select>
        </label>
        <label className="block text-xs">
          Keto vs. family note (optional)
          <input
            name="keto_swap"
            defaultValue={edit?.keto_swap}
            placeholder="Keto: skip the bun, use lettuce. Family: regular buns."
            className={input}
          />
        </label>

        <label className="block text-xs">
          Ingredients, one per line
          <textarea
            name="ingredients"
            required
            rows={edit ? 12 : 8}
            defaultValue={d?.ingredients ?? edit?.ingredients}
            placeholder={"2 lb ground beef\n1 cup shredded cheddar\n+ 1 pack burger buns"}
            className={input}
          />
          <span className="text-neutral-500">
            Start a line with + for family-only items (buns, rice, pasta) so they&apos;re still on the
            shopping list but the recipe knows they aren&apos;t for keto.
          </span>
        </label>

        <label className="block text-xs">
          Steps, one per line
          <textarea
            name="steps"
            rows={edit ? 10 : 6}
            defaultValue={d?.steps ?? edit?.steps}
            className={input}
          />
        </label>

        <label className="block text-xs">
          Tags, separated by commas (optional)
          <input
            name="tags"
            defaultValue={d?.tags ?? edit?.tags}
            placeholder="quick, chicken, slow-cooker"
            className={input}
          />
        </label>

        <label className="block text-xs">
          Photo address (optional, must start with https://)
          <input
            name="image_url"
            type="url"
            defaultValue={d?.image ?? edit?.image_url ?? ""}
            placeholder="https://…"
            className={input}
          />
        </label>

        {save?.error && <p className="text-sm text-red-700">{save.error}</p>}
        <button
          disabled={saving}
          className="rounded-lg bg-green-700 px-4 py-2 font-medium text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : edit ? "Save changes" : "Save recipe"}
        </button>
      </form>
    </div>
  );
}
