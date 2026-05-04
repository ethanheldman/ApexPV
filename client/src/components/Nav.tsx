import { NavLink, Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import Avatar from "./Avatar";
import NotificationBell from "./NotificationBell";
import SearchBox from "./SearchBox";

export default function Nav() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();

  const link = (active: boolean) =>
    "px-3 py-1.5 text-sm font-semibold rounded-lg transition-colors " +
    (active ? "bg-bg-sunken text-text-primary" : "text-text-primary hover:bg-bg-raised");

  const inMeet = loc.pathname.startsWith("/meet");

  return (
    <header
      className="sticky top-0 z-30 bg-bg-base/85 backdrop-blur border-b border-border-subtle"
      style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
    >
      <div className="mx-auto max-w-6xl flex items-center justify-between px-4 sm:px-5 py-3 gap-2 sm:gap-3">
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <div className="h-7 w-7 rounded-lg bg-bg-sunken grid place-items-center text-text-primary font-display font-bold">
            A
          </div>
          <div className="font-display font-bold text-lg tracking-tight">apex</div>
        </Link>

        {/* Desktop / tablet primary nav. Hidden on mobile — replaced by bottom tab bar. */}
        <nav className="hidden md:flex items-center gap-1 overflow-x-auto">
          <NavLink to="/" end className={({ isActive }) => link(isActive)}>
            Feed
          </NavLink>
          <NavLink to="/discover" className={({ isActive }) => link(isActive)}>
            Discover
          </NavLink>
          <NavLink to="/leaderboard" className={({ isActive }) => link(isActive)}>
            Leaderboard
          </NavLink>
          {user && (
            <>
              <NavLink to="/poles" className={({ isActive }) => link(isActive)}>
                Pole Bag
              </NavLink>
              {inMeet ? (
                <span className="ml-2 px-3 py-1.5 rounded-lg bg-bg-raised text-text-primary text-sm font-semibold">
                  Meet Mode
                </span>
              ) : (
                <NavLink to="/log" className="btn-accent ml-2 !py-1.5 !px-3 text-sm">
                  + Log
                </NavLink>
              )}
            </>
          )}
        </nav>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {user && <SearchBox />}
          {user && <NotificationBell />}
          {user ? (
            <>
              {/* Avatar links to profile. Display name hidden on phone. */}
              <NavLink to={`/u/${user.handle}`} className="hidden md:flex items-center gap-2 group">
                <Avatar seed={user.avatar_seed ?? user.handle} url={user.avatar_url} size={32} />
                <div className="hidden lg:block text-right leading-tight">
                  <div className="text-sm font-semibold group-hover:underline">
                    {user.display_name}
                  </div>
                  <div className="text-[11px] text-text-secondary">@{user.handle}</div>
                </div>
              </NavLink>
              <Link
                to="/settings"
                title="Settings"
                className="hidden md:grid text-text-secondary hover:text-text-primary text-lg w-8 h-8 place-items-center rounded-lg hover:bg-bg-raised"
              >
                ⚙
              </Link>
              <button
                onClick={() => {
                  logout();
                  nav("/login");
                }}
                className="hidden md:inline text-xs text-text-secondary hover:text-text-primary"
              >
                sign out
              </button>
            </>
          ) : (
            <Link to="/login" className="btn-primary !py-1.5 !px-3 text-sm">
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
