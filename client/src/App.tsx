import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Calendar, Home, BarChart3, User as UserIcon } from "lucide-react";
import { BottomNav, type Tab } from "./components/ui";
import NotFound from "./components/NotFound";
import Login from "./routes/Login";
import Signup from "./routes/Signup";
import Today from "./routes/Today";
import SessionsList from "./routes/SessionsList";
import Progress from "./routes/Progress";
import Discover from "./routes/Discover";
import Leaderboard from "./routes/Leaderboard";
import Profile from "./routes/Profile";
import PostDetail from "./routes/PostDetail";
import LogSession from "./routes/LogSession";
import PoleBag from "./routes/PoleBag";
import PoleDetail from "./routes/PoleDetail";
import MeetMode from "./routes/MeetMode";
import MeetDetail from "./routes/MeetDetail";
import Notifications from "./routes/Notifications";
import Settings from "./routes/Settings";
import DevComponents from "./routes/_DevComponents";
import { useAuth } from "./auth";

function Private({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return null;
  if (!user) return <Navigate to="/login" state={{ from: loc.pathname }} replace />;
  return children;
}

const env = import.meta.env;

function makeTabs(handle: string | null): Tab[] {
  return [
    {
      to: "/",
      label: "Today",
      icon: Home,
      match: (p) => p === "/",
    },
    {
      to: "/sessions",
      label: "Sessions",
      icon: Calendar,
      match: (p) => p.startsWith("/sessions") || p.startsWith("/log") || p.startsWith("/p/"),
    },
    {
      to: "/progress",
      label: "Progress",
      icon: BarChart3,
      match: (p) => p.startsWith("/progress") || p.startsWith("/leaderboard"),
    },
    {
      to: handle ? `/u/${handle}` : "/login",
      label: "Profile",
      icon: UserIcon,
      match: (p) =>
        p.startsWith("/u/") ||
        p.startsWith("/settings") ||
        p.startsWith("/poles") ||
        p.startsWith("/notifications"),
    },
  ];
}

function ChromeShell({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const loc = useLocation();

  // Hide bottom nav on auth screens + dev showcase + meet-mode (full-bleed UI).
  const hideNav =
    loc.pathname.startsWith("/login") ||
    loc.pathname.startsWith("/signup") ||
    loc.pathname.startsWith("/_dev/") ||
    loc.pathname.startsWith("/meet");

  return (
    <div className="min-h-screen bg-bg-base text-text-primary flex flex-col">
      <main className="flex-1">{children}</main>
      {user && !hideNav && <BottomNav tabs={makeTabs(user.handle)} />}
      {/* Reserve space at the bottom of the page so content doesn't slide
          under the fixed tab bar on mobile. md+ keeps padding minimal. */}
      {user && !hideNav && <div className="h-[72px] md:h-0" aria-hidden />}
    </div>
  );
}

export default function App() {
  return (
    <ChromeShell>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        {/* Primary tabs */}
        <Route path="/" element={<Private><Today /></Private>} />
        <Route path="/sessions" element={<Private><SessionsList /></Private>} />
        <Route path="/progress" element={<Private><Progress /></Private>} />

        {/* Profile + detail surfaces */}
        <Route path="/u/:handle" element={<Profile />} />
        <Route path="/poles" element={<Private><PoleBag /></Private>} />
        <Route path="/poles/:id" element={<PoleDetail />} />
        <Route path="/notifications" element={<Private><Notifications /></Private>} />
        <Route path="/settings" element={<Private><Settings /></Private>} />

        {/* Session detail / logging — under Sessions tab */}
        <Route path="/p/:id" element={<PostDetail />} />
        <Route path="/log" element={<Private><LogSession /></Private>} />
        <Route path="/log/:id" element={<LogSession />} />

        {/* Meet routes */}
        <Route path="/meet" element={<Private><MeetMode /></Private>} />
        <Route path="/meet/:id" element={<Private><MeetMode /></Private>} />
        <Route path="/meets/:id" element={<MeetDetail />} />

        {/* Legacy social — still reachable but not in the tab bar. */}
        <Route path="/discover" element={<Discover />} />
        <Route path="/leaderboard" element={<Leaderboard />} />

        {/* Dev */}
        <Route path="/_dev/components" element={<DevComponents />} />

        <Route
          path="*"
          element={
            <NotFound
              subject="page"
              detail="The link you followed may be broken or the page may have been removed."
            />
          }
        />
      </Routes>
      {env.DEV && (
        <div className="fixed bottom-20 right-4 z-50 hidden md:block text-[10px] text-text-tertiary opacity-50">
          dev
        </div>
      )}
    </ChromeShell>
  );
}
