import { forwardRef, useId } from "react";
import { cn } from "./cn";

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> & {
  label: string;
  /** Helper text shown beneath the input. Replaced by error if present. */
  helper?: string;
  error?: string;
  /** Right-side adornment (unit, etc.) — e.g. "kg", "ft". */
  rightAdornment?: React.ReactNode;
};

const Field = forwardRef<HTMLInputElement, Props>(function Field(
  { label, helper, error, rightAdornment, className, id, ...rest },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label
        htmlFor={inputId}
        className="text-micro uppercase tracking-wider font-medium text-text-tertiary"
      >
        {label}
      </label>
      <div className="relative">
        <input
          ref={ref}
          id={inputId}
          aria-invalid={!!error}
          aria-describedby={helper || error ? `${inputId}-help` : undefined}
          className={cn(
            "h-12 w-full rounded-md bg-bg-raised px-4 text-body text-text-primary placeholder:text-text-tertiary",
            // No visible border until focus per §3.
            "border border-transparent transition-all duration-press ease-apex",
            "focus:border-accent/40 focus:bg-bg-elevated focus:outline-none focus:ring-2 focus:ring-accent/30",
            error && "border-danger/50 ring-2 ring-danger/20",
            rightAdornment && "pr-12",
          )}
          {...rest}
        />
        {rightAdornment && (
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-caption text-text-tertiary">
            {rightAdornment}
          </span>
        )}
      </div>
      {(error || helper) && (
        <p
          id={`${inputId}-help`}
          className={cn(
            "text-caption",
            error ? "text-danger" : "text-text-tertiary",
          )}
        >
          {error ?? helper}
        </p>
      )}
    </div>
  );
});

export default Field;
