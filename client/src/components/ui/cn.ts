// Tiny className combiner used by every primitive. Wraps clsx so callers
// can pass strings, arrays, or conditional objects without ceremony.
import clsx, { type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}
