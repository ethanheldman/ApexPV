import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "./cn";

type Props = {
  /** The hero number — renders in display face with tabular figures. */
  value: string | number;
  /** Caption underneath. */
  label: string;
  /** Optional unit appended to value (e.g. "kg", "m"). */
  unit?: string;
  /** Optional delta — renders as up/down chevron + magnitude. */
  delta?: { value: string | number; direction: "up" | "down"; positive?: boolean };
  /** Choose how big the number renders. */
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
};

const sizeClasses = {
  sm: "text-display-md",
  md: "text-display-lg",
  lg: "text-display-lg md:text-[44px] md:leading-[48px]",
  xl: "text-display-xl",
} as const;

export default function Stat({
  value,
  label,
  unit,
  delta,
  size = "md",
  className,
}: Props) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className="flex items-baseline gap-1">
        <span className={cn("font-display font-semibold tracking-tight tabular-nums", sizeClasses[size])}>
          {value}
        </span>
        {unit && (
          <span className="text-caption text-text-secondary font-medium">{unit}</span>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-micro uppercase tracking-wider font-medium text-text-tertiary">
          {label}
        </span>
        {delta && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 text-caption font-medium tabular-nums",
              delta.positive === false ? "text-danger" : "text-success",
            )}
          >
            {delta.direction === "up" ? (
              <ChevronUp className="h-3 w-3" aria-hidden />
            ) : (
              <ChevronDown className="h-3 w-3" aria-hidden />
            )}
            {delta.value}
          </span>
        )}
      </div>
    </div>
  );
}
