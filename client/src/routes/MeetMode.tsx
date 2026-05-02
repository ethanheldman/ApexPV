import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { ftInToMm, mmToFtIn, poleLenToFtIn, RESULT_COLOR, RESULT_LABEL, todayLocal } from "../lib/format";
import { useUnit } from "../lib/unit";
import type { Attempt, Pole, Session } from "../types";

// Clean imperial increments — every 6", from 9'0" up to 18'0".
const HEIGHTS: { ft: number; in: number }[] = [];
for (let ft = 9; ft <= 18; ft++) {
  HEIGHTS.push({ ft, in: 0 });
  if (ft < 18) HEIGHTS.push({ ft, in: 6 });
}

export default function MeetMode() {
  const { id: routeId } = useParams();
  const nav = useNavigate();
  const { fmt } = useUnit();
  const [session, setSession] = useState<Session | null>(null);
  const [poles, setPoles] = useState<Pole[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [activeHeight, setActiveHeight] = useState({ ft: 13, in: 0 });
  const [poleId, setPoleId] = useState<number>(0);

  useEffect(() => {
    api<Pole[]>("/api/poles/mine").then((ps) => {
      const active = ps.filter((p) => !p.retired);
      setPoles(active);
      if (active.length && !poleId) setPoleId(active[0].id);
    });
    if (routeId) {
      api<Session & { attempts: Attempt[] }>(`/api/sessions/${routeId}`).then((s) => {
        setSession(s);
        setAttempts(s.attempts ?? []);
      });
    } else {
      api<Session>("/api/sessions", {
        method: "POST",
        json: {
          type: "meet",
          date: todayLocal(),
          location: null,
          surface: "outdoor",
          energy: 5,
        },
      }).then((s) => {
        setSession(s);
        nav(`/meet/${s.id}`, { replace: true });
      });
    }
  }, [routeId]);

  // Map old "no_jump" key requests to new "pass" if any external caller still uses it
  const log = async (result: Attempt["result"]) => {
    if (!session) return;
    const mm = ftInToMm(activeHeight.ft, activeHeight.in);
    const a = await api<Attempt>("/api/attempts", {
      method: "POST",
      json: {
        session_id: session.id,
        bar_height_mm: mm,
        result,
        pole_id: poleId || null,
      },
    });
    setAttempts((cur) => [...cur, a]);
    if (result === "clear") {
      const next = HEIGHTS.find(
        (h) => h.ft * 12 + h.in > activeHeight.ft * 12 + activeHeight.in,
      );
      if (next) setActiveHeight(next);
    }
  };

  const finish = async () => {
    if (!session) return;
    // Meet sessions auto-post — fetch the existing post id and navigate there.
    const fresh = await api<Session & { auto_post_id?: number | null }>(
      `/api/sessions/${session.id}`,
    );
    if (fresh.auto_post_id) {
      nav(`/p/${fresh.auto_post_id}`);
    } else {
      // No attempts logged yet — just go home
      nav("/");
    }
  };

  const mmActive = ftInToMm(activeHeight.ft, activeHeight.in);
  const atHeight = attempts.filter((a) => a.bar_height_mm === mmActive);
  const cleared = attempts.filter((a) => a.result === "clear");
  const topClear = cleared.length ? Math.max(...cleared.map((a) => a.bar_height_mm)) : 0;

  return (
    <div className="mx-auto max-w-md px-4 sm:px-5 pt-4 pb-10">
      <div className="flex items-center justify-between mb-3">
        <div className="font-display font-extrabold text-2xl tracking-tight">Meet Mode</div>
        <button onClick={finish} className="btn-primary text-sm !py-1.5 !px-3">
          Finish & post
        </button>
      </div>
      <div className="text-xs text-stone-500 mb-4">
        Three-tap logging. Notes & details after.
      </div>

      <div className="card p-4 mb-3">
        <div className="label mb-2">Bar height</div>
        <div className="flex items-baseline gap-3 mb-3">
          <div className="font-display font-extrabold text-5xl tracking-tight">
            {fmt(mmActive)}
          </div>
          <div className="font-mono text-stone-500">{(mmActive / 1000).toFixed(2)}m</div>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {HEIGHTS.map((h) => {
            const mm = ftInToMm(h.ft, h.in);
            const on = mm === mmActive;
            return (
              <button
                key={`${h.ft}-${h.in}`}
                onClick={() => setActiveHeight(h)}
                className={
                  "py-2 rounded-lg text-xs font-bold " +
                  (on ? "bg-ink text-cream" : "bg-stone-100 text-stone-700 hover:bg-stone-200")
                }
              >
                {fmt(mm)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="card p-4 mb-3">
        <div className="label mb-2">Pole</div>
        <select
          className="input"
          value={poleId}
          onChange={(e) => setPoleId(Number(e.target.value))}
        >
          <option value={0}>— none —</option>
          {poles.map((p) => (
            <option key={p.id} value={p.id}>
              {poleLenToFtIn(p.length_in)} / {p.weight_lb}lb{" "}
              {p.nickname ? `· ${p.nickname}` : ""}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <button
          onClick={() => log("clear")}
          className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-5 rounded-2xl text-lg"
        >
          ✓ Clear
        </button>
        <button
          onClick={() => log("knock")}
          className="bg-rose-500 hover:bg-rose-600 text-white font-bold py-5 rounded-2xl text-lg"
        >
          ✗ Knock
        </button>
        <button
          onClick={() => log("pass")}
          className="bg-amber-500 hover:bg-amber-600 text-white font-bold py-5 rounded-2xl text-lg"
        >
          → Pass
        </button>
      </div>

      <div className="card p-3 mb-3">
        <div className="flex justify-between items-center mb-2">
          <div className="label">At {fmt(mmActive)}</div>
          <div className="text-xs text-stone-500">{atHeight.length} attempt(s)</div>
        </div>
        <div className="flex gap-1.5">
          {[1, 2, 3].map((n) => {
            const a = atHeight[n - 1];
            return (
              <div
                key={n}
                className={
                  "flex-1 rounded-lg py-2.5 text-center text-xs font-bold " +
                  (a ? RESULT_COLOR[a.result] : "bg-stone-50 text-stone-300")
                }
              >
                {a ? RESULT_LABEL[a.result].split(" ")[0] : `${n}`}
              </div>
            );
          })}
        </div>
      </div>

      <div className="card p-4">
        <div className="flex justify-between mb-1">
          <div className="label">Top clearance</div>
          <div className="text-xs text-stone-500">{cleared.length} clears</div>
        </div>
        <div className="font-display font-extrabold text-3xl tracking-tight">
          {topClear ? fmt(topClear) : "—"}
        </div>
      </div>
    </div>
  );
}
