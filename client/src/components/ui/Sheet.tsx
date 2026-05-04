import { AnimatePresence, motion, useDragControls } from "framer-motion";
import { useEffect } from "react";
import { cn } from "./cn";

type Snap = "half" | "full";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Initial snap point. The user can drag to dismiss; brief §3 calls for
   *  50% / 90% — we render at 90% (full minus a top inset) and let the user
   *  swipe down to close. Half-snap is opt-in via prop. */
  snap?: Snap;
  /** Optional title for accessibility + visual header. */
  title?: string;
  children: React.ReactNode;
  className?: string;
};

const snapClasses: Record<Snap, string> = {
  half: "h-[50svh]",
  full: "h-[92svh]",
};

export default function Sheet({
  open,
  onClose,
  snap = "full",
  title,
  children,
  className,
}: Props) {
  const drag = useDragControls();

  // Lock body scroll while the sheet is open so the underlying page doesn't
  // scroll alongside the swipe gesture.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Close on Escape key.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Scrim — 60% per §3 */}
          <motion.div
            key="scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.6 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black"
          />
          <motion.div
            key="sheet"
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", duration: 0.35, bounce: 0.18 }}
            drag="y"
            dragControls={drag}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.2}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120 || info.velocity.y > 600) onClose();
            }}
            className={cn(
              "fixed inset-x-0 bottom-0 z-50 overflow-hidden rounded-t-xl border-t border-border-subtle bg-bg-elevated",
              "flex flex-col",
              snapClasses[snap],
              className,
            )}
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          >
            {/* Drag handle — also the listener trigger so we don't lose
                scroll-inside-sheet by accidentally dragging the body. */}
            <div
              onPointerDown={(e) => drag.start(e)}
              className="flex w-full cursor-grab justify-center pt-2 pb-3 active:cursor-grabbing"
            >
              <div className="h-1 w-9 rounded-full bg-border-strong" />
            </div>
            {title && (
              <div className="px-5 pb-3">
                <h2 className="text-title font-semibold text-text-primary">{title}</h2>
              </div>
            )}
            <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-5">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
