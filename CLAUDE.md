# Chachu ka Mittar

Mess app for Kailash Boys Hostel, NIT Hamirpur: menu, Yes / No opt-in, ratings, committee dashboard, live alerts, quality log, no-login snack counter. Next.js 15 (App Router, `src/`) + Tailwind 4 + Supabase (`@supabase/ssr`). Live at https://chachukamittar.vercel.app; Vercel deploys every push to `main`.

## Commands
- `npm run dev`: dev server on http://localhost:3000
- `npm run lint` and `npx tsc --noEmit`: run both before calling a change done
- `npm run build`: production build

## Layout
- `src/lib/supabase/`: browser, server and middleware Supabase clients. `src/middleware.ts` redirects signed-out users to `/login`; public paths are listed in `src/lib/supabase/middleware.ts`.
- `src/lib/auth.ts`: `requireProfile()`, `requireCommittee()`, `requireStaff()`, `isCommittee()`.
- `src/app/(student)/`: student pages (menu with rating + opt-in, updates, my-food) and their server actions.
- `src/app/admin/`: committee pages (summary, trends, menu, quality, feedback, snacks, kiosk, students, updates); shared server actions in `admin/actions.ts`. The staff role sees only snacks.
- `src/app/login/`: Student / Mess committee / Snack counter tabs; the committee tab rejects non-committee accounts.
- `src/app/kiosk/`: no-login snack counter. Auth is a kiosk PIN checked by security-definer RPCs (`kiosk_roster`, `kiosk_log_snack`, `kiosk_save_faces`, `kiosk_photo_url`). Face matching with face-api in the browser (`src/lib/face.ts`, models in `public/models`); ID scan with `@zxing/browser`. `src/app/api/face-photo/` proxies roster photos (committee login or kiosk PIN).
- `src/components/`: header and brand (NIT logo, `src/lib/brand.ts`), nav, live alerts, charts.
- `supabase/migrations/`: SQL schema. Add a new timestamped migration for schema changes; don't edit one that has already been run.

## Conventions
- Dates are India time: use `isoDateIST()` from `src/lib/dates.ts`, never `new Date().toISOString()` for "today".
- Access control lives in Postgres row level security; UI checks are only for display.
- Time rules exist twice: SQL (`rating_open`, `attendance_deadline`) and `src/lib/menu.ts`. Change both together.
- Secrets live in `.env.local` (git-ignored) and in Vercel's environment variables. Never commit keys.
- The header must not use `backdrop-blur`: it makes the fixed phone nav bar render inside the header.

## Built
1. Login, menu, admin editing
2. Rating flow, opt-in, updates, snack log, roster
3. Trends dashboard with charts: `admin/trends`, `lib/feedback-stats.ts`, `components/charts/`
4. Realtime alerts: `components/live-updates.tsx` in the student layout
5. Quality check log: `admin/quality`, table `quality_checks`, bucket `quality-photos`
6. Snack counter: `/kiosk`, setup at `admin/kiosk`
