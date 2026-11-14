// Turns pasted recipe text (from an email, a note, a cookbook photo's text) into a draft to check and save.
import { parseIngredient } from "./ingredients";
import type { RecipeDraft } from "./recipe-import";

const ING_HEADING = /^(?:the\s+)?(?:ingredients?|what you(?:'|’)?ll need|you will need|shopping list)\s*:?$/i;
const STEP_HEADING = /^(?:instructions?|directions?|method|steps?|preparation|procedure|how to make(?: it)?)\s*:?$/i;
const NOTES_HEADING = /^(?:notes?|tips?|variations?)\s*:?$/i;

const bullet = /^\s*(?:[-*•▪◦☐□✓]|\[\s?\])\s*/;
const numbered = /^\s*(?:step\s*)?\d{1,2}\s*[.):\-–]\s+(?=\S)/i;
// Starts with an amount: 2, 1/2, 1 1/2, 2.5, ½, 1½.
const startsWithAmount = /^\s*(?:\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?[½¼¾⅓⅔]?|[½¼¾⅓⅔])\s*(?:[a-zA-Z(]|-\s*\d)/;

function minutesFrom(text: string, label: RegExp): number | null {
  // Only a line that starts with the label ("Prep time: 10 minutes", "Cook: 25 min"), not a step that mentions cooking.
  const m = text.match(
    new RegExp(`^(?:${label.source})(?:\\s+time\\s*[:\\-]?|\\s*[:\\-])\\s*(\\d+(?:\\.\\d+)?)\\s*(hours?|hrs?|h|minutes?|mins?|m)\\b`, "i")
  );
  if (!m) return null;
  const n = Number(m[1]);
  return Math.round(/^h/i.test(m[2]) ? n * 60 : n);
}

/** True for a line that reads like an ingredient: short, starts with an amount, and is not a numbered step. */
export function looksLikeIngredient(line: string): boolean {
  const t = line.replace(bullet, "").trim();
  if (!t || t.length > 90) return false;
  if (numbered.test(t) && !/^\d+\s+\d+\/\d+|^\d+\/\d+/.test(t)) return false;
  if (/[.!?]$/.test(t) && t.split(" ").length > 6) return false;
  return startsWithAmount.test(t) && !!parseIngredient(t);
}

export function parseRecipeText(input: string): RecipeDraft {
  const raw = input.replace(/\r/g, "").split("\n").map((l) => l.trim());
  const lines = raw.filter((l, i) => l !== "" || (i > 0 && raw[i - 1] !== "")); // squeeze blank runs

  let servings: number | null = null;
  let prep: number | null = null;
  let cook: number | null = null;

  // Pull out the facts lines ("Serves 4", "Prep time: 10 minutes") so they do not end up as steps.
  const body: string[] = [];
  for (const l of lines) {
    const s = l.match(/^(?:serves|servings?|yield|makes)\s*[:\-]?\s*(\d+)/i);
    if (s) {
      servings ??= Number(s[1]);
      continue;
    }
    const p = minutesFrom(l, /prep(?:aration)?/);
    const c = minutesFrom(l, /cook(?:ing)?/);
    if ((p || c) && l.length < 60) {
      prep ??= p;
      cook ??= c;
      continue;
    }
    body.push(l);
  }

  const ingredients: string[] = [];
  const steps: string[] = [];
  const intro: string[] = [];
  const notes: string[] = [];
  let section: "intro" | "ingredients" | "steps" | "notes" = "intro";
  let sawHeading = false;

  for (const l of body) {
    if (!l) continue;
    const bare = l.replace(/[*_#]/g, "").trim();
    if (ING_HEADING.test(bare)) {
      section = "ingredients";
      sawHeading = true;
      continue;
    }
    if (STEP_HEADING.test(bare)) {
      section = "steps";
      sawHeading = true;
      continue;
    }
    if (NOTES_HEADING.test(bare)) {
      section = "notes";
      sawHeading = true;
      continue;
    }
    const text = l.replace(bullet, "");
    if (section === "ingredients") ingredients.push(text);
    else if (section === "steps") steps.push(text.replace(numbered, ""));
    else if (section === "notes") notes.push(text);
    else intro.push(l);
  }

  if (!sawHeading || (ingredients.length === 0 && steps.length === 0)) {
    // No headings to go by: ingredients are the short lines that start with an amount, the rest that is long is the method.
    ingredients.length = 0;
    steps.length = 0;
    const heads: string[] = [];
    let started = false;
    for (const l of body) {
      if (!l) continue;
      const text = l.replace(bullet, "");
      if (looksLikeIngredient(l)) {
        started = true;
        ingredients.push(text);
      } else if (!started && heads.length < 2 && text.length <= 100 && !numbered.test(text)) {
        heads.push(text);
      } else {
        started = true;
        steps.push(text.replace(numbered, ""));
      }
    }
    intro.length = 0;
    intro.push(...heads);
  }

  const [name = "", ...rest] = intro;
  return {
    name: name.replace(/[*_#]/g, "").trim().slice(0, 120),
    description: rest.join(" ").slice(0, 300),
    prep_minutes: prep,
    cook_minutes: cook,
    servings,
    ingredients: ingredients.join("\n"),
    steps: steps.join("\n"),
    tags: "",
    image: null,
  };
}
