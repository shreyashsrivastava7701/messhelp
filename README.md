# Chachu ka Mittar

One app for the hostel mess: today's menu, meal ratings, a committee dashboard, and live alerts.

How it all fits together: [ARCHITECTURE.md](ARCHITECTURE.md). Built so far: steps 1 and 2 of the build order below. Updating from an earlier version? See [UPDATING.md](UPDATING.md).

## Stack

- Next.js 15 (App Router) + Tailwind CSS 4
- Supabase for the database, auth and (from step 4) realtime

## Setup

Step-by-step laptop guide (VS Code and Claude Code): [RUN_LOCALLY.md](RUN_LOCALLY.md).

1. **Create a Supabase project** at [supabase.com](https://supabase.com) (the free tier is enough).

2. **Create the tables.** In the Supabase dashboard open *SQL Editor*, paste the contents of
   [`supabase/migrations/20260929000000_init.sql`](supabase/migrations/20260929000000_init.sql) and run it.
   Then run [`supabase/migrations/20260929020000_step2.sql`](supabase/migrations/20260929020000_step2.sql) the same way.
   Then `supabase/migrations/20260929030000_student_photos.sql`, `supabase/migrations/20260929040000_steps3_5.sql`
   `supabase/migrations/20260929050000_kiosk.sql` and `supabase/migrations/20260929060000_kiosk_auto_faces.sql`.
   Optionally run `supabase/seed_students.sql` and `supabase/seed_weekly_menu.sql` for dummy students and menus.
   (If you use the Supabase CLI instead: `supabase link` then `supabase db push`.)

3. **Skip email confirmation while building** (optional). *Authentication > Sign In / Providers > Email*,
   turn off *Confirm email*. With it on, new users must click the link in their inbox before signing in;
   add `http://localhost:3000/auth/callback` under *Authentication > URL Configuration > Redirect URLs*.

4. **Add your keys.** Copy `.env.example` to `.env.local` and fill in the two values from
   *Project Settings > API* (the anon key or the newer publishable key both work).
   `.env.local` is git-ignored; never commit it. For the AI summary, also set `ANTHROPIC_API_KEY`
   (from console.anthropic.com); the rest of the app works without it.

   ```bash
   cp .env.example .env.local
   ```

5. **Run it.**

   ```bash
   npm install
   npm run dev
   ```

   Open http://localhost:3000 and create an account.

6. **Make yourself committee (or admin).** Everyone signs up as a student. In the SQL Editor:

   ```sql
   update public.profiles set role = 'admin'
   where id = (select id from auth.users where email = 'you@example.com');
   ```

   Refresh the app and an *Edit menu* link appears in the header. Roles can only be changed from the SQL
   Editor or by an admin, never by a user on their own profile.

## Pages

**Student** (sign up on the Student tab with a roll number)

| Page | What it does |
| --- | --- |
| `/` Menu | Today's menu per meal, with an "Eating?" Yes / No panel beside each meal that closes 2 hours before it. Tap stars to rate a meal once it has started (open for 2 days), plus tags and a comment. |
| `/updates` | Announcements from the committee. Turn on browser notifications here. |
| `/my-food` | Snacks you were logged as taking, meals you signed up for, and your ratings (last 14 days). |

**Mess committee** (sign in on the Mess committee tab; role must be `committee` or `admin`)

| Page | What it does |
| --- | --- |
| `/admin` Summary | Per meal: headcount from the Yes / No answers, average rating, top tags, quality check status. Snacks given and who took more than once. Latest AI summary. |
| `/admin/trends` | Charts for the last 7, 14 or 30 days: average rating per meal, most common complaint tags, best and worst dishes, students eating per day. Each chart has a table view. |
| `/admin/insights` (AI, hidden from the menu) | One button writes a short summary of recent comments and tags with the Claude API (needs `ANTHROPIC_API_KEY`). Past summaries are kept. |
| `/admin/quality` | Before each meal: hygiene, temperature, quantity and taste OK/issue, food temperature, notes and a photo. Students see a "Quality checked" badge on the menu. |
| `/admin/menu` | Edit any day's menu, or fill 4 weeks from the weekly menu. |
| `/admin/feedback` | Every rating with tags and comment; filter by meal or 1–2 stars. |
| `/admin/kiosk` | Set the kiosk PIN and open the kiosk. Face data is made automatically by the kiosk from roster photos. |
| `/admin/snacks` | Log a snack by roll number (shows the student's photo) and flag repeats. Counter `staff` accounts see only this page. |
| `/admin/students` | Hostel roster: search, add, remove, import from CSV, and bulk-upload photos named by roll number. |
| `/admin/updates` | Post and pin announcements. |

**Snack counter** (`/kiosk`, no sign-in): a committee member enters the kiosk PIN once on the counter device. Students
press **Take photo** (matched against roster photos in the browser) or scan their ID card's QR/barcode. Each student
gets one snack a day; a second try shows when they already took it. The manual Snacks page stays as a backup.

**Live alerts:** while a student has the app open, a menu change, a new update or a new quality check pops up as a banner and the page refreshes by itself. With notifications on, they also get a browser notification when the tab is in the background.

The day is always computed in India time (`Asia/Kolkata`), whatever region the server runs in.

## Dummy data

- `supabase/seed_students.sql`: 30 fake students (roll numbers `22CS001`–`22CS015`, `22EC001`–`22EC015`) with generated initials photos. The same data is in `supabase/students.csv`.
- `supabase/seed_weekly_menu.sql`: a Monday-to-Sunday menu, applied to the last 7 days and the next 4 weeks.

To add students: **Admin > Students**, then **Add a student** for one, or **Import from CSV** for many
(template at `public/students-template.csv`; columns `roll_no, full_name, room_no, email, photo_url`, only the first two required).
Photos: put a Google Drive link in `photo_url` (the file must be shared as "Anyone with the link"), or use
**Upload photos** and pick a folder of images named by roll number (`22CS001.jpg`). Uploaded photos are shrunk to 400px
and stored in the Supabase Storage bucket `student-photos` (needs `20260929030000_student_photos.sql`).
To change the regular weekly menu: **Table Editor > weekly_menu_items** (weekday 1 = Monday), then **Fill 4 weeks from weekly menu** on the admin Menu page.

When a student signs up with a roll number that's in the roster, their account is linked to it and their name and room come from the roster.
To link an existing account by hand (SQL Editor):

```sql
update public.profiles set roll_no = '22CS001'
where id = (select id from auth.users where email = 'student@example.com');
```

To make a counter staff account, sign them up as a student, then set `role = 'staff'` the same way as admin.

## Database

| Table | Purpose |
| --- | --- |
| `profiles` | One row per user, created on sign up. `role` is `student`, `committee`, `staff` or `admin`; `roll_no` links to the roster. |
| `students` | Hostel roster: roll number, name, room, photo URL, email. |
| `meals` / `menu_items` | One row per date and meal, and its dishes. |
| `weekly_menu_items` | The regular weekly plan used to fill dates. |
| `tags`, `ratings`, `rating_tags` | 1–5 stars, tags and comment; one rating per student per meal. |
| `meal_attendance` | Yes / No per student per meal. |
| `announcements` | Updates board. |
| `snack_logs` | Snacks taken, by roll number; method `manual` now, `qr` and `face` later. |

Row level security is on for every table. Students see only their own ratings, answers and snack log;
the committee sees everything; staff can read the roster and log snacks.

## Deploying to Vercel

Import the repository in Vercel, add the same two environment variables, and add
`https://<your-app>.vercel.app/auth/callback` to Supabase's redirect URLs.

## Build order

1. ✅ Login, menu page, admin menu editing
2. ✅ Rating flow, plus meal opt-in, updates board, snack log, student roster
3. Dashboard with charts
4. Realtime menu alerts
5. AI complaint summary
6. Snack tracking (QR first, then face)
