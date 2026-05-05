import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import AttemptRow from "../components/AttemptRow";
import NotFound from "../components/NotFound";
import Avatar from "../components/Avatar";
import ConfirmDialog from "../components/ConfirmDialog";
import VideoDrop from "../components/VideoDrop";
import AddPoleDialog from "../components/AddPoleDialog";
import NumberField from "../components/NumberField";
import {
  ftInToMm,
  mmToFtIn,
  poleLenToFtIn,
  inchesToFtIn,
  ftInToInches,
  todayLocal,
  stepStatus,
  STEP_STATUS_COLOR,
  STEP_STATUS_LABEL,
} from "../lib/format";
import { useUnit } from "../lib/unit";
import { MISS_TAG_GROUPS } from "../lib/missTags";
import type { Attempt, Meet, Pole, Session } from "../types";

const RESULT_OPTS: { id: Attempt["result"]; label: string; color: string }[] = [
  { id: "clear", label: "Clear", color: "bg-emerald-500 text-white" },
  { id: "knock", label: "Knock", color: "bg-rose-500 text-white" },
  { id: "pass", label: "Pass", color: "bg-amber-500 text-white" },
  { id: "bail", label: "Bail", color: "bg-stone-400 text-white" },
];

export default function LogSession() {
  const { id: routeId } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const { fmt } = useUnit();
  const [step, setStep] = useState<"create" | "log">(routeId ? "log" : "create");
  const [session, setSession] = useState<(Session & { auto_post_id?: number | null }) | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [poles, setPoles] = useState<Pole[]>([]);
  const [otherPoles, setOtherPoles] = useState<Pole[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Attempt | null>(null);
  const [meetMatches, setMeetMatches] = useState<Meet[]>([]);
  const [meetMenuOpen, setMeetMenuOpen] = useState(false);
  const [addPoleOpen, setAddPoleOpen] = useState(false);

  const [meta, setMeta] = useState({
    type: "practice" as Session["type"],
    date: todayLocal(),
    location: "",
    surface: "indoor" as Session["surface"],
    energy: 4,
    notes: "",
    cuesHad: "",
    cuesWork: "",
    meetName: "",
    meetId: null as number | null,
  });

  const [att, setAtt] = useState({
    feet: 13,
    inches: 0,
    result: "clear" as Attempt["result"],
    poleId: 0 as number,
    gripFt: 12 as number | "",
    gripIn: 6 as number | "",
    step_in: "" as number | "",
    runUp: "" as number | "",
    missTags: [] as string[],
    notes: "",
    videoUrl: "",
  });
  const [attError, setAttError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    api<Pole[]>("/api/poles/mine").then((ps) => {
      setPoles(ps);
      if (ps.length > 0 && !att.poleId) setAtt((a) => ({ ...a, poleId: ps[0].id }));
    });
  }, [user]);

  useEffect(() => {
    if (!routeId) return;
    api<Session>(`/api/sessions/${routeId}`)
      .then(async (s: any) => {
        setSession(s);
        setAttempts(s.attempts ?? []);
        setStep("log");
        if (!s.is_owner && s.owner) {
          const them = await api<Pole[]>(`/api/poles/by/${s.owner.handle}`).catch(() => []);
          setOtherPoles(them);
        }
      })
      .catch((e) => {
        if (e.message?.includes("not found") || e.message?.startsWith("404"))
          setNotFound(true);
      });
  }, [routeId]);

  // Meet picker — load recent meets when the dropdown opens, refresh as the
  // user types. Empty query returns the most recent meets so users can pick
  // a meet someone else created without having to remember the exact name.
  useEffect(() => {
    if (meta.type !== "meet" || !meetMenuOpen) return;
    const t = setTimeout(() => {
      api<Meet[]>(
        `/api/meets/search${meta.meetName ? `?q=${encodeURIComponent(meta.meetName)}` : ""}`,
      )
        .then(setMeetMatches)
        .catch(() => setMeetMatches([]));
    }, 150);
    return () => clearTimeout(t);
  }, [meta.meetName, meta.type, meetMenuOpen]);

  // Click outside the meet picker to close it.
  useEffect(() => {
    if (!meetMenuOpen) return;
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest?.("[data-meet-picker]")) setMeetMenuOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [meetMenuOpen]);

  const heightMm = useMemo(() => ftInToMm(att.feet, att.inches), [att.feet, att.inches]);

  // Compute decimal grip inches from the ft+in pair (or null if either is empty)
  const gripInches: number | null =
    att.gripFt === "" || att.gripIn === ""
      ? null
      : ftInToInches(Number(att.gripFt), Number(att.gripIn));

  const validateAttempt = (): string | null => {
    if (att.feet < 6 || att.feet > 22) return "Feet must be 6-22.";
    if (att.inches < 0 || att.inches >= 12)
      return "Inches must be 0-11.99 — use the next foot to roll over.";
    if (gripInches != null && (gripInches < 60 || gripInches > 200))
      return "Grip must be 5'0\" - 16'8\".";
    if (att.gripIn !== "" && (Number(att.gripIn) < 0 || Number(att.gripIn) >= 12))
      return "Grip inches must be 0-11.";
    if (att.step_in !== "" && (Number(att.step_in) < 0 || Number(att.step_in) > 200))
      return "Step must be 0-200 inches.";
    if (att.runUp !== "" && (Number(att.runUp) < 0 || Number(att.runUp) > 40))
      return "Run-up steps must be 0-40.";
    if (att.videoUrl && !/^https?:\/\//.test(att.videoUrl)) return "Video URL must start with http(s)://";
    return null;
  };

  const createSession = async (e: React.FormEvent) => {
    e.preventDefault();
    let meetId = meta.meetId;
    if (meta.type === "meet" && meta.meetName.trim()) {
      const meet = await api<Meet>("/api/meets", {
        method: "POST",
        json: {
          name: meta.meetName.trim(),
          location: meta.location || null,
          date: meta.date,
        },
      });
      meetId = meet.id;
    }
    const s = await api<Session>("/api/sessions", {
      method: "POST",
      json: {
        type: meta.type,
        date: meta.date,
        location: meta.location || null,
        surface: meta.surface,
        energy: meta.energy,
        notes: meta.notes || null,
        cues_had: meta.cuesHad || null,
        cues_work: meta.cuesWork || null,
        meet_id: meetId,
      },
    });
    setSession({ ...s, is_owner: true } as any);
    setStep("log");
    nav(`/log/${s.id}`, { replace: true });
  };

  const toggleTag = (id: string) =>
    setAtt((a) => ({
      ...a,
      missTags: a.missTags.includes(id)
        ? a.missTags.filter((x) => x !== id)
        : [...a.missTags, id],
    }));

  const saveAttempt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    const v = validateAttempt();
    if (v) {
      setAttError(v);
      return;
    }
    setAttError(null);
    try {
      const a = await api<Attempt>("/api/attempts", {
        method: "POST",
        json: {
          session_id: session.id,
          bar_height_mm: heightMm,
          result: att.result,
          pole_id: att.poleId || null,
          grip_in: gripInches,
          step_in: att.step_in === "" ? null : Number(att.step_in),
          run_up_steps: att.runUp === "" ? null : Number(att.runUp),
          miss_tags: att.missTags.length ? att.missTags : undefined,
          notes: att.notes || null,
          video_url: att.videoUrl || null,
        },
      });
      setAttempts((cur) => [...cur, a]);
      setSavedNote(`Logged ${mmToFtIn(heightMm)} · ${RESULT_OPTS.find((r)=>r.id===att.result)?.label}`);
      setTimeout(() => setSavedNote(null), 1800);
      // Pick up the freshly-created auto_post_id for meet sessions
      if (session.type === "meet" && !session.auto_post_id) {
        try {
          const updated = await api<Session & { auto_post_id?: number | null }>(
            `/api/sessions/${session.id}`,
          );
          setSession((cur) => (cur ? { ...cur, auto_post_id: updated.auto_post_id } : cur));
        } catch {}
      }
      // Keep grip across attempts since it usually stays the same. Reset only
      // the per-attempt scratch fields.
      if (att.result === "clear") {
        const newIn = att.inches + 6;
        if (newIn >= 12)
          setAtt((a) => ({ ...a, feet: a.feet + 1, inches: newIn - 12, missTags: [], notes: "", videoUrl: "" }));
        else setAtt((a) => ({ ...a, inches: newIn, missTags: [], notes: "", videoUrl: "" }));
      } else {
        setAtt((a) => ({ ...a, missTags: [], notes: "", videoUrl: "" }));
      }
    } catch (e: any) {
      setAttError(e.message);
    }
  };

  const deleteAttempt = async () => {
    if (!pendingDelete) return;
    await api(`/api/attempts/${pendingDelete.id}`, { method: "DELETE" });
    setAttempts((cur) => cur.filter((a) => a.id !== pendingDelete.id));
    setPendingDelete(null);
  };

  const sharePost = async (visibility: "private" | "followers" | "public") => {
    if (!session) return;
    const top = [...attempts]
      .filter((a) => a.result === "clear")
      .sort((a, b) => b.bar_height_mm - a.bar_height_mm)[0];
    const pinned = top ? [top.id] : attempts.length ? [attempts[attempts.length - 1].id] : [];
    const post = await api<{ id: number }>("/api/posts", {
      method: "POST",
      json: {
        session_id: session.id,
        visibility,
        caption: session.notes || null,
        pinned_attempt_ids: pinned,
      },
    });
    nav(`/p/${post.id}`);
  };

  if (notFound) return <NotFound subject="session" />;

  if (step === "create") {
    return (
      <div className="mx-auto max-w-xl px-4 sm:px-5 pt-6 pb-10">
        <h1 className="font-display font-extrabold text-3xl tracking-tight mb-5">New session</h1>
        <form onSubmit={createSession} className="card p-5 space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {(["practice", "meet"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setMeta({ ...meta, type: t })}
                className={
                  "py-2 rounded-xl font-semibold text-sm capitalize " +
                  (meta.type === t
                    ? "bg-ink text-cream"
                    : "bg-stone-100 text-stone-700 hover:bg-stone-200")
                }
              >
                {t}
              </button>
            ))}
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <div className="label mb-1">date</div>
              <input
                type="date"
                className="input"
                value={meta.date}
                onChange={(e) => setMeta({ ...meta, date: e.target.value })}
                required
              />
            </div>
            <div>
              <div className="label mb-1">surface</div>
              <div className="grid grid-cols-2 gap-2">
                {(["indoor", "outdoor"] as const).map((s) => (
                  <button
                    type="button"
                    key={s}
                    onClick={() => setMeta({ ...meta, surface: s })}
                    className={
                      "py-2 rounded-xl text-sm font-semibold capitalize " +
                      (meta.surface === s
                        ? "bg-ink text-cream"
                        : "bg-stone-100 text-stone-700 hover:bg-stone-200")
                    }
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {meta.type === "meet" && (
            <div className="relative" data-meet-picker>
              <div className="label mb-1">meet</div>
              <div className="relative">
                <input
                  className="input pr-9"
                  value={meta.meetName}
                  onFocus={() => setMeetMenuOpen(true)}
                  onChange={(e) =>
                    setMeta({ ...meta, meetName: e.target.value, meetId: null })
                  }
                  placeholder="Pick an existing meet or type a new one"
                />
                <button
                  type="button"
                  onClick={() => setMeetMenuOpen((v) => !v)}
                  className="absolute right-0 top-0 h-full px-3 text-stone-400 hover:text-ink"
                  tabIndex={-1}
                  aria-label="Browse meets"
                >
                  ▾
                </button>
              </div>

              {meetMenuOpen && (
                <div className="absolute left-0 right-0 mt-1 card shadow-md z-20 max-h-72 overflow-y-auto">
                  {meta.meetName.trim() && !meta.meetId && (
                    <button
                      type="button"
                      onClick={() => setMeetMenuOpen(false)}
                      className="block w-full text-left px-3 py-2 hover:bg-stone-50 text-sm border-b border-stone-100"
                    >
                      <span className="text-stone-500">+ create new meet </span>
                      <span className="font-semibold">"{meta.meetName.trim()}"</span>
                    </button>
                  )}

                  {meetMatches.length === 0 ? (
                    <div className="px-3 py-4 text-stone-400 text-sm text-center">
                      {meta.meetName
                        ? "No meets match — keep typing to create a new one."
                        : "No meets created yet. Type a name to start one."}
                    </div>
                  ) : (
                    <>
                      <div className="label px-3 pt-2 pb-1">
                        {meta.meetName.trim() ? "Existing meets" : "Recent meets"}
                      </div>
                      {meetMatches.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            setMeta({
                              ...meta,
                              meetName: m.name,
                              meetId: m.id,
                              date: m.date,
                              location: m.location ?? meta.location,
                            });
                            setMeetMenuOpen(false);
                          }}
                          className={
                            "block w-full text-left px-3 py-2 hover:bg-stone-50 text-sm " +
                            (meta.meetId === m.id ? "bg-stone-50" : "")
                          }
                        >
                          <div className="font-semibold">{m.name}</div>
                          <div className="text-xs text-stone-500">
                            {m.date}
                            {m.location && ` · ${m.location}`}
                          </div>
                        </button>
                      ))}
                    </>
                  )}
                </div>
              )}

              <p className="text-[11px] text-stone-500 mt-1">
                {meta.meetId
                  ? "Joining an existing meet — your session will show up on the meet page."
                  : "Pick an existing meet to share results with everyone else who was there, or type a new name."}
              </p>
            </div>
          )}

          <div>
            <div className="label mb-1">location (optional)</div>
            <input
              className="input"
              value={meta.location}
              onChange={(e) => setMeta({ ...meta, location: e.target.value })}
              placeholder="Farley Field House, NESCAC Champs..."
            />
          </div>
          <div>
            <div className="label mb-1">energy / mood (1-5)</div>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setMeta({ ...meta, energy: n })}
                  className={
                    "flex-1 py-2 rounded-xl text-sm font-bold " +
                    (meta.energy === n
                      ? "bg-accent text-white"
                      : "bg-stone-100 text-stone-700 hover:bg-stone-200")
                  }
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="label mb-1">cues you had</div>
            <textarea
              className="input min-h-[60px] resize-none"
              value={meta.cuesHad}
              onChange={(e) => setMeta({ ...meta, cuesHad: e.target.value })}
              placeholder="things you were dialing in: tall plant, drive knee, finished swing…"
            />
          </div>
          <div>
            <div className="label mb-1">cues to work on</div>
            <textarea
              className="input min-h-[60px] resize-none"
              value={meta.cuesWork}
              onChange={(e) => setMeta({ ...meta, cuesWork: e.target.value })}
              placeholder="patience on inversion, stronger pen step, drop the trail leg…"
            />
          </div>
          <div>
            <div className="label mb-1">notes (optional)</div>
            <textarea
              className="input min-h-[60px] resize-none"
              value={meta.notes}
              onChange={(e) => setMeta({ ...meta, notes: e.target.value })}
              placeholder="how you felt going in"
            />
          </div>
          <button className="btn-primary w-full">Start session →</button>
        </form>
      </div>
    );
  }

  // Read-only mode
  if (session && (session as any).is_owner === false) {
    return (
      <ReadOnlySessionView
        session={session as any}
        attempts={attempts}
        polesByUser={otherPoles}
      />
    );
  }

  // Owner editor
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-5 pt-6 pb-10 grid lg:grid-cols-[1fr_320px] gap-5">
      <form onSubmit={saveAttempt} className="card p-5 space-y-4">
        <div className="flex items-end justify-between">
          <div>
            <div className="label">Bar height</div>
            <div className="font-display font-extrabold text-5xl tracking-tight leading-none mt-1">
              {fmt(heightMm)}
            </div>
            <div className="text-xs text-stone-500 mt-1 font-mono">
              {(heightMm / 1000).toFixed(2)}m · {heightMm}mm
            </div>
          </div>
          {savedNote && (
            <div className="pill bg-emerald-100 text-emerald-900 animate-pulse">{savedNote}</div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="label mb-1">feet</div>
            <NumberField
              className="input text-lg font-semibold"
              value={att.feet}
              onChange={(e) => setAtt({ ...att, feet: Number(e.target.value) })}
              min={6}
              max={22}
            />
          </div>
          <div>
            <div className="label mb-1">inches (0-11.5)</div>
            <NumberField
              decimal
              step="0.25"
              className="input text-lg font-semibold"
              value={att.inches}
              onChange={(e) => setAtt({ ...att, inches: Number(e.target.value) })}
              min={0}
              max={11.75}
            />
          </div>
        </div>

        <div>
          <div className="label mb-2">result</div>
          <div className="grid grid-cols-4 gap-2">
            {RESULT_OPTS.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setAtt({ ...att, result: r.id })}
                className={
                  "py-3 rounded-xl text-sm font-bold transition-colors " +
                  (att.result === r.id ? r.color : "bg-stone-100 text-stone-700 hover:bg-stone-200")
                }
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <div className="label mb-1">pole</div>
            <div className="flex gap-2">
              <select
                className="input flex-1"
                value={att.poleId}
                onChange={(e) => setAtt({ ...att, poleId: Number(e.target.value) })}
              >
                <option value={0}>— none —</option>
                {poles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {poleLenToFtIn(p.length_in)} / {p.weight_lb}lb{" "}
                    {p.nickname ? `· ${p.nickname}` : ""} ({p.make})
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setAddPoleOpen(true)}
                title="Add a new pole to your bag"
                className="btn-ghost shrink-0 !px-3"
              >
                +
              </button>
            </div>
          </div>
          <div>
            <div className="label mb-1">
              grip{" "}
              {gripInches != null && (
                <span className="font-normal text-stone-400">
                  · {inchesToFtIn(gripInches)} ({gripInches}")
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="relative">
                <NumberField
                  className="input pr-7"
                  min={5}
                  max={16}
                  value={att.gripFt}
                  onChange={(e) =>
                    setAtt({
                      ...att,
                      gripFt: e.target.value === "" ? "" : Number(e.target.value),
                    })
                  }
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 text-sm">
                  ft
                </span>
              </div>
              <div className="relative">
                <NumberField
                  decimal
                  step="0.5"
                  className="input pr-7"
                  min={0}
                  max={11.5}
                  value={att.gripIn}
                  onChange={(e) =>
                    setAtt({
                      ...att,
                      gripIn: e.target.value === "" ? "" : Number(e.target.value),
                    })
                  }
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 text-sm">
                  in
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            {(() => {
              // Live under / on / out feedback against the selected pole's target step.
              // Only renders when both a step value AND a pole-with-target are present.
              const selectedPole = poles.find((p) => p.id === att.poleId);
              const target = selectedPole?.target_step_in ?? null;
              const actual = att.step_in === "" ? null : Number(att.step_in);
              const status = stepStatus(actual, target);
              return (
                <>
                  <div className="label mb-1 flex items-center justify-between">
                    <span>step (in from box)</span>
                    {target != null && (
                      <span className="font-normal text-stone-400 lowercase tracking-normal">
                        target {target}"
                      </span>
                    )}
                  </div>
                  <NumberField
                    decimal
                    className="input"
                    min={0}
                    max={200}
                    value={att.step_in}
                    onChange={(e) =>
                      setAtt({
                        ...att,
                        step_in: e.target.value === "" ? "" : Number(e.target.value),
                      })
                    }
                  />
                  {status && (
                    <div className="mt-1.5">
                      <span className={"pill " + STEP_STATUS_COLOR[status]}>
                        {STEP_STATUS_LABEL[status]}
                        {actual != null && target != null && (
                          <span className="ml-1 opacity-70 normal-case">
                            ({(actual - target > 0 ? "+" : "") + (actual - target).toFixed(1)}")
                          </span>
                        )}
                      </span>
                    </div>
                  )}
                  {target == null && selectedPole && actual != null && (
                    <p className="text-[11px] text-stone-500 mt-1">
                      Set a target step on this pole to see under/on/out feedback.
                    </p>
                  )}
                </>
              );
            })()}
          </div>
          <div>
            <div className="label mb-1">run-up steps</div>
            <NumberField
              className="input"
              min={0}
              max={40}
              value={att.runUp}
              onChange={(e) =>
                setAtt({ ...att, runUp: e.target.value === "" ? "" : Number(e.target.value) })
              }
            />
          </div>
        </div>

        {att.result !== "clear" && (
          <div>
            <div className="label mb-2">miss tags · what went wrong?</div>
            <div className="space-y-3">
              {MISS_TAG_GROUPS.map((g) => (
                <div key={g.group}>
                  <div className="text-[11px] font-semibold text-stone-500 mb-1">{g.group}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {g.tags.map((t) => {
                      const on = att.missTags.includes(t.id);
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => toggleTag(t.id)}
                          className={
                            "px-2.5 py-1 rounded-full text-[12px] font-medium " +
                            (on
                              ? "bg-ink text-cream"
                              : "bg-stone-100 text-stone-700 hover:bg-stone-200")
                          }
                        >
                          {t.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <div className="label mb-1">video</div>
          <VideoDrop
            value={att.videoUrl}
            onChange={(url) => setAtt({ ...att, videoUrl: url })}
          />
        </div>

        <div>
          <div className="label mb-1">notes (optional)</div>
          <textarea
            className="input min-h-[60px] resize-none"
            value={att.notes}
            onChange={(e) => setAtt({ ...att, notes: e.target.value })}
            placeholder="what felt different on that one?"
            maxLength={500}
          />
        </div>

        {attError && <div className="text-rose-700 text-sm">{attError}</div>}
        <button className="btn-accent w-full text-base !py-3">+ Log attempt</button>
      </form>

      <aside className="space-y-4">
        <div className="card p-4">
          <div className="flex items-baseline justify-between">
            <div>
              <div className="label">This session</div>
              <div className="font-display font-bold text-lg capitalize">
                {session?.type} · {session?.date}
              </div>
              {session?.location && (
                <div className="text-xs text-stone-500">{session.location}</div>
              )}
              {(session as any)?.meet && (
                <Link
                  to={`/meets/${(session as any).meet.id}`}
                  className="text-xs text-accent hover:underline mt-1 inline-block"
                >
                  🏟 {(session as any).meet.name} →
                </Link>
              )}
            </div>
            <div className="text-right">
              <div className="font-mono text-2xl font-bold">{attempts.length}</div>
              <div className="text-[11px] text-stone-500">attempts</div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-4">
            {(["clear", "knock", "pass"] as const).map((r) => {
              const c = attempts.filter((a) => a.result === r).length;
              const labels: Record<string, string> = {
                clear: "✓ clears",
                knock: "✗ knocks",
                pass: "→ passes",
              };
              return (
                <div key={r} className="rounded-lg bg-stone-50 px-2 py-2 text-center">
                  <div className="text-xl font-bold">{c}</div>
                  <div className="text-[10px] text-stone-500 uppercase">{labels[r]}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card p-2">
          <div className="px-2 pt-2 pb-1 label">Log</div>
          {attempts.length === 0 ? (
            <div className="text-stone-400 text-sm py-6 text-center">
              No attempts yet — go for it.
            </div>
          ) : (
            attempts
              .slice()
              .reverse()
              .map((a, idx) => (
                <AttemptRow
                  key={a.id}
                  attempt={a}
                  pole={poles.find((p) => p.id === a.pole_id)}
                  index={attempts.length - idx}
                  onDelete={(at) => setPendingDelete(at)}
                />
              ))
          )}
        </div>

        {session?.type === "meet" ? (
          <div className="card p-4">
            <div className="label mb-1">🌐 Meet · auto-posting</div>
            <p className="text-sm text-stone-600">
              This meet shows up publicly so people can see how it went. The post
              updates as you log attempts.
            </p>
            {session.auto_post_id ? (
              <Link
                to={`/p/${session.auto_post_id}`}
                className="btn-primary w-full mt-3"
              >
                View live meet post →
              </Link>
            ) : (
              <p className="text-[11px] text-stone-500 mt-2">
                Log your first attempt and the post goes live.
              </p>
            )}
          </div>
        ) : (
          <div className="card p-4">
            <div className="label mb-2">Share session</div>
            <div className="grid grid-cols-3 gap-2 text-sm">
              <button
                onClick={() => sharePost("private")}
                className="rounded-lg bg-stone-100 hover:bg-stone-200 py-2 font-semibold"
              >
                🔒 Private
              </button>
              <button
                onClick={() => sharePost("followers")}
                className="rounded-lg bg-stone-100 hover:bg-stone-200 py-2 font-semibold"
              >
                👥 Followers
              </button>
              <button
                onClick={() => sharePost("public")}
                className="rounded-lg bg-accent text-white hover:bg-orange-600 py-2 font-semibold"
              >
                🌐 Public
              </button>
            </div>
          </div>
        )}
      </aside>

      <ConfirmDialog
        open={!!pendingDelete}
        title="Delete this attempt?"
        message={
          pendingDelete
            ? `Removes attempt #${pendingDelete.ordinal} at ${mmToFtIn(pendingDelete.bar_height_mm)} from this session.`
            : ""
        }
        confirmLabel="Delete"
        destructive
        onConfirm={deleteAttempt}
        onCancel={() => setPendingDelete(null)}
      />

      <AddPoleDialog
        open={addPoleOpen}
        onClose={() => setAddPoleOpen(false)}
        onCreated={(newPole) => {
          setPoles((cur) => [newPole, ...cur]);
          setAtt((a) => ({ ...a, poleId: newPole.id }));
        }}
      />
    </div>
  );
}

function ReadOnlySessionView({
  session,
  attempts,
  polesByUser,
}: {
  session: Session & {
    owner?: { handle: string; display_name: string; avatar_seed: string | null; avatar_url: string | null };
    meet?: { id: number; name: string } | null;
  };
  attempts: Attempt[];
  polesByUser: Pole[];
}) {
  const cleared = attempts.filter((a) => a.result === "clear").length;
  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-5 pt-6 pb-10">
      <div className="card p-5 mb-4">
        <div className="flex items-start gap-3">
          <Link to={session.owner ? `/u/${session.owner.handle}` : "#"}>
            <Avatar
              seed={session.owner?.avatar_seed ?? session.owner?.handle ?? "?"}
              url={session.owner?.avatar_url}
              size={40}
            />
          </Link>
          <div className="flex-1">
            <div className="label">Read-only · @{session.owner?.handle}</div>
            <div className="font-display font-bold text-2xl tracking-tight capitalize">
              {session.type} · {session.date}
            </div>
            {session.location && (
              <div className="text-sm text-stone-500">{session.location}</div>
            )}
            {session.meet && (
              <Link
                to={`/meets/${session.meet.id}`}
                className="text-xs text-accent hover:underline mt-1 inline-block"
              >
                🏟 {session.meet.name} →
              </Link>
            )}
          </div>
          <div className="text-right">
            <div className="font-mono text-2xl font-bold">{attempts.length}</div>
            <div className="text-[11px] text-stone-500">attempts · {cleared} clears</div>
          </div>
        </div>
        {(session.cues_had || session.cues_work) && (
          <div className="mt-3 grid sm:grid-cols-2 gap-3">
            {session.cues_had && (
              <div className="rounded-lg bg-emerald-50 px-3 py-2">
                <div className="label text-emerald-900">Cues had</div>
                <div className="text-sm text-emerald-900/90 mt-0.5 whitespace-pre-wrap">
                  {session.cues_had}
                </div>
              </div>
            )}
            {session.cues_work && (
              <div className="rounded-lg bg-amber-50 px-3 py-2">
                <div className="label text-amber-900">Cues to work on</div>
                <div className="text-sm text-amber-900/90 mt-0.5 whitespace-pre-wrap">
                  {session.cues_work}
                </div>
              </div>
            )}
          </div>
        )}
        {session.notes && (
          <p className="text-sm text-stone-700 mt-3 italic">"{session.notes}"</p>
        )}
      </div>

      <div className="card p-2">
        <div className="px-2 pt-2 pb-1 label">Attempts</div>
        {attempts.length === 0 ? (
          <div className="text-stone-400 text-sm py-6 text-center">No attempts logged.</div>
        ) : (
          attempts.map((a, i) => (
            <AttemptRow
              key={a.id}
              attempt={a}
              pole={polesByUser.find((p) => p.id === a.pole_id)}
              index={a.ordinal ?? i + 1}
            />
          ))
        )}
      </div>

      <div className="text-center text-xs text-stone-400 mt-4">
        This isn't your session — you can view it but not log attempts.{" "}
        <Link to="/log" className="underline">
          Start your own →
        </Link>
      </div>
    </div>
  );
}
