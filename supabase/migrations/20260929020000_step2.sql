-- MessMate step 2: meal ratings, "will you eat?" opt-in, announcements, snack log.
-- Run this once in the Supabase SQL Editor after the init migration.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.is_staff_or_committee()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select coalesce(public.my_role() in ('committee', 'admin', 'staff'), false);
$$;

create or replace function public.today_ist()
returns date
language sql
stable
as $$
  select (now() at time zone 'Asia/Kolkata')::date;
$$;

-- Default serving start per meal, used when the committee hasn't set a time.
create or replace function public.default_meal_start(p_meal public.meal_type)
returns time
language sql
immutable
as $$
  select case p_meal
    when 'breakfast' then time '07:30'
    when 'lunch'     then time '12:30'
    when 'snacks'    then time '17:00'
    when 'dinner'    then time '20:00'
  end;
$$;

-- When a meal starts, as a real instant (the mess runs on India time).
create or replace function public.meal_start_at(p_date date, p_meal public.meal_type)
returns timestamptz
language sql
stable
security definer set search_path = public
as $$
  select (p_date + coalesce(
            (select starts_at from public.meals where menu_date = p_date and meal_type = p_meal),
            public.default_meal_start(p_meal)))
         at time zone 'Asia/Kolkata';
$$;

-- ---------------------------------------------------------------------------
-- Ratings: only for meals that have started, and at most 2 days back.
-- ---------------------------------------------------------------------------
create or replace function public.rating_open(p_meal_id uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.meals m
    where m.id = p_meal_id
      and m.menu_date >= public.today_ist() - 2
      and now() >= public.meal_start_at(m.menu_date, m.meal_type)
  );
$$;

drop policy "insert own rating" on public.ratings;
drop policy "update own rating" on public.ratings;
create policy "insert own rating" on public.ratings
  for insert to authenticated with check (user_id = auth.uid() and public.rating_open(meal_id));
create policy "update own rating" on public.ratings
  for update to authenticated using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.rating_open(meal_id));

