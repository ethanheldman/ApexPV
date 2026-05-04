import { type LucideIcon } from "lucide-react";
import { cn } from "./cn";

type Props = {
  icon?: LucideIcon;
  title: string;
  body?: string;
  /** Single primary CTA — keep brief per §6. */
  action?: { label: string; onClick: () => void };
  className?: string;
};

export default function EmptyState({ icon: Icon, title, body, action, className }: Props) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-8 py-14 text-center",
        className,
      )}
    >
      {Icon && (
        <div className="grid h-12 w-12 place-items-center rounded-full bg-bg-raised text-text-tertiary">
          <Icon className="h-6 w-6" strokeWidth={1.75} aria-hidden />
        </div>
      )}
      <h3 className="text-title font-semibold text-text-primary">{title}</h3>
      {body && (
        <p className="max-w-xs text-caption text-text-secondary">{body}</p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className={cn(
            "mt-2 inline-flex h-10 items-center justify-center rounded-md bg-accent px-4 text-body font-semibold text-accent-ink",
            "transition-all duration-press ease-apex active:scale-[0.97] hover:bg-accent-hover",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-base",
          )}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
