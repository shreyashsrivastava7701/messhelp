# Making and publishing changes (Mac)

The code lives in your `messhelp` folder, which is connected to GitHub. Vercel watches GitHub and rebuilds
https://chachukamittar.vercel.app by itself after every push. Your data (menu, students, photos, ratings) lives
in Supabase, so code changes never touch it.

## Everyday changes

1. Edit and save files in VS Code (**Cmd+S**). If you like, check them first on http://localhost:3000
   (`npm run dev`).
2. Open **Source Control** (**Ctrl+Shift+G**). Changed files show an **M** (modified) or **U** (new).
3. Type a short message such as `Fix menu text`, then click **Commit**. If it asks to stage all changes, click **Yes**.
4. Click **Sync Changes** (or **Push**).
5. About 1 to 2 minutes later the live site is updated. Watch it on vercel.com under **Deployments**.
   If a deployment turns red, open it and copy the last red lines to Claude.

## Changes sent as files

When Claude sends you changed files:

1. Stop the app with **Ctrl+C** if it's running.
2. Put each file at the path given (replace the old one). Keep the same `messhelp` folder: don't swap in a new
   folder, because that would lose the connection to GitHub.
3. If `package.json` changed, run `npm install`.
4. Run any new SQL file (see below), then commit and sync as above.

## New SQL files

Code goes live through GitHub, but the database doesn't: a new file in `supabase/migrations/` must be run once in
Supabase > **SQL Editor** > **New query** > paste > **Run**. Never re-run one you already ran, and don't run the seed
files again (they would add dummy data back).

Already run on your project, in order:

| File | What it adds |
| --- | --- |
| `20260929000000_init.sql` | Accounts, meals, menus, tags, ratings |
| `20260929020000_step2.sql` | Rating rules, Yes / No, updates, roster, snack log, weekly menu |
| `20260929030000_student_photos.sql` | Student photo storage |
| `20260929040000_steps3_5.sql` | Quality checks and their photo storage, live alerts for quality checks |
| `20260929050000_kiosk.sql` | Snack counter: kiosk PIN, face data, one snack a day |
| `20260929060000_kiosk_auto_faces.sql` | Snack counter learns faces from roster photos by itself |

## New keys

Keys live in two places: `.env.local` on your laptop, and **Settings > Environment Variables** in the Vercel project.
If a change needs a new key, add it in both, restart `npm run dev`, and redeploy on Vercel
(**Deployments > ⋯ > Redeploy**) so the live site picks it up.

## Snack counter setup (once)

1. Sign in on the **Mess committee** tab and open **Kiosk**.
2. Set a kiosk PIN (6 to 12 digits).
3. On the counter laptop or phone, open the **Snack counter** tab on the sign-in page (or `/kiosk`), type the PIN and
   allow the camera. Face data is made automatically from the photos on the Students page. The
   **Check new photos now** button on the Kiosk page is optional and lists photos without a clear face.
