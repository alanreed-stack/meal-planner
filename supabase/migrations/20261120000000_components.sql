-- Components: something made from several ingredients that a recipe can use, like pico de gallo (tomatoes, onions,
-- cilantro, lime juice). Each recipe that uses one chooses to make it from scratch (its ingredients go on the shopping
-- list) or buy it (one item for the ready-made version goes on the list).
create table public.components (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  buy_as text,                          -- what to search for when buying it ready-made, e.g. "pico de gallo"
  buy_unit text not null default 'jar', -- how it is sold: jar, tub, pack...
  created_at timestamptz not null default now()
);
create unique index components_household_name_idx on public.components (household_id, lower(name));

-- The ingredients for one batch.
create table public.component_ingredients (
  id uuid primary key default gen_random_uuid(),
  component_id uuid not null references public.components(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  qty numeric,
  unit text,
  category text not null default 'pantry',
  sort integer not null default 0
);
create index component_ingredients_component_id_idx on public.component_ingredients (component_id);

-- A line in a recipe can be a component. qty is how many batches. A component in use cannot be deleted (restrict).
alter table public.recipe_ingredients add column component_id uuid references public.components(id) on delete restrict;
alter table public.recipe_ingredients add column from_scratch boolean not null default true;
create index recipe_ingredients_component_id_idx on public.recipe_ingredients (component_id);

alter table public.components enable row level security;
alter table public.component_ingredients enable row level security;
create policy "household components" on public.components for all using (is_member(household_id)) with check (is_member(household_id));
create policy "household component ingredients" on public.component_ingredients for all using (is_member(household_id)) with check (is_member(household_id));
