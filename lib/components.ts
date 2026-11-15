// Components: a named group of ingredients (pico de gallo = tomatoes, onions, cilantro, lime juice) that a recipe can use.
// A recipe line points at a component and either makes it from scratch (its ingredients are used) or buys it ready-made
// (one item is used). expandIngredients turns those lines into plain ingredients, so everything downstream (scaling,
// merging on the shopping list, cost, protein) keeps working on ordinary rows.

import { guessCategory } from "./ingredients";

export type ComponentIngredient = { name: string; qty: number | null; unit: string | null; category: string };

export type Component = {
  id: string;
  name: string;
  buy_as: string | null;
  buy_unit: string;
  ingredients: ComponentIngredient[];
};

export type ComponentMap = Map<string, Component>;

/** A recipe line as stored. For a component line, qty is the number of batches and name is only a fallback label. */
export type RecipeRow = {
  name: string;
  qty: number | null;
  unit: string | null;
  category: string;
  family_only?: boolean;
  component_id?: string | null;
  from_scratch?: boolean | null;
};

export type PlainIngredient = {
  name: string;
  qty: number | null;
  unit: string | null;
  category: string;
  family_only: boolean;
  /** The component this came from, if any. */
  via: string | null;
};

const round = (n: number) => Math.round(n * 1000) / 1000;

/** Replaces component lines with what they stand for. Lines for a component that no longer exists are dropped. */
export function expandIngredients(rows: RecipeRow[], components: ComponentMap): PlainIngredient[] {
  const out: PlainIngredient[] = [];
  for (const r of rows) {
    const family_only = !!r.family_only;
    if (!r.component_id) {
      out.push({ name: r.name, qty: r.qty, unit: r.unit, category: r.category, family_only, via: null });
      continue;
    }
    const c = components.get(r.component_id);
    if (!c) continue;
    const batches = r.qty == null ? 1 : Number(r.qty);
    if (r.from_scratch === false) {
      const name = c.buy_as?.trim() || c.name;
      out.push({ name, qty: batches, unit: c.buy_unit, category: guessCategory(name), family_only, via: c.name });
      continue;
    }
    for (const i of c.ingredients) {
      out.push({
        name: i.name,
        qty: i.qty == null ? null : round(Number(i.qty) * batches),
        unit: i.unit,
        category: i.category,
        family_only,
        via: c.name,
      });
    }
  }
  return out;
}

export type ComponentLine = { name: string; batches: number; from_scratch: boolean; family_only: boolean };

/** "@Pico de gallo", "@2 Pico de gallo", "@Pico de gallo (buy)", with a leading "+" for family-only. Null for any other line. */
export function parseComponentLine(raw: string): ComponentLine | null {
  let line = raw.trim().replace(/^[-*•]\s*/, "");
  let family_only = false;
  if (line.startsWith("+")) {
    family_only = true;
    line = line.slice(1).trim();
  }
  if (!line.startsWith("@")) return null;
  line = line.slice(1).trim();
  let from_scratch = true;
  const buy = line.match(/\s*\((?:buy|bought|store|store[- ]bought)\)\s*$/i);
  if (buy) {
    from_scratch = false;
    line = line.slice(0, buy.index).trim();
  }
  let batches = 1;
  const n = line.match(/^(\d+(?:\.\d+)?|\d+\/\d+)\s+(?=\S)/);
  if (n) {
    const v = n[1].includes("/") ? Number(n[1].split("/")[0]) / Number(n[1].split("/")[1]) : Number(n[1]);
    if (Number.isFinite(v) && v > 0) {
      batches = round(v);
      line = line.slice(n[0].length).trim();
    }
  }
  const name = line.replace(/\s+/g, " ").trim();
  return name ? { name, batches, from_scratch, family_only } : null;
}

/** The reverse of parseComponentLine, for the edit form. */
export function componentToLine(c: { name: string; batches: number | null; from_scratch: boolean; family_only: boolean }): string {
  const b = c.batches == null || c.batches === 1 ? "" : `${round(Number(c.batches))} `;
  return `${c.family_only ? "+" : ""}@${b}${c.name}${c.from_scratch ? "" : " (buy)"}`;
}

/** Finds a component by name, ignoring case and extra spaces. */
export function findComponent(name: string, all: Component[]): Component | undefined {
  const k = name.replace(/\s+/g, " ").trim().toLowerCase();
  return all.find((c) => c.name.trim().toLowerCase() === k);
}

export const toMap = (all: Component[]): ComponentMap => new Map(all.map((c) => [c.id, c]));
