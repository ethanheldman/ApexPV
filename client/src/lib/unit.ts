import { useAuth } from "../auth";
import type { Unit } from "./format";
import { fmtHeight } from "./format";

/** Hook that returns the current viewer's unit preference + a height formatter. */
export function useUnit(): { unit: Unit; fmt: (mm: number | null | undefined) => string } {
  const { user } = useAuth();
  const unit: Unit = user?.unit_pref === "metric" ? "metric" : "imperial";
  return { unit, fmt: (mm) => fmtHeight(mm, unit) };
}
