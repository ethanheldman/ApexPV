// Wheel-style height picker. Mobile-first: scrollable column of values that
// snaps to the selected one. Stores the canonical value in millimetres so
// the same picker can drive both feet/inches and metric display per §3.
//
// Built with CSS scroll-snap on a tall column — no external picker library
// (stays within the dep budget).

import { useEffect, useMemo, useRef } from "react";
import { cn } from "./cn";

type Unit = "imperial" | "metric";

type Props = {
  /** Canonical value in millimetres. */
  valueMm: number;
  onChange: (mm: number) => void;
  unit: Unit;
  minMm?: number;
  maxMm?: number;
  className?: string;
};

const ROW_HEIGHT = 36;
const VISIBLE_ROWS = 5;
const WHEEL_HEIGHT = ROW_HEIGHT * VISIBLE_ROWS;

function ftInToMm(ft: number, inches: number) {
  return Math.round(ft * 304.8 + inches * 25.4);
}

function mmToFtIn(mm: number) {
  const totalIn = mm / 25.4;
  let ft = Math.floor(totalIn / 12);
  let inches = Math.round((totalIn - ft * 12) * 4) / 4; // quarter-inch resolution
  if (inches >= 12) {
    ft += 1;
    inches -= 12;
  }
  return { ft, inches };
}

function Wheel<V extends number>({
  values,
  selected,
  onChange,
  format,
}: {
  values: V[];
  selected: V;
  onChange: (v: V) => void;
  format: (v: V) => string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastEmittedRef = useRef<V>(selected);

  // Scroll to the selected row whenever value changes externally.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const idx = values.indexOf(selected);
    if (idx < 0) return;
    el.scrollTop = idx * ROW_HEIGHT;
    lastEmittedRef.current = selected;
  }, [selected, values]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let timer: number | null = null;
    const onScroll = () => {
      if (timer != null) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const idx = Math.round(el.scrollTop / ROW_HEIGHT);
        const v = values[Math.min(values.length - 1, Math.max(0, idx))];
        if (v != null && v !== lastEmittedRef.current) {
          lastEmittedRef.current = v;
          onChange(v);
        }
      }, 80);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      if (timer != null) window.clearTimeout(timer);
    };
  }, [values, onChange]);

  return (
    <div
      ref={scrollRef}
      className="relative w-20 snap-y snap-mandatory overflow-y-auto scroll-smooth no-scrollbar"
      style={{
        height: WHEEL_HEIGHT,
        // Pad so the first and last rows can sit at the centre line.
        scrollPaddingTop: `${(WHEEL_HEIGHT - ROW_HEIGHT) / 2}px`,
        paddingTop: `${(WHEEL_HEIGHT - ROW_HEIGHT) / 2}px`,
        paddingBottom: `${(WHEEL_HEIGHT - ROW_HEIGHT) / 2}px`,
      }}
    >
      <ul>
        {values.map((v) => {
          const isSelected = v === selected;
          return (
            <li
              key={String(v)}
              style={{ height: ROW_HEIGHT }}
              className={cn(
                "flex snap-center items-center justify-center font-display font-semibold tabular-nums transition-colors",
                isSelected
                  ? "text-text-primary text-display-md"
                  : "text-text-tertiary text-title",
              )}
            >
              {format(v)}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function HeightPicker({
  valueMm,
  onChange,
  unit,
  minMm = ftInToMm(6, 0),
  maxMm = ftInToMm(20, 0),
  className,
}: Props) {
  // Compute axis values unconditionally so the hooks stay stable across re-renders.
  const ftMin = useMemo(() => mmToFtIn(minMm).ft, [minMm]);
  const ftMax = useMemo(() => mmToFtIn(maxMm).ft, [maxMm]);
  const fts = useMemo(
    () => Array.from({ length: ftMax - ftMin + 1 }, (_, i) => ftMin + i),
    [ftMin, ftMax],
  );
  const insQuarters = useMemo(() => Array.from({ length: 48 }, (_, i) => i * 0.25), []);
  const mMin = useMemo(() => Math.floor(minMm / 1000), [minMm]);
  const mMax = useMemo(() => Math.floor(maxMm / 1000), [maxMm]);
  const ms = useMemo(
    () => Array.from({ length: mMax - mMin + 1 }, (_, i) => mMin + i),
    [mMin, mMax],
  );
  const cms = useMemo(() => Array.from({ length: 100 }, (_, i) => i), []);

  const ftIn = mmToFtIn(valueMm);
  const meters = Math.floor(valueMm / 1000);
  const cm = Math.round((valueMm - meters * 1000) / 10);

  return (
    <div className={cn("relative inline-block", className)}>
      <div className="flex items-center justify-center gap-2 px-3">
        {unit === "imperial" ? (
          <>
            <Wheel
              values={fts}
              selected={ftIn.ft}
              onChange={(v) => onChange(ftInToMm(v, ftIn.inches))}
              format={(v) => `${v}'`}
            />
            <Wheel
              values={insQuarters}
              selected={ftIn.inches}
              onChange={(v) => onChange(ftInToMm(ftIn.ft, v))}
              format={(v) => `${v}"`}
            />
          </>
        ) : (
          <>
            <Wheel
              values={ms}
              selected={meters}
              onChange={(v) => onChange(v * 1000 + cm * 10)}
              format={(v) => `${v}m`}
            />
            <Wheel
              values={cms}
              selected={cm}
              onChange={(v) => onChange(meters * 1000 + v * 10)}
              format={(v) => v.toString().padStart(2, "0")}
            />
          </>
        )}
      </div>
      {/* Selection band — two hairlines marking the centre row. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 border-y border-border-strong"
        style={{ height: ROW_HEIGHT }}
      />
      {/* Top + bottom fade so out-of-focus rows feel less prominent. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-bg-elevated to-transparent"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-bg-elevated to-transparent"
      />
    </div>
  );
}
