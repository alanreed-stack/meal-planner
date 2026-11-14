-- Phase 16. A small product photo for each matched Kroger product, shown on the shopping list and match page.
alter table public.shopping_items add column if not exists kroger_image text;
alter table public.kroger_matches add column if not exists image_url text;
