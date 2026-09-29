# Updating Chachu ka Mittar to a new version (Mac)

Each new version comes as a zip. You swap the code folder, keep your keys, and run any new SQL once.
Your data lives in Supabase, so nothing is lost when you swap folders.

## 1. Stop the app
In the VS Code terminal that runs `npm run dev`, press **Ctrl+C**.

## 2. Swap the folder, keep your keys
1. Rename your current folder from `messmate` to `messmate-old` (in Finder: click it, press Enter, type the new name).
2. Unzip the new zip and move the new `messmate` folder to the same place, e.g. Documents.
3. Copy your keys file across. In the VS Code terminal (or the Terminal app):

   ```bash
   cd ~/Documents            # or wherever the two folders are
   cp messmate-old/.env.local messmate/.env.local
   ```

   `.env.local` is hidden in Finder. Press **Cmd+Shift+.** to show hidden files if you want to see it.

Why a fresh folder instead of copying new files over the old ones? New versions sometimes delete or move
files, and an old leftover file can break the app.

## 3. Open the new folder and start
In VS Code: **File > Open Folder…** and pick the new `messmate`. Then in its terminal:

```bash
npm install
npm run dev
```

## 4. Run the new SQL (only the new files, once each)
Supabase > **SQL Editor** > **+ New query** > paste the file > **Run**. Never re-run a migration you already ran.

| Version | Run these, in this order |
| --- | --- |
| Step 1 | `supabase/migrations/20260929000000_init.sql`, then `supabase/seed.sql` |
| Step 2 | `supabase/migrations/20260929020000_step2.sql`, then `supabase/seed_students.sql`, then `supabase/seed_weekly_menu.sql` |
| Photos (v3) | `supabase/migrations/20260929030000_student_photos.sql` |
| Dashboard, alerts, AI, quality (v4) | `supabase/migrations/20260929040000_steps3_5.sql` |
| Snack kiosk, new name (v5) | `supabase/migrations/20260929050000_kiosk.sql` |
| Kiosk learns faces itself (v6) | `supabase/migrations/20260929060000_kiosk_auto_faces.sql` |

Your menu, students, photos and ratings stay in Supabase, so a new zip never replaces them.
Don't run the seed files again; they would add the dummy data back.

## 5. Set up the snack kiosk (v5 and later)
1. Sign in on the **Mess committee** tab and open **Kiosk**.
2. Set a kiosk PIN (6 to 12 digits).
3. Face data is automatic: the kiosk learns each face from the photos on the Students page by itself
   (new students and changed photos are picked up within a few minutes). The **Check new photos now** button is
   optional and lists photos without a clear face.
4. On the counter laptop or phone, open `/kiosk` (for example http://localhost:3000/kiosk), type the PIN and allow the camera.
   Students press **Take photo**, or switch to **ID card scan** and hold up their card. One snack per student per day.

The camera only works on `localhost` or an `https://` site, so a phone can use the kiosk after you deploy.

## 6. Turn on the AI summary (v4 and later, optional)
The **AI** page writes a short summary of students' comments using the Claude API. Everything else works without it.

1. Go to https://console.anthropic.com, sign in, add a little credit under **Billing**, then **API Keys > Create Key** and copy it.
2. Open `.env.local` in VS Code and add a line at the end (no spaces, no quotes):

   ```
   ANTHROPIC_API_KEY=sk-ant-...your key...
   ```

3. Stop the app (**Ctrl+C**) and start it again with `npm run dev`. Env changes only load on start.

Each summary is one short API call (a few cents at most). The key stays on your laptop's server side and never reaches students' browsers.

Once everything works you can delete `messmate-old`.

## Doing it with Claude Code instead
Open the **new** folder in VS Code, run `claude` in the terminal, and say:
"Copy .env.local from ../messmate-old, run npm install, and start the dev server."
Claude Code can't reach your Supabase dashboard, so paste the SQL files there yourself.
