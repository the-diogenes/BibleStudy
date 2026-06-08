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

-- When a member first creates their profile, inherit their role (member/admin)
-- from the invite allowlist so admin bootstrap is a single step.
create or replace function public.set_role_from_invite()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  select role into new.role from public.member_invites
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')) limit 1;
  if new.role is null then new.role := 'member'; end if;
  return new;
end $$;

drop trigger if exists profiles_set_role on public.profiles;
create trigger profiles_set_role before insert on public.profiles
  for each row execute function public.set_role_from_invite();

-- Onboarding: the signed-in user calls this once to create their membership row.
-- SECURITY DEFINER so it can create the profile after verifying the invite,
-- without depending on INSERT row-level-security timing. Returns the profile.
create or replace function public.ensure_profile(p_display_name text default null)
returns setof public.profiles
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  inv_role text;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  if exists (select 1 from public.profiles where id = uid) then
    return query select * from public.profiles where id = uid;
    return;
  end if;

  if not public.is_invited() then
    raise exception 'not invited' using errcode = '42501';
  end if;

  select role into inv_role from public.member_invites
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')) limit 1;

  return query
  insert into public.profiles (id, display_name, role)
  values (
    uid,
    coalesce(nullif(p_display_name, ''), split_part(coalesce(auth.jwt() ->> 'email', ''), '@', 1)),
    coalesce(inv_role, 'member')
  )
  returning *;
end $$;

grant execute on function public.ensure_profile(text) to authenticated;

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
  for insert with check (id = auth.uid());
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

-- ═══════════════════════════════════════════════════════════════════════════
--  Feature pack: usernames, role protection, admin password reset, meetings,
--  RSVPs, verse highlights, and the contact/feedback inbox.
--  Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto with schema extensions;

-- Store the username on the profile (for the admin roster + display).
alter table public.profiles add column if not exists username text;

-- Backfill usernames from the auth email local-part where missing.
update public.profiles p
set username = split_part(u.email, '@', 1)
from auth.users u
where u.id = p.id and (p.username is null or p.username = '');

-- ───────────────────────── App settings (admin-controlled) ─────────────────────────
-- Single-row settings table. require_invite flips the allowlist gate on/off.
create table if not exists public.app_settings (
  id             int primary key default 1,
  require_invite boolean not null default false,
  constraint app_settings_singleton check (id = 1)
);
insert into public.app_settings (id) values (1) on conflict (id) do nothing;

create or replace function public.require_invite()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select require_invite from public.app_settings where id = 1), false);
$$;

alter table public.app_settings enable row level security;
drop policy if exists app_settings_read on public.app_settings;
create policy app_settings_read on public.app_settings for select using (true);
drop policy if exists app_settings_write on public.app_settings;
create policy app_settings_write on public.app_settings
  for update using (public.is_admin()) with check (public.is_admin());

-- Re-create ensure_profile so it also records the username on first login.
-- OPEN REGISTRATION by default: anyone who signs up gets a member profile. Turn on
-- app_settings.require_invite (admin setting) to gate joining to the allowlist.
-- If their email is on member_invites, that role is honored (pre-assign admins).
create or replace function public.ensure_profile(p_display_name text default null)
returns setof public.profiles
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  inv_role text;
  uname text := split_part(coalesce(auth.jwt() ->> 'email', ''), '@', 1);
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  if exists (select 1 from public.profiles where id = uid) then
    return query select * from public.profiles where id = uid;
    return;
  end if;

  -- Allowlist gate is admin-toggleable (see app_settings.require_invite).
  if public.require_invite() and not public.is_invited() then
    raise exception 'not invited' using errcode = '42501';
  end if;

  select role into inv_role from public.member_invites
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')) limit 1;

  return query
  insert into public.profiles (id, display_name, role, username)
  values (
    uid,
    coalesce(nullif(p_display_name, ''), uname),
    coalesce(inv_role, 'member'),
    uname
  )
  returning *;
end $$;

grant execute on function public.ensure_profile(text) to authenticated;

-- Prevent members from promoting themselves: only admins may change a role.
create or replace function public.protect_profile_role()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    new.role := old.role;
  end if;
  return new;
end $$;

drop trigger if exists profiles_protect_role on public.profiles;
create trigger profiles_protect_role before update on public.profiles
  for each row execute function public.protect_profile_role();

