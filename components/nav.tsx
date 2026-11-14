import Link from "next/link";
import { UserRound } from "lucide-react";
import { weekStartOf, todayET } from "@/lib/dates";
import { requireHousehold } from "@/lib/household";
import { signOut } from "@/lib/sign-out";
import { NavTabs } from "./nav-tabs";
import { Menu } from "./ui/menu";
import { SubmitButton } from "./ui/submit-button";

/** The first upcoming week whose plan changed after its shopping list was built, if any. */
async function staleListWeek(): Promise<string | null> {
  const { supabase, householdId } = await requireHousehold();
  const { data } = await supabase
    .from("weeks")
    .select("week_start, plan_changed_at, list_built_at")
    .eq("household_id", householdId)
    .gte("week_start", weekStartOf(todayET()))
    .not("list_built_at", "is", null)
    .not("plan_changed_at", "is", null)
    .order("week_start");
  const stale = (data ?? []).find((w) => Date.parse(w.plan_changed_at!) > Date.parse(w.list_built_at!));
  return stale?.week_start ?? null;
}

/**
 * Phones: just the app name up top (the tab bar below does the navigating, and Sign out lives in Settings).
 * Computers: links across the top and an account menu on the right.
 */
export async function Nav() {
  const staleWeek = await staleListWeek();
  return (
    <>
      <a
        href="#main"
        className="fixed top-2 left-2 z-50 -translate-y-20 rounded-md bg-primary px-4 py-3 font-semibold text-primary-foreground focus:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        Skip to content
      </a>
      <header className="border-b border-border bg-surface [view-transition-name:site-header]">
      <div className="mx-auto flex w-full max-w-5xl items-center gap-6 px-4 py-2 text-sm">
        <Link
          href="/"
          className="rounded-sm py-2 text-base font-bold text-primary-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          Meal Planner
        </Link>
        <NavTabs staleWeek={staleWeek} />
        <span className="flex-1" />
        <div className="hidden md:block">
          <Menu label="Account" title="Account" icon={<UserRound aria-hidden className="size-5" />}>
            <form action={signOut}>
              <SubmitButton variant="secondary" className="w-full">
                Sign out
              </SubmitButton>
            </form>
          </Menu>
        </div>
      </div>
    </header>
    </>
  );
}
