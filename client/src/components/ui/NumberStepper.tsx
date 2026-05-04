import { Minus, Plus } from "lucide-react";
import { useEffect, useRef } from "react";
import { cn } from "./cn";

type Props = {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Suffix shown next to the number (e.g. "ft", "in", "lb"). */
  unit?: string;
  /** Coarse step used while long-pressing (auto-accelerates). */
  longPressStep?: number;
  className?: string;
};

export default function NumberStepper({
  value,
  onChange,
  min = -Infinity,
  max = Infinity,
  step = 1,
  unit,
  longPressStep,
  className,
}: Props) {
  // Track the latest value through a ref so the long-press interval can read
  // it without a stale closure (state updates won't flush within the tick).
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  const timeoutRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);

  const stop = () => {
    if (timeoutRef.current != null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (intervalRef.current != null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  useEffect(() => () => stop(), []);

  const clamp = (n: number) => Math.min(max, Math.max(min, n));

  const bump = (dir: 1 | -1, stepSize = step) => {
    const next = clamp(valueRef.current + dir * stepSize);
    valueRef.current = next;
    onChange(next);
  };

  const startHold = (dir: 1 | -1) => {
    stop();
    // 300ms initial pause so a tap doesn't auto-trigger the hold.
    timeoutRef.current = window.setTimeout(() => {
      let ticks = 0;
      let delay = 120;
      const fire = () => {
        ticks += 1;
        // After ~6 ticks, switch to the coarser long-press step if provided.
        const useStep = ticks > 6 && longPressStep ? longPressStep : step;
        bump(dir, useStep);
        // Accelerate to 60ms after a few ticks.
        if (ticks === 4 && intervalRef.current != null) {
          window.clearInterval(intervalRef.current);
          delay = 60;
          intervalRef.current = window.setInterval(fire, delay);
        }
      };
      intervalRef.current = window.setInterval(fire, delay);
    }, 300);
  };

  return (
    <div
      className={cn(
        "inline-flex h-12 items-center rounded-md bg-bg-raised border border-border-subtle",
        className,
      )}
    >
      <button
        type="button"
        aria-label="decrease"
        onClick={() => bump(-1)}
        onPointerDown={() => startHold(-1)}
        onPointerUp={stop}
        onPointerLeave={stop}
        disabled={value <= min}
        className={cn(
          "inline-flex h-full w-12 items-center justify-center text-text-secondary",
          "transition-all duration-press ease-apex active:scale-[0.92]",
          "hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed",
        )}
      >
        <Minus className="h-4 w-4" aria-hidden />
      </button>
      <div className="flex min-w-[72px] items-baseline justify-center gap-1 px-3">
        <span className="text-display-md font-display font-semibold text-text-primary tabular-nums">
          {value}
        </span>
        {unit && <span className="text-caption text-text-tertiary">{unit}</span>}
      </div>
      <button
        type="button"
        aria-label="increase"
        onClick={() => bump(1)}
        onPointerDown={() => startHold(1)}
        onPointerUp={stop}
        onPointerLeave={stop}
        disabled={value >= max}
        className={cn(
          "inline-flex h-full w-12 items-center justify-center text-text-secondary",
          "transition-all duration-press ease-apex active:scale-[0.92]",
          "hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed",
        )}
      >
        <Plus className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}
