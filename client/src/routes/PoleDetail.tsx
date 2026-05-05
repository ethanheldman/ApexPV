import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import Avatar from "../components/Avatar";
import AttemptRow from "../components/AttemptRow";
import NotFound from "../components/NotFound";
import {
  fmtDate,
  mmToMeters,
  poleLenToFtIn,
  stepStatus,
  STEP_STATUS_COLOR,
  STEP_STATUS_LABEL,
  STEP_TOLERANCE_IN,
} from "../lib/format";
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

  const [editingTarget, setEditingTarget] = useState(false);
  const [targetDraft, setTargetDraft] = useState<string>("");
  const [savingTarget, setSavingTarget] = useState(false);

  useEffect(() => {
    if (!id) return;
    api<PoleDetailResp>(`/api/poles/${id}`)
      .then((d) => {
        setData(d);
        setTargetDraft(d.target_step_in == null ? "" : String(d.target_step_in));
      })
      .catch((e: any) => {
        if (e.message?.includes("not found") || e.message?.startsWith("404"))
          setNotFound(true);
      });
  }, [id]);

  const saveTarget = async () => {
    if (!data) return;
    setSavingTarget(true);
    try {
      const next = targetDraft.trim() === "" ? null : Number(targetDraft);
      await api(`/api/poles/${data.id}`, {
        method: "PATCH",
        json: { target_step_in: next },
      });
      setData({ ...data, target_step_in: next });
      setEditingTarget(false);
    } catch (e: any) {
      // Surface as alert for now; could route through a toast system later.
      alert(e.message ?? "save failed");
    } finally {
      setSavingTarget(false);
    }
  };

  // Group attempts by session_id so the list reads as "session block + attempts".
  const grouped = useMemo(() => {
    if (!data) return [];
    const out: {
      sessionId: number;
      date: string;
      type: string;
      location: string | null;
      attempts: AttemptWithSession[];
    }[] = [];
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

  // Aggregate step quality across all attempts on this pole. Computed
  // client-side from the attempt list — no extra round trip needed since the
  // pole detail endpoint already returns every attempt.
  const stepBreakdown = useMemo(() => {
    if (!data) return { under: 0, on: 0, out: 0, untagged: 0 };
    const target = data.target_step_in;
    let under = 0, on = 0, out = 0, untagged = 0;
    for (const a of data.attempts) {
      const s = stepStatus(a.step_in, target);
      if (s === "under") under++;
      else if (s === "on") on++;
      else if (s === "out") out++;
      else untagged++;
    }
    return { under, on, out, untagged };
  }, [data]);

  if (notFound) return <NotFound subject="pole" />;
  if (!data) return <div className="px-5 pt-6 text-stone-400">loading…</div>;

  const clearRate =
    data.stats.total_attempts > 0
      ? Math.round((data.stats.clears / data.stats.total_attempts) * 100)
      : 0;
  const stepTagged =
    stepBreakdown.under + stepBreakdown.on + stepBreakdown.out;

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

        {/* Target step row — read-only for non-owners, inline editable for owner. */}
        <div className="mt-4 pt-4 border-t border-stone-100">
          <div className="flex items-baseline justify-between gap-3">
            <div className="label">target step (in from box)</div>
            {data.is_owner && !editingTarget && (
              <button
                onClick={() => setEditingTarget(true)}
                className="text-xs text-stone-500 hover:text-ink hover:underline"
              >
                {data.target_step_in == null ? "set target" : "edit"}
              </button>
            )}
          </div>
          {editingTarget && data.is_owner ? (
            <div className="mt-2 flex items-center gap-2">
              <input
                type="number"
                step="0.5"
                min={0}
                max={200}
                inputMode="decimal"
                className="input flex-1"
                value={targetDraft}
                onChange={(e) => setTargetDraft(e.target.value)}
                placeholder="e.g. 102"
                autoFocus
              />
              <button
                onClick={saveTarget}
                disabled={savingTarget}
                className="btn-primary text-sm !py-1.5 !px-3"
              >
                {savingTarget ? "…" : "Save"}
              </button>
              <button
                onClick={() => {
                  setEditingTarget(false);
                  setTargetDraft(
                    data.target_step_in == null ? "" : String(data.target_step_in),
                  );
                }}
                disabled={savingTarget}
                className="btn-ghost text-sm !py-1.5 !px-3"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="mt-1 font-display font-extrabold text-2xl tracking-tight">
              {data.target_step_in == null
                ? <span className="text-stone-400 text-base font-normal italic">no target set</span>
                : <>{data.target_step_in}<span className="text-stone-400 text-base font-normal">"</span></>}
            </div>
          )}
          {data.target_step_in != null && (
            <p className="text-[11px] text-stone-500 mt-1">
              Attempts within ±{STEP_TOLERANCE_IN}" of this are tagged{" "}
              <strong>on</strong>; closer than that to the box →{" "}
              <strong>under</strong>; further out → <strong>out</strong>.
            </p>
          )}
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

      {/* Step quality breakdown — only meaningful when a target is set + at
          least one attempt has been tagged. */}
      {data.target_step_in != null && stepTagged > 0 && (
        <div className="card p-5 mb-4">
          <div className="label mb-3">
            Step quality · {stepTagged} attempt{stepTagged === 1 ? "" : "s"} tagged
          </div>
          <div className="space-y-2">
            <StepBar
              label="Under"
              count={stepBreakdown.under}
              total={stepTagged}
              colorClass="bg-rose-500"
              hint="took off too close to the box"
            />
            <StepBar
              label="On"
              count={stepBreakdown.on}
              total={stepTagged}
              colorClass="bg-emerald-500"
              hint={`within ±${STEP_TOLERANCE_IN}"`}
            />
            <StepBar
              label="Out"
              count={stepBreakdown.out}
              total={stepTagged}
              colorClass="bg-amber-500"
              hint="took off too far from the box"
            />
          </div>
          {stepBreakdown.untagged > 0 && (
            <p className="text-[11px] text-stone-500 mt-3">
              {stepBreakdown.untagged} attempt{stepBreakdown.untagged === 1 ? "" : "s"}{" "}
              {stepBreakdown.untagged === 1 ? "had" : "had"} no logged step.
            </p>
          )}
        </div>
      )}

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
                {g.attempts.map((a, i) => {
                  const status = stepStatus(a.step_in, data.target_step_in);
                  return (
                    <div key={a.id} className="grid grid-cols-[1fr_auto] items-center px-1">
                      <AttemptRow attempt={a} index={a.ordinal ?? i + 1} />
                      {status && (
                        <span
                          className={
                            "pill mr-3 " + STEP_STATUS_COLOR[status]
                          }
                          title={
                            a.step_in != null && data.target_step_in != null
                              ? `step ${a.step_in}\" vs target ${data.target_step_in}\"`
                              : ""
                          }
                        >
                          {STEP_STATUS_LABEL[status]}
                        </span>
                      )}
                    </div>
                  );
                })}
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

function StepBar({
  label,
  count,
  total,
  colorClass,
  hint,
}: {
  label: string;
  count: number;
  total: number;
  colorClass: string;
  hint?: string;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs mb-1">
        <span className="font-semibold text-stone-700">
          {label}
          {hint && <span className="text-stone-400 font-normal italic ml-1">— {hint}</span>}
        </span>
        <span className="font-mono text-stone-500">
          {count} <span className="text-stone-400">({pct}%)</span>
        </span>
      </div>
      <div className="h-2 rounded-full bg-stone-100 overflow-hidden">
        <div
          className={"h-full " + colorClass}
          style={{ width: total > 0 ? `${(count / total) * 100}%` : "0%" }}
        />
      </div>
    </div>
  );
}
