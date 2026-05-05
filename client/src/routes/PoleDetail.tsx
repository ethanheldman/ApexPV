import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import Avatar from "../components/Avatar";
import AttemptRow from "../components/AttemptRow";
import NotFound from "../components/NotFound";
import { fmtDate, mmToMeters, poleLenToFtIn } from "../lib/format";
import { useUnit } from "../lib/unit";
import type { Attempt, Pole } from "../types";

type AttemptWithSession = Attempt & {
  session_date: string;
  session_type: "practice" | "meet";
  session_location: string | null;
  session_id: number;
};

type PoleDetailResp = Pole & {
  is_owner: boolean;
  owner: {
    handle: string;
    display_name: string;
    avatar_seed: string | null;
    avatar_url: string | null;
  };
  stats: {
    total_attempts: number;
    clears: number;
    knocks: number;
    passes: number;
    best_clearance_mm: number | null;
  };
  attempts: AttemptWithSession[];
};

export default function PoleDetail() {
  const { id } = useParams();
  const { user: me } = useAuth();
  const { fmt } = useUnit();
  const [data, setData] = useState<PoleDetailResp | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    api<PoleDetailResp>(`/api/poles/${id}`)
      .then(setData)
      .catch((e: any) => {
        if (e.message?.includes("not found") || e.message?.startsWith("404"))
          setNotFound(true);
      });
  }, [id]);

  // Group attempts by session_id so the list reads as "session block + its attempts"
  const grouped = useMemo(() => {
    if (!data) return [];
    const out: { sessionId: number; date: string; type: string; location: string | null; attempts: AttemptWithSession[] }[] = [];
    const seen: Record<number, number> = {};
    for (const a of data.attempts) {
      const key = a.session_id;
      if (seen[key] === undefined) {
        seen[key] = out.length;
        out.push({
          sessionId: key,
          date: a.session_date,
          type: a.session_type,
          location: a.session_location,
          attempts: [],
        });
      }
      out[seen[key]].attempts.push(a);
    }
    return out;
  }, [data]);

  if (notFound) return <NotFound subject="pole" />;
  if (!data) return <div className="px-5 pt-6 text-stone-400">loading…</div>;

  const clearRate =
    data.stats.total_attempts > 0
      ? Math.round((data.stats.clears / data.stats.total_attempts) * 100)
      : 0;

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-5 pt-6 pb-10">
      {/* Pole header */}
      <div className={"card p-5 mb-4 " + (data.retired ? "opacity-80" : "")}>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="label">
              {data.retired ? "retired pole" : "pole"}
              {" · "}
              <Link to={`/u/${data.owner.handle}`} className="hover:underline">
                @{data.owner.handle}
              </Link>
            </div>
            <h1 className="font-display font-extrabold text-3xl tracking-tight mt-1">
              {poleLenToFtIn(data.length_in)} / {data.weight_lb}lb
            </h1>
            <div className="text-stone-600 text-sm">
              {data.make}
              {data.flex != null && ` · flex ${data.flex}`}
            </div>
            {data.nickname && (
              <div className="text-stone-500 text-sm italic mt-1">"{data.nickname}"</div>
            )}
          </div>
          <Link to={data.is_owner ? "/poles" : `/u/${data.owner.handle}`}>
            <Avatar
              seed={data.owner.avatar_seed ?? data.owner.handle}
              url={data.owner.avatar_url}
              size={48}
            />
          </Link>
        </div>
      </div>

      {/* Stats card */}
      <div className="card p-5 mb-4">
        <div className="label mb-3">Lifetime on this pole</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label="Attempts" value={String(data.stats.total_attempts)} />
          <Stat label="Clears" value={String(data.stats.clears)} sub={`${clearRate}%`} />
          <Stat label="Knocks" value={String(data.stats.knocks)} />
          <Stat
            label="Best clearance"
            value={data.stats.best_clearance_mm ? fmt(data.stats.best_clearance_mm) : "—"}
            sub={data.stats.best_clearance_mm ? mmToMeters(data.stats.best_clearance_mm) : undefined}
          />
        </div>
      </div>

      {/* Attempt list — owner only */}
      {data.is_owner ? (
        grouped.length === 0 ? (
          <div className="card p-6 text-center text-stone-500">
            No attempts logged on this pole yet. Pick it on your next session.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="label">Attempts</div>
            {grouped.map((g) => (
              <div key={g.sessionId} className="card p-2">
                <Link
                  to={`/log/${g.sessionId}`}
                  className="flex items-baseline justify-between px-2 pt-2 pb-1 hover:bg-stone-50 rounded-lg"
                >
                  <div>
                    <div className="font-display font-bold text-sm capitalize">
                      {g.type} · {fmtDate(g.date)}
                    </div>
                    {g.location && (
                      <div className="text-[11px] text-stone-500">{g.location}</div>
                    )}
                  </div>
                  <div className="text-[11px] text-stone-400">
                    {g.attempts.length} attempt{g.attempts.length === 1 ? "" : "s"}
                  </div>
                </Link>
                {g.attempts.map((a, i) => (
                  <AttemptRow
                    key={a.id}
                    attempt={a}
                    index={a.ordinal ?? i + 1}
                  />
                ))}
              </div>
            ))}
          </div>
        )
      ) : (
        <div className="card p-5 text-sm text-stone-500">
          {me ? `Only @${data.owner.handle} can see attempts on this pole.` : (
            <>
              <Link to="/login" className="font-semibold text-ink underline">
                Sign in
              </Link>{" "}
              to see your own pole stats. Other people's attempt lists are private.
            </>
          )}
        </div>
      )}

      <div className="text-center mt-6">
        <Link
          to={data.is_owner ? "/poles" : `/u/${data.owner.handle}`}
          className="text-xs text-stone-500 hover:text-ink hover:underline"
        >
          ← {data.is_owner ? "back to your pole bag" : `back to @${data.owner.handle}`}
        </Link>
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <div className="label">{label}</div>
      <div className="font-display font-bold text-2xl tracking-tight">{value}</div>
      {sub && <div className="text-[11px] text-stone-400">{sub}</div>}
    </div>
  );
}
