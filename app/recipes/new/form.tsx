"use client";

import { useActionState } from "react";
import { importRecipe, saveRecipe } from "./actions";
import { Button } from "@/components/ui/button";
import { Card, cardStyles } from "@/components/ui/card";
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

  // What to show in a box: what you just typed (if a save failed), else what was imported, else what was already saved.
  const typed = save?.values;
  const val = (key: string, imported: string | number | null | undefined, saved: string | number | null | undefined) =>
    typed?.[key] ?? (imported != null && imported !== "" ? String(imported) : undefined) ?? (saved != null ? String(saved) : undefined);

  const errors = save?.errors;

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

      {/* The key remounts the form with fresh values after an import or a failed save, so nothing you typed is lost. */}
      <form key={`${imp.n ?? "manual"}-${save?.n ?? 0}`} action={saveAction} className="space-y-5" noValidate>
        {edit && <input type="hidden" name="recipe_id" value={edit.id} />}

        {(errors || save?.error) && (
          <Notice tone="error">
            {save?.error ?? "A couple of things need fixing before this can be saved. They're marked below."}
          </Notice>
        )}

        <Card as="section" className="space-y-4">
          <h2 className="font-semibold">Basics</h2>
          <Field label="Recipe name" error={errors?.name}>
            <Input
              name="name"
              defaultValue={val("name", d?.name, edit?.name)}
              aria-invalid={!!errors?.name || undefined}
              autoFocus={!!errors?.name}
            />
          </Field>
          <Field label="Short description (optional)">
            <Input name="description" defaultValue={val("description", d?.description, edit?.description)} />
          </Field>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="Prep (min)">
              <Input
                name="prep_minutes"
                type="number"
                inputMode="numeric"
                min={0}
                defaultValue={val("prep_minutes", d?.prep_minutes, edit?.prep_minutes)}
              />
            </Field>
            <Field label="Cook (min)">
              <Input
                name="cook_minutes"
                type="number"
                inputMode="numeric"
                min={0}
                defaultValue={val("cook_minutes", d?.cook_minutes, edit?.cook_minutes)}
              />
            </Field>
            <Field label="Servings">
              <Input
                name="servings"
                type="number"
                inputMode="numeric"
                min={1}
                defaultValue={val("servings", d?.servings, edit?.servings) ?? "4"}
              />
            </Field>
            <Field label="Difficulty">
              <Select name="difficulty" defaultValue={val("difficulty", null, edit?.difficulty) ?? "easy"}>
                <option>easy</option>
                <option>medium</option>
                <option>hard</option>
              </Select>
            </Field>
          </div>

          <Field label="Who is it for?">
            <Select name="diet" defaultValue={val("diet", null, edit?.diet) ?? "both"}>
              <option value="both">Keto and family (with swaps)</option>
              <option value="family">Family only</option>
              <option value="keto">Keto only</option>
            </Select>
          </Field>
          <Field label="Keto vs. family note (optional)">
            <Input
              name="keto_swap"
              defaultValue={val("keto_swap", null, edit?.keto_swap)}
              placeholder="Keto: skip the bun, use lettuce. Family: regular buns."
            />
          </Field>
          <Field label="Tags, separated by commas (optional)">
            <Input
              name="tags"
              defaultValue={val("tags", d?.tags, edit?.tags)}
              placeholder="quick, chicken, slow-cooker"
            />
          </Field>
          <Field label="Photo address (optional)" hint="Must start with https://">
            <Input
              name="image_url"
              type="url"
              defaultValue={val("image_url", d?.image, edit?.image_url)}
              placeholder="https://…"
            />
          </Field>
        </Card>

        <Card as="section" className="space-y-4">
          <h2 className="font-semibold">Ingredients</h2>
          <Field
            label="One per line"
            error={errors?.ingredients}
            hint="Start a line with + for family-only items (buns, rice, pasta) so they're still on the shopping list but the recipe knows they aren't for keto."
          >
            <Textarea
              name="ingredients"
              rows={edit ? 12 : 8}
              defaultValue={val("ingredients", d?.ingredients, edit?.ingredients)}
              placeholder={"2 lb ground beef\n1 cup shredded cheddar\n+ 1 pack burger buns"}
              aria-invalid={!!errors?.ingredients || undefined}
              autoFocus={!!errors?.ingredients && !errors?.name}
            />
          </Field>
        </Card>

        <Card as="section" className="space-y-4">
          <h2 className="font-semibold">Steps</h2>
          <Field label="One per line">
            <Textarea name="steps" rows={edit ? 10 : 6} defaultValue={val("steps", d?.steps, edit?.steps)} />
          </Field>
        </Card>

        {/* Phones: Save stays pinned above the tab bar, so you never scroll to find it. */}
        <div
          data-actionbar
          className="fixed inset-x-0 bottom-[calc(3.6rem+env(safe-area-inset-bottom))] z-20 border-t border-border bg-surface/95 p-2 backdrop-blur md:static md:z-auto md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none"
        >
          <Button type="submit" variant="primary" size="lg" pending={saving} className="w-full md:w-auto">
            {saving ? "Saving…" : edit ? "Save changes" : "Save recipe"}
          </Button>
        </div>
      </form>
    </div>
  );
}
