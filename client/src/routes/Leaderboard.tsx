import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api";
import Avatar from "../components/Avatar";
import { mmToFtIn, mmToMeters, GENDER_LABEL, LEVEL_LABEL } from "../lib/format";
import { useUnit } from "../lib/unit";

type Row = {
  handle: string;
  display_name: string;
  school: string | null;
  avatar_seed: string | null;
  pr_height_mm: number | null;
  pr_date: string | null;
  gender: string | null;
  level: string | null;
  rank: number;
  tied: boolean;
};

export default function Leaderboard() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [params, setParams] = useSearchParams();
  const { unit, fmt } = useUnit();
  const gender = params.get("gender") ?? "";
  const level = params.get("level") ?? "";

  useEffect(() => {
    const qs = new URLSearchParams();
    if (gender) qs.set("gender", gender);
    if (level) qs.set("level", level);
    api<Row[]>(`/api/feed/leaderboard${qs.toString() ? "?" + qs.toString() : ""}`)
      .then(setRows)
      .catch(() => setRows([]));
  }, [gender, level]);

  const setFilter = (key: "gender" | "level", val: string) => {
    const next = new URLSearchParams(params);
    if (val) next.set(key, val);
    else next.delete(key);
    setParams(next);
  };

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-5 pt-6 pb-10">
      <h1 className="font-display font-extrabold text-3xl tracking-tight mb-2">
        Leaderboard
      </h1>
      <p className="text-stone-500 text-sm mb-4">
        Standing PRs. Ties broken by earliest date set.
      </p>

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

      {!rows ? (
        <div className="text-stone-400">loading…</div>
      ) : rows.length === 0 ? (
        <div className="card p-6 text-center text-stone-500">No vaulters match those filters.</div>
      ) : (
        <div className="card divide-y divide-stone-100">
          {rows.map((r) => (
            <Link
              key={r.handle}
              to={`/u/${r.handle}`}
              className="flex items-center gap-4 p-4 hover:bg-stone-50"
            >
              <div
                className={
                  "w-10 text-center font-mono font-bold " +
                  (r.rank === 1
                    ? "text-amber-500"
                    : r.rank === 2
                      ? "text-stone-500"
                      : r.rank === 3
                        ? "text-orange-700"
                        : "text-stone-400")
                }
                title={r.tied ? "Tie broken by earliest date set" : ""}
              >
                {r.tied ? `T-${r.rank}` : r.rank}
              </div>
              <Avatar seed={r.avatar_seed ?? r.handle} url={(r as any).avatar_url} size={40} />
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">{r.display_name}</div>
                <div className="text-xs text-stone-500 truncate">
                  @{r.handle}
                  {r.school && ` · ${r.school}`}
                  {r.level && ` · ${LEVEL_LABEL[r.level] ?? r.level}`}
                </div>
              </div>
              <div className="text-right">
                <div className="font-display font-extrabold text-xl tracking-tight">
                  {fmt(r.pr_height_mm)}
                </div>
                <div className="text-[11px] text-stone-400">
                  {unit === "metric" ? mmToFtIn(r.pr_height_mm) : mmToMeters(r.pr_height_mm)}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
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
