import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import Nav from "./components/Nav";
import MobileTabBar from "./components/MobileTabBar";
import NotFound from "./components/NotFound";
import Login from "./routes/Login";
import Signup from "./routes/Signup";
import Feed from "./routes/Feed";
import Discover from "./routes/Discover";
import Leaderboard from "./routes/Leaderboard";
import Profile from "./routes/Profile";
import PostDetail from "./routes/PostDetail";
import LogSession from "./routes/LogSession";
import PoleBag from "./routes/PoleBag";
import MeetMode from "./routes/MeetMode";
import Notifications from "./routes/Notifications";
import Settings from "./routes/Settings";
import MeetDetail from "./routes/MeetDetail";
import PoleDetail from "./routes/PoleDetail";
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

export default function App() {
  return (
    <div className="min-h-screen-mobile flex flex-col">
      <Nav />
      <main className="flex-1">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/" element={<Private><Feed /></Private>} />
          <Route path="/discover" element={<Discover />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/meets/:id" element={<MeetDetail />} />
          <Route path="/u/:handle" element={<Profile />} />
          <Route path="/p/:id" element={<PostDetail />} />
          <Route path="/log" element={<Private><LogSession /></Private>} />
          <Route path="/log/:id" element={<LogSession />} />
          <Route path="/poles" element={<Private><PoleBag /></Private>} />
          <Route path="/poles/:id" element={<PoleDetail />} />
          <Route path="/meet" element={<Private><MeetMode /></Private>} />
          <Route path="/meet/:id" element={<Private><MeetMode /></Private>} />
          <Route path="/notifications" element={<Private><Notifications /></Private>} />
          <Route path="/settings" element={<Private><Settings /></Private>} />
          {/* Visual QA route for the redesign primitives. */}
          <Route path="/_dev/components" element={<DevComponents />} />
          <Route path="*" element={<NotFound subject="page" detail="The link you followed may be broken or the page may have been removed." />} />
        </Routes>
      </main>
      <footer className="text-center text-xs text-stone-400 py-6 hidden md:block">
        Apex · pole vault training journal
        {env.DEV ? " · local dev build" : ""}
      </footer>
      <MobileTabBar />
    </div>
  );
}
