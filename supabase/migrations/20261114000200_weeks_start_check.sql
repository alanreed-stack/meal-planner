-- From now on a week can only start on a Sunday, so a stray Monday row cannot be created.
alter table public.weeks add constraint weeks_start_is_sunday check (extract(dow from week_start) = 0);
