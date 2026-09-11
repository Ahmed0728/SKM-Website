# SKM — Say Know More

Static site (no build step, plain HTML/CSS/JS) backed by
[Supabase](https://supabase.com) (free tier). Three parts:

- **Public site** (`index.html`) — About + membership application form
- **Member portal** (`member.html`) — email/password login → approval →
  $35/month payment → profile setup → events, member directory, merch
  preview
- **Admin panel** (`admin.html`) — review applications, manage the member
  roster (including payment status), post events, approve suggested
  matches, import an existing contact list

## 1. Set up the database

1. Create a free account/project at https://supabase.com.
2. Open the **SQL editor**, paste in the entire contents of
   [`supabase-schema.sql`](supabase-schema.sql), and run it. It's safe to
   re-run if you need to.
3. Go to **Project Settings → API** and copy the **Project URL** and
   **anon public** key into [`js/supabase-config.js`](js/supabase-config.js).

The anon key is meant to be public client-side — the RLS policies in the
schema are what actually control who can see/change what.

## 2. Create your admin account

1. Go to **Authentication → Users** in Supabase and manually add yourself
   (email + password).
2. Back in the **SQL editor**, run (with your real email):
   ```sql
   update profiles set is_admin = true, approved = true
     where email = 'you@example.com';
   ```
   (This works because the schema auto-creates a `profiles` row the moment
   any auth user is created.)
3. Under **Authentication → Settings**, "Confirm email" should be off —
   that's what lets a new member get instant access after creating an
   account, instead of waiting on a confirmation email.
4. Sign in at `/admin.html` with that email + password.

## 3. How membership approval works

- Someone applies via the public form → lands in the **Applications** tab
  in admin, status `new`.
- You review it and set status to `approved` (or `declined`/`contacted`).
- That person visits `/member.html` and creates an account (email +
  password — first visit only, then it's a normal login). The database
  automatically matches their email against approved applications and
  unlocks the next step. If there's no match yet, they see a "pending
  approval" screen — you can also manually flag someone approved in the
  admin **Members** tab.
- **Bulk-importing an existing list**: use the CSV importer in the admin
  **Applications** tab (columns: `name`, `email`, `company` — header row
  required). Imported rows land as pre-approved applications, so those
  people get instant portal access the first time they sign in (still
  gated by payment — see below).

## 3b. Payment — $35/month membership

Approved members hit a payment screen before they can set up their
profile or access the portal. This is built and wired in
(`STRIPE_PAYMENT_LINK` in [`js/supabase-config.js`](js/supabase-config.js)),
but currently pointed at a **test-mode** Stripe Payment Link — it works
end-to-end with Stripe's test cards but can't take a real charge yet,
because the Stripe account (Say Know More Group) hasn't completed
business verification.

**To go live:**
1. In the Stripe Dashboard, click **Verify your business** (top right) and
   complete it — legal business info + a bank account for payouts. Only
   you can do this step, it's your business/banking info.
2. Once verified, switch off "Sandbox" mode (top left) and repeat the
   payment link setup in **live** mode: Payment links → Create payment
   link → Product "SKM Membership", $35.00, Monthly recurring.
3. Copy that live link (`https://buy.stripe.com/xxxxx`, no `test_` in it)
   into `STRIPE_PAYMENT_LINK`, replacing the test one.

The member's email is pre-filled on the Stripe checkout page
automatically either way.

**How confirmation works right now:** this is a static site with no
backend server, so payment confirmation is manual — Stripe's dashboard
shows you every payment in real time, and you check the **Paid** box for
that person in the admin **Members** tab. The member sees an "Already
paid? Check again" button on their end that re-checks their status.

**Fast-follow, once this is live and working:** fully automatic
confirmation needs a small serverless function that listens for Stripe's
`checkout.session.completed` webhook and flips `payment_status` itself —
a Supabase Edge Function is the natural place for it. Worth doing once
you've had a few real members go through the manual flow and confirmed
it's what you want.

## 4. Matches / connections

Every approved member has to complete a short onboarding form the first
time they sign in (name, company/occupation, bio, tags) before they can
access the rest of the portal — that's what feeds the matcher.

The admin **Matches** tab scores every pair of members by weighted overlap
across their tags, bio, and company text (exact tag matches count more
than incidental shared keywords) and surfaces the strongest pairs as
suggestions, with the specific overlap shown so you can judge each one.
Nothing is visible to members until you click **Connect** — at that point
it shows up for both members under "Your connections" in the portal.

This is a heuristic (`matchScore` in `js/admin.js`), not a live AI model —
it's instant, free, and needs zero extra infrastructure. A genuine
LLM/embedding-based matcher is a clean future upgrade: add a `pgvector`
column to `profiles`, a Supabase Edge Function that calls an embeddings
API (e.g. OpenAI) whenever a profile is saved, and rank matches by cosine
similarity instead of keyword overlap. That needs an API key and a
deployed Edge Function, so it's worth doing once the core system's been
live and tested for a bit.

## 5. Fill in remaining content

- Add real events in the admin **Events** tab once you have some.
- Merch: `assets/merch/` holds preview images members can browse/search in
  the portal — swap in real product shots whenever ready.

## 6. Run it locally

No build tools needed — just open `index.html` in a browser, or serve the
folder (e.g. `ruby -run -e httpd . -p 8000` if you don't have Python/Node
set up — see below) and visit `http://localhost:8000`.

## 7. Deploying updates

This site is live at **https://ahmed0728.github.io/SKM-Website/**, source
at **https://github.com/Ahmed0728/SKM-Website**. This machine doesn't have
git installed (no Xcode Command Line Tools), so updates so far have gone
through either GitHub's web uploader or the GitHub API directly with a
short-lived, narrowly-scoped personal access token. Once git is available,
this folder can be pushed the normal way:

```bash
git init
git add .
git commit -m "Update"
git branch -M main
git remote add origin https://github.com/Ahmed0728/SKM-Website.git
git push -u origin main
```
