"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, CloudOff, PartyPopper } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/card";
import { RowButton } from "@/components/ui/row-button";
import { SubmitButton } from "@/components/ui/submit-button";
import { cn } from "@/lib/cn";
import { readKey, serverSnapshot, subscribe, writeKey } from "@/lib/cook-store";
import { watch, type LiveStatus } from "@/lib/live";
import {
  applyRemote,
  dropChange,
  enqueue,
  flushQueue,
  parseQueue,
  pendingText,
  type Change,
  type Queue,
} from "@/lib/offline-queue";
import { useWakeLock } from "@/lib/use-wake-lock";
import { PrecachePage } from "@/components/service-worker";
import { resetPicked, setPicked } from "../actions";

export type StoreItem = {
  id: string;
  text: string;
  category: string;
  picked: boolean;
  inCart: boolean;
  /** "2 × Kroger shredded cheddar 8 oz", when the item has a match. */
  product: string | null;
  /** "Aisle 12", when Kroger said. */
  aisle: string | null;
};

// Whether the phone has a connection right now, as far as it can tell.
const onlineSubscribe = (cb: () => void) => {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
};

export function StoreList({
  items,
  order,
  weekId,
  weekStart,
  weekText,
}: {
  items: StoreItem[];
  order: string[];
  weekId: string | null;
  weekStart: string;
  weekText: string;
}) {
  const router = useRouter();
  const screen = useWakeLock();
  const online = useSyncExternalStore(onlineSubscribe, () => navigator.onLine, () => true);
  const [hideCart, setHideCart] = useState(false);
  const [live, setLive] = useState<LiveStatus>("connecting");

  // Ticks that could not be saved wait here (in the browser) until there is signal.
  const qKey = `instore:q:v1:${weekId}`;
  const qRaw = useSyncExternalStore(subscribe, () => readKey(qKey), serverSnapshot);
  const queue = useMemo<Queue>(() => parseQueue(qRaw), [qRaw]);
  const readQueue = useCallback(() => parseQueue(readKey(qKey)), [qKey]);
  const writeQueue = useCallback((q: Queue) => writeKey(qKey, JSON.stringify(q)), [qKey]);

  // What each item shows: your latest tick (or the other phone's) over what the server last said.
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [seen, setSeen] = useState(items);
  if (seen !== items) {
    // Fresh data from the server: keep only the ticks still waiting to be saved.
    setSeen(items);
    setOverrides((o) => Object.fromEntries(Object.entries(o).filter(([id]) => queue.some((c) => c.id === id))));
  }
  // Ticks still waiting to be saved count too, so they stay ticked if the page is reloaded with no signal.
  const queued = Object.fromEntries(queue.map((c) => [c.id, c.picked]));
  const isPicked = (i: StoreItem) => overrides[i.id] ?? queued[i.id] ?? i.picked;

  // ---- saving a tick: at once on screen, then to the server; if that fails, into the queue
  async function persist(c: Change) {
    if (!navigator.onLine) {
      writeQueue(enqueue(readQueue(), c));
      return;
    }
    try {
      await setPicked(c.id, c.picked);
      const waiting = readQueue().find((x) => x.id === c.id);
      if (waiting && waiting.picked === c.picked) writeQueue(dropChange(readQueue(), c.id));
    } catch {
      writeQueue(enqueue(readQueue(), c));
    }
  }

  function toggle(i: StoreItem) {
    const next = !isPicked(i);
    setOverrides((o) => ({ ...o, [i.id]: next }));
    void persist({ id: i.id, picked: next });
  }

  // ---- sending the queue when there is signal: as soon as it comes back, and every 15 seconds while anything waits
  const flushing = useRef(false);
  const flush = useCallback(async () => {
    if (flushing.current || !navigator.onLine) return;
    const before = readQueue();
    if (before.length === 0) return;
    flushing.current = true;
    try {
      const left = await flushQueue(before, (c) => setPicked(c.id, c.picked));
      const sent = before.filter((c) => !left.some((l) => l.id === c.id && l.picked === c.picked));
      writeQueue(readQueue().filter((c) => !sent.some((s) => s.id === c.id && s.picked === c.picked)));
      if (sent.length > 0) {
        // Keep showing what was just saved (the page may be an older copy), then load the current list.
        setOverrides((o) => ({ ...o, ...Object.fromEntries(sent.map((c) => [c.id, c.picked])) }));
        router.refresh();
      }
    } finally {
      flushing.current = false;
    }
  }, [readQueue, writeQueue, router]);

  const waiting = queue.length;
  useEffect(() => {
    if (waiting === 0) return;
    void flush();
    const id = setInterval(() => void flush(), 15000);
    return () => clearInterval(id);
  }, [waiting, online, flush]);

  // ---- the other phone's changes, as they happen
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!weekId) return;
    const refreshSoon = () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(() => router.refresh(), 400);
    };
    const stop = watch(
      [{ table: "shopping_items", filter: `week_id=eq.${weekId}`, deletes: true }],
      (c) => {
        const id = String((c.event === "DELETE" ? c.old.id : c.row.id) ?? "");
        const known = itemsRef.current.find((i) => i.id === id);
        if (c.event === "UPDATE" && known) {
          if (typeof c.row.picked === "boolean") {
            setOverrides((o) => applyRemote(o, parseQueue(readKey(qKey)), { id, picked: c.row.picked as boolean }));
          }
          // Something other than the tick changed (taken off the list, sent to the cart): load the new list.
          if (c.row.to_order === false || !!c.row.sent_at !== known.inCart) refreshSoon();
        } else if (c.event === "INSERT" || (c.event === "DELETE" && known) || (c.event === "UPDATE" && !known && c.row.to_order === true)) {
          refreshSoon();
        }
      },
      setLive
    );
    const onVisible = () => {
      if (document.visibilityState === "visible") refreshSoon();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisible);
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    };
  }, [weekId, qKey, router]);

  // ---- what to show
  const visible = items.filter((i) => !(hideCart && i.inCart));
  const open = visible.filter((i) => !isPicked(i));
  const got = visible.filter((i) => isPicked(i));
  const pickedCount = items.filter(isPicked).length;
  const byCategory = order
    .map((c) => ({ c, rows: open.filter((i) => i.category === c).sort((a, b) => a.text.localeCompare(b.text)) }))
    .filter((g) => g.rows.length);
  const note = pendingText(waiting, online);

  const row = (i: StoreItem, done: boolean) => (
    <li key={i.id}>
      <RowButton
        onClick={() => toggle(i)}
        aria-pressed={done}
        className="flex min-h-14 w-full items-center gap-4 border-b border-border px-1 py-2 text-left"
      >
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-sm border-2",
            done ? "border-primary bg-primary text-primary-foreground" : "border-muted"
          )}
        >
          {done && <Check aria-hidden className="size-6" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className={cn("block text-xl tabular-nums", done && "text-muted line-through")}>{i.text}</span>
          {(i.product || i.aisle) && (
            <span className="mt-0.5 block text-sm text-muted">
              {i.product}
              {i.product && i.aisle ? " · " : ""}
              {i.aisle && <b className="font-semibold text-foreground">{i.aisle}</b>}
            </span>
          )}
        </span>
        {i.inCart && <Badge tone="success">in Kroger cart</Badge>}
      </RowButton>
    </li>
  );

  return (
    <>
      <PrecachePage href={`/shopping/store?w=${weekStart}`} version={items.map((i) => `${i.id}${i.picked}${i.inCart}`).join()} />
      <header className="sticky top-0 z-10 -mx-4 border-b border-border bg-surface/95 px-4 py-2 backdrop-blur">
        <div className="flex items-center gap-3">
          <ButtonLink href={`/shopping?w=${weekStart}`} size="sm">
            <ArrowLeft aria-hidden className="size-4" /> Back
          </ButtonLink>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-bold">In-store list</h1>
            <p className="text-xs text-muted tabular-nums">{weekText}</p>
          </div>
          <form action={resetPicked}>
            <input type="hidden" name="week" value={weekStart} />
            <SubmitButton variant="ghost" size="sm">
              Start over
            </SubmitButton>
          </form>
        </div>
        {items.length > 0 && (
          <div className="mt-2 flex items-center gap-3">
            <div
              role="progressbar"
              aria-label="Items picked up"
              aria-valuemin={0}
              aria-valuemax={items.length}
              aria-valuenow={pickedCount}
              className="h-2 flex-1 overflow-hidden rounded-full bg-surface-muted"
            >
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(pickedCount / items.length) * 100}%` }} />
            </div>
            <span className="text-sm font-semibold tabular-nums">
              {pickedCount} of {items.length}
            </span>
            {live === "live" && (
              <span className="flex items-center gap-1 text-xs text-muted" title="Changes on the other phone show up here as they happen">
                <span aria-hidden className="size-2 rounded-full bg-primary" /> Live
              </span>
            )}
          </div>
        )}
        {note && (
          <p role="status" className="mt-1 flex items-center gap-1.5 text-sm font-medium text-warning-ink">
            <CloudOff aria-hidden className="size-4 shrink-0" /> {note}
          </p>
        )}
        {screen === "unsupported" && (
          <p className="mt-1 text-xs text-muted">This browser can&apos;t keep the screen on while you shop.</p>
        )}
      </header>

      <div className="mt-3">
        <label className="mb-3 flex min-h-11 items-center gap-3 text-sm text-muted">
          <input
            type="checkbox"
            className="size-5 accent-primary"
            checked={hideCart}
            onChange={(e) => setHideCart(e.target.checked)}
          />
          Hide items already in my Kroger cart
        </label>

        {items.length === 0 && (
          <EmptyState title="Nothing to buy">Build the list on the Shopping page first.</EmptyState>
        )}

        {byCategory.map((g) => (
          <section key={g.c} className="mb-4">
            <h2 className="mb-1 text-sm font-semibold tracking-wide text-muted uppercase">{g.c}</h2>
            <ul>{g.rows.map((i) => row(i, false))}</ul>
          </section>
        ))}

        {open.length === 0 && visible.length > 0 && (
          <EmptyState icon={<PartyPopper aria-hidden className="size-8" />} title="Everything's in the cart" className="my-6" />
        )}

        {got.length > 0 && (
          <section className="mt-6">
            <h2 className="mb-1 text-sm font-semibold tracking-wide text-muted uppercase">Got it ({got.length})</h2>
            <ul>{got.map((i) => row(i, true))}</ul>
          </section>
        )}
      </div>
    </>
  );
}
