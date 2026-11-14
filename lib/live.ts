// Live updates: Supabase tells the page when someone else changes a row, so two phones stay in step.

export type LiveSource = {
  table: string;
  /** Limits updates to one week, e.g. "week_id=eq.123". Row-level security still applies on top. */
  filter?: string;
  /** Also hear about deleted rows. Deletes cannot be filtered, so only the ids of rows you are showing should be used. */
  deletes?: boolean;
};

export type LiveChange = {
  table: string;
  event: "INSERT" | "UPDATE" | "DELETE";
  row: Record<string, unknown>;
  old: Record<string, unknown>;
};

export type LiveStatus = "connecting" | "live" | "off";

/** Starts listening, and returns a function that stops. Safe to stop before it has finished connecting. */
export function watch(
  sources: LiveSource[],
  onChange: (c: LiveChange) => void,
  onStatus?: (s: LiveStatus) => void
): () => void {
  let stopped = false;
  let cleanup: (() => void) | null = null;

  void (async () => {
    try {
      const { createClient } = await import("@/lib/supabase/client");
      if (stopped) return;
      const supabase = createClient();
      const channel = supabase.channel(`live-${sources.map((s) => s.table).join("-")}-${Math.random().toString(36).slice(2, 8)}`);
      for (const s of sources) {
        for (const event of ["INSERT", "UPDATE"] as const) {
          channel.on("postgres_changes", { event, schema: "public", table: s.table, ...(s.filter ? { filter: s.filter } : {}) }, (p) =>
            onChange({ table: s.table, event, row: (p.new ?? {}) as Record<string, unknown>, old: (p.old ?? {}) as Record<string, unknown> })
          );
        }
        if (s.deletes) {
          channel.on("postgres_changes", { event: "DELETE", schema: "public", table: s.table }, (p) =>
            onChange({ table: s.table, event: "DELETE", row: {}, old: (p.old ?? {}) as Record<string, unknown> })
          );
        }
      }
      channel.subscribe((status) => {
        if (stopped) return;
        onStatus?.(status === "SUBSCRIBED" ? "live" : status === "CLOSED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT" ? "off" : "connecting");
      });
      cleanup = () => void supabase.removeChannel(channel);
      if (stopped) cleanup();
    } catch {
      onStatus?.("off");
    }
  })();

  return () => {
    stopped = true;
    cleanup?.();
  };
}
