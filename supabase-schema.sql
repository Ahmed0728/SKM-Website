-- SKM — Say Know More: full database schema.
-- Paste this whole file into the Supabase SQL editor and run it.
-- Safe to re-run — uses "if not exists" / "or replace" throughout.

-- ============================================================
-- Applications (the public "Apply" form)
-- ============================================================

create table if not exists members (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text,
  company text,
  referral text,
  message text,
  status text not null default 'new', -- new | contacted | approved | declined
  notes text,
  created_at timestamptz not null default now()
);
alter table members add column if not exists company text;

alter table members enable row level security;

drop policy if exists "public can apply" on members;
create policy "public can apply" on members for insert to anon with check (true);

-- ============================================================
-- Profiles (real member accounts, created automatically on signup)
-- ============================================================

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text,
  company text,
  tags text[] not null default '{}',
  bio text,
  approved boolean not null default false,
  directory_visible boolean not null default true,
  is_admin boolean not null default false,
  onboarded boolean not null default false,
  created_at timestamptz not null default now()
);
alter table profiles add column if not exists onboarded boolean not null default false;

alter table profiles enable row level security;

-- Helper functions (security definer so they can check profiles without
-- recursing into the RLS policies that call them).
create or replace function is_admin() returns boolean as $$
  select coalesce((select is_admin from profiles where id = auth.uid()), false);
$$ language sql security definer stable;

create or replace function is_approved_member() returns boolean as $$
  select coalesce((select approved from profiles where id = auth.uid()), false);
$$ language sql security definer stable;

-- Now that the helpers exist, lock down the applications table properly:
drop policy if exists "authenticated can read" on members;
drop policy if exists "authenticated can update" on members;
drop policy if exists "admin can read applications" on members;
drop policy if exists "admin can update applications" on members;
create policy "admin can read applications" on members for select to authenticated using (is_admin());
create policy "admin can update applications" on members for update to authenticated using (is_admin());

drop policy if exists "profiles read" on profiles;
create policy "profiles read" on profiles for select to authenticated
  using (
    auth.uid() = id
    or is_admin()
    or (approved = true and directory_visible = true and is_approved_member())
  );

drop policy if exists "profiles update" on profiles;
create policy "profiles update" on profiles for update to authenticated
  using (auth.uid() = id or is_admin())
  with check (auth.uid() = id or is_admin());

-- Stop a member from self-elevating approved/is_admin on their own row.
create or replace function prevent_privilege_escalation() returns trigger as $$
begin
  if not is_admin() then
    new.is_admin := old.is_admin;
    new.approved := old.approved;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists profiles_guard on profiles;
create trigger profiles_guard before update on profiles
  for each row execute function prevent_privilege_escalation();

-- Auto-create a profile whenever someone signs up (magic link or password).
-- Auto-approves them if their email matches an approved application.
create or replace function handle_new_user() returns trigger as $$
declare
  matched record;
begin
  select * into matched from members
    where lower(email) = lower(new.email) and status = 'approved'
    order by created_at desc limit 1;

  insert into profiles (id, email, name, company, approved)
  values (
    new.id,
    new.email,
    coalesce(matched.name, split_part(new.email, '@', 1)),
    matched.company,
    matched is not null
  )
  on conflict (id) do nothing;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================================
-- Events (admin-posted, visible to approved members)
-- ============================================================

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  location text,
  starts_at timestamptz,
  image_url text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

alter table events enable row level security;

drop policy if exists "events read" on events;
create policy "events read" on events for select to authenticated
  using (is_approved_member() or is_admin());

drop policy if exists "events write" on events;
create policy "events write" on events for insert to authenticated with check (is_admin());

drop policy if exists "events modify" on events;
create policy "events modify" on events for update to authenticated using (is_admin());

drop policy if exists "events delete" on events;
create policy "events delete" on events for delete to authenticated using (is_admin());

-- ============================================================
-- Connections (admin-curated matches between members)
-- ============================================================

create table if not exists connections (
  id uuid primary key default gen_random_uuid(),
  member_a uuid not null references profiles(id) on delete cascade,
  member_b uuid not null references profiles(id) on delete cascade,
  note text,
  status text not null default 'connected',
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

alter table connections enable row level security;

drop policy if exists "connections admin all" on connections;
create policy "connections admin all" on connections for all to authenticated
  using (is_admin()) with check (is_admin());

drop policy if exists "connections self read" on connections;
create policy "connections self read" on connections for select to authenticated
  using (member_a = auth.uid() or member_b = auth.uid());

-- ============================================================
-- One-time: after you sign in to /admin.html the first time, run this
-- (with your real email) to mark yourself as the admin:
--
-- update profiles set is_admin = true, approved = true
--   where email = 'you@example.com';
-- ============================================================
