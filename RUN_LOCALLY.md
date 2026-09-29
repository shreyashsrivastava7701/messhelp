# Running Chachu ka Mittar on your laptop

## 0. Install once
- **Node.js 20 or newer** (LTS) from https://nodejs.org. Check with `node -v`.
- **VS Code** from https://code.visualstudio.com. Recommended extensions: *ESLint* and *Tailwind CSS IntelliSense*.
- **Git** (optional, the zip already has the project's git history).

## 1. Unzip and open
Unzip `messmate.zip`, then in VS Code use **File > Open Folder…** and pick the `messmate` folder.
Open a terminal inside VS Code with **Terminal > New Terminal** (or Ctrl+`).

## 2. Set up Supabase (about 5 minutes, once)
1. Create a free project at https://supabase.com.
2. Dashboard > **SQL Editor** > New query. Paste all of `supabase/migrations/20260929000000_init.sql` and click **Run**.
   Then do the same, one file at a time, with `supabase/seed.sql`, `supabase/migrations/20260929020000_step2.sql`,
   `supabase/migrations/20260929030000_student_photos.sql`, `supabase/migrations/20260929040000_steps3_5.sql`, `supabase/migrations/20260929050000_kiosk.sql`, `supabase/migrations/20260929060000_kiosk_auto_faces.sql`,
   `supabase/seed_students.sql` and `supabase/seed_weekly_menu.sql`.
3. **Authentication > Sign In / Providers > Email**: turn off **Confirm email** so you can sign in straight away.
4. **Project Settings > API**: keep this tab open for the next step.

## 3. Add your keys
In the VS Code terminal:

```bash
cp .env.example .env.local        # Windows PowerShell: copy .env.example .env.local
```

Open `.env.local` and paste your **Project URL** and **anon / publishable key**. This file is git-ignored; don't share it.
Optional: add `ANTHROPIC_API_KEY=` with a key from console.anthropic.com to use the AI summary page.

## 4. Run
```bash
npm install
npm run dev
```
Open http://localhost:3000, click **Create an account**, and sign up.

## 5. Make yourself admin
Back in the Supabase SQL Editor (use the email you signed up with):

```sql
update public.profiles set role = 'admin'
where id = (select id from auth.users where email = 'you@example.com');
```

Refresh the app. An **Edit menu** link now appears in the header.

## Working with Claude Code
1. Install it (needs Node 18+): `npm install -g @anthropic-ai/claude-code`
   Or install the **Claude Code** extension from the VS Code marketplace, which adds a Claude panel to VS Code.
2. In the VS Code terminal, inside the `messmate` folder, run `claude` and sign in with your Claude account the first time.
3. Claude Code reads `CLAUDE.md` automatically, so it already knows the stack, the commands and the build order.
   Try asking:
   - `Run the app and check the menu page loads`
   - `Build step 2: the 2-tap rating flow with stars and tags`
4. Keep `npm run dev` running in a second terminal tab so you can watch changes live in the browser.

## If something goes wrong
- **"Invalid API key" or a blank page after login:** re-check `.env.local`, then stop the server (Ctrl+C) and run `npm run dev` again. Env changes need a restart.
- **"relation public.meals does not exist":** the SQL from step 2 wasn't run in this Supabase project.
- **Sign up says "check your email":** email confirmation is still on (step 2.3).
- **No Edit menu link:** your role is still `student`; run the SQL in step 5, then refresh.
- **Port 3000 is busy:** `npm run dev -- -p 3001`.
