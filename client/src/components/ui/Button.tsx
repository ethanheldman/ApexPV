import { forwardRef } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "./cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

type Props = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "size"> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
};

const variantClasses: Record<Variant, string> = {
  // Lime accent — primary CTA, used sparingly per §1.
  primary:
    "bg-accent text-accent-ink hover:bg-accent-hover active:bg-accent-pressed disabled:bg-accent/30 disabled:text-accent-ink/60",
  // Neutral raised surface — most default actions.
  secondary:
    "bg-bg-raised text-text-primary hover:bg-[#252934] active:bg-[#2C313B] disabled:text-text-disabled",
  // Transparent — tertiary actions, dialog cancels.
  ghost:
    "bg-transparent text-text-secondary hover:text-text-primary hover:bg-bg-raised/40 active:bg-bg-raised/60",
  // Destructive — confirms in delete sheets, etc.
  danger:
    "bg-danger/15 text-danger hover:bg-danger/25 active:bg-danger/35 disabled:opacity-50",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-8 px-3 text-caption",
  md: "h-10 px-4 text-body",
  lg: "h-12 px-5 text-body",
};

const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  {
    variant = "primary",
    size = "md",
    loading,
    fullWidth,
    className,
    disabled,
    children,
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "relative inline-flex items-center justify-center gap-2 rounded-md font-semibold",
        "transition-all duration-press ease-apex active:scale-[0.97]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-base",
        "disabled:cursor-not-allowed",
        variantClasses[variant],
        sizeClasses[size],
        fullWidth && "w-full",
        className,
      )}
      {...rest}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      ) : (
        children
      )}
    </button>
  );
});

export default Button;
