// A tiny store for cook mode's saved progress, backed by localStorage (with a memory copy when storage is blocked).
// React reads it with useSyncExternalStore, so the server render and the first client render agree, then it fills in.

const mem = new Map<string, string>();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    // Another tab changed it: forget our copy of that key and read again.
    if (e.key) mem.delete(e.key);
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function readKey(key: string): string | null {
  if (mem.has(key)) return mem.get(key) ?? null;
  let value: string | null = null;
  try {
    value = localStorage.getItem(key);
  } catch {
    // blocked: fall back to memory only
  }
  if (value !== null) mem.set(key, value);
  return value;
}

export function writeKey(key: string, value: string) {
  mem.set(key, value);
  try {
    localStorage.setItem(key, value);
  } catch {
    // blocked: it still works for this visit
  }
  emit();
}

/** Removes every saved key that `isOld` says belongs to another day. */
export function removeOld(isOld: (key: string) => boolean) {
  try {
    for (const k of Object.keys(localStorage)) if (isOld(k)) localStorage.removeItem(k);
  } catch {
    // blocked
  }
}

export const serverSnapshot = () => null;
