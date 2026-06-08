import { Link, NavLink, Outlet } from "react-router-dom";
import { config, isSupabaseConfigured } from "../lib/config";
import { useAuth } from "../context/AuthContext";
import { useSettings } from "../context/SettingsContext";
import { BookIcon, ChatIcon, HomeIcon, MailIcon, MoonIcon, NoteIcon, SunIcon, UserIcon } from "./icons";

const tabs = [
  { to: "/", label: "Home", Icon: HomeIcon, end: true },
  { to: "/bible", label: "Bible", Icon: BookIcon },
  { to: "/threads", label: "Threads", Icon: ChatIcon },
  { to: "/notes", label: "Notes", Icon: NoteIcon },
  { to: "/profile", label: "Profile", Icon: UserIcon },
];

export default function Layout() {
  const { isAdmin } = useAuth();
  const { resolvedDark, setTheme } = useSettings();

  return (
    <div className="mx-auto flex min-h-full max-w-2xl flex-col">
      <header className="sticky top-0 z-20 border-b border-stone-200 bg-parchment/90 backdrop-blur">
        <div className="flex items-center justify-between px-4 py-3">
          <Link to="/" className="font-serif text-lg font-semibold tracking-tight">
            {config.groupName}
          </Link>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Link to="/admin" className="text-xs font-medium text-stone-500 hover:text-ink">
                Admin
              </Link>
            )}
            <Link
              to="/contact"
              aria-label="Contact and feedback"
              className="rounded-md p-1.5 text-stone-500 hover:bg-stone-100 hover:text-ink"
            >
              <MailIcon className="h-5 w-5" />
            </Link>
            <button
              type="button"
              onClick={() => setTheme(resolvedDark ? "light" : "dark")}
              aria-label={resolvedDark ? "Switch to light mode" : "Switch to dark mode"}
              className="rounded-md p-1.5 text-stone-500 hover:bg-stone-100 hover:text-ink"
            >
              {resolvedDark ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </header>

      {!isSupabaseConfigured && (
        <div className="mx-4 mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Backend not configured. The reader works, but sign-in, threads, and notes
          need a Supabase project (see <span className="font-mono">public/config.js</span>).
        </div>
      )}

      <main className="flex-1 px-4 pt-4 pb-nav">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-stone-200 bg-white/95 backdrop-blur safe-bottom">
        <div className="mx-auto grid max-w-2xl grid-cols-5">
          {tabs.map(({ to, label, Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition ${
                  isActive ? "text-ink" : "text-stone-400"
                }`
              }
            >
              <Icon className="h-6 w-6" />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
