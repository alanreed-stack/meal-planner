import Link from "next/link";
import { UserRound } from "lucide-react";
import { signOut } from "@/lib/sign-out";
import { NavTabs } from "./nav-tabs";
import { Menu } from "./ui/menu";
import { SubmitButton } from "./ui/submit-button";

/**
 * Phones: just the app name up top (the tab bar below does the navigating, and Sign out lives in Settings).
 * Computers: links across the top and an account menu on the right.
 */
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
  );
}
