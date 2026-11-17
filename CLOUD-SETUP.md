# FlowTrack — Supabase Cloud Setup

## Files and hosting
- `index.html` is the GitHub Pages entry point.
- Runtime Supabase configuration is loaded from `assets/js/cloud-config.js`.
- The root `cloud-config.js` is kept as a matching reference copy; editing it alone does not change the running app.
- Upload the complete project contents (including the entire `assets/` folder) to the repository root.

## Supabase configuration
1. In Supabase SQL Editor, run `supabase-setup.sql` once.
2. In Authentication → Sign In / Providers, enable Email.
3. In Authentication → URL Configuration:
   - Site URL: `https://iamjohnyogesh-bit.github.io/Workflow-Tracker/`
   - Redirect URL: `https://iamjohnyogesh-bit.github.io/Workflow-Tracker/**`
4. In `assets/js/cloud-config.js`, set the Supabase project URL and publishable key.
   - A publishable key (`sb_publishable_...`) or legacy anon key is suitable for browser use.
   - Never put a secret/service-role key in this repository.

## GitHub Pages
- Repository → Settings → Pages
- Source: Deploy from a branch
- Branch: `main`
- Folder: `/ (root)`
- Save, then wait for the Pages deployment to finish.

## Account and sync behavior
- When cloud configuration is valid, the login screen asks for Email address and Password.
- Create an account using email/password. If email confirmation is enabled, confirm the email before signing in.
- Each signed-in account has one row in `public.workspaces`; RLS restricts access to the authenticated user's own row.
- Task/workspace changes are saved locally first and queued for cloud sync. Look for `Cloud: saved ✓` before switching devices.
- Sign in on another device with the same email/password to load the cloud workspace.
- Existing local-only accounts are not automatically converted. Export a JSON backup from the old local workspace and import it after signing in to the cloud account.
- Simultaneous editing on multiple devices is last-write-wins. Avoid editing the same account on two devices at once.

## Troubleshooting
If the login form still says **User name** instead of **Email address**, the deployed page is not loading the configured `assets/js/cloud-config.js`. Confirm that exact file in GitHub contains the real project URL and publishable key, commit it, then hard-refresh the Pages site (`Ctrl+Shift+R`). Also check DevTools Console/Network for a failed script request.
