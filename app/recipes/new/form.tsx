"use client";

import { useActionState, useState } from "react";
import { Camera, Trash2 } from "lucide-react";
import { importRecipe, importText, saveRecipe } from "./actions";
import { Button } from "@/components/ui/button";
import { Card, cardStyles } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Chip } from "@/components/ui/chip";
import { Notice } from "@/components/ui/notice";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { parseIngredient } from "@/lib/ingredients";
import { findComponent, parseComponentLine, type Component } from "@/lib/components";
import { formatAmount } from "@/lib/format";
import { resizeImage } from "@/lib/resize-image";

export type RecipeFormInitial = {
  id: string;
  name: string;
  description: string;
  diet: string;
  keto_swap: string;
  notes: string;
  prep_minutes: number | null;
  cook_minutes: number | null;
  servings: number;
  difficulty: string;
  ingredients: string; // one per line
  steps: string; // one per line
  tags: string;
  image_url: string;
};

export function NewRecipeForm({
  edit,
  householdId,
  components = [],
}: {
  edit?: RecipeFormInitial;
  householdId: string;
  components?: Component[];
}) {
  const [mode, setMode] = useState<"link" | "text">("link");
  const [fromLink, linkAction, linking] = useActionState(importRecipe, {});
  const [fromText, textAction, reading] = useActionState(importText, {});
  // Whichever import ran last fills the form below.
  const imp = (fromText.n ?? 0) > (fromLink.n ?? 0) ? fromText : fromLink;
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
        <section className={cardStyles()} aria-labelledby="import-title">
          <h2 id="import-title" className="font-semibold">
            Start from something you already have
          </h2>
          <div className="mt-2 mb-3 flex gap-2" role="group" aria-label="Where is the recipe?">
            <Chip on={mode === "link"} onClick={() => setMode("link")}>
              A web link
            </Chip>
            <Chip on={mode === "text"} onClick={() => setMode("text")}>
              Pasted text
            </Chip>
          </div>

          {mode === "link" ? (
            <form action={linkAction}>
              <p className="mb-3 text-sm text-muted">
                Paste a recipe page address. We&apos;ll fill in the form below so you can check it and save.
              </p>
              <div className="flex gap-2">
                <Input name="url" type="url" placeholder="https://www.allrecipes.com/recipe/..." aria-label="Recipe page address" />
                <Button type="submit" variant="primary" pending={linking} className="shrink-0">
                  {linking ? "Reading…" : "Import"}
                </Button>
              </div>
              {fromLink.error && <Notice tone="error" className="mt-3">{fromLink.error}</Notice>}
            </form>
          ) : (
            <form action={textAction}>
              <p className="mb-3 text-sm text-muted">
                Paste the recipe from an email or a note. We&apos;ll sort the ingredients from the steps, and you check it below.
              </p>
              <Textarea name="text" rows={7} aria-label="Recipe text" placeholder={"Garlic Butter Shrimp\nIngredients\n1 lb shrimp\n3 tbsp butter\nSteps\nMelt the butter. Add the shrimp."} />
              <Button type="submit" variant="primary" pending={reading} className="mt-3">
                {reading ? "Reading…" : "Sort it out"}
              </Button>
              {fromText.error && <Notice tone="error" className="mt-3">{fromText.error}</Notice>}
            </form>
          )}
          {imp.draft && <Notice tone="success" className="mt-3">Filled in below. Check the details, then save.</Notice>}
        </section>
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
          <Field label="Family notes (optional)" hint="Shown on the recipe and while you cook. For example: double the sauce, kids pick out the peppers.">
            <Textarea name="notes" rows={2} defaultValue={val("notes", null, edit?.notes)} />
          </Field>
          <Field label="Tags, separated by commas (optional)">
            <Input
              name="tags"
              defaultValue={val("tags", d?.tags, edit?.tags)}
              placeholder="quick, chicken, slow-cooker"
            />
          </Field>
          <PhotoField householdId={householdId} defaultUrl={val("image_url", d?.image, edit?.image_url) ?? ""} />
        </Card>

        <Card as="section" className="space-y-4">
          <h2 className="font-semibold">Ingredients</h2>
          <IngredientsField
            defaultValue={val("ingredients", d?.ingredients, edit?.ingredients) ?? ""}
            rows={edit ? 12 : 8}
            error={errors?.ingredients}
            autoFocus={!!errors?.ingredients && !errors?.name}
            components={components}
          />
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

/** The ingredients box, with a live "how we read this" list under it, so a bad guess is caught before it reaches the shopping list. */
function IngredientsField({
  defaultValue,
  rows,
  error,
  autoFocus,
  components,
}: {
  defaultValue: string;
  rows: number;
  error?: string;
  autoFocus: boolean;
  components: Component[];
}) {
  const [text, setText] = useState(defaultValue);
  const add = (name: string) => setText((t) => `${t.trimEnd()}${t.trim() ? "\n" : ""}@${name}`);
  const read = text
    .split("\n")
    .map((raw) => ({ raw, p: parseIngredient(raw), c: parseComponentLine(raw) }))
    .filter((r) => r.raw.trim() !== "");

  return (
    <>
      <Field
        label="One per line"
        error={error}
        hint="Start a line with + for family-only items (buns, rice, pasta) so they're still on the shopping list but the recipe knows they aren't for keto."
      >
        <Textarea
          name="ingredients"
          rows={rows}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={"2 lb ground beef\n1 cup shredded cheddar\n+ 1 pack burger buns"}
          aria-invalid={!!error || undefined}
          autoFocus={autoFocus}
        />
      </Field>
      {components.length > 0 && (
        <div>
          <p className="mb-1 text-sm font-medium">Add something you make</p>
          <div className="flex flex-wrap gap-2">
            {components.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => add(c.name)}
                className="min-h-11 rounded-md border border-border bg-surface px-3 text-sm hover:bg-surface-muted"
              >
                + {c.name}
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-muted">
            A line that starts with @ uses it. Add (buy) at the end to buy it ready-made, or a number after the @ for more than one batch.
          </p>
        </div>
      )}
      {read.length > 0 && (
        <div aria-live="polite">
          <h3 className="mb-1 text-sm font-medium">How we read these ({read.length})</h3>
          <ul className="divide-y divide-border rounded-md border border-border text-sm">
            {read.map((r, i) => (
              <li key={i} className="flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2">
                {r.c ? (
                  findComponent(r.c.name, components) ? (
                    <>
                      <span className="min-w-16 font-medium tabular-nums">{r.c.batches !== 1 ? `${r.c.batches} ×` : "1 ×"}</span>
                      <span className="min-w-0 flex-1 break-words">{findComponent(r.c.name, components)!.name}</span>
                      <Badge>{r.c.from_scratch ? "make it" : "buy it"}</Badge>
                      {r.c.family_only && <Badge tone="diet-family">family only</Badge>}
                    </>
                  ) : (
                    <span className="text-danger-ink">No component called “{r.c.name}”</span>
                  )
                ) : r.p ? (
                  <>
                    <span className="min-w-16 font-medium tabular-nums">
                      {r.p.qty != null ? formatAmount(r.p.qty, r.p.unit) : <span className="text-warning-ink">no amount</span>}
                    </span>
                    <span className="min-w-0 flex-1 break-words">{r.p.name}</span>
                    <Badge>{r.p.category}</Badge>
                    {r.p.family_only && <Badge tone="diet-family">family only</Badge>}
                  </>
                ) : (
                  <span className="text-danger-ink">Couldn&apos;t read “{r.raw.trim()}”</span>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-1 text-xs text-muted">
            The amount, the name we&apos;ll look for at the store, and the aisle. Change the line above if one is off.
          </p>
        </div>
      )}
    </>
  );
}

/** A photo for the recipe: take one or choose one on a phone (it is shrunk first), or paste an address. */
function PhotoField({ householdId, defaultUrl }: { householdId: string; defaultUrl: string }) {
  const [url, setUrl] = useState(defaultUrl);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function choose(file: File | undefined) {
    if (!file) return;
    setProblem(null);
    setBusy(true);
    try {
      const small = await resizeImage(file);
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const path = `${householdId}/${crypto.randomUUID()}.jpg`;
      const { error } = await supabase.storage.from("recipe-photos").upload(path, small, {
        contentType: "image/jpeg",
        cacheControl: "31536000",
      });
      if (error) throw error;
      setUrl(supabase.storage.from("recipe-photos").getPublicUrl(path).data.publicUrl);
    } catch {
      setProblem("Couldn't upload that picture. Check your connection and try again, or paste an address instead.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Photo (optional)</p>
      {url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" referrerPolicy="no-referrer" className="h-40 w-full rounded-md object-cover" />
      )}
      <div className="flex flex-wrap gap-2">
        <label
          className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-border bg-surface px-4 text-sm font-medium hover:bg-surface-muted focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring ${busy ? "pointer-events-none opacity-60" : ""}`}
        >
          {busy ? <Spinner /> : <Camera aria-hidden className="size-4" />}
          {busy ? "Uploading…" : url ? "Take or choose another" : "Take or choose a photo"}
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            disabled={busy}
            onChange={(e) => {
              void choose(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
        {url && (
          <Button type="button" variant="ghost" onClick={() => setUrl("")}>
            <Trash2 aria-hidden className="size-4" /> Remove photo
          </Button>
        )}
      </div>
      {problem && <Notice tone="error">{problem}</Notice>}
      <Field label="Or paste a photo address" hint="Must start with https://">
        <Input name="image_url" type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
      </Field>
    </div>
  );
}
