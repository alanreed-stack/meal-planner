import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { toMap, type Component, type ComponentMap } from "@/lib/components";

/** Every component the household has, with its ingredients. RLS limits the rows to the household. */
export async function loadComponents(supabase: SupabaseClient<Database>): Promise<Component[]> {
  const [{ data: comps }, { data: ings }] = await Promise.all([
    supabase.from("components").select("id, name, buy_as, buy_unit").order("name"),
    supabase.from("component_ingredients").select("component_id, name, qty, unit, category").order("sort"),
  ]);
  const by = new Map<string, Component["ingredients"]>();
  for (const i of ings ?? []) {
    const list = by.get(i.component_id) ?? [];
    list.push({ name: i.name, qty: i.qty == null ? null : Number(i.qty), unit: i.unit, category: i.category });
    by.set(i.component_id, list);
  }
  return (comps ?? []).map((c) => ({ ...c, ingredients: by.get(c.id) ?? [] }));
}

export async function loadComponentMap(supabase: SupabaseClient<Database>): Promise<ComponentMap> {
  return toMap(await loadComponents(supabase));
}
