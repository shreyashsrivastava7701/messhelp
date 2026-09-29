-- The kiosk now learns faces by itself: when it starts (and every few minutes)
-- it makes face data for any student whose roster photo is new or changed, so
-- the committee only has to add students and photos on the Students page.

-- Roster for the kiosk, now also saying which photo each face was made from.
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
             'face_photo_url', f.photo_url,
             'taken_today', (select min(l.created_at) from public.snack_logs l
                              where l.roll_no = s.roll_no and l.menu_date = public.today_ist()))
           order by s.roll_no)
      from public.students s
      left join public.face_descriptors f on f.roll_no = s.roll_no), '[]'::jsonb));
end;
$$;

-- A student's photo link, for the kiosk's photo download (PIN required).
create or replace function public.kiosk_photo_url(p_pin text, p_roll_no text)
returns text
language plpgsql security definer set search_path = public
as $$
begin
  if public.kiosk_check_pin(p_pin) is not null then
    return null;
  end if;
  return (select photo_url from public.students where roll_no = p_roll_no);
end;
$$;

-- Saves face data made by the kiosk. Only accepted for the student's current photo.
-- p_rows: [{"roll_no": "...", "photo_url": "...", "descriptor": [128 numbers]}]
create or replace function public.kiosk_save_faces(p_pin text, p_rows jsonb)
returns int
language plpgsql security definer set search_path = public
as $$
declare
  v_saved int;
begin
  if public.kiosk_check_pin(p_pin) is not null then
    return 0;
  end if;
  insert into public.face_descriptors (roll_no, descriptor, photo_url, updated_at)
  select r.roll_no, r.descriptor, r.photo_url, now()
    from jsonb_to_recordset(coalesce(p_rows, '[]'::jsonb)) as r(roll_no text, photo_url text, descriptor real[])
    join public.students s on s.roll_no = r.roll_no and s.photo_url = r.photo_url
   where array_length(r.descriptor, 1) = 128
  on conflict (roll_no) do update
    set descriptor = excluded.descriptor, photo_url = excluded.photo_url, updated_at = now();
  get diagnostics v_saved = row_count;
  return v_saved;
end;
$$;

revoke all on function public.kiosk_photo_url(text, text) from public;
revoke all on function public.kiosk_save_faces(text, jsonb) from public;
grant execute on function public.kiosk_photo_url(text, text) to anon, authenticated;
grant execute on function public.kiosk_save_faces(text, jsonb) to anon, authenticated;
