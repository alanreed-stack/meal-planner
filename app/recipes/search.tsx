"use client";

import { createContext, Fragment, useContext, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { Input } from "@/components/ui/field";
import { ChipLink } from "@/components/ui/chip";
import { matchesQuery } from "@/lib/recipe-search";

// The search words live here so the box, the filter chips and the filter sheet all share them. Typing narrows the
// list at once in the browser, and the address is kept up to date so a refresh or a shared link keeps the search.

type Ctx = { q: string; setQ: (v: string) => void };
const SearchContext = createContext<Ctx | null>(null);

export function useSearch(): Ctx {
  return useContext(SearchContext) ?? { q: "", setQ: () => {} };
}

export function SearchProvider({ initialQ, children }: { initialQ: string; children: ReactNode }) {
  const [q, setQState] = useState(initialQ);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function setQ(value: string) {
    setQState(value);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const url = new URL(window.location.href);
      if (value.trim()) url.searchParams.set("q", value);
      else url.searchParams.delete("q");
      window.history.replaceState(null, "", url.pathname + url.search);
    }, 300);
  }

  return <SearchContext.Provider value={{ q, setQ }}>{children}</SearchContext.Provider>;
}

/** The search box. Without JavaScript it is an ordinary form, so search still works. */
export function SearchBox({ keep }: { keep: Record<string, string> }) {
  const { q, setQ } = useSearch();
  return (
    <form role="search" action="/recipes" className="mb-3" onSubmit={(e) => e.preventDefault()}>
      {Object.entries(keep).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <Input
        type="search"
        name="q"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search by name, ingredient or tag"
        aria-label="Search recipes"
      />
    </form>
  );
}

export type SearchItem = { id: string; text: string; node: ReactNode };

/** The recipe grid, narrowed to what you have typed. */
export function ResultList({
  items,
  suffix,
  empty,
}: {
  items: SearchItem[];
  suffix: string;
  /** Shown when there is nothing to search through at all (no recipes, or none removed). */
  empty: ReactNode;
}) {
  const { q, setQ } = useSearch();
  const shown = items.filter((i) => matchesQuery(i.text, q));
  return (
    <>
      <p className="mb-4 text-xs text-muted tabular-nums" aria-live="polite">
        {shown.length} recipe{shown.length === 1 ? "" : "s"}
        {suffix}
      </p>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((i) => (
          <Fragment key={i.id}>{i.node}</Fragment>
        ))}
        {shown.length === 0 && (
          <li className="text-muted sm:col-span-2 lg:col-span-3">
            {items.length === 0 ? (
              empty
            ) : (
              <>
                Nothing matches “{q.trim()}”.{" "}
                <button type="button" onClick={() => setQ("")} className="text-primary-ink underline">
                  Clear the search
                </button>
              </>
            )}
          </li>
        )}
      </ul>
    </>
  );
}

/** A filter chip whose link keeps whatever is typed in the search box. */
export function SearchChipLink({ href, ...props }: ComponentProps<typeof ChipLink>) {
  const { q } = useSearch();
  const url = new URL(String(href), "http://x");
  if (q.trim()) url.searchParams.set("q", q);
  else url.searchParams.delete("q");
  return <ChipLink href={url.pathname + url.search} {...props} />;
}
