# Running Chachu ka Mittar on your laptop (Mac)

## 0. Install once
- **Node.js 20 or newer** (LTS) from https://nodejs.org. Check with `node -v`.
- **VS Code** from https://code.visualstudio.com. Recommended extensions: *ESLint* and *Tailwind CSS IntelliSense*.
- **Git** comes with the Mac's Command Line Tools. VS Code offers to install them the first time you use Source Control.

## 1. Get the code and open it
Either:
- **From GitHub:** in VS Code press **Cmd+Shift+P**, choose **Git: Clone**, paste the repository link, and pick a folder; or
- **From a zip:** unzip it, then in VS Code use **File > Open Folder…** and pick the `messhelp` folder.

Open a terminal inside VS Code with **Terminal > New Terminal**.

## 2. Set up Supabase (about 5 minutes, once)
Skip this if you already have your Supabase project.

1. Create a free project at https://supabase.com.
2. Dashboard > **SQL Editor** > **New query**. Paste each of these files and click **Run**, one at a time, in this order:
   1. `supabase/migrations/20260929000000_init.sql`
   2. `supabase/migrations/20260929020000_step2.sql`
   3. `supabase/migrations/20260929030000_student_photos.sql`
   4. `supabase/migrations/20260929040000_steps3_5.sql`
   5. `supabase/migrations/20260929050000_kiosk.sql`
   6. `supabase/migrations/20260929060000_kiosk_auto_faces.sql`

   Optional dummy data: `supabase/seed_weekly_menu.sql` and `supabase/seed_students.sql`. Run seed files only once.
3. **Authentication > Sign In / Providers > Email**: turn off **Confirm email** so you can sign in straight away.
4. **Project Settings > API**: keep this tab open for the next step.

## 3. Add your keys
In the VS Code terminal:

```bash
cp .env.example .env.local
```

Open `.env.local` and paste your **Project URL** and **anon / publishable key**. This file is git-ignored and never
uploaded to GitHub; don't share it.

## 4. Run
Type these one at a time, pressing Enter after each and waiting for the first to finish:

```bash
npm install
```
```bash
npm run dev
```

Open http://localhost:3000. On a new Supabase project, click **Create an account** on the **Student** tab and sign up.

## 5. Make yourself admin (new Supabase project only)
In the Supabase SQL Editor (use the email you signed up with):

```sql
update public.profiles set role = 'admin'
where id = (select id from auth.users where email = 'you@example.com');
```

Then sign in on the **Mess committee** tab.

## Working with Claude Code
1. Install the **Claude Code** extension from the VS Code marketplace, or in the terminal:
   `npm install -g @anthropic-ai/claude-code`
2. In the VS Code terminal, inside the `messmate` folder, run `claude` and sign in the first time.
3. Claude Code reads `CLAUDE.md` automatically, so it already knows the stack, the commands and the conventions.
   Try asking, for example: `Add a "Jain food" option to the menu editor`.
4. Keep `npm run dev` running in a second terminal tab so you can watch changes live in the browser.

## If something goes wrong
- **`npm error EBADPLATFORM` or odd package errors:** you typed `npm install` and `npm run dev` on one line. Run them separately.
- **`ENOENT ... package.json`:** you're not inside the `messmate` folder. Run `cd messmate` (or the folder's full path) first.
- **"fetch failed" in the terminal, or a blank page after login:** `.env.local` has the wrong or old Supabase keys, or your
  Supabase project is paused (open it in the dashboard and click **Restore**). After fixing `.env.local`, stop the server
  (**Ctrl+C**) and run `npm run dev` again.
- **"relation ... does not exist":** a SQL file from step 2 wasn't run in this Supabase project.
- **Sign up says "check your email":** email confirmation is still on (step 2.3).
- **Mess committee tab says your account isn't committee:** run the SQL in step 5, then sign in again.
- **A red "hydration" error mentioning `data-gr-...`:** that's the Grammarly browser extension. It's harmless; reload the page.
- **Port 3000 is busy:** `npm run dev -- -p 3001`.
