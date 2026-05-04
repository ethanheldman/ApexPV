import { useState } from "react";
import { api } from "../api";
import { POLE_BRANDS } from "../lib/poleBrands";
import { ftInToDecimalFeet, poleLenToFtIn } from "../lib/format";
import NumberField from "./NumberField";
import type { Pole } from "../types";

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: (pole: Pole) => void;
};

const EMPTY = {
  brandSelect: "",
  make: "",
  length_ft: 13,
  length_inches: 6,
  weight_lb: 145,
  flex: "" as number | "",
  nickname: "",
};

export default function AddPoleDialog({ open, onClose, onCreated }: Props) {
  const [form, setForm] = useState({ ...EMPTY });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const lengthDecimal = ftInToDecimalFeet(form.length_ft, form.length_inches);

  const reset = () => {
    setForm({ ...EMPTY });
    setErr(null);
    setBusy(false);
  };

  const close = () => {
    reset();
    onClose();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.make.trim()) {
      setErr("Pick a brand.");
      return;
    }
    if (form.length_ft < 6 || form.length_ft > 18) {
      setErr("Length feet must be 6-18.");
      return;
    }
    if (form.length_inches < 0 || form.length_inches >= 12) {
      setErr("Length inches must be 0-11.");
      return;
    }
    if (form.weight_lb < 60 || form.weight_lb > 220) {
      setErr("Weight must be 60-220 lb.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const pole = await api<Pole>("/api/poles", {
        method: "POST",
        json: {
          make: form.make,
          length_in: lengthDecimal,
          weight_lb: Number(form.weight_lb),
          flex: form.flex === "" ? null : Number(form.flex),
          nickname: form.nickname || null,
        },
      });
      onCreated(pole);
      reset();
      onClose();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 grid items-end sm:items-center justify-items-stretch sm:justify-items-center bg-bg-sunken/30 backdrop-blur-sm"
      onClick={close}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="card p-5 w-full sm:max-w-md sm:w-full rounded-b-none sm:rounded-2xl shadow-xl space-y-3"
        style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom, 0px))" }}
      >
        <div className="flex items-baseline justify-between">
          <h2 className="font-display font-extrabold text-2xl tracking-tight">
            Add a pole
          </h2>
          <button
            type="button"
            onClick={close}
            className="text-text-tertiary hover:text-text-primary text-2xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div>
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

        <div>
          <div className="label mb-1">
            length{" "}
            <span className="font-normal text-text-tertiary">
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
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-text-tertiary text-sm">
                ft
              </span>
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
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-text-tertiary text-sm">
                in
              </span>
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

        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="label mb-1">flex (opt)</div>
            <NumberField
              decimal
              className="input"
              step="0.1"
              min={5}
              max={30}
              value={form.flex}
              onChange={(e) =>
                setForm({
                  ...form,
                  flex: e.target.value === "" ? "" : Number(e.target.value),
                })
              }
            />
          </div>
          <div>
            <div className="label mb-1">nickname (opt)</div>
            <input
              className="input"
              maxLength={40}
              value={form.nickname}
              onChange={(e) => setForm({ ...form, nickname: e.target.value })}
              placeholder="Greenie"
            />
          </div>
        </div>

        {err && <div className="text-rose-700 text-sm">{err}</div>}

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={close}
            className="btn-ghost flex-1"
            disabled={busy}
          >
            Cancel
          </button>
          <button className="btn-accent flex-1" disabled={busy}>
            {busy ? "Saving…" : "Add to bag"}
          </button>
        </div>
      </form>
    </div>
  );
}
