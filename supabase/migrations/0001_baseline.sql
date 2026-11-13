-- Baseline: the database as it stood on 2026-11-13, written out so a new project can be rebuilt from this repo.
-- It already includes the columns that 20261113000000_phase12_sent_qty_zip.sql adds (that file is safe to run
-- after this one). It was captured from the live project, not applied to it: the live database already has all of this.
--
-- Access model: every household table is locked to the household's members through is_member(). Kroger login
-- tokens are readable only by the person they belong to. The household and member rows are created and joined
-- through the two security-definer functions below, so there is deliberately no INSERT policy on them.

-- ============ tables ============

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Our Family',
  invite_code text not null unique default substr(md5((random())::text || (clock_timestamp())::text), 1, 8),
  created_at timestamptz not null default now(),
  kroger_location_id text,
  kroger_store_name text,
  default_protein_lbs numeric not null default 2 check (default_protein_lbs >= 0.5 and default_protein_lbs <= 10),
  dinner_time time not null default '18:00:00',
  zip text
);

create table public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text,
  eats_keto boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  slug text,
  name text not null,
  description text,
  diet text not null default 'both' check (diet in ('both', 'family', 'keto')),
  keto_swap text,
  prep_minutes integer,
  cook_minutes integer,
  servings integer not null default 4,
  difficulty text not null default 'easy' check (difficulty in ('easy', 'medium', 'hard')),
  tags text[] not null default '{}',
  steps text[] not null default '{}',
  favorite boolean not null default false,
  source text not null default 'custom' check (source in ('starter', 'custom', 'ai')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  archived boolean not null default false,
  rating smallint check (rating in (-1, 1)),
  image_url text,
  unique (household_id, slug)
);

create table public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  qty numeric,
  unit text,
  category text not null default 'pantry',
  family_only boolean not null default false,
  sort integer not null default 0
);

create table public.weeks (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  week_start date not null,
  mode text not null default 'home' check (mode in ('home', 'travel')),
  created_at timestamptz not null default now(),
  unique (household_id, week_start)
);

create table public.planned_meals (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  week_id uuid not null references public.weeks(id) on delete cascade,
  day date not null,
  slot text not null default 'dinner' check (slot in ('breakfast', 'lunch', 'dinner')),
  recipe_id uuid references public.recipes(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  protein_lbs numeric check (protein_lbs is null or (protein_lbs >= 0.5 and protein_lbs <= 10)),
  kind text not null default 'recipe' check (kind in ('recipe', 'leftovers', 'out', 'quick')),
  rating smallint check (rating in (-1, 0, 1))
);

create table public.shopping_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  week_id uuid not null references public.weeks(id) on delete cascade,
  name text not null,
  qty numeric,
  unit text,
  category text not null default 'pantry',
  to_order boolean not null default true,
  kroger_product_id text,
  kroger_upc text,
  kroger_description text,
  created_at timestamptz not null default now(),
  manual boolean not null default false,
  kroger_price numeric,
  order_qty integer not null default 1 check (order_qty >= 1 and order_qty <= 50),
  sent_at timestamptz,
  kroger_size text,
  match_confidence text check (match_confidence in ('ok', 'low')),
  order_qty_manual boolean not null default false,
  picked boolean not null default false,
  sent_qty integer not null default 0
);

create table public.pantry_staples (
  household_id uuid not null references public.households(id) on delete cascade,
  name_key text not null,
  name text not null,
  created_at timestamptz not null default now(),
  primary key (household_id, name_key)
);

-- Remembered Kroger product for an ingredient name, shared by the household.
create table public.kroger_matches (
  household_id uuid not null references public.households(id) on delete cascade,
  name_key text not null,
  upc text not null,
  product_id text,
  description text,
  price numeric,
  order_qty integer not null default 1 check (order_qty >= 1 and order_qty <= 50),
  updated_at timestamptz not null default now(),
  size text,
  confidence text check (confidence in ('ok', 'low')),
  qty_override integer check (qty_override >= 1 and qty_override <= 50),
  primary key (household_id, name_key)
);

-- One Kroger login per person (not per household).
create table public.kroger_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  access_token text not null,
  refresh_token text,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);

-- A single row that something pings so the free-tier project is not paused for inactivity.
-- RLS is on with no policy, so only the service role can touch it.
create table public.keepalive (
  id integer primary key default 1 check (id = 1),
  pinged_at timestamptz not null default now()
);

-- ============ indexes ============

create index household_members_user_id_idx on public.household_members using btree (user_id);
create index planned_meals_week_id_idx on public.planned_meals using btree (week_id);
create index recipe_ingredients_recipe_id_idx on public.recipe_ingredients using btree (recipe_id);
create index recipes_household_id_idx on public.recipes using btree (household_id);
create index shopping_items_week_id_idx on public.shopping_items using btree (week_id);

-- ============ functions ============

create or replace function public.is_member(hid uuid)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $function$
  select exists (select 1 from public.household_members where household_id = hid and user_id = auth.uid());
$function$;

create or replace function public.create_household(p_name text, p_display_name text, p_keto boolean)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare hid uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  insert into public.households (name) values (coalesce(nullif(p_name,''), 'Our Family')) returning id into hid;
  insert into public.household_members (household_id, user_id, display_name, eats_keto) values (hid, auth.uid(), p_display_name, p_keto);
  return hid;
end $function$;

create or replace function public.join_household(p_code text, p_display_name text, p_keto boolean)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare hid uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select id into hid from public.households where invite_code = lower(trim(p_code));
  if hid is null then raise exception 'invalid invite code'; end if;
  insert into public.household_members (household_id, user_id, display_name, eats_keto) values (hid, auth.uid(), p_display_name, p_keto)
    on conflict do nothing;
  return hid;
end $function$;

-- ============ row level security ============

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.weeks enable row level security;
alter table public.planned_meals enable row level security;
alter table public.shopping_items enable row level security;
alter table public.pantry_staples enable row level security;
alter table public.kroger_matches enable row level security;
alter table public.kroger_connections enable row level security;
alter table public.keepalive enable row level security;

create policy "members read household" on public.households for select using (is_member(id));
create policy "members update household" on public.households for update using (is_member(id));

create policy "members read members" on public.household_members for select using (is_member(household_id));
create policy "update own membership" on public.household_members for update using (user_id = auth.uid());

create policy "household recipes" on public.recipes for all using (is_member(household_id)) with check (is_member(household_id));
create policy "household ingredients" on public.recipe_ingredients for all using (is_member(household_id)) with check (is_member(household_id));
create policy "household weeks" on public.weeks for all using (is_member(household_id)) with check (is_member(household_id));
create policy "household meals" on public.planned_meals for all using (is_member(household_id)) with check (is_member(household_id));
create policy "household shopping" on public.shopping_items for all using (is_member(household_id)) with check (is_member(household_id));
create policy "household staples" on public.pantry_staples for all using (is_member(household_id)) with check (is_member(household_id));
create policy "household matches" on public.kroger_matches for all using (is_member(household_id)) with check (is_member(household_id));

create policy "own kroger connection" on public.kroger_connections for all using (user_id = auth.uid()) with check (user_id = auth.uid());
