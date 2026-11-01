import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** Returns the signed-in user's household, or sends them to /setup. */
export async function requireHousehold() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: member } = await supabase
    .from("household_members")
    .select("household_id, display_name, eats_keto, households(name, invite_code)")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!member) redirect("/setup");

  const h = member.households as unknown as { name: string; invite_code: string } | null;
  return {
    supabase,
    user,
    householdId: member.household_id as string,
    displayName: member.display_name as string | null,
    eatsKeto: member.eats_keto as boolean,
    householdName: h?.name ?? "Our Family",
    inviteCode: h?.invite_code ?? "",
  };
}
