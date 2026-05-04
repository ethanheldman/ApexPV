import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import Avatar from "../components/Avatar";
import PostCard from "../components/PostCard";
import NotFound from "../components/NotFound";
import { mmToFtIn, mmToMeters, ftInToMm, poleLenToFtIn, GENDER_LABEL, LEVEL_LABEL } from "../lib/format";
import { useUnit } from "../lib/unit";
import { MISS_TAG_LABEL } from "../lib/missTags";
import type { Pole, Post, User } from "../types";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceDot,
} from "recharts";

type PostsResp = { posts: Post[]; hidden_count: number };

/** Generate axis ticks snapped to 6" imperial increments around a mm range. */
function imperialTicks(minMm: number, maxMm: number): number[] {
  // Round outward to nearest 6" (152.4 mm)
  const stepMm = ftInToMm(0, 6);
  const lower = Math.floor(minMm / stepMm) * stepMm;
  const upper = Math.ceil(maxMm / stepMm) * stepMm;
  const ticks: number[] = [];
  for (let v = lower; v <= upper; v += stepMm) ticks.push(v);
  return ticks;
}

export default function Profile() {
  const { handle } = useParams();
  const { user: me } = useAuth();
  const { unit, fmt } = useUnit();
  const [user, setUser] = useState<User | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [hiddenCount, setHiddenCount] = useState(0);
  const [poles, setPoles] = useState<Pole[]>([]);
  const [progression, setProgression] = useState<{ date: string; height: number }[]>([]);
  const [missCounts, setMissCounts] = useState<{ tag: string; count: number }[]>([]);
  const [following, setFollowing] = useState<boolean | null>(null);
  const [tab, setTab] = useState<"posts" | "stats" | "poles">("posts");

  const fetchAll = useCallback(async () => {
    if (!handle) return;
    try {
      const u = await api<User>(`/api/users/${handle}`);
      setUser(u);
      setNotFound(false);
    } catch (e: any) {
      if (e.message?.includes("not found") || e.message?.startsWith("404")) {
        setNotFound(true);
        setUser(null);
        return;
      }
    }
    api<PostsResp>(`/api/posts/by/${handle}`)
      .then((r) => {
        setPosts(r.posts);
        setHiddenCount(r.hidden_count);
      })
      .catch(() => {
        setPosts([]);
        setHiddenCount(0);
      });
    api<Pole[]>(`/api/poles/by/${handle}`).then(setPoles).catch(() => setPoles([]));
    api<{ date: string; height: number }[]>(`/api/attempts/stats/${handle}/progression`)
      .then(setProgression)
      .catch(() => setProgression([]));
    api<{ tag: string; count: number }[]>(`/api/attempts/stats/${handle}/miss-tags`)
      .then(setMissCounts)
      .catch(() => setMissCounts([]));

    if (me && me.handle !== handle) {
      api<{ following: boolean }>(`/api/users/${handle}/follow-status`)
        .then((r) => setFollowing(r.following))
        .catch(() => setFollowing(false));
    } else {
      setFollowing(null);
    }
  }, [handle, me]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const toggleFollow = async () => {
    if (!handle || following === null) return;
    const willFollow = !following;
    setFollowing(willFollow);
    try {
      if (willFollow) await api(`/api/users/${handle}/follow`, { method: "POST" });
      else await api(`/api/users/${handle}/follow`, { method: "DELETE" });
      // BUG-12: refetch user counts so follower count updates
      const u = await api<User>(`/api/users/${handle}`);
      setUser(u);
      // BUG-13: also refetch posts; new follower may unlock followers-only posts
      const pr = await api<PostsResp>(`/api/posts/by/${handle}`);
      setPosts(pr.posts);
      setHiddenCount(pr.hidden_count);
    } catch {
      setFollowing(!willFollow);
    }
  };

  const chartData = useMemo(
    () =>
      progression.map((p) => ({
        date: p.date,
        mm: p.height,
      })),
    [progression],
  );
  const peakIdx = chartData.length
    ? chartData.reduce((m, p, i) => (p.mm > chartData[m].mm ? i : m), 0)
    : -1;
  const yMin = chartData.length ? Math.min(...chartData.map((d) => d.mm)) : 0;
  const yMax = chartData.length ? Math.max(...chartData.map((d) => d.mm)) : 0;
  const yTicks = chartData.length ? imperialTicks(yMin - ftInToMm(0, 6), yMax + ftInToMm(0, 6)) : [];

  if (notFound) {
    return (
      <NotFound
        subject="vaulter"
        detail={handle ? `No vaulter @${handle} on Apex.` : undefined}
      />
    );
  }
  if (!user) return <div className="px-5 pt-6 text-text-tertiary">loading…</div>;

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-5 pt-6 pb-10">
      <div className="card p-5 sm:p-6 mb-6">
        <div className="flex items-start gap-4 sm:gap-5">
          <Avatar
            seed={user.avatar_seed ?? user.handle}
            url={user.avatar_url}
            size={64}
          />
          <div className="flex-1 min-w-0">
            <h1 className="font-display font-extrabold text-2xl sm:text-3xl tracking-tight leading-tight">
              {user.display_name}
            </h1>
            <div className="text-text-secondary text-sm break-words">
              @{user.handle}
              {user.school && ` · ${user.school}`}
              {user.gender && ` · ${GENDER_LABEL[user.gender]}`}
              {user.level && ` · ${LEVEL_LABEL[user.level]}`}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="label">PR</div>
            <div className="font-display font-extrabold text-2xl sm:text-3xl tracking-tight">
              {fmt(user.pr_height_mm)}
            </div>
            <div className="text-[11px] text-text-tertiary">
              {unit === "metric" ? mmToFtIn(user.pr_height_mm) : mmToMeters(user.pr_height_mm)}
            </div>
          </div>
        </div>

        {user.bio && <p className="text-sm text-text-primary mt-3">{user.bio}</p>}

        <div className="flex flex-wrap gap-x-5 gap-y-2 mt-4 text-sm">
          <div>
            <span className="font-semibold">{user.followers ?? 0}</span>{" "}
            <span className="text-text-secondary">followers</span>
          </div>
          <div>
            <span className="font-semibold">{user.following ?? 0}</span>{" "}
            <span className="text-text-secondary">following</span>
          </div>
          <div>
            <span className="font-semibold">{user.total_attempts ?? 0}</span>{" "}
            <span className="text-text-secondary">attempts</span>
          </div>
          <div>
            <span className="font-semibold">{user.total_clearances ?? 0}</span>{" "}
            <span className="text-text-secondary">clearances</span>
          </div>
        </div>

        {following !== null && (
          <button
            onClick={toggleFollow}
            className={(following ? "btn-ghost" : "btn-primary") + " mt-4 w-full sm:w-auto"}
          >
            {following ? "Following" : "Follow"}
          </button>
        )}
      </div>

      <div className="flex gap-1 mb-4">
        {(["posts", "stats", "poles"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={
              "px-4 py-1.5 text-sm font-semibold rounded-lg " +
              (tab === t
                ? "bg-bg-sunken text-text-primary"
                : "bg-bg-raised text-text-secondary hover:bg-bg-raised")
            }
          >
            {t === "posts" ? "Posts" : t === "stats" ? "Stats" : "Pole bag"}
          </button>
        ))}
      </div>

      {tab === "posts" && (
        <div className="space-y-4">
          {posts.length === 0 ? (
            <div className="card p-6 text-center">
              {hiddenCount > 0 ? (
                <>
                  <div className="font-display font-bold text-lg">
                    @{user.handle} keeps their training private.
                  </div>
                  <p className="text-text-secondary text-sm mt-2">
                    {hiddenCount} {hiddenCount === 1 ? "post is" : "posts are"} hidden from you.
                    {following === false && me && me.handle !== user.handle && (
                      <> Follow them to see followers-only sessions.</>
                    )}
                  </p>
                </>
              ) : (
                <div className="text-text-secondary">No posts to show.</div>
              )}
            </div>
          ) : (
            <>
              {posts.map((p) => (
                <PostCard key={p.id} post={p} />
              ))}
              {hiddenCount > 0 && (
                <div className="text-center text-xs text-text-tertiary py-2">
                  + {hiddenCount} more hidden by privacy settings
                </div>
              )}
            </>
          )}
        </div>
      )}

      {tab === "stats" && (
        <div className="space-y-4">
          <div className="card p-5">
            <div className="flex items-baseline justify-between mb-2">
              <div className="label">Clearance progression</div>
              {chartData.length > 0 && (
                <div className="text-xs text-text-secondary">
                  apex: <span className="font-bold text-text-primary">{fmt(yMax)}</span>
                </div>
              )}
            </div>
            {chartData.length === 0 ? (
              <div className="text-text-tertiary text-sm py-12 text-center">No clearances yet.</div>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 4, left: 12 }}>
                    <CartesianGrid stroke="#e7e5e4" strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11, fill: "#78716c" }}
                      tickFormatter={(s) => {
                        const d = new Date(s + "T12:00:00");
                        return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
                      }}
                    />
                    <YAxis
                      type="number"
                      domain={[
                        () => yMin - ftInToMm(0, 6),
                        () => yMax + ftInToMm(0, 6),
                      ] as any}
                      ticks={yTicks}
                      tick={{ fontSize: 11, fill: "#78716c" }}
                      tickFormatter={(v) => fmt(v as number)}
                      width={62}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#0c0a09",
                        color: "#f7f5f0",
                        border: "none",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                      formatter={(v: any) => [fmt(v as number), "Apex"]}
                      labelFormatter={(s) => s}
                    />
                    <Line
                      type="monotone"
                      dataKey="mm"
                      stroke="#ff5a1f"
                      strokeWidth={2.5}
                      dot={{ r: 3, stroke: "#ff5a1f", fill: "#fff", strokeWidth: 2 }}
                      activeDot={{ r: 5 }}
                    />
                    {peakIdx >= 0 && (
                      <ReferenceDot
                        x={chartData[peakIdx].date}
                        y={chartData[peakIdx].mm}
                        r={6}
                        fill="#ff5a1f"
                        stroke="#fff"
                        strokeWidth={2}
                      />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="card p-5">
            <div className="label mb-3">Why misses happen</div>
            {missCounts.length === 0 ? (
              <div className="text-text-tertiary text-sm">No tagged misses yet.</div>
            ) : (
              <div className="space-y-1.5">
                {missCounts.map((m) => {
                  const max = missCounts[0].count;
                  const pct = (m.count / max) * 100;
                  return (
                    <div key={m.tag}>
                      <div className="flex justify-between text-xs mb-0.5">
                        <span className="text-text-primary">{MISS_TAG_LABEL[m.tag] ?? m.tag}</span>
                        <span className="text-text-secondary font-mono">{m.count}</span>
                      </div>
                      <div className="h-2 rounded-full bg-bg-raised overflow-hidden">
                        <div
                          className="h-full bg-accent/80"
                          style={{ width: `${Math.max(8, pct)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "poles" && (
        <div className="grid sm:grid-cols-2 gap-3">
          {poles.length === 0 ? (
            <div className="card p-6 text-text-secondary sm:col-span-2 text-center">
              No poles in the bag.
            </div>
          ) : (
            poles.map((p) => (
              <Link
                key={p.id}
                to={`/poles/${p.id}`}
                className={"card p-4 hover:shadow-sm transition-shadow " + (p.retired ? "opacity-60" : "")}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-display font-bold text-xl">
                      {poleLenToFtIn(p.length_in)} / {p.weight_lb}lb
                    </div>
                    <div className="text-sm text-text-secondary">{p.make}</div>
                    {p.nickname && (
                      <div className="text-xs text-text-tertiary italic mt-0.5">"{p.nickname}"</div>
                    )}
                  </div>
                  {p.retired ? (
                    <span className="pill bg-bg-raised text-text-secondary">retired</span>
                  ) : (
                    <span className="pill bg-emerald-100 text-emerald-800">active</span>
                  )}
                </div>
                <div className="flex gap-3 mt-3 text-xs text-text-secondary">
                  {p.flex != null && <span>flex {p.flex}</span>}
                  <span>{p.attempts_count} attempts →</span>
                </div>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}
