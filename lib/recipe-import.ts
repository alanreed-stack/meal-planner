import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export type RecipeDraft = {
  name: string;
  description: string;
  prep_minutes: number | null;
  cook_minutes: number | null;
  servings: number | null;
  ingredients: string; // one per line
  steps: string; // one per line
  tags: string; // comma separated
  image: string | null; // https address of the page's main photo, if there is one
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function imageOf(node: any, html: string, pageUrl: string): string | null {
  const first = (v: unknown): string | null => {
    if (!v) return null;
    if (typeof v === "string") return v;
    if (Array.isArray(v)) return first(v[0]);
    if (typeof v === "object") return first((v as { url?: unknown }).url);
    return null;
  };
  let src = first(node?.image);
  if (!src) {
    const og = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
      ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    src = og?.[1] ?? null;
  }
  if (!src) return null;
  try {
    const u = new URL(src.replace(/&amp;/g, "&"), pageUrl);
    return u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

function isPrivate(ip: string): boolean {
  if (ip.includes(":")) {
    const l = ip.toLowerCase();
    return l === "::1" || l === "::" || l.startsWith("fc") || l.startsWith("fd") || l.startsWith("fe80") || l.startsWith("::ffff:");
  }
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 10 || a === 127 || a === 0 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127)
  );
}

async function assertPublic(url: URL) {
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Only web links work.");
  const host = url.hostname;
  const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
  if (addrs.some((a) => isPrivate(a.address))) throw new Error("That address isn't allowed.");
}

async function fetchHtml(input: string): Promise<string> {
  let url = new URL(input);
  for (let hop = 0; hop < 4; hop++) {
    await assertPublic(url);
    const res = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(10_000),
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) throw new Error("Bad redirect.");
      url = new URL(loc, url);
      continue;
    }
    if (!res.ok) throw new Error(`The site returned an error (${res.status}).`);
    const reader = res.body?.getReader();
    if (!reader) throw new Error("Empty page.");
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 3_000_000) {
        await reader.cancel();
        break;
      }
      chunks.push(value);
    }
    return Buffer.concat(chunks).toString("utf8");
  }
  throw new Error("Too many redirects.");
}

function decode(s: string): string {
  return s
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function findRecipe(node: any): any | null {
  if (!node) return null;
  if (Array.isArray(node)) {
    for (const n of node) {
      const r = findRecipe(n);
      if (r) return r;
    }
    return null;
  }
  if (typeof node === "object") {
    const t = node["@type"];
    if (t === "Recipe" || (Array.isArray(t) && t.includes("Recipe"))) return node;
    if (node["@graph"]) return findRecipe(node["@graph"]);
  }
  return null;
}

function minutes(iso: unknown): number | null {
  if (typeof iso !== "string") return null;
  const m = iso.match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/i);
  if (!m) return null;
  const total = Number(m[1] ?? 0) * 1440 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
  return total > 0 ? total : null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function steps(instr: any): string[] {
  if (!instr) return [];
  if (typeof instr === "string") return instr.split(/\n+/).map(decode).filter(Boolean);
  if (Array.isArray(instr)) return instr.flatMap(steps);
  if (instr.itemListElement) return steps(instr.itemListElement);
  if (instr.text) return [decode(String(instr.text))];
  if (instr.name) return [decode(String(instr.name))];
  return [];
}

export async function importRecipeFromUrl(url: string): Promise<RecipeDraft> {
  const html = await fetchHtml(url.trim());
  const blocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const b of blocks) {
    try {
      const r = findRecipe(JSON.parse(b[1].trim()));
      if (!r) continue;
      const ingredients: string[] = (r.recipeIngredient ?? []).map((x: unknown) => decode(String(x)));
      if (!ingredients.length) continue;
      const yieldRaw = Array.isArray(r.recipeYield) ? r.recipeYield[0] : r.recipeYield;
      const servings = parseInt(String(yieldRaw ?? ""), 10);
      const kw = typeof r.keywords === "string" ? r.keywords : Array.isArray(r.keywords) ? r.keywords.join(",") : "";
      return {
        name: decode(String(r.name ?? "")),
        description: decode(String(r.description ?? "")).slice(0, 300),
        prep_minutes: minutes(r.prepTime),
        cook_minutes: minutes(r.cookTime) ?? (minutes(r.totalTime) && !r.prepTime ? minutes(r.totalTime) : null),
        servings: Number.isFinite(servings) ? servings : null,
        ingredients: ingredients.join("\n"),
        steps: steps(r.recipeInstructions).join("\n"),
        tags: kw.split(",").map((k: string) => k.trim().toLowerCase()).filter(Boolean).slice(0, 6).join(", "),
        image: imageOf(r, html, url.trim()),
      };
    } catch {
      // try the next block
    }
  }
  throw new Error("Couldn't find a recipe on that page. Try another link, or add it by hand.");
}
