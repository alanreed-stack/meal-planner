-- Phase 12.
-- sent_qty: how many packages of the matched product are already in the Kroger cart, so a rebuilt list
-- or a raised quantity only adds the difference instead of the whole amount again.
alter table public.shopping_items add column if not exists sent_qty integer not null default 0;
-- zip: the ZIP code the household last used to search for a store.
alter table public.households add column if not exists zip text;

-- Existing rows already in the cart count as fully sent.
update public.shopping_items set sent_qty = order_qty where sent_at is not null and sent_qty = 0;
