# Chachu ka Mittar

Chachu ka Mittar, the Kailash Boys Hostel (NIT Hamirpur) mess app (folder still `messmate`): menu, ratings, committee dashboard, alerts. Next.js 15 (App Router, `src/`) + Tailwind 4 + Supabase (`@supabase/ssr`).

## Commands
- `npm run dev`: dev server on http://localhost:3000
- `npm run lint` and `npx tsc --noEmit`: run both before calling a change done
- `npm run build`: production build

## Layout
- `src/lib/supabase/`: browser, server and middleware Supabase clients. `src/middleware.ts` redirects signed-out users to `/login`.
- `src/lib/auth.ts`: `requireProfile()` and `isCommittee()`.
- `src/app/(student)/`: student pages (menu with rating + opt-in, updates, my-food) and their server actions.
- `src/app/admin/`: committee pages (summary, trends, menu, quality, feedback, snacks, kiosk, students, updates; AI page exists but is not in the nav); shared server actions in `admin/actions.ts`. The staff role sees only snacks.
- `src/app/login/`: Student / Mess committee tabs; the committee tab rejects non-committee accounts.
- `supabase/migrations/`: SQL schema. Add a new timestamped migration for schema changes; don't edit one that has already been run.

## Conventions
- Dates are India time: use `isoDateIST()` from `src/lib/dates.ts`, never `new Date().toISOString()` for "today".
- Access control lives in Postgres row level security; UI checks are only for display.
- Time rules exist twice: SQL (`rating_open`, `attendance_deadline`) and `src/lib/menu.ts`. Change both together.
- Secrets live in `.env.local` (git-ignored). Never commit keys.

## Build order
1. Login, menu, admin editing (done)
2. Rating flow, opt-in, updates, snack log, roster (done)
3. Trends dashboard with charts: `admin/trends`, `lib/feedback-stats.ts`, `components/charts/` (done)
4. Realtime alerts: `components/live-updates.tsx` in the student layout (done)
5. AI complaint summary: `lib/ai-summary.ts` (server-only, `ANTHROPIC_API_KEY`), `admin/insights`, table `ai_summaries` (done)
   Quality check log: `admin/quality`, table `quality_checks`, bucket `quality-photos` (done)
6. Snack kiosk: `/kiosk` (no login, kiosk PIN checked by security-definer RPCs `kiosk_roster`/`kiosk_log_snack`), face-api in the browser (`lib/face.ts`, models in `public/models`), ID scan with @zxing/browser; setup at `admin/kiosk` (done)