-- Admin-only: set another member's password (no service key needed).
create or replace function public.admin_set_password(target uuid, new_password text)
returns void language plpgsql security definer set search_path = public, auth, extensions as $$
begin
  if not public.is_admin() then
    raise exception 'admins only' using errcode = '42501';
  end if;
  if length(coalesce(new_password, '')) < 6 then
    raise exception 'password too short';
  end if;
  update auth.users
    set encrypted_password = extensions.crypt(new_password, extensions.gen_salt('bf')),
        updated_at = now()
  where id = target;
end $$;

grant execute on function public.admin_set_password(uuid, text) to authenticated;

-- ───────────────────────── Meetings & RSVPs ─────────────────────────
create table if not exists public.meetings (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  starts_at   timestamptz,
  location    text,
  book        text,
  chapter     int,
  verse_start int,
  verse_end   int,
  notes       text,
  created_at  timestamptz not null default now()
);
create index if not exists meetings_starts_idx on public.meetings (starts_at);

create table if not exists public.meeting_rsvps (
  meeting_id uuid not null references public.meetings (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  status     text not null default 'yes',  -- yes | no | maybe
  updated_at timestamptz not null default now(),
  primary key (meeting_id, user_id)
);

-- ───────────────────────── Verse highlights ─────────────────────────
create table if not exists public.highlights (
  user_id    uuid not null references auth.users (id) on delete cascade,
  book       text not null,
  chapter    int  not null,
  verse      int  not null,
  color      text not null default 'yellow',
  created_at timestamptz not null default now(),
  primary key (user_id, book, chapter, verse)
);

-- ───────────────────────── Contact / feedback inbox ─────────────────────────
create table if not exists public.feedback_threads (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  subject    text not null,
  status     text not null default 'open',  -- open | closed
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists feedback_threads_user_idx on public.feedback_threads (user_id, updated_at desc);

create table if not exists public.feedback_messages (
  id          uuid primary key default gen_random_uuid(),
  thread_id   uuid not null references public.feedback_threads (id) on delete cascade,
  author      uuid not null references auth.users (id) on delete cascade,
  sender_role text not null default 'member',  -- member | admin
  body        text not null,
  created_at  timestamptz not null default now()
);
create index if not exists feedback_messages_thread_idx on public.feedback_messages (thread_id, created_at);

-- RLS
alter table public.meetings         enable row level security;
alter table public.meeting_rsvps    enable row level security;
alter table public.highlights       enable row level security;
alter table public.feedback_threads enable row level security;
alter table public.feedback_messages enable row level security;

drop policy if exists meetings_read on public.meetings;
create policy meetings_read on public.meetings for select using (public.is_member());
drop policy if exists meetings_write on public.meetings;
create policy meetings_write on public.meetings
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists rsvps_read on public.meeting_rsvps;
create policy rsvps_read on public.meeting_rsvps for select using (public.is_member());
drop policy if exists rsvps_own on public.meeting_rsvps;
create policy rsvps_own on public.meeting_rsvps
  for all using (user_id = auth.uid()) with check (public.is_member() and user_id = auth.uid());

drop policy if exists highlights_own on public.highlights;
create policy highlights_own on public.highlights
  for all using (user_id = auth.uid()) with check (public.is_member() and user_id = auth.uid());

-- feedback threads: a member sees only their own; admins see all.
drop policy if exists feedback_threads_select on public.feedback_threads;
create policy feedback_threads_select on public.feedback_threads
  for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists feedback_threads_insert on public.feedback_threads;
create policy feedback_threads_insert on public.feedback_threads
  for insert with check (public.is_member() and user_id = auth.uid());
drop policy if exists feedback_threads_update on public.feedback_threads;
create policy feedback_threads_update on public.feedback_threads
  for update using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

-- feedback messages: visible to the thread owner and admins.
drop policy if exists feedback_messages_select on public.feedback_messages;
create policy feedback_messages_select on public.feedback_messages
  for select using (
    public.is_admin() or exists (
      select 1 from public.feedback_threads t
      where t.id = thread_id and t.user_id = auth.uid()
    )
  );
drop policy if exists feedback_messages_insert on public.feedback_messages;
create policy feedback_messages_insert on public.feedback_messages
  for insert with check (
    author = auth.uid() and (
      public.is_admin() or exists (
        select 1 from public.feedback_threads t
        where t.id = thread_id and t.user_id = auth.uid()
      )
    )
  );

-- ───────────────────────── Bookmarks ─────────────────────────
create table if not exists public.bookmarks (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  book       text not null,
  chapter    int  not null,
  verse      int,            -- null = a whole-chapter (page) bookmark
  label      text,
  created_at timestamptz not null default now()
);
create index if not exists bookmarks_user_idx on public.bookmarks (user_id, created_at desc);

-- ───────────────────────── Reading progress (chapters read) ─────────────────────────
create table if not exists public.reads (
  user_id uuid not null references auth.users (id) on delete cascade,
  book    text not null,
  chapter int  not null,
  read_at timestamptz not null default now(),
  primary key (user_id, book, chapter)
);

alter table public.bookmarks enable row level security;
alter table public.reads     enable row level security;

drop policy if exists bookmarks_own on public.bookmarks;
create policy bookmarks_own on public.bookmarks
  for all using (user_id = auth.uid()) with check (public.is_member() and user_id = auth.uid());

drop policy if exists reads_own on public.reads;
create policy reads_own on public.reads
  for all using (user_id = auth.uid()) with check (public.is_member() and user_id = auth.uid());

-- Realtime for the live bits.
do $$ begin alter publication supabase_realtime add table public.feedback_messages; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.meetings; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.meeting_rsvps; exception when duplicate_object then null; end $$;

-- ═══════════════════════════════════════════════════════════════════════════
--  Study groups (multi-tenant). A user can create up to 5 groups and join any
--  number via a share code. Studies, discussions, notes, and meetings all live
--  inside a group; personal data (reads, bookmarks, highlights) stays per-user.
--  "Group admins" manage their own group only — separate from site admin.
--  Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.groups (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  code       text not null unique,
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.group_members (
  group_id  uuid not null references public.groups (id) on delete cascade,
  user_id   uuid not null references auth.users (id) on delete cascade,
  role      text not null default 'member',  -- member | admin (group-level only)
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index if not exists group_members_user_idx on public.group_members (user_id);

-- SECURITY DEFINER helpers so policies can check membership without RLS recursion.
create or replace function public.is_group_member(gid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.group_members where group_id = gid and user_id = auth.uid()
  );
$$;

create or replace function public.is_group_admin(gid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.group_members
    where group_id = gid and user_id = auth.uid() and role = 'admin'
  );
$$;

-- Add the group_id link to all group-scoped content.
alter table public.studies  add column if not exists group_id uuid references public.groups (id) on delete cascade;
alter table public.lessons  add column if not exists group_id uuid references public.groups (id) on delete cascade;
alter table public.threads  add column if not exists group_id uuid references public.groups (id) on delete cascade;
alter table public.posts    add column if not exists group_id uuid references public.groups (id) on delete cascade;
alter table public.notes    add column if not exists group_id uuid references public.groups (id) on delete cascade;
alter table public.meetings add column if not exists group_id uuid references public.groups (id) on delete cascade;

create index if not exists studies_group_idx  on public.studies  (group_id, position);
create index if not exists threads_group_idx  on public.threads  (group_id, created_at desc);
create index if not exists notes_group_idx    on public.notes    (group_id);
create index if not exists meetings_group_idx on public.meetings (group_id);

-- A passage thread is now unique per group (each group has its own discussion).
do $$ begin
  alter table public.threads drop constraint if exists threads_ref_key;
exception when undefined_object then null; end $$;
do $$ begin
  alter table public.threads add constraint threads_group_ref_key unique (group_id, ref);
exception when duplicate_table then null; when duplicate_object then null; end $$;

-- ───────────────────────── Group RPCs (all SECURITY DEFINER) ─────────────────────────
-- Create a group (max 5 per user), become its admin, return the new row.
create or replace function public.create_group(p_name text)
returns setof public.groups
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  new_code text;
  gid uuid;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if length(coalesce(trim(p_name), '')) = 0 then raise exception 'name required'; end if;
  if (select count(*) from public.groups where created_by = uid) >= 5 then
    raise exception 'group limit reached' using errcode = 'P0001';
  end if;

  loop
    new_code := upper(substr(replace(encode(extensions.gen_random_bytes(6), 'hex'), '/', ''), 1, 8));
    exit when not exists (select 1 from public.groups where code = new_code);
  end loop;

  insert into public.groups (name, code, created_by)
    values (trim(p_name), new_code, uid)
    returning id into gid;
  insert into public.group_members (group_id, user_id, role) values (gid, uid, 'admin');

  return query select * from public.groups where id = gid;
end $$;

-- Preview a group by code without joining (so a user can confirm before joining).
create or replace function public.lookup_group(p_code text)
returns table (id uuid, name text, member_count bigint)
language sql stable security definer set search_path = public as $$
  select g.id, g.name, (select count(*) from public.group_members m where m.group_id = g.id)
  from public.groups g
  where upper(g.code) = upper(trim(p_code))
  limit 1;
$$;

-- Join a group by code (idempotent), return the group.
create or replace function public.join_group(p_code text)
returns setof public.groups
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  gid uuid;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  select id into gid from public.groups where upper(code) = upper(trim(p_code)) limit 1;
  if gid is null then raise exception 'no such group' using errcode = 'P0002'; end if;
  insert into public.group_members (group_id, user_id, role)
    values (gid, uid, 'member') on conflict do nothing;
  return query select * from public.groups where id = gid;
end $$;

create or replace function public.rename_group(p_group uuid, p_name text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_group_admin(p_group) then raise exception 'group admins only' using errcode = '42501'; end if;
  if length(coalesce(trim(p_name), '')) = 0 then raise exception 'name required'; end if;
  update public.groups set name = trim(p_name) where id = p_group;
end $$;

create or replace function public.delete_group(p_group uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_group_admin(p_group) then raise exception 'group admins only' using errcode = '42501'; end if;
  delete from public.groups where id = p_group;
end $$;

create or replace function public.set_group_member_role(p_group uuid, p_user uuid, p_role text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_group_admin(p_group) then raise exception 'group admins only' using errcode = '42501'; end if;
  if p_role not in ('member', 'admin') then raise exception 'bad role'; end if;
  update public.group_members set role = p_role where group_id = p_group and user_id = p_user;
end $$;

create or replace function public.remove_group_member(p_group uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  -- Group admins may kick anyone; any member may remove themselves (leave).
  if not (public.is_group_admin(p_group) or p_user = uid) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  delete from public.group_members where group_id = p_group and user_id = p_user;
end $$;

grant execute on function public.create_group(text)               to authenticated;
grant execute on function public.lookup_group(text)               to authenticated;
grant execute on function public.join_group(text)                 to authenticated;
grant execute on function public.rename_group(uuid, text)         to authenticated;
grant execute on function public.delete_group(uuid)               to authenticated;
grant execute on function public.set_group_member_role(uuid, uuid, text) to authenticated;
grant execute on function public.remove_group_member(uuid, uuid)  to authenticated;

-- ───────────────────────── Group RLS ─────────────────────────
alter table public.groups        enable row level security;
alter table public.group_members enable row level security;

drop policy if exists groups_read on public.groups;
create policy groups_read on public.groups for select using (public.is_group_member(id));
-- (insert/update/delete on groups go through the SECURITY DEFINER RPCs above.)

drop policy if exists group_members_read on public.group_members;
create policy group_members_read on public.group_members
  for select using (public.is_group_member(group_id));

-- ───────────────────────── Re-scope content policies to groups ─────────────────────────
drop policy if exists studies_read on public.studies;
drop policy if exists studies_write on public.studies;
create policy studies_read  on public.studies for select using (public.is_group_member(group_id));
create policy studies_write on public.studies for all
  using (public.is_group_admin(group_id)) with check (public.is_group_admin(group_id));

drop policy if exists lessons_read on public.lessons;
drop policy if exists lessons_write on public.lessons;
create policy lessons_read  on public.lessons for select using (public.is_group_member(group_id));
create policy lessons_write on public.lessons for all
  using (public.is_group_admin(group_id)) with check (public.is_group_admin(group_id));

drop policy if exists threads_read on public.threads;
drop policy if exists threads_insert on public.threads;
drop policy if exists threads_modify on public.threads;
drop policy if exists threads_delete on public.threads;
create policy threads_read on public.threads for select using (public.is_group_member(group_id));
create policy threads_insert on public.threads
  for insert with check (public.is_group_member(group_id) and created_by = auth.uid());
create policy threads_modify on public.threads
  for update using (created_by = auth.uid() or public.is_group_admin(group_id))
  with check (created_by = auth.uid() or public.is_group_admin(group_id));
create policy threads_delete on public.threads
  for delete using (created_by = auth.uid() or public.is_group_admin(group_id));

drop policy if exists posts_read on public.posts;
drop policy if exists posts_insert on public.posts;
drop policy if exists posts_modify on public.posts;
drop policy if exists posts_delete on public.posts;
create policy posts_read on public.posts for select using (public.is_group_member(group_id));
create policy posts_insert on public.posts
  for insert with check (public.is_group_member(group_id) and author = auth.uid());
create policy posts_modify on public.posts
  for update using (author = auth.uid() or public.is_group_admin(group_id))
  with check (author = auth.uid() or public.is_group_admin(group_id));
create policy posts_delete on public.posts
  for delete using (author = auth.uid() or public.is_group_admin(group_id));

drop policy if exists notes_read on public.notes;
drop policy if exists notes_insert on public.notes;
drop policy if exists notes_modify on public.notes;
drop policy if exists notes_delete on public.notes;
create policy notes_read on public.notes
  for select using (public.is_group_member(group_id) and (visibility = 'group' or author = auth.uid()));
create policy notes_insert on public.notes
  for insert with check (public.is_group_member(group_id) and author = auth.uid());
create policy notes_modify on public.notes
  for update using (author = auth.uid() or public.is_group_admin(group_id))
  with check (author = auth.uid() or public.is_group_admin(group_id));
create policy notes_delete on public.notes
  for delete using (author = auth.uid() or public.is_group_admin(group_id));

drop policy if exists reactions_read on public.post_reactions;
drop policy if exists reactions_own on public.post_reactions;
create policy reactions_read on public.post_reactions for select using (
  exists (select 1 from public.posts p where p.id = post_id and public.is_group_member(p.group_id))
);
create policy reactions_own on public.post_reactions for all
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.posts p where p.id = post_id and public.is_group_member(p.group_id))
  );

drop policy if exists meetings_read on public.meetings;
drop policy if exists meetings_write on public.meetings;
create policy meetings_read  on public.meetings for select using (public.is_group_member(group_id));
create policy meetings_write on public.meetings for all
  using (public.is_group_admin(group_id)) with check (public.is_group_admin(group_id));

drop policy if exists rsvps_read on public.meeting_rsvps;
drop policy if exists rsvps_own on public.meeting_rsvps;
create policy rsvps_read on public.meeting_rsvps for select using (
  exists (select 1 from public.meetings m where m.id = meeting_id and public.is_group_member(m.group_id))
);
create policy rsvps_own on public.meeting_rsvps for all
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.meetings m where m.id = meeting_id and public.is_group_member(m.group_id))
  );

-- ───────────────────────── Migrate existing shared content into one group ─────────────────────────
-- One-time: if there are members but no groups yet, fold all current content into
-- a single "Bible Study" group so nothing is lost, and add everyone to it.
do $$
declare gid uuid; owner_id uuid;
begin
  if not exists (select 1 from public.groups)
     and exists (select 1 from public.profiles) then
    select id into owner_id from public.profiles where role = 'admin' order by created_at limit 1;
    if owner_id is null then select id into owner_id from public.profiles order by created_at limit 1; end if;

    insert into public.groups (name, code, created_by)
      values ('Bible Study', upper(substr(replace(encode(extensions.gen_random_bytes(6), 'hex'), '/', ''), 1, 8)), owner_id)
      returning id into gid;

    insert into public.group_members (group_id, user_id, role)
      select gid, id, case when role = 'admin' then 'admin' else 'member' end from public.profiles
      on conflict do nothing;

    update public.studies  set group_id = gid where group_id is null;
    update public.lessons  set group_id = gid where group_id is null;
    update public.threads  set group_id = gid where group_id is null;
    update public.posts    set group_id = gid where group_id is null;
    update public.notes    set group_id = gid where group_id is null;
    update public.meetings set group_id = gid where group_id is null;
  end if;
end $$;

-- Realtime for group tables.
do $$ begin alter publication supabase_realtime add table public.groups; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.group_members; exception when duplicate_object then null; end $$;

-- ───────────────────────── Bootstrap the first admin ─────────────────────────
-- The group signs in with a USERNAME + password. Internally a username maps to
-- "<username>@biblestudy.app". IMPORTANT: in the Supabase dashboard under
-- Authentication -> Providers -> Email, turn OFF "Confirm email" (these synthetic
-- addresses can't receive mail).
--
-- 1) Add your admin username to the allowlist (lowercase synthetic email):
--      insert into public.member_invites (email, role)
--      values ('lazorraptor@biblestudy.app', 'admin')
--      on conflict (email) do update set role = 'admin';
-- 2) Open the app -> Create account -> username "lazorRaptor" + your password.
--    The new profile inherits the admin role automatically.
-- (If you created the account before step 1, fix the role once:)
--      update public.profiles set role = 'admin'
--      where id = (select id from auth.users where email = 'lazorraptor@biblestudy.app');
