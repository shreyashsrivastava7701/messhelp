-- MessMate: storage for student photos uploaded from the committee portal.
-- Run once in the Supabase SQL Editor after the step 2 migration.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('student-photos', 'student-photos', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "anyone reads student photos" on storage.objects;
drop policy if exists "committee uploads student photos" on storage.objects;
drop policy if exists "committee replaces student photos" on storage.objects;
drop policy if exists "committee deletes student photos" on storage.objects;

-- Files are named <roll>-<random>.jpg, so links can't be guessed from a roll number.
create policy "anyone reads student photos" on storage.objects
  for select using (bucket_id = 'student-photos');
create policy "committee uploads student photos" on storage.objects
  for insert to authenticated with check (bucket_id = 'student-photos' and public.is_committee());
create policy "committee replaces student photos" on storage.objects
  for update to authenticated using (bucket_id = 'student-photos' and public.is_committee());
create policy "committee deletes student photos" on storage.objects
  for delete to authenticated using (bucket_id = 'student-photos' and public.is_committee());
