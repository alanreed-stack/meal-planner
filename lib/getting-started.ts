// The short checklist for a household that has just been set up.

export type StartState = {
  recipes: number;
  plannedDinners: number;
  hasStore: boolean;
  krogerConnected: boolean;
  staples: number;
};

export type StartItem = { key: string; label: string; done: boolean };

export function gettingStarted(s: StartState): { items: StartItem[]; doneCount: number; allDone: boolean } {
  const items: StartItem[] = [
    { key: "recipes", label: "Add or pick some recipes", done: s.recipes > 0 },
    { key: "plan", label: "Plan the week", done: s.plannedDinners > 0 },
    { key: "store", label: "Choose your Kroger store", done: s.hasStore },
    { key: "kroger", label: "Connect your Kroger account", done: s.krogerConnected },
    { key: "staples", label: "Tell us what you always have", done: s.staples > 0 },
  ];
  const doneCount = items.filter((i) => i.done).length;
  return { items, doneCount, allDone: doneCount === items.length };
}
