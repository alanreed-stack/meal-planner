import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NavTabs } from "./nav-tabs";

async function signOut() {
  "use server";
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export function Nav() {
  return (
    <header className="border-b bg-white">
      <div className="mx-auto flex max-w-5xl items-center gap-6 px-4 py-3 text-sm">
        <Link href="/" className="text-base font-bold text-green-800">
          Meal Planner
        </Link>
        <NavTabs />
        <span className="flex-1" />
        <form action={signOut}>
          <button className="rounded px-2 py-1.5 text-neutral-600 underline">Sign out</button>
        </form>
      </div>
    </header>
  );
}
