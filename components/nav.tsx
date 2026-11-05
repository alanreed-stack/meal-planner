import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function signOut() {
  "use server";
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export function Nav({ inviteCode }: { inviteCode?: string }) {
  return (
    <header className="border-b bg-white">
      <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3 text-sm">
        <Link href="/recipes" className="font-bold text-green-800">
          Meal Planner
        </Link>
        <Link href="/plan">This week</Link>
        <Link href="/shopping">Shopping</Link>
        <Link href="/recipes">Recipes</Link>
        <Link href="/settings">Settings</Link>
        <span className="flex-1" />
        {inviteCode && (
          <span className="hidden text-neutral-500 sm:inline">
            Invite code: <b>{inviteCode}</b>
          </span>
        )}
        <form action={signOut}>
          <button className="underline">Sign out</button>
        </form>
      </div>
    </header>
  );
}
