import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types";

/**
 * The browser's own connection to Supabase. It is used only for live updates, and only loaded (with import()) on the
 * pages that listen for them, so the other pages do not download it.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );
}
