import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import type { Pole } from "../types";
import ConfirmDialog from "../components/ConfirmDialog";
import NumberField from "../components/NumberField";
import { POLE_BRANDS } from "../lib/poleBrands";
import { poleLenToFtIn, ftInToDecimalFeet } from "../lib/format";

const EMPTY = {
  make: "",
  brandSelect: "",
  length_ft: 13,
  length_inches: 6,
  weight_lb: 145,
  flex: 14.0,
  nickname: "",
};

export default function PoleBag() {
  const [poles, setPoles] = useState<Pole[]>([]);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ ...EMPTY });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Pole | null>(null);
  const [undoFor, setUndoFor] = useState<Pole | null>(null);

  const refresh = () => api<Pole[]>("/api/poles/mine").then(setPoles);

  useEffect(() => {
    refresh();
  }, []);

  // BUG-26 / BUG-03: enforce ranges before submit
  const lengthDecimal = ftInToDecimalFeet(form.length_ft, form.length_inches);

  const validate = () => {
    if (!form.make.trim()) return "Make is required.";
    if (form.length_ft < 6 || form.length_ft > 18) return "Feet must be 6-18.";
    if (form.length_inches < 0 || form.length_inches >= 12)
      return "Inches must be 0-11.";
    if (lengthDecimal < 6 || lengthDecimal > 18)
      return "Length must be between 6' and 18'.";
    if (form.weight_lb < 60 || form.weight_lb > 220)
      return "Weight must be between 60 and 220 lb.";
    if (form.flex && (form.flex < 5 || form.flex > 30))
      return "Flex must be between 5 and 30.";
    return null;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api("/api/poles", {
        method: "POST",
        json: {
          make: form.make,
          length_in: lengthDecimal,
          weight_lb: Number(form.weight_lb),
          flex: form.flex ? Number(form.flex) : null,
          nickname: form.nickname || null,
        },
      });
      setForm({ ...EMPTY });
      setAdding(false);
      refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const toggleRetired = async (p: Pole) => {
    await api(`/api/poles/${p.id}`, { method: "PATCH", json: { retired: !p.retired } });
    refresh();
  };

  const doDelete = async () => {
    if (!pendingDelete) return;
    const target = pendingDelete;
    await api(`/api/poles/${target.id}`, { method: "DELETE" });
    setPendingDelete(null);
    setUndoFor(target);
    refresh();
    // auto-clear undo after 6s
    setTimeout(() => {
      setUndoFor((cur) => (cur?.id === target.id ? null : cur));
    }, 6000);
  };

  const undo = async () => {
    if (!undoFor) return;
    await api(`/api/poles/${undoFor.id}/restore`, { method: "POST" });
    setUndoFor(null);
    refresh();
  };

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-5 pt-6 pb-10">
      <div className="flex items-end justify-between mb-5">
        <div>
          <h1 className="font-display font-extrabold text-3xl tracking-tight">Pole bag</h1>
          <p className="text-stone-500 text-sm">Track lifetime use across every pole.</p>
        </div>
        <button onClick={() => setAdding((a) => !a)} className="btn-primary">
          {adding ? "Cancel" : "+ Add pole"}
        </button>
      </div>

      {adding && (
        <form onSubmit={submit} className="card p-4 mb-5 grid sm:grid-cols-5 gap-3">
          <div className="sm:col-span-2">
            <div className="label mb-1">brand</div>
            <select
              className="input"
              value={form.brandSelect}
              onChange={(e) => {
                const v = e.target.value;
                setForm({
                  ...form,
                  brandSelect: v,
                  make: v === "__custom" ? form.make : v,
                });
              }}
              required
            >
              <option value="">— pick —</option>
              {POLE_BRANDS.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
              <option value="__custom">Other (type below)</option>
            </select>
            {form.brandSelect === "__custom" && (
              <input
                className="input mt-2"
                required
                maxLength={40}
                value={form.make}
                onChange={(e) => setForm({ ...form, make: e.target.value })}
                placeholder="brand name"
              />
            )}
          </div>
          <div className="sm:col-span-2">
            <div className="label mb-1">
              length{" "}
              <span className="font-normal text-stone-400">
                · {poleLenToFtIn(lengthDecimal)}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="relative">
                <NumberField
                  className="input pr-7"
                  min={6}
                  max={18}
                  required
                  value={form.length_ft}
                  onChange={(e) => setForm({ ...form, length_ft: Number(e.target.value) })}
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 text-sm">ft</span>
              </div>
              <div className="relative">
                <NumberField
                  className="input pr-7"
                  min={0}
                  max={11}
                  step="1"
                  required
                  value={form.length_inches}
                  onChange={(e) => setForm({ ...form, length_inches: Number(e.target.value) })}
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 text-sm">in</span>
              </div>
            </div>
          </div>
          <div>
            <div className="label mb-1">weight (lb)</div>
            <NumberField
              className="input"
              min={60}
              max={220}
              required
              value={form.weight_lb}
              onChange={(e) => setForm({ ...form, weight_lb: Number(e.target.value) })}
            />
          </div>
          <div>
            <div className="label mb-1">flex</div>
            <NumberField
              decimal
              className="input"
              step="0.1"
              min={5}
              max={30}
              value={form.flex}
              onChange={(e) => setForm({ ...form, flex: Number(e.target.value) })}
            />
          </div>
          <div className="sm:col-span-4">
            <div className="label mb-1">nickname (optional)</div>
            <input
              className="input"
              maxLength={40}
              value={form.nickname}
              onChange={(e) => setForm({ ...form, nickname: e.target.value })}
              placeholder="Greenie, Sting, Old Reliable…"
            />
          </div>
          <div className="sm:col-span-5 flex items-end gap-3">
            {error && <div className="text-rose-700 text-sm flex-1">{error}</div>}
            <button className="btn-accent self-end ml-auto" disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      )}

      {poles.length === 0 ? (
        <div className="card p-6 text-center text-stone-500">
          No poles yet. Add one above to start tracking.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {poles.map((p) => (
            <div key={p.id} className={"card p-4 " + (p.retired ? "opacity-60" : "")}>
              <Link to={`/poles/${p.id}`} className="block -m-1 p-1 rounded-lg hover:bg-stone-50">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-display font-bold text-2xl">
                      {poleLenToFtIn(p.length_in)} / {p.weight_lb}lb
                    </div>
                    <div className="text-sm text-stone-500">{p.make}</div>
                    {p.nickname && (
                      <div className="text-xs text-stone-400 italic mt-0.5">"{p.nickname}"</div>
                    )}
                  </div>
                  {p.retired ? (
                    <span className="pill bg-stone-200 text-stone-600">retired</span>
                  ) : (
                    <span className="pill bg-emerald-100 text-emerald-800">active</span>
                  )}
                </div>
                <div className="flex gap-3 mt-3 text-xs text-stone-500">
                  {p.flex != null && <span>flex {p.flex}</span>}
                  <span>
                    {p.attempts_count} attempt{p.attempts_count === 1 ? "" : "s"} →
                  </span>
                </div>
              </Link>
              <div className="flex gap-2 mt-3 pt-3 border-t border-stone-100">
                <button onClick={() => toggleRetired(p)} className="btn-ghost text-xs !py-1 !px-2">
                  {p.retired ? "Reactivate" : "Retire"}
                </button>
                <button
                  onClick={() => setPendingDelete(p)}
                  className="text-xs text-rose-700 hover:underline ml-auto"
                >
                  delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        title={
          pendingDelete
            ? `Delete the ${poleLenToFtIn(pendingDelete.length_in)} / ${pendingDelete.weight_lb}lb${
                pendingDelete.nickname ? ` (${pendingDelete.nickname})` : ""
              }?`
            : ""
        }
        message="Logged attempts on this pole will keep their reference, but it'll disappear from your bag. You can undo within a few seconds."
        confirmLabel="Delete"
        destructive
        onConfirm={doDelete}
        onCancel={() => setPendingDelete(null)}
      />

      {undoFor && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-ink text-cream rounded-xl shadow-lg flex items-center gap-3 pl-4 pr-2 py-2 text-sm">
          <span>
            Deleted <strong>{poleLenToFtIn(undoFor.length_in)} / {undoFor.weight_lb}lb</strong>
          </span>
          <button
            onClick={undo}
            className="bg-accent text-white font-semibold rounded-lg px-3 py-1 text-xs"
          >
            Undo
          </button>
          <button
            onClick={() => setUndoFor(null)}
            className="text-stone-400 hover:text-cream px-2"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
