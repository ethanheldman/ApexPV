import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import Avatar from "../components/Avatar";
import { relTime } from "../lib/format";
import type { Notification } from "../types";

export default function Notifications() {
  const [items, setItems] = useState<Notification[] | null>(null);

  useEffect(() => {
    api<Notification[]>("/api/notifications")
      .then(setItems)
      .catch(() => setItems([]));
    // mark all read on visit
    api("/api/notifications/mark-all-read", { method: "POST" }).catch(() => {});
  }, []);

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-5 pt-6 pb-10">
      <h1 className="font-display font-extrabold text-3xl tracking-tight mb-1">
        Notifications
      </h1>
      <p className="text-text-secondary text-sm mb-5">
        Up & Overs, comments, and new follows on your sessions.
      </p>

      {items === null ? (
        <div className="text-text-tertiary">loading…</div>
      ) : items.length === 0 ? (
        <div className="card p-8 text-center text-text-secondary">
          No notifications yet. Post something so the world can see it.
        </div>
      ) : (
        <div className="card divide-y divide-border-subtle">
          {items.map((n) => {
            const isUnread = !n.read_at;
            const verb =
              n.type === "kudos"
                ? "Up & Over'd your post"
                : n.type === "comment"
                  ? "commented on your post"
                  : n.type === "follow"
                    ? "started following you"
                    : "did something";
            return (
              <Link
                key={n.id}
                to={
                  n.type === "follow" && n.actor_handle
                    ? `/u/${n.actor_handle}`
                    : n.post_id
                      ? `/p/${n.post_id}`
                      : "/"
                }
                className={
                  "flex items-start gap-3 p-4 hover:bg-bg-raised/30 " +
                  (isUnread ? "bg-bg-base/40" : "")
                }
              >
                <Avatar seed={n.actor_seed ?? n.actor_handle ?? "?"} size={36} url={null} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm">
                    <span className="font-semibold">{n.actor_name ?? "Someone"}</span>{" "}
                    <span className="text-text-secondary">{verb}</span>
                  </div>
                  {n.comment_body && (
                    <div className="text-sm text-text-secondary mt-0.5 truncate italic">
                      "{n.comment_body}"
                    </div>
                  )}
                  <div className="text-[11px] text-text-tertiary mt-1">{relTime(n.created_at)}</div>
                </div>
                {isUnread && (
                  <div className="w-2 h-2 rounded-full bg-accent shrink-0 mt-2" />
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
