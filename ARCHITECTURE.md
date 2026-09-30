# Chachu ka Mittar: architecture

Chachu ka Mittar is one web app for the Kailash Boys Hostel mess at
NIT Hamirpur, live at https://chachukamittar.vercel.app. Students see the menu, say whether they'll eat, rate meals
and see what they've taken. The mess committee edits menus, reads feedback and charts, logs food quality, manages
the student roster and posts updates. A no-login snack counter checks students by face or ID card.

This file explains how the pieces fit, how a request flows, where each thing lives, and what's left to build.
For install steps see [RUN_LOCALLY.md](RUN_LOCALLY.md); for publishing changes see [UPDATING.md](UPDATING.md) and
[DEPLOY.md](DEPLOY.md).

---

## 1. The big picture

```
   Student's phone / Committee laptop
            │  (browser)
            ▼
 ┌──────────────────────────────────────┐
 │  Next.js app (this folder)           │   on Vercel (live site)
 │                                      │   and on your Mac (dev)
 │  middleware.ts ── checks login on    │
 │                   every request      │
 │  Pages (server components) ─ read    │
 │  Server actions ─ write              │
 │  Client components ─ taps, charts,   │
 │   photo upload, snack counter camera │
 └───────────────┬──────────────────────┘
                 │ supabase-js (URL + anon key from .env.local)
                 ▼
 ┌──────────────────────────────────────┐
 │  Supabase                            │
 │   Auth      – email + password       │
 │   Postgres  – all tables             │
 │   RLS       – who may read/write     │
 │   Storage   – student/quality photos │
 │   Realtime  – live alerts to students│
 └──────────────────────────────────────┘
```

There is no separate backend server. The Next.js app talks straight to Supabase, and **security is enforced
inside the database** with Row Level Security (RLS). Even if someone called Supabase directly with the public
key, the database would still refuse anything their role isn't allowed to do. Checks in the UI (like hiding
the Admin link) are only for convenience.

---

## 2. Tech stack

| Layer | What | Why |
| --- | --- | --- |
| Frontend + server | Next.js 15 (App Router), React 19, TypeScript | Pages render on the server, so they're fast on cheap phones and keys never reach the browser unnecessarily. |
| Styling | Tailwind CSS 4 | Quick, consistent, mobile-first. |
| Database, login, files | Supabase (Postgres, Auth, Storage, Realtime) | One free service covers all of it. |
| Hosting | Vercel | Free tier; rebuilds the site on every push to GitHub. |
| ID card scan | @zxing/browser | Reads QR codes and barcodes from the camera. |
| Face matching | face-api (TensorFlow.js) in the browser | No separate server needed; only face descriptors are stored. |

---

## 3. Who uses it (roles)

Every account has a `role` in the `profiles` table.

| Role | How they get it | What they can do |
| --- | --- | --- |
| `student` | Default on sign-up | Menu, Yes/No opt-in, rate meals, updates, own food history |
| `committee` | Admin sets it with SQL | Everything on the admin side |
| `admin` | You set it with SQL | Same as committee, plus changing other people's roles |
| `staff` | Admin sets it with SQL | Only the Snacks counter page (log snacks, see the roster) |

The login page has three tabs. **Student** signs in or signs up (with a roll number). **Mess committee** signs
in only, and rejects accounts that aren't committee, admin or staff. **Snack counter** opens the kiosk, which
needs the kiosk PIN instead of an account.

---

## 4. How a request flows

**Reading a page** (for example, a student opens the menu):

1. `src/middleware.ts` runs first. It refreshes the login cookie and sends signed-out users to `/login`.
2. The page (`src/app/(student)/page.tsx`) runs **on the server**. It asks Supabase for the meals, tags,
   the student's answers and ratings, all at once in parallel.
3. Supabase applies RLS, so the student only gets rows they're allowed to see.
4. The server sends finished HTML to the phone. Small interactive parts (stars, Yes/No) then come alive in
   the browser.

**Writing** (for example, a student taps 4 stars):

1. `rate-meal.tsx` (a client component) calls the server action `rateMeal()` in `src/app/(student)/actions.ts`.
2. The action calls the database function `submit_rating()`, which saves stars, tags and comment in one go.
3. RLS checks the rating is the student's own and that the meal is open for rating. If not, the save is refused
   and the student sees a friendly message.

**Live alerts** go the other way: `live-updates.tsx` in the student layout subscribes to Supabase Realtime.
When the committee changes a menu, posts an update or saves a quality check, open student screens show a
banner and refresh themselves.

