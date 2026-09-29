-- Demo menu for today (India time). Safe to re-run.
with d as (select (now() at time zone 'Asia/Kolkata')::date as today),
m as (
  insert into public.meals (menu_date, meal_type, starts_at, ends_at)
  select d.today, x.meal, x.s, x.e from d,
    (values ('breakfast'::public.meal_type, '07:30'::time, '09:30'::time),
            ('lunch',  '12:30', '14:30'),
            ('snacks', '17:00', '18:00'),
            ('dinner', '20:00', '22:00')) as x(meal, s, e)
  on conflict (menu_date, meal_type) do update set starts_at = excluded.starts_at
  returning id, meal_type
)
insert into public.menu_items (meal_id, name, is_veg, position)
select m.id, i.name, i.veg, i.pos from m
join (values
  ('breakfast'::public.meal_type, 'Aloo paratha', true, 0),
  ('breakfast', 'Curd', true, 1),
  ('breakfast', 'Tea', true, 2),
  ('lunch', 'Rice', true, 0),
  ('lunch', 'Dal tadka', true, 1),
  ('lunch', 'Roti', true, 2),
  ('lunch', 'Aloo gobhi', true, 3),
  ('snacks', 'Samosa', true, 0),
  ('snacks', 'Tea', true, 1),
  ('dinner', 'Jeera rice', true, 0),
  ('dinner', 'Rajma', true, 1),
  ('dinner', 'Roti', true, 2),
  ('dinner', 'Egg curry', false, 3)
) as i(meal, name, veg, pos) on i.meal = m.meal_type
on conflict (meal_id, name) do nothing;
