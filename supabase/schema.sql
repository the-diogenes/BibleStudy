-- Bible Study Site - Supabase schema
-- Run in the Supabase SQL Editor. Safe to re-run (idempotent).
--
-- Security model:
--   * Real accounts via Supabase Auth (magic links).
--   * Group is gated by an invite allowlist (member_invites).
--   * A profile row = membership. Only invited emails can create a profile.
--   * All app tables are protected by Row-Level Security tied to auth.uid().

-- ───────────────────────── Helper functions ─────────────────────────
-- SECURITY DEFINER so they can read profiles/invites without tripping the
-- policies that reference them (avoids RLS recursion).

create table if not exists public.member_invites (
  email      text primary key,
  role       text not null default 'member',
  invited_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  role         text not null default 'member',
  created_at   timestamptz not null default now()
);

create or replace function public.is_member()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid());
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.is_invited()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.member_invites
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- ───────────────────────── Curriculum ─────────────────────────
create table if not exists public.studies (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text,
  position    int not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists public.lessons (
  id          uuid primary key default gen_random_uuid(),
  study_id    uuid not null references public.studies (id) on delete cascade,
  title       text not null,
  book        text not null,
  chapter     int not null,
  verse_start int,
  verse_end   int,
  status      text not null default 'upcoming',  -- upcoming | active | done
  link        text,
  notes       text,
  position    int not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists lessons_study_idx on public.lessons (study_id, position);

create table if not exists public.lesson_progress (
  lesson_id  uuid not null references public.lessons (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  completed  boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (lesson_id, user_id)
);

-- ───────────────────────── Discussion ─────────────────────────
create table if not exists public.threads (
  id          uuid primary key default gen_random_uuid(),
  ref         text not null,                 -- canonical key e.g. "JHN.1.1-18"
  book        text not null,
  chapter     int not null,
  verse_start int,
  verse_end   int,
  title       text,
  created_by  uuid not null references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (ref)
);
create index if not exists threads_ref_idx on public.threads (ref);
create index if not exists threads_created_idx on public.threads (created_at desc);

create table if not exists public.posts (
  id         uuid primary key default gen_random_uuid(),
  thread_id  uuid not null references public.threads (id) on delete cascade,
  parent_id  uuid references public.posts (id) on delete cascade,
  author     uuid not null references auth.users (id) on delete cascade,
  body       text not null,
  created_at timestamptz not null default now()
);
create index if not exists posts_thread_idx on public.posts (thread_id, created_at);

-- ───────────────────────── Notes ─────────────────────────
create table if not exists public.notes (
  id          uuid primary key default gen_random_uuid(),
  ref         text not null,
  book        text not null,
  chapter     int not null,
  verse_start int,
  verse_end   int,
  body        text not null,
  visibility  text not null default 'private',  -- private | group
  author      uuid not null references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists notes_ref_idx on public.notes (ref);
create index if not exists notes_author_idx on public.notes (author);

-- ───────────────────────── Reactions ─────────────────────────
create table if not exists public.post_reactions (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  emoji   text not null default '🙏',
  created_at timestamptz not null default now(),
  primary key (post_id, user_id, emoji)
);
create index if not exists post_reactions_post_idx on public.post_reactions (post_id);

-- ───────────────────────── Row-Level Security ─────────────────────────
alter table public.member_invites  enable row level security;
alter table public.post_reactions  enable row level security;
alter table public.profiles        enable row level security;
alter table public.studies         enable row level security;
alter table public.lessons         enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.threads         enable row level security;
alter table public.posts           enable row level security;
alter table public.notes           enable row level security;

-- member_invites: admins manage; a user may check their own invite (for onboarding).
drop policy if exists invites_admin on public.member_invites;
create policy invites_admin on public.member_invites
  for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists invites_self_read on public.member_invites;
create policy invites_self_read on public.member_invites
  for select using (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

-- profiles: members see each other; you create/update only your own (admins any).
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (public.is_member());
drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles
  for insert with check (id = auth.uid() and public.is_invited());
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- studies / lessons: members read; admins write.
drop policy if exists studies_read on public.studies;
create policy studies_read on public.studies for select using (public.is_member());
drop policy if exists studies_write on public.studies;
create policy studies_write on public.studies
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists lessons_read on public.lessons;
create policy lessons_read on public.lessons for select using (public.is_member());
drop policy if exists lessons_write on public.lessons;
create policy lessons_write on public.lessons
  for all using (public.is_admin()) with check (public.is_admin());

-- lesson_progress: each member manages their own.
drop policy if exists progress_own on public.lesson_progress;
create policy progress_own on public.lesson_progress
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- threads: members read; members create (as themselves); owner/admin edit.
drop policy if exists threads_read on public.threads;
create policy threads_read on public.threads for select using (public.is_member());
drop policy if exists threads_insert on public.threads;
create policy threads_insert on public.threads
  for insert with check (public.is_member() and created_by = auth.uid());
drop policy if exists threads_modify on public.threads;
create policy threads_modify on public.threads
  for update using (created_by = auth.uid() or public.is_admin())
  with check (created_by = auth.uid() or public.is_admin());
drop policy if exists threads_delete on public.threads;
create policy threads_delete on public.threads
  for delete using (created_by = auth.uid() or public.is_admin());

-- posts: members read; author writes own; owner/admin edit/delete.
drop policy if exists posts_read on public.posts;
create policy posts_read on public.posts for select using (public.is_member());
drop policy if exists posts_insert on public.posts;
create policy posts_insert on public.posts
  for insert with check (public.is_member() and author = auth.uid());
drop policy if exists posts_modify on public.posts;
create policy posts_modify on public.posts
  for update using (author = auth.uid() or public.is_admin())
  with check (author = auth.uid() or public.is_admin());
drop policy if exists posts_delete on public.posts;
create policy posts_delete on public.posts
  for delete using (author = auth.uid() or public.is_admin());

-- notes: read group notes or your own private ones; author writes; owner/admin edit.
drop policy if exists notes_read on public.notes;
create policy notes_read on public.notes
  for select using (public.is_member() and (visibility = 'group' or author = auth.uid()));
drop policy if exists notes_insert on public.notes;
create policy notes_insert on public.notes
  for insert with check (public.is_member() and author = auth.uid());
drop policy if exists notes_modify on public.notes;
create policy notes_modify on public.notes
  for update using (author = auth.uid() or public.is_admin())
  with check (author = auth.uid() or public.is_admin());
drop policy if exists notes_delete on public.notes;
create policy notes_delete on public.notes
  for delete using (author = auth.uid() or public.is_admin());

-- post_reactions: members read; each member toggles their own reactions.
drop policy if exists reactions_read on public.post_reactions;
create policy reactions_read on public.post_reactions for select using (public.is_member());
drop policy if exists reactions_own on public.post_reactions;
create policy reactions_own on public.post_reactions
  for all using (user_id = auth.uid()) with check (public.is_member() and user_id = auth.uid());

-- ───────────────────────── Realtime ─────────────────────────
do $$ begin alter publication supabase_realtime add table public.post_reactions; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.posts; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.notes; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.lessons; exception when duplicate_object then null; end $$;

-- ───────────────────────── Bootstrap the first admin ─────────────────────────
-- 1) Add yourself to the allowlist (use the email you'll sign in with):
--      insert into public.member_invites (email, role) values ('you@example.com', 'admin')
--      on conflict (email) do update set role = 'admin';
-- 2) Sign in once in the app (creates your profile), then promote yourself:
--      update public.profiles set role = 'admin'
--      where id = (select id from auth.users where email = 'you@example.com');
