"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, CalendarDays, Home, Settings, ShoppingCart } from "lucide-react";
import { cn } from "@/lib/cn";

const TABS = [
  { href: "/", label: "Home", Icon: Home },
  { href: "/plan", label: "Week", Icon: CalendarDays },
  { href: "/shopping", label: "Shopping", Icon: ShoppingCart },
  { href: "/recipes", label: "Recipes", Icon: BookOpen },
  { href: "/settings", label: "Settings", Icon: Settings },
];

function isActive(path: string, href: string) {
  return href === "/" ? path === "/" : path === href || path.startsWith(href + "/");
}

const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

/** Links along the top on a computer, a tab bar along the bottom on a phone. */
export function NavTabs() {
  const path = usePathname();
  return (
    <>
      <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
        {TABS.map(({ href, label }) => {
          const on = isActive(path, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={on ? "page" : undefined}
              className={cn(
                "rounded-sm px-3 py-2 text-sm",
                focus,
                on ? "bg-primary-soft font-semibold text-primary-ink" : "text-muted hover:text-foreground"
              )}
            >
              {label}
            </Link>
          );
        })}
      </nav>

      <nav
        data-tabbar
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
        aria-label="Main"
      >
        <ul className="grid grid-cols-5">
          {TABS.map(({ href, label, Icon }) => {
            const on = isActive(path, href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={on ? "page" : undefined}
                  className={cn(
                    "flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px]",
                    focus,
                    on ? "font-semibold text-primary-ink" : "text-muted"
                  )}
                >
                  <Icon aria-hidden className="size-6" />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
