import { cn } from "./cn";

type Variant = "neutral" | "accent" | "success" | "warn" | "danger";

type Props = {
  variant?: Variant;
  /** Show a small dot indicator on the left. */
  dot?: boolean;
  className?: string;
  children: React.ReactNode;
};

const variantClasses: Record<Variant, { bg: string; text: string; dot: string }> = {
  neutral: { bg: "bg-bg-raised", text: "text-text-secondary", dot: "bg-text-tertiary" },
  accent: { bg: "bg-accent/15", text: "text-accent", dot: "bg-accent" },
  success: { bg: "bg-success/15", text: "text-success", dot: "bg-success" },
  warn: { bg: "bg-warn/15", text: "text-warn", dot: "bg-warn" },
  danger: { bg: "bg-danger/15", text: "text-danger", dot: "bg-danger" },
};

export default function Tag({ variant = "neutral", dot, className, children }: Props) {
  const v = variantClasses[variant];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-micro font-medium uppercase tracking-wider",
        v.bg,
        v.text,
        className,
      )}
    >
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full", v.dot)} />}
      {children}
    </span>
  );
}
