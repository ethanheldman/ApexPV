// Fixed-bottom 4-tab navigation per §3 and §4 IA. Active tab gets a lime
// underline indicator that springs between tabs via framer-motion's layoutId.
//
// Tabs: Today / Sessions / Progress / Profile.
// Sub-routes that aren't tabs (sessions/new, etc.) render this bar with no
// matching active tab, which is fine — the underline just doesn't render.

import { motion } from "framer-motion";
import { type LucideIcon } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "./cn";

export type Tab = {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Custom matcher; defaults to startsWith(to). */
  match?: (pathname: string) => boolean;
};

type Props = {
  tabs: Tab[];
  className?: string;
};

export default function BottomNav({ tabs, className }: Props) {
  const loc = useLocation();
  const activeIndex = tabs.findIndex((t) =>
    t.match ? t.match(loc.pathname) : loc.pathname === t.to,
  );

  return (
    <nav
      className={cn(
        "fixed inset-x-0 bottom-0 z-30 border-t border-border-subtle bg-bg-sunken/85 backdrop-blur-md",
        className,
      )}
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="relative mx-auto flex max-w-md items-stretch">
        {tabs.map((t, i) => {
          const Icon = t.icon;
          const active = i === activeIndex;
          return (
            <Link
              key={t.to}
              to={t.to}
              className={cn(
                "relative flex flex-1 flex-col items-center gap-1 py-3",
                "transition-all duration-press ease-apex active:scale-[0.97]",
                active ? "text-text-primary" : "text-text-tertiary hover:text-text-secondary",
              )}
            >
              <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
              <span className="text-micro font-semibold uppercase tracking-wider">
                {t.label}
              </span>
              {active && (
                <motion.div
                  layoutId="bottom-nav-indicator"
                  className="absolute bottom-1 h-0.5 w-8 rounded-full bg-accent"
                  transition={{ type: "spring", duration: 0.32, bounce: 0.2 }}
                />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
