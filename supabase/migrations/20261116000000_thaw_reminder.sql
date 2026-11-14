-- Phase 17. Optional "move the meat to the fridge tonight" reminder on Home. Off unless someone turns it on.
alter table public.households add column if not exists thaw_reminder boolean not null default false;
