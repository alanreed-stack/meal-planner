-- Phase 21.
-- Family notes on a recipe ("double the sauce", "kids pick out the peppers").
alter table public.recipes add column if not exists notes text;

-- Recipe photos taken or chosen on a phone. The bucket is public to read (the photo addresses are random and the pictures
-- are not sensitive), but only a signed-in member of a household can add, replace or remove files, and only inside that
-- household's own folder: the first part of every file path is the household id.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('recipe-photos', 'recipe-photos', true, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "members add recipe photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'recipe-photos' and public.is_member(((storage.foldername(name))[1])::uuid));
create policy "members change recipe photos" on storage.objects for update to authenticated
  using (bucket_id = 'recipe-photos' and public.is_member(((storage.foldername(name))[1])::uuid));
create policy "members remove recipe photos" on storage.objects for delete to authenticated
  using (bucket_id = 'recipe-photos' and public.is_member(((storage.foldername(name))[1])::uuid));
