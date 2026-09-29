-- Snack kiosk: a no-login screen at the counter that recognises a student's face
-- (or their ID card) and logs one snack per day.
--
-- The kiosk has no user account. It proves itself with a kiosk PIN that the
-- committee sets; every kiosk call goes through a security-definer function
-- that checks the PIN, so the tables stay closed to anonymous users.
-- Only face *descriptors* (128 numbers per student) are stored here, never
-- extra photos.

-- ---------------------------------------------------------------------------
-- Face descriptors, computed in the committee's browser from roster photos.
-- ---------------------------------------------------------------------------
create table if not exists public.face_descriptors (
  roll_no     text primary key references public.students (roll_no) on delete cascade,
  descriptor  real[] not null check (array_length(descriptor, 1) = 128),
  photo_url   text,              -- the photo it was made from; changes mean "redo"
  updated_at  timestamptz not null default now()
);

alter table public.face_descriptors enable row level security;

drop policy if exists "committee manages face data" on public.face_descriptors;
create policy "committee manages face data" on public.face_descriptors
  for all to authenticated using (public.is_committee()) with check (public.is_committee());

-- ---------------------------------------------------------------------------
-- Kiosk PIN (one row). No policies: only the functions below touch it.
-- ---------------------------------------------------------------------------
create table if not exists public.kiosk_settings (
  id            boolean primary key default true check (id),
  pin_hash      text not null,
  failed_count  int not null default 0,
  locked_until  timestamptz,
  updated_at    timestamptz not null default now()
);

alter table public.kiosk_settings enable row level security;

create or replace function public.set_kiosk_pin(p_pin text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_committee() then
    raise exception 'Only the mess committee can set the kiosk PIN';
  end if;
  if p_pin is null or p_pin !~ '^[0-9]{6,12}$' then
    raise exception 'The PIN must be 6 to 12 digits';
  end if;
  insert into public.kiosk_settings (id, pin_hash, failed_count, locked_until, updated_at)
  values (true, encode(sha256(convert_to('messmate-kiosk:' || p_pin, 'UTF8')), 'hex'), 0, null, now())
  on conflict (id) do update
    set pin_hash = excluded.pin_hash, failed_count = 0, locked_until = null, updated_at = now();
end;
$$;

create or replace function public.kiosk_is_set()
returns boolean
language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.kiosk_settings) $$;

-- Checks the PIN. Returns null when it's right, otherwise a reason.
-- It returns instead of raising so the failed-try counter is saved.
-- Ten wrong tries lock the kiosk for 15 minutes.
create or replace function public.kiosk_check_pin(p_pin text)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  s public.kiosk_settings;
begin
  select * into s from public.kiosk_settings where id for update;
  if not found then
    return 'not_set';
  end if;
  if s.locked_until is not null and s.locked_until > now() then
    return 'locked';
  end if;
  if s.pin_hash <> encode(sha256(convert_to('messmate-kiosk:' || coalesce(p_pin, ''), 'UTF8')), 'hex') then
    update public.kiosk_settings
       set failed_count = s.failed_count + 1,
           locked_until = case when s.failed_count + 1 >= 10 then now() + interval '15 minutes' end
     where id;
    return 'bad_pin';
  end if;
  if s.failed_count > 0 then
    update public.kiosk_settings set failed_count = 0, locked_until = null where id;
  end if;
  return null;
end;
$$;

-- Everything the kiosk needs to recognise students and show who they are.
-- Returns {"error": reason} or {"students": [...]}.
create or replace function public.kiosk_roster(p_pin text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_err text := public.kiosk_check_pin(p_pin);
begin
  if v_err is not null then
    return jsonb_build_object('error', v_err);
  end if;
  return jsonb_build_object('students', coalesce((
    select jsonb_agg(jsonb_build_object(
             'roll_no', s.roll_no,
             'full_name', s.full_name,
             'room_no', s.room_no,
             'photo_url', s.photo_url,
             'descriptor', f.descriptor,
             'taken_today', (select min(l.created_at) from public.snack_logs l
                              where l.roll_no = s.roll_no and l.menu_date = public.today_ist()))
           order by s.roll_no)
      from public.students s
      left join public.face_descriptors f on f.roll_no = s.roll_no), '[]'::jsonb));
end;
$$;

-- Logs one snack for today. A second try the same day is refused.
-- Returns {"status": logged | already | unknown | <pin error>, "full_name", "taken_at"}.
create or replace function public.kiosk_log_snack(p_pin text, p_roll_no text, p_method text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_err   text := public.kiosk_check_pin(p_pin);
  v_name  text;
  v_first timestamptz;
  v_item  text;
begin
  if v_err is not null then
    return jsonb_build_object('status', v_err);
  end if;
  if p_method not in ('qr', 'face') then
    return jsonb_build_object('status', 'unknown');
  end if;

  select s.full_name into v_name from public.students s where s.roll_no = p_roll_no;
  if not found then
    return jsonb_build_object('status', 'unknown');
  end if;

  -- One at a time per student, so two quick taps can't both get through.
  perform pg_advisory_xact_lock(hashtext('kiosk-snack:' || p_roll_no));

  select min(l.created_at) into v_first
    from public.snack_logs l
   where l.roll_no = p_roll_no and l.menu_date = public.today_ist();
  if v_first is not null then
    return jsonb_build_object('status', 'already', 'full_name', v_name, 'taken_at', v_first);
  end if;

  select coalesce(string_agg(mi.name, ', ' order by mi.position), 'Snacks') into v_item
    from public.meals m
    join public.menu_items mi on mi.meal_id = m.id
   where m.menu_date = public.today_ist() and m.meal_type = 'snacks';

  insert into public.snack_logs (roll_no, item, quantity, method, logged_by)
  values (p_roll_no, left(v_item, 200), 1, p_method, null);

  return jsonb_build_object('status', 'logged', 'full_name', v_name, 'taken_at', now());
end;
$$;

revoke all on function public.set_kiosk_pin(text) from public;
revoke all on function public.kiosk_check_pin(text) from public;
revoke all on function public.kiosk_roster(text) from public;
revoke all on function public.kiosk_log_snack(text, text, text) from public;
revoke all on function public.kiosk_is_set() from public;
grant execute on function public.set_kiosk_pin(text) to authenticated;
grant execute on function public.kiosk_is_set() to authenticated;
grant execute on function public.kiosk_roster(text) to anon, authenticated;
grant execute on function public.kiosk_log_snack(text, text, text) to anon, authenticated;
