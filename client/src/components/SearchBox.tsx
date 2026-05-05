import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import Avatar from "./Avatar";
import { mmToFtIn } from "../lib/format";

type Result = {
  users: { id: number; handle: string; display_name: string; school: string | null; avatar_seed: string | null; pr_height_mm: number | null }[];
  posts: { id: number; caption: string | null; handle: string; display_name: string; avatar_seed: string | null }[];
};

export default function SearchBox() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [res, setRes] = useState<Result | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const nav = useNavigate();

  useEffect(() => {
    if (q.trim().length < 1) {
      setRes(null);
      return;
    }
    const t = setTimeout(() => {
      api<Result>(`/api/search?q=${encodeURIComponent(q.trim())}`)
        .then(setRes)
        .catch(() => setRes(null));
    }, 150);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <input
        className="input !py-1.5 !px-3 w-44 sm:w-56 text-sm"
        placeholder="Search vaulters…"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && res?.users[0]) {
            nav(`/u/${res.users[0].handle}`);
            setOpen(false);
            setQ("");
          }
        }}
      />
      {open && q.trim() && res && (res.users.length || res.posts.length) > 0 && (
        <div className="absolute right-0 top-full mt-2 w-72 sm:w-80 card shadow-lg overflow-hidden z-40">
          {res.users.length > 0 && (
            <div className="p-2">
              <div className="label px-2 mb-1">Athletes</div>
              {res.users.map((u) => (
                <Link
                  key={u.id}
                  to={`/u/${u.handle}`}
                  onClick={() => {
                    setOpen(false);
                    setQ("");
                  }}
                  className="flex items-center gap-3 p-2 hover:bg-stone-50 rounded-lg"
                >
                  <Avatar seed={u.avatar_seed ?? u.handle} size={32} />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate">{u.display_name}</div>
                    <div className="text-[11px] text-stone-500 truncate">
                      @{u.handle}
                      {u.school && ` · ${u.school}`}
                    </div>
                  </div>
                  {u.pr_height_mm && (
                    <div className="font-mono text-[11px] text-stone-700">
                      {mmToFtIn(u.pr_height_mm)}
                    </div>
                  )}
                </Link>
              ))}
            </div>
          )}
          {res.posts.length > 0 && (
            <div className="border-t border-stone-100 p-2">
              <div className="label px-2 mb-1">Posts</div>
              {res.posts.map((p) => (
                <Link
                  key={p.id}
                  to={`/p/${p.id}`}
                  onClick={() => {
                    setOpen(false);
                    setQ("");
                  }}
                  className="block p-2 hover:bg-stone-50 rounded-lg"
                >
                  <div className="text-sm truncate">{p.caption}</div>
                  <div className="text-[11px] text-stone-500">@{p.handle}</div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
