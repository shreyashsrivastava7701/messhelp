-- MessMate schema, step 1 (login, menu, admin menu editing).
-- Tables for ratings are created now so steps 2 to 5 need no reshaping.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.user_role as enum ('student', 'committee', 'staff', 'admin');
create type public.meal_type as enum ('breakfast', 'lunch', 'snacks', 'dinner');

-- ---------------------------------------------------------------------------
-- Profiles: one row per auth user, created by trigger on sign up.
-- ---------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text,
  room_no     text,
  role        public.user_role not null default 'student',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Role helpers used by RLS policies. security definer avoids RLS recursion on profiles.
create or replace function public.my_role()
returns public.user_role
language sql
stable
security definer set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_committee()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select coalesce(public.my_role() in ('committee', 'admin'), false);
$$;

-- Only admins may change anyone's role; everyone else can edit their own name/room.
create or replace function public.guard_profile_role()
returns trigger
language plpgsql
as $$
begin
  if new.role is distinct from old.role
     and auth.uid() is not null
     and coalesce(public.my_role() <> 'admin', true) then
    raise exception 'Only admins can change roles';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_guard_role
  before update on public.profiles
  for each row execute function public.guard_profile_role();

-- ---------------------------------------------------------------------------
-- Meals: one row per (date, meal). Menu items hang off a meal.
-- ---------------------------------------------------------------------------
create table public.meals (
  id          uuid primary key default gen_random_uuid(),
  menu_date   date not null,
  meal_type   public.meal_type not null,
  starts_at   time,
  ends_at     time,
  note        text,                       -- e.g. "Festival special", "Served late today"
  updated_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (menu_date, meal_type)
);

create table public.menu_items (
  id          uuid primary key default gen_random_uuid(),
  meal_id     uuid not null references public.meals (id) on delete cascade,
  name        text not null check (length(trim(name)) > 0),
  is_veg      boolean not null default true,
  position    int not null default 0,
  created_at  timestamptz not null default now(),
  unique (meal_id, name)
);

create index menu_items_meal_id_idx on public.menu_items (meal_id, position);

-- ---------------------------------------------------------------------------
-- Ratings (step 2): 1-5 stars per meal, optional tags and comment,
-- optionally pinned to one dish so the dashboard can find disliked items.
-- ---------------------------------------------------------------------------
create table public.tags (
  slug        text primary key,
  label       text not null,
  sentiment   text not null check (sentiment in ('negative', 'positive'))
);

insert into public.tags (slug, label, sentiment) values
  ('too_oily',      'Too oily',        'negative'),
  ('cold',          'Cold',            'negative'),
  ('less_quantity', 'Less quantity',   'negative'),
  ('undercooked',   'Undercooked',     'negative'),
  ('too_spicy',     'Too spicy',       'negative'),
  ('bland',         'Bland',           'negative'),
  ('stale',         'Stale',           'negative'),
  ('hygiene',       'Hygiene issue',   'negative'),
  ('tasty',         'Tasty',           'positive'),
  ('good_quantity', 'Good quantity',   'positive');

create table public.ratings (
  id          uuid primary key default gen_random_uuid(),
  meal_id     uuid not null references public.meals (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  stars       smallint not null check (stars between 1 and 5),
  comment     text check (comment is null or length(comment) <= 500),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (meal_id, user_id)               -- one rating per student per meal
);

create table public.rating_tags (
  rating_id   uuid not null references public.ratings (id) on delete cascade,
  tag_slug    text not null references public.tags (slug),
  item_id     uuid references public.menu_items (id) on delete set null,  -- which dish the tag is about, if any
  primary key (rating_id, tag_slug)
);

create index ratings_meal_id_idx on public.ratings (meal_id);
create index rating_tags_tag_idx on public.rating_tags (tag_slug);

-- Dashboard helper (step 3): average stars and tag counts per meal.
create view public.meal_rating_summary
with (security_invoker = true)
as
select
  m.id           as meal_id,
  m.menu_date,
  m.meal_type,
  count(r.id)    as rating_count,
  round(avg(r.stars)::numeric, 2) as avg_stars
from public.meals m
left join public.ratings r on r.meal_id = m.id
group by m.id;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.profiles    enable row level security;
alter table public.meals       enable row level security;
alter table public.menu_items  enable row level security;
alter table public.tags        enable row level security;
alter table public.ratings     enable row level security;
alter table public.rating_tags enable row level security;

-- profiles
create policy "read own profile, committee reads all" on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_committee());
create policy "update own profile" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "admin updates any profile" on public.profiles
  for update to authenticated using (public.my_role() = 'admin');

-- meals and menu items: everyone signed in reads, committee writes
create policy "signed in users read meals" on public.meals
  for select to authenticated using (true);
create policy "committee writes meals" on public.meals
  for all to authenticated using (public.is_committee()) with check (public.is_committee());

create policy "signed in users read menu items" on public.menu_items
  for select to authenticated using (true);
create policy "committee writes menu items" on public.menu_items
  for all to authenticated using (public.is_committee()) with check (public.is_committee());

-- tags
create policy "signed in users read tags" on public.tags
  for select to authenticated using (true);

-- ratings: students manage their own, committee reads all
create policy "read own ratings, committee reads all" on public.ratings
  for select to authenticated using (user_id = auth.uid() or public.is_committee());
create policy "insert own rating" on public.ratings
  for insert to authenticated with check (user_id = auth.uid());
create policy "update own rating" on public.ratings
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "delete own rating" on public.ratings
  for delete to authenticated using (user_id = auth.uid());

create policy "read tags of visible ratings" on public.rating_tags
  for select to authenticated using (
    exists (select 1 from public.ratings r
            where r.id = rating_id and (r.user_id = auth.uid() or public.is_committee())));
create policy "write tags on own rating" on public.rating_tags
  for all to authenticated
  using (exists (select 1 from public.ratings r where r.id = rating_id and r.user_id = auth.uid()))
  with check (exists (select 1 from public.ratings r where r.id = rating_id and r.user_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- Realtime (step 4): broadcast menu changes to students.
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.meals, public.menu_items;
