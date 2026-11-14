const API = "https://api.kroger.com/v1";

export const KROGER_SCOPES = "product.compact cart.basic:write";

export const REDIRECT_URI =
  process.env.KROGER_REDIRECT_URI ??
  "https://meal-planner-team-huddle2.vercel.app/api/kroger/callback";

function basicAuth() {
  const id = process.env.KROGER_CLIENT_ID;
  const secret = process.env.KROGER_CLIENT_SECRET;
  if (!id || !secret) throw new Error("Kroger credentials are not configured");
  return "Basic " + Buffer.from(`${id}:${secret}`).toString("base64");
}

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
};

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(`${API}/connect/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: basicAuth(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(body),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Kroger token error ${res.status}`);
  return res.json();
}

export function authorizeUrl(state: string) {
  const p = new URLSearchParams({
    client_id: process.env.KROGER_CLIENT_ID!,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: KROGER_SCOPES,
    state,
  });
  return `${API}/connect/oauth2/authorize?${p}`;
}

export const exchangeCode = (code: string) =>
  tokenRequest({ grant_type: "authorization_code", code, redirect_uri: REDIRECT_URI });

export const refreshToken = (refresh_token: string) =>
  tokenRequest({ grant_type: "refresh_token", refresh_token });

/** App-level token for store and product lookups (no user login needed). */
let cached: { token: string; exp: number } | null = null;
async function appToken() {
  if (cached && cached.exp > Date.now() + 30_000) return cached.token;
  const t = await tokenRequest({ grant_type: "client_credentials", scope: "product.compact" });
  cached = { token: t.access_token, exp: Date.now() + t.expires_in * 1000 };
  return cached.token;
}

async function get(path: string, params: Record<string, string>) {
  const res = await fetch(`${API}${path}?${new URLSearchParams(params)}`, {
    headers: { Authorization: `Bearer ${await appToken()}`, Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Kroger ${path} error ${res.status}`);
  return res.json();
}

export type Store = { id: string; name: string; address: string };

export async function searchStores(zip: string): Promise<Store[]> {
  const json = await get("/locations", {
    "filter.zipCode.near": zip,
    "filter.limit": "8",
  });
  return (json.data ?? []).map(
    (l: {
      locationId: string;
      name: string;
      chain: string;
      address: { addressLine1: string; city: string; state: string };
    }) => ({
      id: l.locationId,
      name: l.name,
      address: `${l.address.addressLine1}, ${l.address.city}, ${l.address.state}`,
    })
  );
}

export type Product = {
  upc: string;
  productId: string;
  description: string;
  brand: string;
  size: string;
  price: number | null;
  categories: string[];
  /** A small front-of-package photo, when Kroger has one. */
  image: string | null;
  /** Where it is in the chosen store, e.g. "Aisle 12", when Kroger says. */
  aisle: string | null;
};

type KrogerImages = { perspective?: string; sizes?: { size?: string; url?: string }[] }[] | undefined;

/** The front photo at a small size (about 200px is plenty for a thumbnail), or the nearest thing Kroger has. */
export function pickImage(images: KrogerImages): string | null {
  const front = images?.find((i) => i.perspective === "front") ?? images?.[0];
  const sizes = front?.sizes ?? [];
  const pick = ["small", "thumbnail", "medium"].map((s) => sizes.find((x) => x.size === s)).find(Boolean) ?? sizes[0];
  return pick?.url && pick.url.startsWith("https://") ? pick.url : null;
}

/** "Aisle 12" for a product, from the first place Kroger lists it. */
export function pickAisle(locations: { description?: string; number?: string }[] | undefined): string | null {
  const first = locations?.[0];
  if (!first) return null;
  const text = first.description?.trim();
  if (text) return /^\d+$/.test(text) ? `Aisle ${text}` : text;
  return first.number?.trim() ? `Aisle ${first.number.trim()}` : null;
}

export async function searchProducts(term: string, locationId: string, limit = 6): Promise<Product[]> {
  const json = await get("/products", {
    "filter.term": term,
    "filter.locationId": locationId,
    "filter.limit": String(limit),
  });
  return (json.data ?? []).map(
    (p: {
      productId: string;
      upc: string;
      description: string;
      brand?: string;
      categories?: string[];
      images?: { perspective?: string; sizes?: { size?: string; url?: string }[] }[];
      aisleLocations?: { description?: string; number?: string }[];
      items?: { size?: string; price?: { regular?: number; promo?: number } }[];
    }) => {
      const item = p.items?.[0];
      const price = item?.price?.promo || item?.price?.regular || null;
      return {
        upc: p.upc,
        productId: p.productId,
        description: p.description,
        brand: p.brand ?? "",
        size: item?.size ?? "",
        price,
        categories: p.categories ?? [],
        image: pickImage(p.images),
        aisle: pickAisle(p.aisleLocations),
      };
    }
  );
}

export class KrogerError extends Error {
  constructor(public status: number) {
    super(`Kroger cart error ${status}`);
  }
}

export async function addToCart(userToken: string, items: { upc: string; quantity: number }[]) {
  const res = await fetch(`${API}/cart/add`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${userToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ items: items.map((i) => ({ ...i, modality: "PICKUP" })) }),
    cache: "no-store",
  });
  if (!res.ok) throw new KrogerError(res.status);
}
