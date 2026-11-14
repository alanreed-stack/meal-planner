export type BuildSummary = { added: number; removed: number; changed: number; matched: number; empty: boolean };

const items = (n: number) => `${n} item${n === 1 ? "" : "s"}`;

/** "Added 6 items, removed 2. Found Kroger products for 5." */
export function describeBuild(r: BuildSummary): string {
  if (r.empty) return "Nothing to list yet. Plan some recipes first.";
  const parts: string[] = [];
  if (r.added) parts.push(`added ${items(r.added)}`);
  if (r.removed) parts.push(`removed ${r.removed}`);
  if (r.changed) parts.push(`${r.changed} amount${r.changed === 1 ? "" : "s"} changed`);
  let msg = parts.length ? parts.join(", ") : "No changes, the list was already up to date";
  msg = msg[0].toUpperCase() + msg.slice(1);
  if (r.matched) msg += `. Found Kroger products for ${r.matched}`;
  return msg + ".";
}
