# SKM — Say Know More

Minimal static site: landing/about + membership application form + a
password-protected admin dashboard to review applicants. No build step —
plain HTML/CSS/JS, backed by [Supabase](https://supabase.com) (free tier)
for storage and admin auth.

## 1. Set up the backend (Supabase — free)

1. Create a free account at https://supabase.com and a new project.
2. In the SQL editor, run:

```sql
create table members (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text,
  referral text,
  message text,
  status text not null default 'new',
  notes text,
  created_at timestamptz not null default now()
);

alter table members enable row level security;

-- Anyone can submit an application (insert only, no read access).
create policy "public can apply"
  on members for insert
  to anon
  with check (true);

-- Only signed-in (admin) users can view or edit applications.
create policy "authenticated can read"
  on members for select
  to authenticated
  using (true);

create policy "authenticated can update"
  on members for update
  to authenticated
  using (true);
```

3. Go to **Authentication > Users** and manually add yourself (email +
   password) as the one admin account. Turn off public sign-ups under
   **Authentication > Settings** so no one else can create an account.
4. Go to **Project Settings > API** and copy the **Project URL** and
   **anon public key**.
5. Paste both into [`js/supabase-config.js`](js/supabase-config.js).

The anon key is meant to be public — the RLS policies above are what
actually control access (insert-only for the public, read/write only for
your signed-in admin account).

## 2. Fill in the real content

- Edit the About paragraph in [`index.html`](index.html) (marked with a
  `TODO` comment) with the real description of what SKM is.
- Swap in additional/alternate logo exports in `assets/` if you have them
  (the current one was pulled from `SKM_Logo.ai`).

## 3. Run it locally

No build tools needed — just open `index.html` in a browser, or serve the
folder:

```bash
python3 -m http.server 8000
```

then visit `http://localhost:8000`.

## 4. Put it on GitHub + go live

This machine doesn't currently have git/Xcode Command Line Tools
installed, so the easiest path is GitHub's web uploader (no git needed):

1. Go to https://github.com/new, create a repo (e.g. `skm-website`).
2. On the new repo page, click **uploading an existing file** and drag in
   everything from this folder.
3. Commit to `main`.
4. Go to **Settings > Pages**, set **Source** to `main` / `/(root)`, save.
   GitHub gives you a live URL at `https://<username>.github.io/skm-website/`.

If you later install git (`xcode-select --install`, or Homebrew), this
folder is a normal git repo waiting to happen:

```bash
git init
git add .
git commit -m "Initial SKM site"
git branch -M main
git remote add origin https://github.com/<username>/skm-website.git
git push -u origin main
```

## Admin dashboard

Visit `/admin.html`, sign in with the one admin account you created in
step 1.3. From there you can see every applicant, change their status
(new / contacted / approved / declined), and leave notes — that's the
"connect them on the back end" piece.

## Later: Merch tab

Not built yet. When you're ready, add a `#merch` section to `index.html`
+ a nav link, same pattern as `#about`/`#apply`.
