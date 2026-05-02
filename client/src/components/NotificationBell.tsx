import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";

export default function NotificationBell() {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const fetch = () =>
      api<{ count: number }>("/api/notifications/unread-count")
        .then((r) => !cancelled && setCount(r.count))
        .catch(() => {});
    fetch();
    const t = setInterval(fetch, 30_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [user]);

  if (!user) return null;
  return (
    <Link
      to="/notifications"
      className="relative inline-flex items-center justify-center w-9 h-9 rounded-lg hover:bg-stone-100 text-stone-700"
      aria-label="Notifications"
    >
      <span className="text-lg">🔔</span>
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-accent text-white text-[10px] font-bold flex items-center justify-center">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
