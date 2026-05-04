import { motion } from "framer-motion";
import { useId } from "react";
import { cn } from "./cn";

type Option<T extends string> = { value: T; label: string };

type Props<T extends string> = {
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
  fullWidth?: boolean;
  className?: string;
};

export default function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  fullWidth = true,
  className,
}: Props<T>) {
  // Shared layoutId per instance so the indicator slides only between
  // segments of THIS control, not across other SegmentedControls on the page.
  const layoutId = useId();

  return (
    <div
      role="radiogroup"
      className={cn(
        "relative inline-flex rounded-md bg-bg-sunken p-1",
        fullWidth && "w-full",
        className,
      )}
    >
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(opt.value)}
            className={cn(
              "relative z-10 flex h-9 items-center justify-center rounded-[6px] px-4 text-caption font-medium transition-colors",
              fullWidth && "flex-1",
              selected ? "text-text-primary" : "text-text-tertiary hover:text-text-secondary",
            )}
          >
            {selected && (
              <motion.div
                layoutId={layoutId}
                className="absolute inset-0 -z-10 rounded-[6px] bg-bg-raised"
                transition={{ type: "spring", duration: 0.25, bounce: 0.15 }}
              />
            )}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
