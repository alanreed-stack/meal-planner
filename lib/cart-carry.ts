// When the shopping list is rebuilt, works out what to remember about what is already in the Kroger cart.

export type OldRow = {
  picked: boolean | null;
  kroger_upc: string | null;
  sent_at: string | null;
  sent_qty: number;
  order_qty: number;
};

export type Carry = { picked: boolean; sent_at: string | null; sent_qty: number };

/**
 * Same product as before: keep "picked up" and what was sent. If more packages are needed than were sent,
 * "in cart" is cleared and the next send adds only the difference. A different product starts fresh.
 */
export function carryOver(old: OldRow | undefined, newUpc: string | null, packs: number): Carry {
  if (!old) return { picked: false, sent_at: null, sent_qty: 0 };
  const picked = old.picked ?? false;
  if (!newUpc || old.kroger_upc !== newUpc) return { picked, sent_at: null, sent_qty: 0 };
  // Rows sent before sent_qty existed count as fully sent.
  const sentBefore = old.sent_at ? Math.max(old.sent_qty, old.order_qty) : old.sent_qty;
  const stillSent = !!old.sent_at && packs <= sentBefore;
  return { picked, sent_at: stillSent ? old.sent_at : null, sent_qty: sentBefore };
}
