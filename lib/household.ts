import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** The signed-in user's household, or why there isn't one. Never redirects, so it is safe in loading skeletons and layouts. */
export const findHousehold = cache(async function findHousehold() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, state: "signed-out" as const };

  const { data: member } = await supabase
    .from("household_members")
    .select("household_id, display_name, eats_keto, households(name, invite_code)")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!member) return { supabase, user, state: "no-household" as const };

  const h = member.households;
  return {
    supabase,
    user,
    state: "ok" as const,
    householdId: member.household_id as string,
    displayName: member.display_name as string | null,
    eatsKeto: member.eats_keto as boolean,
    householdName: h?.name ?? "Our Family",
    inviteCode: h?.invite_code ?? "",
  };
});

/** Returns the signed-in user's household, or sends them to /login or /setup. */
export async function requireHousehold() {
  const r = await findHousehold();
  if (r.state === "signed-out") redirect("/login");
  if (r.state === "no-household") redirect("/setup");
  return r;
}
