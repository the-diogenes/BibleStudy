# Bible Study

A mobile-first, installable (PWA) Bible study app for a private group:

- Bible reader with multiple free/public-domain English translations (Berean Standard Bible by default, plus WEB, KJV, NET, and many more) via the Free Use Bible API.
- Original-language interlinear (Greek/Hebrew) with Strong's numbers, transliteration, morphology, and a tap-to-read lexicon.
- Wiki/Reddit-style discussion on any passage, plus personal and shared "margin" notes.
- A curriculum hub: a landing page with the group's study plan and a live checklist that links to each passage and its discussion.
- Real member accounts (passwordless magic-link sign-in), gated by an invite allowlist, with strict Row-Level Security.

Tech: React + Vite + TypeScript + Tailwind, deployed as a static site to GitHub Pages, with Supabase for auth, database, and realtime.

All Bible content is free / public domain. No licensing fees.

---

## 1. Run locally

```bash
npm install
npm run dev
```

Open the printed URL. The Bible reader works immediately. Sign-in, threads, and
notes require Supabase (next step).

## 2. Set up Supabase (accounts, threads, notes)

1. Create a project at [supabase.com](https://supabase.com).
2. In the SQL Editor, run [`supabase/schema.sql`](supabase/schema.sql).
3. Bootstrap yourself as admin (use the email you'll sign in with):

   ```sql
   insert into public.member_invites (email, role) values ('you@example.com', 'admin')
     on conflict (email) do update set role = 'admin';
   ```

4. Copy the config and fill in **Project URL** and the **anon public** key
   (Project Settings -> API):

   ```bash
   cp public/config.example.js public/config.js
   ```

5. Sign in once in the app (creates your profile), then promote yourself:

   ```sql
   update public.profiles set role = 'admin'
   where id = (select id from auth.users where email = 'you@example.com');
   ```

The anon key is meant to be public; your data is protected by Row-Level Security
(only invited, signed-in members can read/write group data).

Magic links: Supabase sends sign-in emails on the free tier. For production
volume, configure a custom SMTP provider under Auth settings. Also add your site
URL under **Auth -> URL Configuration -> Redirect URLs**
(`http://localhost:5173` for dev and `https://the-diogenes.github.io/BibleStudy/`).

## 3. Deploy to GitHub Pages

This repo (`the-diogenes/BibleStudy`) is served at
`https://the-diogenes.github.io/BibleStudy/`.

1. In GitHub: **Settings -> Pages -> Build and deployment -> Source: GitHub Actions**.
2. In **Settings -> Secrets and variables -> Actions** add:
   - Variable `SUPABASE_URL` = your project URL
   - Variable `GROUP_NAME` = your group's name (optional)
   - Secret `SUPABASE_ANON_KEY` = your anon public key
3. Push to `main`. The workflow in
   [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) builds with the
   correct base path (`/BibleStudy/`) and deploys.

(If you fork/rename the repo, update `VITE_BASE` in the workflow and the redirect
URL above.)

## 4. Original-language interlinear data

Ships with sample chapters (John 1, Genesis 1) and a matching Strong's lexicon so
the interlinear view works out of the box. To validate or extend coverage:

```bash
npm run build:interlinear
```

See [`scripts/build-interlinear.mjs`](scripts/build-interlinear.mjs) for the data
format and the public-domain sources (Berean tables, Open Scriptures Hebrew Bible,
SBLGNT/OpenGNT, Strong's dictionaries) to build the full Bible.

## Project layout

```
public/
  config.example.js        Runtime Supabase config template
  data/interlinear/<BK>/   Per-chapter Greek/Hebrew interlinear JSON
  data/strongs.json        Strong's lexicon
src/
  context/                 Auth + settings (translation, interlinear) providers
  components/              Layout, Discussion, NotesPanel, CommentaryPanel, WordPopover
  lib/                     bibleApi, interlinear, db (Supabase), refs, cache
  pages/                   Home, Bible, Reader, Passage, Threads, Notes, Profile, About, Admin
supabase/schema.sql        Tables + strict RLS + realtime
scripts/build-interlinear.mjs
```

## Content & doctrine

The app is a neutral platform. The study plan, the About / Statement of Faith
page (`src/pages/About.tsx`), and all discussion and notes are authored by your
group. Commentaries shown in the Passage view are public-domain works that
reflect their own authors' views; choose which to display.

## Notes for the curriculum

See [`docs/curriculum-research.md`](docs/curriculum-research.md) for a neutral
shortlist of study methods and reputable sources to choose from (you decide what
to adopt).

Future feature ideas are parked in
[`docs/future-ideas.md`](docs/future-ideas.md).
