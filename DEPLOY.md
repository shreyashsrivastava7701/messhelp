# Putting Chachu ka Mittar online (GitHub + Vercel)

**Status: done.** The code is in the GitHub repo `shreyashsrivastava7701/messhelp`, the Vercel project is
`chachu_ka_mittar`, and the site is live at https://chachukamittar.vercel.app. Keep this guide for reference or
for setting it up again.

Order matters: first put the code on **GitHub**, then **Vercel** builds the website from GitHub.
After that, every change you push to GitHub goes live by itself in about a minute.

Your keys file (`.env.local`) is never uploaded. The `.gitignore` file already keeps it out.

---

## Part 1: Put the code on GitHub (about 5 minutes)

1. Open your `messhelp` folder in VS Code.
2. Click the **Source Control** icon in the left bar (the icon with three dots joined by lines), or press **Ctrl+Shift+G**.
3. Click **Publish to GitHub**.
   - If a box asks you to install **Git** or the **Command Line Tools**, click **Install**, wait for it to finish, then click **Publish to GitHub** again.
   - If it asks to sign in to GitHub, click **Allow** and sign in as `shreyashsrivastava7701` in the browser that opens, then return to VS Code.
4. VS Code asks for a name and visibility. Pick **Publish to GitHub private repository**, and type a name (ours is `messhelp`).
5. If it asks which files to include, keep everything ticked and press **OK**. (`node_modules`, `.next` and `.env.local` are skipped automatically.)
6. Wait for "Successfully published". Open https://github.com/shreyashsrivastava7701/messhelp to check the files are there.
   You should see `src`, `supabase`, `package.json` and so on, and **no** `.env.local`.

## Part 2: Make the website on Vercel (about 5 minutes)

1. Go to https://vercel.com and click **Sign Up**. Choose **Hobby** (free), then **Continue with GitHub**.
2. Click **Add New… > Project**. If you don't see `messhelp`, click **Adjust GitHub App Permissions**, allow access to the `messhelp` repository, and come back.
3. Next to `messhelp`, click **Import**.
4. **Project Name:** ours is `chachu_ka_mittar`. The address is set under **Settings > Domains**
   (ours is `chachukamittar.vercel.app`). Leave Framework as **Next.js**, leave **Root Directory** as `./`,
   and don't change the build settings.
5. Open **Environment Variables** and add these two. Copy the values from your `.env.local` in VS Code:

   | Key | Value |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | your Supabase Project URL (starts with `https://`) |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | your anon / publishable key |

   Paste each name exactly, with no spaces and no quotes around the value.
6. Click **Deploy** and wait for the confetti, which takes about 1 to 2 minutes. Then click **Continue to Dashboard** and note your address (the **Domains** line).

If the import page just shows the project with no deployment, open the project > **Deployments** >
**Create Deployment**, type `main` and click **Create Deployment**. If it lands as a **Preview**, open its **⋯**
menu and choose **Promote to Production**.

If the build fails, click the failed deployment, copy the last red lines, and send them to Claude.

## Part 3: Tell Supabase about the new address (2 minutes)

In the Supabase dashboard for your project:

1. **Authentication > URL Configuration**
   - **Site URL:** `https://chachukamittar.vercel.app` (your real address)
   - **Redirect URLs > Add URL:** `https://chachukamittar.vercel.app/auth/callback`
   - Keep `http://localhost:3000/auth/callback` too, so your laptop still works.
   - Click **Save**.
2. Optional: under **Authentication > Sign In / Providers > Email**, turn **Confirm email** back on if you want students to confirm their email. Leave it off while testing.

## Part 4: Check it works

1. Open your Vercel address on your phone and sign in on the **Mess committee** tab.
2. Open **Kiosk** and check the PIN is set.
3. Tap **Snack counter** on the sign-in page, enter the PIN and allow the camera. The camera now works on phones because the site is `https://`.
4. Send the address to a few students and ask them to sign up on the **Student** tab.

Your data is the same as on your laptop, because both use the same Supabase project.

---

## Updating the website later

Once it's on GitHub, you don't swap folders any more (full steps in [UPDATING.md](UPDATING.md)):

1. Change files in VS Code (or put in files Claude sends you).
2. Open **Source Control**, type a short message such as "Fix menu text" in the box, and click **Commit**.
   If it asks to stage all changes, click **Yes**.
3. Click **Sync Changes** (or **Push**).
4. Vercel sees the push and rebuilds the site by itself. Check the **Deployments** tab on vercel.com.

New SQL files still have to be run once in the Supabase SQL Editor, as before.

**Tip:** once the repo exists, add it to this project in Claude (Project settings > Repositories). Then Claude can send
changes straight to GitHub as pull requests you approve with one click, instead of files.
