// Sticky top bar — 56h, page title left, contextual actions right, blurs
// the background when the page scrolls. Per §3.
import { useEffect, useState } from "react";
import { cn } from "./cn";

type Props = {
  title?: React.ReactNode;
  /** Slot on the left (e.g. back button). */
  leading?: React.ReactNode;
  /** Slot on the right (icon buttons). */
  trailing?: React.ReactNode;
  className?: string;
};

export default function AppHeader({ title, leading, trailing, className }: Props) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex h-14 items-center justify-between border-b transition-colors duration-page ease-apex",
        scrolled
          ? "bg-bg-base/80 border-border-subtle backdrop-blur-md"
          : "bg-bg-base border-transparent",
        className,
      )}
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="flex h-full items-center gap-2 px-3">
        {leading}
        {title && (
          <h1 className="text-title font-semibold text-text-primary">{title}</h1>
        )}
      </div>
      {trailing && <div className="flex h-full items-center gap-1 px-3">{trailing}</div>}
    </header>
  );
}