**Snack kiosk**: `/kiosk` has no user login. The counter device stores a kiosk PIN, and every call goes through
database functions (`kiosk_roster`, `kiosk_log_snack`) that check the PIN, lock after 10 wrong tries, and allow
one snack per student per day. Face matching runs entirely in the browser with face-api: the kiosk itself turns
each roster photo into 128 numbers once (and again when a photo changes), and compares a new photo against
those numbers. Adding students and photos on the Students page is all the committee does. ID cards are read with a QR/barcode scanner that looks for a roster roll number in the code.

**Photo upload** is the one exception that goes straight from the browser to Supabase Storage (it's faster
for big folders). The committee's own login is used, and Storage policies only let committee accounts upload.

---

## 5. Folder map

```
messmate/
├─ src/
│  ├─ middleware.ts              login check on every request
│  ├─ app/
│  │  ├─ kiosk/                  /kiosk  no-login snack counter (face or ID card)
│  │  ├─ api/face-photo/         serves roster photos for face data (committee or kiosk PIN)
│  │  ├─ login/                  Student / Mess committee / Snack counter tabs, sign-in and sign-up
│  │  ├─ auth/callback/          target of email confirmation links
│  │  ├─ (student)/              student side (the "(student)" folder name doesn't appear in URLs)
│  │  │  ├─ page.tsx             /          menu + Yes/No + rating
│  │  │  ├─ updates/             /updates   announcements
│  │  │  ├─ my-food/             /my-food   snacks, sign-ups, ratings
│  │  │  └─ actions.ts           rateMeal, setAttendance
│  │  └─ admin/                  committee side, all under /admin
│  │     ├─ page.tsx             Summary
│  │     ├─ trends/              Charts over 7/14/30 days
│  │     ├─ quality/             Pre-meal quality checklist + photo
│  │     ├─ menu/                Edit menu + fill from weekly menu
│  │     ├─ feedback/            All ratings and comments
│  │     ├─ snacks/              Log snacks, repeat flags (manual backup)
│  │     ├─ kiosk/               Kiosk PIN, face data status
│  │     ├─ students/            Roster, CSV import, photo upload
│  │     ├─ updates/             Post announcements
│  │     └─ actions.ts           server actions for the pages above
│  ├─ components/                header, brand (logo), nav, date switcher, avatar, live alerts, charts/
│  └─ lib/
│     ├─ supabase/               the three Supabase clients (browser, server, middleware)
│     ├─ auth.ts                 requireProfile / requireCommittee / requireStaff
│     ├─ menu.ts                 meal times, opt-in deadline, rating window
│     ├─ dates.ts                everything in India time
│     ├─ csv.ts                  CSV reader for the roster import
│     ├─ photos.ts               Google Drive link → image link
│     ├─ image.ts                shrink photos in the browser before upload
│     ├─ feedback-stats.ts       numbers behind the Trends charts
│     ├─ face.ts                 face detection + matching in the browser
│     ├─ brand.ts                app and hostel name
│     └─ types.ts                shared types and constants
├─ supabase/
│  ├─ migrations/                database changes, run in order, once each
│  └─ seed_*.sql, students.csv   optional dummy data
├─ public/                      NIT logo, face models (models/), students-template.csv
├─ .env.local                    your Supabase URL and key (never shared or committed)
└─ README.md, RUN_LOCALLY.md, UPDATING.md, DEPLOY.md, CLAUDE.md, ARCHITECTURE.md
```

---

## 6. Database

```
auth.users ──1:1── profiles ──(roll_no)──► students ◄──(roll_no)── snack_logs
                      │
                      ├──< ratings >── meals ──< menu_items
                      │       └──< rating_tags >── tags
                      ├──< meal_attendance  (date + meal)
                      ├──< announcements (created_by)
                      └──< quality_checks (checked_by, one per date + meal)

weekly_menu_items ── apply_weekly_menu() ──► meals + menu_items
```

| Table | One row per | Notes |
| --- | --- | --- |
| `profiles` | app account | Created automatically on sign-up. Holds `role` and the linked `roll_no`. |
| `students` | hostel resident | The roster, even for people without the app. Photo link lives here. |
| `meals` | date + meal (breakfast, lunch, snacks, dinner) | Start/end time and a note. |
| `menu_items` | dish in a meal | Veg flag and order. |
| `weekly_menu_items` | dish in the regular weekly plan | Weekday 1 = Monday. Copied into dates by `apply_weekly_menu()`. |
| `tags` | rating tag | "Too oily", "Cold", "Tasty"… |
| `ratings` | student + meal | 1–5 stars and a comment. One per student per meal. |
| `rating_tags` | tag on a rating | Can also point at a single dish. |
| `meal_attendance` | student + date + meal | Yes/No answer. |
| `announcements` | update post | Can be pinned. |
| `quality_checks` | date + meal | Hygiene / temperature / quantity / taste OK, °C, notes, photo. Everyone reads; committee writes. |
| `face_descriptors` | student | 128 numbers describing their face, made from the roster photo. Committee reads; the kiosk writes through a PIN-checked function. |
| `kiosk_settings` | (one row) | Hashed kiosk PIN and wrong-try counter. Only kiosk functions touch it. |
| `snack_logs` | snack handed out | By roll number; `method` is `manual`, `qr` (ID card) or `face`. |

