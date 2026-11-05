import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NavTabs } from "./nav-tabs";
import { SubmitButton } from "./ui/submit-button";

async function signOut() {
  "use server";
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export function Nav() {
  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex w-full max-w-5xl items-center gap-6 px-4 py-2 text-sm">
        <Link
          href="/"
          className="rounded-sm py-2 text-base font-bold text-primary-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          Meal Planner
        </Link>
        <NavTabs />
        <span className="flex-1" />
        <form action={signOut}>
          <SubmitButton variant="ghost" size="sm">
            Sign out
          </SubmitButton>
        </form>
      </div>
    </header>
  );
}
