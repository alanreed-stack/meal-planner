"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Home", icon: "🏠" },
  { href: "/plan", label: "Week", icon: "📅" },
  { href: "/shopping", label: "Shopping", icon: "🛒" },
  { href: "/recipes", label: "Recipes", icon: "🍽️" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
];

function isActive(path: string, href: string) {
  return href === "/" ? path === "/" : path === href || path.startsWith(href + "/");
}

/** Links along the top on a computer, a tab bar along the bottom on a phone. */
export function NavTabs() {
  const path = usePathname();
  return (
    <>
      <nav className="hidden items-center gap-5 md:flex" aria-label="Main">
        {TABS.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            aria-current={isActive(path, t.href) ? "page" : undefined}
            className={isActive(path, t.href) ? "font-semibold text-green-800" : "text-neutral-700 hover:text-black"}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      <nav
        data-tabbar
        className="fixed inset-x-0 bottom-0 z-30 border-t bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
        aria-label="Main"
      >
        <ul className="grid grid-cols-5">
          {TABS.map((t) => {
            const on = isActive(path, t.href);
            return (
              <li key={t.href}>
                <Link
                  href={t.href}
                  aria-current={on ? "page" : undefined}
                  className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] ${
                    on ? "font-semibold text-green-800" : "text-neutral-600"
                  }`}
                >
                  <span className="text-xl leading-none" aria-hidden>
                    {t.icon}
                  </span>
                  {t.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
