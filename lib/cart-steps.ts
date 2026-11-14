// The five steps from an empty page to items in the Kroger cart, and which one is next.

export type StepKey = "list" | "store" | "kroger" | "matched" | "sent";

export type CartState = {
  /** The list has at least one item. */
  listBuilt: boolean;
  hasStore: boolean;
  /** Connected to Kroger with a login that still works. */
  connected: boolean;
  /** Items checked to order. */
  toOrder: number;
  /** Checked items with no Kroger product yet. */
  unmatched: number;
  /** Checked items not yet sent to the cart. */
  unsent: number;
};

export type Step = { key: StepKey; label: string; done: boolean };

const LABELS: Record<StepKey, string> = {
  list: "List built",
  store: "Store chosen",
  kroger: "Kroger connected",
  matched: "Items matched",
  sent: "Sent",
};

export function cartSteps(s: CartState): { steps: Step[]; next: StepKey | null } {
  const done: Record<StepKey, boolean> = {
    list: s.listBuilt,
    store: s.hasStore,
    kroger: s.connected,
    matched: s.hasStore && s.toOrder > 0 && s.unmatched === 0,
    sent: s.toOrder > 0 && s.unsent === 0,
  };
  const steps = (Object.keys(LABELS) as StepKey[]).map((key) => ({ key, label: LABELS[key], done: done[key] }));
  return { steps, next: steps.find((x) => !x.done)?.key ?? null };
}

/** What the "needs a look" filter counts: no match, a shaky match, or a package count we could not work out. */
export function needsLook(i: { to_order: boolean; kroger_upc: string | null; match_confidence: string | null }, checkQty: boolean, hasStore: boolean): boolean {
  if (!hasStore || !i.to_order) return false;
  return !i.kroger_upc || i.match_confidence === "low" || checkQty;
}

/** The checked items as plain text grouped by aisle, for sharing. */
export function shareText(
  title: string,
  groups: { category: string; lines: string[] }[]
): string {
  const body = groups
    .filter((g) => g.lines.length)
    .map((g) => `${g.category.toUpperCase()}\n${g.lines.map((l) => `- ${l}`).join("\n")}`)
    .join("\n\n");
  return body ? `${title}\n\n${body}` : title;
}
