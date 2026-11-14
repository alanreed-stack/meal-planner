-- Phase 15. When a household's plan last changed in a way that affects the shopping list, and when the list
-- was last built, so the app can say "your plan changed since this list was built".
alter table public.weeks add column if not exists plan_changed_at timestamptz;
alter table public.weeks add column if not exists list_built_at timestamptz;

-- Lists that already exist count as built when their newest generated row was made.
update public.weeks w
set list_built_at = (
  select max(s.created_at) from public.shopping_items s where s.week_id = w.id and s.manual = false
)
where list_built_at is null
  and exists (select 1 from public.shopping_items s where s.week_id = w.id and s.manual = false);