**Rules the database enforces:**

- Students see and change only their own ratings, answers and snack history.
- Ratings open when a meal starts and stay open for 2 days.
- Yes/No closes 2 hours before a meal starts.
- Only committee/admin edit menus, the roster, announcements and quality checks. Staff can log snacks.
- The snack counter allows one snack per student per day, and locks for 15 minutes after 10 wrong PINs.
- Only admins change roles. Students can't re-link themselves to someone else's roll number.
- On sign-up, if the roll number is in the roster and unclaimed, the account is linked and the name and room
  are filled in from the roster.

The time rules exist in both SQL (`rating_open`, `attendance_deadline`) and `src/lib/menu.ts` (for what the
screen shows). Change both together.

### Migrations (run once each, in order)

| File | Adds |
| --- | --- |
| `20260929000000_init.sql` | Roles, profiles, meals, menu items, tags, ratings, RLS, realtime |
| `20260929020000_step2.sql` | Rating rules, opt-in, announcements, roster, snack log, weekly menu |
| `20260929030000_student_photos.sql` | `student-photos` storage bucket and its rules |
| `20260929040000_steps3_5.sql` | `quality_checks`, `quality-photos` bucket, realtime for quality checks |
| `20260929050000_kiosk.sql` | Face descriptors, kiosk PIN, kiosk functions (one snack a day) |
| `20260929060000_kiosk_auto_faces.sql` | Lets the kiosk make face data itself from roster photos |

---

## 7. Setup steps (fresh start)

1. Install Node.js 20+ and VS Code.
2. Create a Supabase project. In **SQL Editor**, run the six migrations above in order.
   Optionally run `seed_weekly_menu.sql` for a sample menu.
3. In Supabase, **Authentication > Sign In / Providers > Email**: turn off "Confirm email" while developing.
4. In the project folder: `cp .env.example .env.local`, then paste your Project URL and anon key into it.
5. `npm install`, then `npm run dev`, and open http://localhost:3000.
6. Sign up on the **Student** tab, then make yourself admin in SQL:
   `update public.profiles set role = 'admin' where id = (select id from auth.users where email = 'you@…');`
7. Sign in on the **Mess committee** tab. Add students (CSV or one by one), upload photos, set up the menu, and set
   a kiosk PIN on the **Kiosk** page.
8. To put it online, follow [DEPLOY.md](DEPLOY.md).

---

## 8. What's done

| Step | Status | Contents |
| --- | --- | --- |
| 1. Login, menu, admin menu editing | ✅ Done | Email login, today's menu, per-day editor |
| 2. Rating flow | ✅ Done | 2-tap stars, tags, comments; plus Yes/No opt-in, updates board, snack log, roster, committee summary and feedback log |
| Extra | ✅ Done | Student / committee login tabs, weekly menu, CSV import, Drive photo links, bulk photo upload |
| 3. Dashboard with charts | ✅ Done | Trends page: rating per meal over time, complaint tags, best/worst dishes, daily headcount |
| 4. Realtime alerts | ✅ Done | Live banner + auto refresh for students; optional browser notifications |
| 5. Quality check log | ✅ Done | Pre-meal checklist with photo; badge on the student menu |
| 6. Snack counter | ✅ Done | No-login kiosk: face photo or ID card scan, one snack a day, learns faces from roster photos; manual Snacks page kept as backup |
| Branding | ✅ Done | Chachu ka Mittar name, NIT Hamirpur logo, "Eating?" Yes/No beside each meal, Snack counter tab on sign-in |
| Online | ✅ Done | Code on GitHub; live on Vercel at https://chachukamittar.vercel.app |

Tested so far: type checks, lint and production build pass; database rules were tested against a local
Postgres copy; the charts and the snack counter were run in a browser with sample data and a fake camera.
Face matching on real faces still needs trying with a few students.

---

## 9. Next steps

1. **Try the snack counter with real students** and tune the match strictness in `src/lib/face.ts` (`SURE`, `MAYBE`)
   if it confuses people or rejects them too often.
2. **Connect the GitHub repo to the Claude project** (Project settings > Repositories), so changes can arrive as
   pull requests you approve instead of files you copy.
3. **Before real students join:** turn **Confirm email** back on in Supabase, and make sure the live address is in
   **Authentication > URL Configuration**.
4. **Polish.**
   - Make photos private (signed links) instead of public links.
   - Restrict sign-up to the college email domain.
   - Add a few automated tests for the rating and opt-in rules.
   - Add an installable home-screen icon (PWA).
