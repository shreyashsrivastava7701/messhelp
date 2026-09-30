# Chachu ka Mittar

The mess app for Kailash Boys Hostel, NIT Hamirpur: today's menu, "Eating?" Yes / No, meal ratings,
a committee dashboard with charts, live alerts, a food quality log and a no-login snack counter.

- **Live site:** https://chachukamittar.vercel.app
- **How it fits together:** [ARCHITECTURE.md](ARCHITECTURE.md)
- **Run it on your laptop:** [RUN_LOCALLY.md](RUN_LOCALLY.md)
- **Put it online (GitHub + Vercel):** [DEPLOY.md](DEPLOY.md)
- **Making and publishing changes:** [UPDATING.md](UPDATING.md)

## Stack

- Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS 4
- Supabase: database, login, file storage and realtime
- face-api (in the browser) for the snack counter's face check, and a QR/barcode reader for ID cards
- Hosted on Vercel, which rebuilds the site on every push to GitHub

## Setup (fresh start)

1. **Create a Supabase project** at [supabase.com](https://supabase.com). The free tier is enough.

2. **Create the tables.** In the Supabase dashboard, open **SQL Editor** and run each of these files once, in this order:
   1. `supabase/migrations/20260929000000_init.sql`
   2. `supabase/migrations/20260929020000_step2.sql`
   3. `supabase/migrations/20260929030000_student_photos.sql`
   4. `supabase/migrations/20260929040000_steps3_5.sql`
   5. `supabase/migrations/20260929050000_kiosk.sql`
   6. `supabase/migrations/20260929060000_kiosk_auto_faces.sql`

   Optional dummy data: `supabase/seed_weekly_menu.sql` (a weekly menu) and `supabase/seed_students.sql` (30 fake students).

3. **Email confirmation** (optional while testing). Under **Authentication > Sign In / Providers > Email**, turn off
   **Confirm email** so new accounts can sign in straight away.

4. **Add your keys.** Copy `.env.example` to `.env.local` and fill in the two values from **Project Settings > API**
   (the anon key or the newer publishable key both work). `.env.local` is git-ignored; never commit it.

   ```bash
   cp .env.example .env.local
   ```

5. **Run it.**

   ```bash
   npm install
   npm run dev
   ```

   Open http://localhost:3000 and create an account on the **Student** tab.

6. **Make yourself admin.** In the SQL Editor:

   ```sql
   update public.profiles set role = 'admin'
   where id = (select id from auth.users where email = 'you@example.com');
   ```

   Then sign in on the **Mess committee** tab. Roles can only be changed from the SQL Editor, never by a user.

## Pages

The sign-in page has three tabs: **Student**, **Mess committee** and **Snack counter**.

**Student** (sign up on the Student tab with a roll number)

| Page | What it does |
| --- | --- |
| `/` Menu | Today's menu per meal, with an "Eating?" Yes / No panel beside each meal that closes 2 hours before it. Rate a meal with stars, tags and a comment once it has started (open for 2 days). Shows a "Quality checked" badge when the committee has checked a meal. |
| `/updates` | Announcements from the committee. Turn on browser notifications here. |
| `/my-food` | Snacks you took, meals you said Yes to, and your ratings (last 14 days). |

**Mess committee** (sign in on the Mess committee tab; role must be `committee` or `admin`)

| Page | What it does |
| --- | --- |
| `/admin` Summary | Per meal: headcount from the Yes / No answers, average rating, top tags and quality check status. Snacks given and who took more than once. |
| `/admin/trends` | Charts for the last 7, 14 or 30 days: average rating per meal, most common complaint tags, best and worst dishes, students eating per day. Each chart has a table view. |
| `/admin/menu` | Edit any day's menu, or fill 4 weeks from the weekly menu. |
| `/admin/quality` | Before each meal: hygiene, temperature, quantity and taste OK / issue, food temperature, notes and a photo. |
| `/admin/feedback` | Every rating with tags and comment; filter by meal or by 1–2 stars. |
| `/admin/snacks` | Log a snack by roll number by hand (shows the student's photo) and flag repeats. The backup for the snack counter. Counter `staff` accounts see only this page. |
| `/admin/kiosk` | Set the kiosk PIN and open the snack counter. Face data is made automatically from the roster photos. |
| `/admin/students` | Hostel roster: search, add, remove, import from CSV, and bulk-upload photos named by roll number. |
| `/admin/updates` | Post and pin announcements. |

**Snack counter** (`/kiosk`, no sign-in): a committee member enters the kiosk PIN once on the counter device.
Students press **Take photo** (matched against their roster photo) or switch to **ID card scan** and hold up their
card's QR code or barcode. Each student gets one snack a day; a second try shows when they already took it.
The kiosk learns faces by itself from the photos on the Students page, including new students and changed photos.
The camera needs `https://` (the live site) or `localhost`.

**Live alerts:** while a student has the app open, a menu change, a new update or a new quality check pops up as a
banner and the page refreshes by itself. With notifications on, they also get a browser notification when the tab
is in the background.

All dates and deadlines use India time (`Asia/Kolkata`), whatever region the server runs in.

## Students and photos

- **One student:** Admin > Students > **Add a student**.
- **Many students:** **Import from CSV** (template at `public/students-template.csv`; columns
  `roll_no, full_name, room_no, email, photo_url`, only the first two required).
- **Photos:** put a Google Drive link in `photo_url` (shared as "Anyone with the link"), or use **Upload photos**
  and pick a folder of images named by roll number (`22CS001.jpg`). Uploaded photos are shrunk to 400px and stored
  in the Supabase Storage bucket `student-photos`.
- **Weekly menu:** edit **Table Editor > weekly_menu_items** in Supabase (weekday 1 = Monday), then press
  **Fill 4 weeks from weekly menu** on the admin Menu page.

When a student signs up with a roll number that's in the roster, their account is linked to it and their name and
room come from the roster. To link an existing account by hand (SQL Editor):

```sql
update public.profiles set roll_no = '22CS001'
where id = (select id from auth.users where email = 'student@example.com');
```

To make a counter staff account, sign them up as a student, then set `role = 'staff'` the same way as admin.

## Database

| Table | Purpose |
| --- | --- |
| `profiles` | One row per user, created on sign-up. `role` is `student`, `committee`, `staff` or `admin`; `roll_no` links to the roster. |
| `students` | Hostel roster: roll number, name, room, photo link, email. |
| `meals` / `menu_items` | One row per date and meal, and its dishes. |
| `weekly_menu_items` | The regular weekly plan used to fill dates. |
| `tags`, `ratings`, `rating_tags` | 1–5 stars, tags and a comment; one rating per student per meal. |
| `meal_attendance` | Yes / No per student per meal. |
| `announcements` | Updates board. |
| `quality_checks` | One pre-meal quality check per date and meal. |
| `snack_logs` | Snacks taken, by roll number; method `manual`, `qr` or `face`. |
| `face_descriptors` | 128 numbers per student's face, made from the roster photo (no extra photos are stored). |
| `kiosk_settings` | The hashed kiosk PIN and the wrong-try counter. |

Row level security is on for every table. Students see only their own ratings, answers and snack log; the
committee sees everything; staff can read the roster and log snacks. The snack counter has no account and works
only through database functions that check the kiosk PIN.

## Build order

1. ✅ Login, menu page, admin menu editing
2. ✅ Rating flow, plus meal opt-in, updates board, snack log, student roster
3. ✅ Dashboard with charts (Trends)
4. ✅ Live menu and update alerts
5. ✅ Quality check log with photos
6. ✅ Snack counter: face check and ID card scan, no login
7. ✅ Online at https://chachukamittar.vercel.app
