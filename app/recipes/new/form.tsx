"use client";

import { useActionState } from "react";
import { importRecipe, saveRecipe } from "./actions";
import { Button } from "@/components/ui/button";
import { cardStyles } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";


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
        <form action={importAction} className={cardStyles()}>
          <h2 className="font-semibold">Import from a link</h2>
          <p className="mb-3 text-sm text-muted">
            Paste a recipe page address. We&apos;ll fill in the form below so you can check it and save.
          </p>
          <div className="flex gap-2">
            <Input
              name="url"
              type="url"
              placeholder="https://www.allrecipes.com/recipe/..."
              aria-label="Recipe page address"
            />
            <Button type="submit" variant="primary" pending={importing} className="shrink-0">
              {importing ? "Reading…" : "Import"}
            </Button>
          </div>
          {imp.error && <Notice tone="error" className="mt-3">{imp.error}</Notice>}
          {d && <Notice tone="success" className="mt-3">Imported. Check the details below, then save.</Notice>}
        </form>
      )}

      {/* key remounts the form with new defaults after each import */}
      <form key={imp.n ?? "manual"} action={saveAction} className="space-y-4">
        <h2 className="font-semibold">{edit ? "Edit recipe" : "Recipe details"}</h2>
        {edit && <input type="hidden" name="recipe_id" value={edit.id} />}
        <Field label="Recipe name">
          <Input name="name" required defaultValue={d?.name ?? edit?.name} />
        </Field>
        <Field label="Short description (optional)">
          <Input name="description" defaultValue={d?.description ?? edit?.description} />
        </Field>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Prep (min)">
            <Input
              name="prep_minutes"
              type="number"
              min={0}
              defaultValue={d?.prep_minutes ?? edit?.prep_minutes ?? ""}
            />
          </Field>
          <Field label="Cook (min)">
            <Input
              name="cook_minutes"
              type="number"
              min={0}
              defaultValue={d?.cook_minutes ?? edit?.cook_minutes ?? ""}
            />
          </Field>
          <Field label="Servings">
            <Input name="servings" type="number" min={1} defaultValue={d?.servings ?? edit?.servings ?? 4} />
          </Field>
          <Field label="Difficulty">
            <Select name="difficulty" defaultValue={edit?.difficulty ?? "easy"}>
              <option>easy</option>
              <option>medium</option>
              <option>hard</option>
            </Select>
          </Field>
        </div>

        <Field label="Who is it for?">
          <Select name="diet" defaultValue={edit?.diet ?? "both"}>
            <option value="both">Keto and family (with swaps)</option>
            <option value="family">Family only</option>
            <option value="keto">Keto only</option>
          </Select>
        </Field>
        <Field label="Keto vs. family note (optional)">
          <Input
            name="keto_swap"
            defaultValue={edit?.keto_swap}
            placeholder="Keto: skip the bun, use lettuce. Family: regular buns."
          />
        </Field>

        <Field
          label="Ingredients, one per line"
          hint="Start a line with + for family-only items (buns, rice, pasta) so they're still on the shopping list but the recipe knows they aren't for keto."
        >
          <Textarea
            name="ingredients"
            required
            rows={edit ? 12 : 8}
            defaultValue={d?.ingredients ?? edit?.ingredients}
            placeholder={"2 lb ground beef\n1 cup shredded cheddar\n+ 1 pack burger buns"}
          />
        </Field>

        <Field label="Steps, one per line">
          <Textarea name="steps" rows={edit ? 10 : 6} defaultValue={d?.steps ?? edit?.steps} />
        </Field>

        <Field label="Tags, separated by commas (optional)">
          <Input name="tags" defaultValue={d?.tags ?? edit?.tags} placeholder="quick, chicken, slow-cooker" />
        </Field>

        <Field label="Photo address (optional)" hint="Must start with https://">
          <Input name="image_url" type="url" defaultValue={d?.image ?? edit?.image_url ?? ""} placeholder="https://…" />
        </Field>

        {save?.error && <Notice tone="error">{save.error}</Notice>}
        <Button type="submit" variant="primary" size="lg" pending={saving}>
          {saving ? "Saving…" : edit ? "Save changes" : "Save recipe"}
        </Button>
      </form>
    </div>
  );
}
