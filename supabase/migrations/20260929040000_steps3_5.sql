-- MessMate steps 3-5: AI weekly summaries and the pre-meal quality check log.
-- (Step 3 charts and step 4 live alerts use existing tables and need no SQL.)
-- Run once in the Supabase SQL Editor after 20260929030000_student_photos.sql.

-- ---------------------------------------------------------------------------
-- AI summaries (step 5): one row per generated summary, committee only.
-- ---------------------------------------------------------------------------
create table public.ai_summaries (
  id            uuid primary key default gen_random_uuid(),
  period_start  date not null,
  period_end    date not null,
  summary       text not null,
  rating_count  int not null default 0,
  comment_count int not null default 0,
  model         text,
  created_by    uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now()
);

create index ai_summaries_created_idx on public.ai_summaries (created_at desc);

alter table public.ai_summaries enable row level security;

create policy "committee reads summaries" on public.ai_summaries
  for select to authenticated using (public.is_committee());
create policy "committee saves summaries" on public.ai_summaries
  for insert to authenticated with check (public.is_committee() and created_by = auth.uid());
create policy "committee deletes summaries" on public.ai_summaries
  for delete to authenticated using (public.is_committee());

-- ---------------------------------------------------------------------------
-- Quality checks: a committee member's checklist before a meal is served.
-- Students can read them (that's the accountability); committee writes.
-- ---------------------------------------------------------------------------
create table public.quality_checks (
  id             uuid primary key default gen_random_uuid(),
  menu_date      date not null default public.today_ist(),
  meal_type      public.meal_type not null,
  hygiene_ok     boolean not null,
  temperature_ok boolean not null,
  quantity_ok    boolean not null,
  taste_ok       boolean not null,
  food_temp_c    numeric(4, 1) check (food_temp_c is null or food_temp_c between 0 and 120),
  notes          text check (notes is null or length(notes) <= 1000),
  photo_url      text,
  checked_by     uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now(),
  unique (menu_date, meal_type)
);

alter table public.quality_checks enable row level security;

create policy "signed in users read quality checks" on public.quality_checks
  for select to authenticated using (true);
create policy "committee writes quality checks" on public.quality_checks
  for all to authenticated using (public.is_committee()) with check (public.is_committee());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('quality-photos', 'quality-photos', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "anyone reads quality photos" on storage.objects;
drop policy if exists "committee uploads quality photos" on storage.objects;
create policy "anyone reads quality photos" on storage.objects
  for select using (bucket_id = 'quality-photos');
create policy "committee uploads quality photos" on storage.objects
  for insert to authenticated with check (bucket_id = 'quality-photos' and public.is_committee());

-- Live alerts (step 4) also listen to quality checks.
alter publication supabase_realtime add table public.quality_checks;
