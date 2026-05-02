import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api";
import type { Post, User } from "../types";
import PostCard from "../components/PostCard";
import { Link } from "react-router-dom";
import Avatar from "../components/Avatar";
import { GENDER_LABEL, LEVEL_LABEL } from "../lib/format";
import { useUnit } from "../lib/unit";

export default function Discover() {
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [users, setUsers] = useState<User[] | null>(null);
  const [params, setParams] = useSearchParams();
  const { fmt } = useUnit();
  const gender = params.get("gender") ?? "";
  const level = params.get("level") ?? "";

  useEffect(() => {
    const qs = new URLSearchParams();
    if (gender) qs.set("gender", gender);
    if (level) qs.set("level", level);
    api<Post[]>(`/api/feed/discover${qs.toString() ? "?" + qs.toString() : ""}`)
      .then(setPosts)
      .catch(() => setPosts([]));
    api<User[]>(`/api/users${qs.toString() ? "?" + qs.toString() : ""}`)
      .then(setUsers)
      .catch(() => setUsers([]));
  }, [gender, level]);

  const setFilter = (key: "gender" | "level", val: string) => {
    const next = new URLSearchParams(params);
    if (val) next.set(key, val);
    else next.delete(key);
    setParams(next);
  };

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-5 pt-6 pb-10 grid lg:grid-cols-[1fr_280px] gap-6">
      <div>
        <div className="flex items-end justify-between mb-3">
          <h1 className="font-display font-extrabold text-3xl tracking-tight">Discover</h1>
        </div>

        <div className="flex flex-wrap gap-1.5 mb-4">
          <FilterChip label="All divisions" active={!gender} onClick={() => setFilter("gender", "")} />
          {(["m", "f", "x"] as const).map((g) => (
            <FilterChip
              key={g}
              label={GENDER_LABEL[g]}
              active={gender === g}
              onClick={() => setFilter("gender", g)}
            />
          ))}
          <span className="w-px h-6 bg-stone-200 mx-1.5 self-center" />
          <FilterChip label="All levels" active={!level} onClick={() => setFilter("level", "")} />
          {(["hs", "college", "open", "masters"] as const).map((l) => (
            <FilterChip
              key={l}
              label={LEVEL_LABEL[l]}
              active={level === l}
              onClick={() => setFilter("level", l)}
            />
          ))}
        </div>

        {posts === null ? (
          <div className="text-stone-400">loading…</div>
        ) : posts.length === 0 ? (
          <div className="card p-6 text-stone-500">No public posts match those filters.</div>
        ) : (
          <div className="space-y-4">
            {posts.map((p) => (
              <PostCard key={p.id} post={p} />
            ))}
          </div>
        )}
      </div>

      <aside className="space-y-4">
        <div className="card p-4">
          <div className="label mb-2">Athletes</div>
          <div className="space-y-2">
            {(users ?? []).map((u) => (
              <Link
                key={u.id}
                to={`/u/${u.handle}`}
                className="flex items-center gap-3 hover:bg-stone-50 rounded-lg p-1.5 -m-1.5"
              >
                <Avatar seed={u.avatar_seed ?? u.handle} url={u.avatar_url} size={36} />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm truncate">{u.display_name}</div>
                  <div className="text-[11px] text-stone-500 truncate">
                    @{u.handle}
                    {u.school && ` · ${u.school}`}
                  </div>
                </div>
                {u.pr_height_mm && (
                  <div className="font-mono text-xs text-stone-700">
                    {fmt(u.pr_height_mm)}
                  </div>
                )}
              </Link>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "px-2.5 py-1 rounded-full text-[12px] font-semibold transition-colors " +
        (active ? "bg-ink text-cream" : "bg-stone-100 text-stone-700 hover:bg-stone-200")
      }
    >
      {label}
    </button>
  );
}
