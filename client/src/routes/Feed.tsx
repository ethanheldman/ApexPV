import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import type { Post } from "../types";
import PostCard from "../components/PostCard";
import { useAuth } from "../auth";
import { useUnit } from "../lib/unit";

export default function Feed() {
  const { user } = useAuth();
  const { fmt } = useUnit();
  const [posts, setPosts] = useState<Post[] | null>(null);

  useEffect(() => {
    api<Post[]>("/api/feed").then(setPosts).catch(() => setPosts([]));
  }, []);

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-5 pt-6 pb-10">
      <div className="flex items-end justify-between mb-5">
        <div>
          <h1 className="font-display font-extrabold text-3xl tracking-tight">
            Your feed
          </h1>
          <p className="text-text-secondary text-sm mt-1">
            From you and the vaulters you follow.
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/meet" className="btn-ghost">Meet Mode</Link>
          <Link to="/log" className="btn-accent">+ Log session</Link>
        </div>
      </div>

      {user?.pr_height_mm && (
        <div className="card p-4 mb-5 flex items-center gap-4 bg-gradient-to-br from-bg-base to-bg-raised">
          <div className="font-display font-extrabold text-4xl">
            {fmt(user.pr_height_mm)}
          </div>
          <div className="flex-1">
            <div className="label">Your standing PR</div>
            <div className="text-sm text-text-secondary mt-0.5">
              {user.pr_date && `set ${new Date(user.pr_date).toLocaleDateString()}`}
            </div>
          </div>
          <Link to={`/u/${user.handle}`} className="btn-ghost">
            View profile →
          </Link>
        </div>
      )}

      {posts === null ? (
        <div className="text-text-tertiary text-center py-10">loading…</div>
      ) : posts.length === 0 ? (
        <div className="card p-8 text-center">
          <div className="font-display font-bold text-xl">Quiet around here</div>
          <p className="text-text-secondary text-sm mt-1">
            Follow some vaulters or log your first session to fill the feed.
          </p>
          <Link to="/discover" className="btn-primary mt-4 inline-flex">
            Discover athletes
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((p) => (
            <PostCard key={p.id} post={p} />
          ))}
        </div>
      )}
    </div>
  );
}
