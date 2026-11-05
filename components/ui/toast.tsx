"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import { cn } from "@/lib/cn";
import { IconButton } from "./icon-button";

type Tone = "info" | "success" | "error";

type ToastInput = {
  message: ReactNode;
  tone?: Tone;
  /** A link-style action, e.g. "Open cart". Use href for a link or onClick for a handler. */
  action?: { label: string; href?: string; onClick?: () => void };
  /** Milliseconds before it disappears. */
  duration?: number;
};

type UndoableInput = {
  message: string;
  /** Runs when the time is up and Undo wasn't pressed. This is where the real delete happens. */
  onCommit: () => void | Promise<void>;
  /** Runs if Undo is pressed. Put the item back. */
  onUndo: () => void;
  duration?: number;
};

type Api = {
  show: (t: ToastInput) => void;
  undoable: (t: UndoableInput) => void;
};

type Item = {
  id: number;
  tone: Tone;
  message: ReactNode;
  action?: { label: string; onClick: () => void; href?: string };
};

const ToastContext = createContext<Api | null>(null);

/** Safe to call anywhere under the provider. Outside it, toasts quietly do nothing (undoable ones commit at once). */
export function useToast(): Api {
  return (
    useContext(ToastContext) ?? {
      show: () => {},
      undoable: ({ onCommit }) => void onCommit(),
    }
  );
}

const icons = { info: Info, success: CheckCircle2, error: XCircle };

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Item[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  // Undoable removals waiting for their time to run out: id -> commit function.
  const pending = useRef(new Map<number, () => void>());

  const dismiss = useCallback((id: number) => {
    const t = timers.current.get(id);
    if (t) clearTimeout(t);
    timers.current.delete(id);
    setItems((all) => all.filter((i) => i.id !== id));
  }, []);

  const push = useCallback(
    (item: Omit<Item, "id">, duration: number, onExpire?: () => void) => {
      const id = nextId.current++;
      setItems((all) => [...all.slice(-2), { ...item, id }]); // at most 3 on screen
      timers.current.set(
        id,
        setTimeout(() => {
          onExpire?.();
          dismiss(id);
        }, duration)
      );
      return id;
    },
    [dismiss]
  );

  const api = useMemo<Api>(
    () => ({
      show: ({ message, tone = "info", action, duration = 4500 }) => {
        let id = 0;
        id = push(
          {
            message,
            tone,
            action: action && {
              label: action.label,
              href: action.href,
              onClick: () => {
                action.onClick?.();
                dismiss(id);
              },
            },
          },
          duration
        );
      },
      undoable: ({ message, onCommit, onUndo, duration = 5000 }) => {
        let id = 0;
        const commit = () => {
          pending.current.delete(id);
          void onCommit();
        };
        id = push(
          {
            message,
            tone: "info",
            action: {
              label: "Undo",
              onClick: () => {
                pending.current.delete(id);
                onUndo();
                dismiss(id);
              },
            },
          },
          duration,
          commit
        );
        pending.current.set(id, commit);
      },
    }),
    [push, dismiss]
  );

  // If the person switches away from the app, finish pending removals now rather than lose them.
  useEffect(() => {
    const flush = () => {
      if (document.visibilityState !== "hidden") return;
      for (const [id, commit] of [...pending.current]) {
        const t = timers.current.get(id);
        if (t) clearTimeout(t);
        timers.current.delete(id);
        commit();
        setItems((all) => all.filter((i) => i.id !== id));
      }
    };
    document.addEventListener("visibilitychange", flush);
    return () => document.removeEventListener("visibilitychange", flush);
  }, []);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* Sits above the bottom tab bar on phones. */}
      <div
        data-toasts
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-50 flex flex-col items-center gap-2 px-4 md:bottom-6"
      >
        {items.map((t) => {
          const Icon = icons[t.tone];
          return (
            <div
              key={t.id}
              role={t.tone === "error" ? "alert" : "status"}
              className={cn(
                "toast-in pointer-events-auto flex w-full max-w-md items-center gap-2 rounded-md bg-foreground py-1 pr-1 pl-3 text-sm text-background shadow-lg"
              )}
            >
              <Icon aria-hidden className="size-4 shrink-0" />
              <span className="min-w-0 flex-1 py-2">{t.message}</span>
              {t.action &&
                (t.action.href ? (
                  <a
                    href={t.action.href}
                    target="_blank"
                    rel="noreferrer"
                    onClick={t.action.onClick}
                    className="inline-flex min-h-11 items-center rounded-sm px-3 font-semibold underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    {t.action.label}
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={t.action.onClick}
                    className="inline-flex min-h-11 items-center rounded-sm px-3 font-semibold underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    {t.action.label}
                  </button>
                ))}
              <IconButton
                label="Dismiss"
                compact
                className="text-background hover:bg-background/15 hover:text-background"
                onClick={() => {
                  // Dismissing an undoable toast counts as "leave it removed".
                  const commit = pending.current.get(t.id);
                  if (commit) {
                    const timer = timers.current.get(t.id);
                    if (timer) clearTimeout(timer);
                    timers.current.delete(t.id);
                    commit();
                  }
                  dismiss(t.id);
                }}
              >
                <X aria-hidden className="size-4" />
              </IconButton>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