-- Save stars, tags and comment in one call (runs with the caller's permissions).
create or replace function public.submit_rating(
  p_meal_id uuid,
  p_stars   smallint,
  p_tags    text[] default '{}',
  p_comment text default null
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.ratings (meal_id, user_id, stars, comment)
  values (p_meal_id, auth.uid(), p_stars, nullif(trim(p_comment), ''))
  on conflict (meal_id, user_id)
  do update set stars = excluded.stars, comment = excluded.comment, updated_at = now()
  returning id into v_id;

  delete from public.rating_tags where rating_id = v_id;
  insert into public.rating_tags (rating_id, tag_slug)
  select v_id, t from unnest(coalesce(p_tags, '{}')) as t
  on conflict do nothing;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- "Will you eat?" opt-in. Closes 2 hours before each meal starts.
-- ---------------------------------------------------------------------------
create table public.meal_attendance (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  menu_date   date not null,
  meal_type   public.meal_type not null,
  will_eat    boolean not null,
  updated_at  timestamptz not null default now(),
  primary key (user_id, menu_date, meal_type)
);

create index meal_attendance_date_idx on public.meal_attendance (menu_date, meal_type);

create or replace function public.attendance_deadline(p_date date, p_meal public.meal_type)
returns timestamptz
language sql
stable
as $$
  select public.meal_start_at(p_date, p_meal) - interval '2 hours';
$$;

alter table public.meal_attendance enable row level security;

create policy "read own attendance, committee reads all" on public.meal_attendance
  for select to authenticated using (user_id = auth.uid() or public.is_committee());
create policy "set own attendance before deadline" on public.meal_attendance
  for insert to authenticated
  with check (user_id = auth.uid() and now() < public.attendance_deadline(menu_date, meal_type));
create policy "change own attendance before deadline" on public.meal_attendance
  for update to authenticated
  using (user_id = auth.uid() and now() < public.attendance_deadline(menu_date, meal_type))
  with check (user_id = auth.uid() and now() < public.attendance_deadline(menu_date, meal_type));

-- ---------------------------------------------------------------------------
-- Announcements (updates board)
-- ---------------------------------------------------------------------------
create table public.announcements (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (length(trim(title)) > 0),
  body        text,
  pinned      boolean not null default false,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);

create index announcements_created_idx on public.announcements (pinned desc, created_at desc);

alter table public.announcements enable row level security;

create policy "signed in users read announcements" on public.announcements
  for select to authenticated using (true);
create policy "committee writes announcements" on public.announcements
  for all to authenticated using (public.is_committee()) with check (public.is_committee());

-- ---------------------------------------------------------------------------
-- Student roster: every hostel resident, whether or not they have signed up.
-- The admin imports it (CSV or Table Editor); sign-up links an account to it
-- by roll number.
-- ---------------------------------------------------------------------------
create table public.students (
  roll_no     text primary key check (length(trim(roll_no)) > 0),
  full_name   text not null,
  room_no     text,
  photo_url   text,
  email       text,
  created_at  timestamptz not null default now()
);

alter table public.profiles add column roll_no text unique references public.students (roll_no) on delete set null;

alter table public.students enable row level security;

create policy "students read own roster row, staff read all" on public.students
  for select to authenticated using (
    roll_no = (select p.roll_no from public.profiles p where p.id = auth.uid())
    or public.is_staff_or_committee());
create policy "committee manages roster" on public.students
  for all to authenticated using (public.is_committee()) with check (public.is_committee());

create or replace function public.my_roll_no()
returns text
language sql
stable
security definer set search_path = public
as $$
  select roll_no from public.profiles where id = auth.uid();
$$;

-- Sign-up now links the account to the roster by roll number (when one matches
-- and nobody has claimed it yet) and fills in name and room from the roster.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_roll text := nullif(upper(trim(new.raw_user_meta_data ->> 'roll_no')), '');
  v_student public.students;
begin
  select * into v_student from public.students s
  where s.roll_no = v_roll
    and not exists (select 1 from public.profiles p where p.roll_no = s.roll_no);

  insert into public.profiles (id, full_name, room_no, roll_no)
  values (
    new.id,
    coalesce(v_student.full_name, new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    coalesce(v_student.room_no, new.raw_user_meta_data ->> 'room_no'),
    v_student.roll_no
  );
  return new;
end;
$$;

-- Students may not re-point their account at someone else's roll number.
create or replace function public.guard_profile_role()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is not null and coalesce(public.my_role() <> 'admin', true) then
    if new.role is distinct from old.role then
      raise exception 'Only admins can change roles';
    end if;
    if new.roll_no is distinct from old.roll_no and not public.is_committee() then
      raise exception 'Only the committee can change roll numbers';
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Snack log: who took what, by roll number, so it works for students without
-- the app too. Staff/committee log it by hand now; QR and face scanning
-- (step 6) will write to the same table.
-- ---------------------------------------------------------------------------
create table public.snack_logs (
  id          uuid primary key default gen_random_uuid(),
  roll_no     text not null references public.students (roll_no) on delete cascade,
  menu_date   date not null default public.today_ist(),
  item        text not null check (length(trim(item)) > 0),
  quantity    smallint not null default 1 check (quantity between 1 and 20),
  method      text not null default 'manual' check (method in ('manual', 'qr', 'face')),
  logged_by   uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);

create index snack_logs_date_idx on public.snack_logs (menu_date, roll_no);

alter table public.snack_logs enable row level security;

create policy "read own snack log, staff reads all" on public.snack_logs
  for select to authenticated using (roll_no = public.my_roll_no() or public.is_staff_or_committee());
create policy "staff logs snacks" on public.snack_logs
  for insert to authenticated with check (public.is_staff_or_committee() and logged_by = auth.uid());
create policy "committee deletes snack entries" on public.snack_logs
  for delete to authenticated using (public.is_committee());

-- Staff need to look students up to log snacks.
drop policy "read own profile, committee reads all" on public.profiles;
create policy "read own profile, staff and committee read all" on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_staff_or_committee());

-- Realtime for the updates board (used in step 4).
alter publication supabase_realtime add table public.announcements;

-- ---------------------------------------------------------------------------
-- Weekly menu: the regular Monday-to-Sunday plan. apply_weekly_menu() copies it
-- into real dates; the committee then edits any single day as usual.
-- ---------------------------------------------------------------------------
create table public.weekly_menu_items (
  id          uuid primary key default gen_random_uuid(),
  weekday     smallint not null check (weekday between 1 and 7),  -- 1 = Monday ... 7 = Sunday
  meal_type   public.meal_type not null,
  name        text not null check (length(trim(name)) > 0),
  is_veg      boolean not null default true,
  position    int not null default 0,
  unique (weekday, meal_type, name)
);

alter table public.weekly_menu_items enable row level security;

create policy "signed in users read weekly menu" on public.weekly_menu_items
  for select to authenticated using (true);
create policy "committee writes weekly menu" on public.weekly_menu_items
  for all to authenticated using (public.is_committee()) with check (public.is_committee());

-- Fill p_days days starting at p_from from the weekly plan. Days/meals that
-- already have dishes are left alone, so hand edits are never overwritten.
-- Returns the number of meals filled.
create or replace function public.apply_weekly_menu(p_from date, p_days int default 28)
returns int
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_day date;
  v_meal public.meal_type;
  v_meal_id uuid;
  v_filled int := 0;
begin
  for v_day in select generate_series(p_from, p_from + p_days - 1, interval '1 day')::date loop
    for v_meal in select distinct w.meal_type from public.weekly_menu_items w
                  where w.weekday = extract(isodow from v_day) loop
      insert into public.meals (menu_date, meal_type, starts_at, ends_at)
      values (v_day, v_meal, public.default_meal_start(v_meal), null)
      on conflict (menu_date, meal_type) do update set menu_date = excluded.menu_date
      returning id into v_meal_id;

      if not exists (select 1 from public.menu_items where meal_id = v_meal_id) then
        insert into public.menu_items (meal_id, name, is_veg, position)
        select v_meal_id, w.name, w.is_veg, w.position
        from public.weekly_menu_items w
        where w.weekday = extract(isodow from v_day) and w.meal_type = v_meal;
        v_filled := v_filled + 1;
      end if;
    end loop;
  end loop;
  return v_filled;
end;
$$;
