import { forwardRef } from "react";
import { cn } from "./cn";

type Props = React.HTMLAttributes<HTMLDivElement> & {
  /** Adds press-scale + raised hover state for clickable cards. */
  interactive?: boolean;
  /** Shrink the default 20/24 padding (e.g. for nested cards). */
  padding?: "none" | "sm" | "md" | "lg";
};

const paddingClasses = {
  none: "",
  sm: "p-3",
  md: "p-5 md:p-6", // §2: 20 mobile, 24 ≥md
  lg: "p-6 md:p-8",
} as const;

const Card = forwardRef<HTMLDivElement, Props>(function Card(
  { className, interactive, padding = "md", children, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        "rounded-lg border border-border-subtle bg-bg-elevated",
        // Elevation by lightness only — no shadows per §2.
        paddingClasses[padding],
        interactive &&
          "cursor-pointer transition-all duration-press ease-apex hover:bg-bg-raised active:scale-[0.97]",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
});

export default Card;
