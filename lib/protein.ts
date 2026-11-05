import { proteinLbs } from "./scale";

export type Protein = "chicken" | "beef" | "pork" | "turkey" | "shrimp" | "fish" | "lamb" | "none";

type Ing = { name: string; qty: number | null; unit: string | null; category: string };

function classify(name: string): Protein {
  const n = name.toLowerCase();
  if (/shrimp/.test(n)) return "shrimp";
  if (/salmon|cod\b|tuna|tilapia|fish/.test(n)) return "fish";
  if (/chicken/.test(n)) return "chicken";
  if (/turkey/.test(n)) return "turkey";
  if (/beef|steak|flank|sirloin|brisket/.test(n)) return "beef";
  if (/pork|bacon|sausage|ham\b/.test(n)) return "pork";
  if (/lamb/.test(n)) return "lamb";
  return "none";
}

/** The meat that makes up most of the recipe by weight. */
export function mainProtein(ings: Ing[]): Protein {
  const meats = ings.filter((i) => i.category === "meat");
  if (meats.length) {
    let best = meats[0];
    let bestW = proteinLbs([meats[0]]) ?? 0;
    for (const m of meats.slice(1)) {
      const w = proteinLbs([m]) ?? 0;
      if (w > bestW) {
        best = m;
        bestW = w;
      }
    }
    const p = classify(best.name);
    if (p !== "none") return p;
  }
  // Canned fish lives in the pantry aisle.
  const canned = ings.find((i) => /tuna|salmon/.test(i.name.toLowerCase()));
  return canned ? "fish" : "none";
}
