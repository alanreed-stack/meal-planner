"use client";

import Link from "next/link";
import { Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
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

// Week and Shopping always describe the same week. While you are on one of them with ?w=..., the other tab keeps it.
const WEEK_TABS = new Set(["/plan", "/shopping"]);
const onWeekPage = (path: string) => [...WEEK_TABS].some((t) => isActive(path, t));
const validWeek = (w: string | null) => (w && /^\d{4}-\d{2}-\d{2}$/.test(w) ? w : null);

/** Links along the top on a computer, a tab bar along the bottom on a phone. */
export function NavTabs({ staleWeek = null }: { staleWeek?: string | null }) {
  // useSearchParams needs a Suspense boundary. Until it resolves the tabs simply point at the current week.
  return (
    <Suspense fallback={<Tabs week={null} staleWeek={staleWeek} />}>
      <TabsWithWeek staleWeek={staleWeek} />
    </Suspense>
  );
}

function TabsWithWeek({ staleWeek }: { staleWeek: string | null }) {
  const path = usePathname();
  const w = useSearchParams().get("w");
  return <Tabs week={onWeekPage(path) ? validWeek(w) : null} staleWeek={staleWeek} />;
}

function Tabs({ week, staleWeek }: { week: string | null; staleWeek: string | null }) {
  const path = usePathname();
  // A list that needs updating is flagged on the Shopping tab, and the tab opens that week unless you are already on one.
  const to = (href: string) => {
    const w = week ?? (href === "/shopping" ? staleWeek : null);
    return w && WEEK_TABS.has(href) ? `${href}?w=${w}` : href;
  };
  const dot = (href: string) => href === "/shopping" && !!staleWeek;
  return (
    <>
      <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
        {TABS.map(({ href, label }) => {
          const on = isActive(path, href);
          return (
            <Link
              key={href}
              href={to(href)}
              aria-current={on ? "page" : undefined}
              className={cn(
                "rounded-sm px-3 py-2 text-sm",
                focus,
                on ? "bg-primary-soft font-semibold text-primary-ink" : "text-muted hover:text-foreground"
              )}
            >
              {label}
              {dot(href) && <StaleDot />}
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
                  href={to(href)}
                  aria-current={on ? "page" : undefined}
                  className={cn(
                    "relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px]",
                    focus,
                    on ? "font-semibold text-primary-ink" : "text-muted"
                  )}
                >
                  {/* A short bar above the active tab, so it is not only the color that changes. */}
                  <span
                    aria-hidden
                    className={cn("absolute top-0 h-0.5 w-8 rounded-full", on ? "bg-primary" : "bg-transparent")}
                  />
                  <span className="relative">
                    <Icon aria-hidden className="size-6" strokeWidth={on ? 2.4 : 2} />
                    {dot(href) && <StaleDot className="absolute -top-0.5 -right-1" />}
                  </span>
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

/** A small dot meaning "this list needs updating", with a text version for screen readers. */
function StaleDot({ className }: { className?: string }) {
  return (
    <>
      <span aria-hidden className={cn("ml-1 inline-block size-2.5 rounded-full bg-warning", className)} />
      <span className="sr-only">, the list needs updating</span>
    </>
  );
}
