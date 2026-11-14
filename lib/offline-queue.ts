// In the store the signal comes and goes. A tick that could not be saved is kept here and sent when it can be.

export type Change = { id: string; picked: boolean };
export type Queue = Change[];

/** Adds a change. The latest change for an item replaces an older one (tick, untick, tick is just "ticked"). */
export function enqueue(queue: Queue, change: Change): Queue {
  return [...queue.filter((c) => c.id !== change.id), change];
}

/** Removes an item's waiting change, for when a newer one went through. */
export function dropChange(queue: Queue, id: string): Queue {
  return queue.filter((c) => c.id !== id);
}

export function parseQueue(raw: string | null): Queue {
  if (!raw) return [];
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data.filter(
      (c): c is Change => !!c && typeof c === "object" && typeof (c as Change).id === "string" && typeof (c as Change).picked === "boolean"
    );
  } catch {
    return [];
  }
}

/**
 * Sends waiting changes one at a time, oldest first, and stops at the first one that fails so the order is kept.
 * Returns what is still waiting.
 */
export async function flushQueue(queue: Queue, send: (c: Change) => Promise<void>): Promise<Queue> {
  const left = [...queue];
  while (left.length > 0) {
    try {
      await send(left[0]);
      left.shift();
    } catch {
      break;
    }
  }
  return left;
}

/**
 * What to show for each item once another phone's change arrives. A change still waiting on this phone wins,
 * because it is newer than anything the other phone saw.
 */
export function applyRemote(
  current: Record<string, boolean>,
  queue: Queue,
  remote: { id: string; picked: boolean }
): Record<string, boolean> {
  if (queue.some((c) => c.id === remote.id)) return current;
  return { ...current, [remote.id]: remote.picked };
}

/** "Offline, 3 changes waiting" or "3 changes waiting to save", or nothing at all. */
export function pendingText(waiting: number, online: boolean): string | null {
  if (waiting === 0) return online ? null : "Offline. Ticks will save when you have signal.";
  const n = `${waiting} change${waiting === 1 ? "" : "s"} waiting`;
  return online ? `${n} to save` : `Offline, ${n}`;
}
