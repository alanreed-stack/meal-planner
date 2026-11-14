-- Phase 20.
-- Live updates: changes to these tables are pushed to open pages, so two phones on the same list stay in step.
-- Row-level security still decides who receives a change (members of the household only).
alter publication supabase_realtime add table public.shopping_items, public.planned_meals, public.weeks;

-- The aisle Kroger says a product is in at the chosen store, e.g. "Aisle 12". Shown on the in-store list.
alter table public.shopping_items add column if not exists kroger_aisle text;
alter table public.kroger_matches add column if not exists aisle text;
