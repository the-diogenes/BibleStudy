// Copy this file to public/config.js and fill in your Supabase project values.
//
// The Supabase ANON key is designed to be public (it is safe in client code).
// Your data is protected by Row-Level Security (see supabase/schema.sql), so a
// member must be signed in AND on the invite allowlist to read/write group data.
//
// Get these from Supabase: Project Settings -> API -> Project URL + anon public key.
//
// For GitHub Pages deploys you may intentionally commit public/config.js
// (remove the matching line in .gitignore) so the built site includes it.

window.__BIBLE_CONFIG__ = {
  supabaseUrl: "https://YOUR_PROJECT_ID.supabase.co",
  supabaseAnonKey: "YOUR_ANON_PUBLIC_KEY",

  // Cosmetic: the name shown in the header and on the About page.
  groupName: "Our Bible Study",
};
