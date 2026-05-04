// Heights are stored in millimeters server-side so imperial values round-trip
// without precision loss (13'6" = 4115mm exactly).

export function ftInToMm(ft: number, inches: number): number {
  // Use exact integer-arithmetic conversion: 1 inch = 25.4 mm.
  // Round to integer mm to keep DB values stable.
  return Math.round(ft * 304.8 + inches * 25.4);
}

/**
 * canonicalizeHeight: ensures the inches component is always 0 ≤ in < 12.
 * Without this, a height like 14*12 + 12 inches would render as "14'12""
 * instead of "15'0"". This is BUG-01.
 */
export function canonicalizeHeight(ft: number, inches: number): { ft: number; inches: number } {
  if (inches < 0) {
    const carry = Math.ceil(-inches / 12);
    return { ft: ft - carry, inches: inches + carry * 12 };
  }
  if (inches >= 12) {
    const carry = Math.floor(inches / 12);
    return { ft: ft + carry, inches: inches - carry * 12 };
  }
  return { ft, inches };
}

export function mmToFtIn(mm: number | null | undefined): string {
  if (mm == null) return "—";
  // Total inches as float, then split into ft + inches and snap inches to nearest quarter.
  const totalIn = mm / 25.4;
  let ft = Math.floor(totalIn / 12);
  let inches = totalIn - ft * 12;
  // Snap inches to nearest quarter
  inches = Math.round(inches * 4) / 4;
  // Re-canonicalize after rounding (e.g. 11.99 → 12 → +1 ft, 0 in)
  ({ ft, inches } = canonicalizeHeight(ft, inches));
  if (inches === Math.floor(inches)) {
    return `${ft}'${inches.toFixed(0)}"`;
  }
  return `${ft}'${inches}"`;
}

export function mmToMeters(mm: number | null | undefined): string {
  if (mm == null) return "—";
  return `${(mm / 1000).toFixed(2)}m`;
}

export function relTime(iso: string): string {
  // Accepts both ISO ("2026-04-30T12:34:56.000Z" — Postgres) and the legacy
  // SQLite format ("2026-04-30 12:34:56", treated as UTC).
  let d: Date;
  if (iso.includes("T") || iso.endsWith("Z")) {
    d = new Date(iso);
  } else {
    d = new Date(iso.replace(" ", "T") + "Z");
  }
  const diffMs = Date.now() - d.getTime();
  const m = Math.floor(diffMs / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d`;
  const w = Math.floor(days / 7);
  if (w < 5) return `${w}w`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * Pole length is stored as decimal feet (e.g. 14.5 = 14'6", 14.7 ≈ 14'8.4").
 * Display as feet + inches with quarter-inch resolution.
 */
export function poleLenToFtIn(decimalFeet: number | null | undefined): string {
  if (decimalFeet == null) return "—";
  const totalIn = decimalFeet * 12;
  let ft = Math.floor(totalIn / 12);
  let inches = totalIn - ft * 12;
  inches = Math.round(inches * 4) / 4;
  if (inches >= 12) {
    ft += 1;
    inches -= 12;
  }
  if (inches === 0) return `${ft}'0"`;
  if (inches === Math.floor(inches)) return `${ft}'${inches.toFixed(0)}"`;
  return `${ft}'${inches}"`;
}

/** Convert ft + inches → decimal feet (storage format for poles). */
export function ftInToDecimalFeet(ft: number, inches: number): number {
  return Math.round((ft + inches / 12) * 100) / 100;
}

/**
 * Grip + step are stored as decimal inches (e.g. 154.5).
 * Display as feet + inches with quarter-inch resolution.
 */
export function inchesToFtIn(totalInches: number | null | undefined): string {
  if (totalInches == null) return "—";
  let ft = Math.floor(totalInches / 12);
  let inches = totalInches - ft * 12;
  inches = Math.round(inches * 4) / 4;
  if (inches >= 12) {
    ft += 1;
    inches -= 12;
  }
  if (inches === 0) return `${ft}'0"`;
  if (inches === Math.floor(inches)) return `${ft}'${inches.toFixed(0)}"`;
  return `${ft}'${inches}"`;
}

/** ft + inches → total decimal inches (storage format for grip / step). */
export function ftInToInches(ft: number, inches: number): number {
  return Math.round((ft * 12 + inches) * 100) / 100;
}

export function fmtDate(s: string): string {
  return new Date(s + "T12:00:00").toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/** Today's date in the client's local timezone, as YYYY-MM-DD. Fixes BUG-11. */
export function todayLocal(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export type Unit = "imperial" | "metric";

/** Display a height in the user's preferred unit. */
export function fmtHeight(mm: number | null | undefined, unit: Unit): string {
  if (mm == null) return "—";
  return unit === "metric" ? mmToMeters(mm) : mmToFtIn(mm);
}

export const RESULT_LABEL: Record<string, string> = {
  clear: "✓ clearance",
  knock: "✗ knock",
  pass: "→ pass",
  bail: "↩ bail",
};

// Short label for tight spaces
export const RESULT_LABEL_SHORT: Record<string, string> = {
  clear: "Clear",
  knock: "Knock",
  pass: "Pass",
  bail: "Bail",
};

export const RESULT_COLOR: Record<string, string> = {
  clear: "bg-emerald-100 text-emerald-900",
  knock: "bg-rose-100 text-rose-900",
  pass: "bg-amber-100 text-amber-900",
  bail: "bg-bg-raised text-text-primary",
};

export const GENDER_LABEL: Record<string, string> = {
  m: "Men",
  f: "Women",
};

export const LEVEL_LABEL: Record<string, string> = {
  hs: "High School",
  college: "College",
  open: "Open",
  masters: "Masters",
};
