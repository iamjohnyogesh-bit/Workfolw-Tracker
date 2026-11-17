# FlowTrack cloud setup (GitHub Pages + Supabase)

This project supports two modes:
- **Cloud mode** when `assets/js/cloud-config.js` contains your valid Supabase project URL and **publishable/anon** key.
- **Local mode** when those values are left as placeholders (existing local username/password and optional folder backup).

## Setup
1. Create a Supabase project at https://supabase.com/dashboard.
2. In **SQL Editor**, execute `supabase-setup.sql` to create a per-user workspace table with Row Level Security (RLS).
3. In **Authentication > Providers**, enable Email authentication. Email confirmation is recommended. Configure the site's URL and redirect URLs under Authentication > URL Configuration.
4. In **Project Settings / API Keys**, copy the project URL and **publishable (or legacy anon)** key into `assets/js/cloud-config.js`. **Never** use the secret/service_role key in a browser or GitHub repository.
5. Rename `index(2).html` to `index.html` (or use the included `index.html`), commit the project contents to a GitHub repository, and enable **Settings > Pages > Deploy from a branch** (main, root).
6. Visit your GitHub Pages URL, create an account with an **email address** and password (at least 8 characters), verify email if enabled, and sign in. Sign in on a second device using the same credentials to load your saved workspace.

## Behavior / important limitations
- Cloud mode uses **email/password**, not username/password. Email uniquely identifies a user. Authentication is handled by Supabase Auth; password hashes are never stored in the app's database or source code.
- Each user can access only their own workspace via RLS. Do not remove or weaken the policies.
- Each save updates the user's JSON workspace. Sync is debounced; a small 'Cloud: saved' status appears at bottom right. If offline or a save fails, the local browser copy remains. Use the **Retry sync** button to retry failed uploads.
- On login, the latest cloud copy replaces the local cache for that account. Multiple simultaneous devices use **last write wins**, so editing concurrently can overwrite another device's changes. Wait for the 'Cloud: saved' status before switching devices and reload the other device before editing.
- Existing **local-only accounts are not automatically migrated**. Sign up with an email in cloud mode and import an exported JSON backup through Settings if you need the old workspace.
- Supabase free-tier availability and limits are subject to Supabase's terms.
- Do not commit personal data backups or secret keys to GitHub. Public GitHub Pages is not a backend.
