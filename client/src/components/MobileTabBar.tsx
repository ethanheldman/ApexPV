import { NavLink } from "react-router-dom";
import { useAuth } from "../auth";
import Avatar from "./Avatar";

const itemBase =
  "flex flex-col items-center justify-center flex-1 gap-0.5 text-[10px] font-semibold transition-colors h-full";

export default function MobileTabBar() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-bg-base/95 backdrop-blur border-t border-border-subtle"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="flex h-[58px] items-stretch">
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            itemBase + (isActive ? " text-text-primary" : " text-text-secondary")
          }
        >
          <span className="text-[20px] leading-none">🏠</span>
          <span>Feed</span>
        </NavLink>
        <NavLink
          to="/discover"
          className={({ isActive }) =>
            itemBase + (isActive ? " text-text-primary" : " text-text-secondary")
          }
        >
          <span className="text-[20px] leading-none">🔭</span>
          <span>Discover</span>
        </NavLink>
        {/* Center action: Log */}
        <NavLink
          to="/log"
          className={({ isActive }) =>
            "flex flex-col items-center justify-center flex-1 gap-0.5 text-[10px] font-bold transition-colors h-full " +
            (isActive ? "text-accent" : "text-text-primary")
          }
        >
          <span className="grid place-items-center w-11 h-11 rounded-full bg-accent text-white text-2xl shadow-sm -mt-3">
            +
          </span>
          <span className="-mt-0.5">Log</span>
        </NavLink>
        <NavLink
          to="/leaderboard"
          className={({ isActive }) =>
            itemBase + (isActive ? " text-text-primary" : " text-text-secondary")
          }
        >
          <span className="text-[20px] leading-none">🏆</span>
          <span>Top</span>
        </NavLink>
        <NavLink
          to={`/u/${user.handle}`}
          className={({ isActive }) =>
            itemBase + (isActive ? " text-text-primary" : " text-text-secondary")
          }
        >
          <Avatar
            seed={user.avatar_seed ?? user.handle}
            url={user.avatar_url}
            size={22}
          />
          <span>You</span>
        </NavLink>
      </div>
    </nav>
  );
}
