import { forwardRef } from "react";
import { cn } from "./cn";

type Variant = "default" | "primary" | "ghost";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  /** Explicit aria-label is required since there's no visible text. */
  "aria-label": string;
};

const variantClasses: Record<Variant, string> = {
  default: "bg-bg-raised text-text-primary hover:bg-[#252934] active:bg-[#2C313B]",
  primary: "bg-accent text-accent-ink hover:bg-accent-hover active:bg-accent-pressed",
  ghost: "bg-transparent text-text-secondary hover:text-text-primary hover:bg-bg-raised/40",
};

const IconButton = forwardRef<HTMLButtonElement, Props>(function IconButton(
  { variant = "default", className, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(
        "inline-flex h-10 w-10 items-center justify-center rounded-md",
        "transition-all duration-press ease-apex active:scale-[0.97]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-base",
        "disabled:opacity-40 disabled:cursor-not-allowed",
        variantClasses[variant],
        className,
      )}
      {...rest}
    >
      {/* Lucide icons render at 20px in headers/toolbars per §6. Pass an
          icon element of size={20} from lucide-react. */}
      {children}
    </button>
  );
});

export default IconButton;
