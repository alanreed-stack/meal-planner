-- Phase 22. A person can remove their own membership, which is how they leave a household. They can only ever
-- remove their own row. (The app also refuses to let the last member leave.)
create policy "leave own membership" on public.household_members for delete using (user_id = auth.uid());
