// Sessions list per brief §5.2.
// Header + 12-week calendar heatmap + segmented filter + grouped session cards.

import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Calendar as CalendarIcon } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../auth";
import {
  AppHeader,
  Card,
  EmptyState,
  IconButton,
  SegmentedControl,
  Tag,
} from "../components/ui";
import { useUnit } from "../lib/unit";
import { fmtDate } from "../lib/format";
import type { Attempt, Session } from "../types";

const HEATMAP_WEEKS = 12;
const DAY_MS = 24 * 60 * 60 * 1000;

type SessionWithAttempts = Session & { attempts?: Attempt[] };
type Filter = "all" | "indoor" | "outdoor";

const FILTER_OPTS = [
  { value: "all" as const, label: "All" },
  { value: "indoor" as const, label: "Indoor" },
  { value: "outdoor" as const, label: "Outdoor" },
];

function utcDay(iso: string) {
  return new Date(iso + "T00:00:00Z");
}

function isoDay(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default function SessionsList() {
  const { user } = useAuth();
  const { fmt } = useUnit();
  const nav = useNavigate();
  const [sessions, setSessions] = useState<SessionWithAttempts[] | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    if (!user) return;
    api<Session[]>("/api/sessions/mine/list")
      .then(setSessions)
      .catch(() => setSessions([]));
  }, [user]);

  const filtered = useMemo(() => {
    if (!sessions) return null;
    if (filter === "all") return sessions;
    return sessions.filter((s) => s.surface === filter);
  }, [sessions, filter]);

  // Per-day attempt counts for the heatmap. We approximate "intensity" by
  // session count per day — accurate attempts-per-day would require fetching
  // attempts for every session, too expensive for this surface.
  const heat = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of sessions ?? []) {
      map.set(s.date, (map.get(s.date) ?? 0) + 1);
    }
    return map;
  }, [sessions]);

  // 12 weeks × 7 days, ending on today.
  const heatmap = useMemo(() => {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    // Find last Sunday (col 0 = Mon, col 6 = Sun for athletic week-start).
    const day = today.getUTCDay() || 7;
    const lastSunday = new Date(today.getTime() - (day - 7) * DAY_MS);
    const totalDays = HEATMAP_WEEKS * 7;
    const startDay = new Date(lastSunday.getTime() - (totalDays - 1) * DAY_MS);

    const cells: { iso: string; intensity: number }[] = [];
    for (let i = 0; i < totalDays; i++) {
      const d = new Date(startDay.getTime() + i * DAY_MS);
      const iso = isoDay(d);
      cells.push({ iso, intensity: heat.get(iso) ?? 0 });
    }
    return cells;
  }, [heat]);

  // Group sessions by month label for the list.
  const grouped = useMemo(() => {
    if (!filtered) return [];
    const groups: { label: string; rows: Session[] }[] = [];
    for (const s of filtered) {
      const d = utcDay(s.date);
      const label = d.toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
      });
      const last = groups[groups.length - 1];
      if (last && last.label === label) last.rows.push(s);
      else groups.push({ label, rows: [s] });
    }
    return groups;
  }, [filtered]);

  return (
    <>
      <AppHeader
        title="Sessions"
        trailing={
          <IconButton
            aria-label="Log session"
            variant="primary"
            onClick={() => nav("/log")}
          >
            <Plus className="h-5 w-5" strokeWidth={2} />
          </IconButton>
        }
      />

      <div className="mx-auto max-w-md space-y-5 px-gutter pt-4 pb-6">
        {/* Calendar heatmap */}
        <Card padding="md">
          <p className="text-micro font-semibold uppercase tracking-wider text-text-tertiary">
            Last {HEATMAP_WEEKS} weeks
          </p>
          <div className="mt-3 flex gap-1 overflow-x-auto no-scrollbar">
            {Array.from({ length: HEATMAP_WEEKS }, (_, w) => {
              const weekCells = heatmap.slice(w * 7, (w + 1) * 7);
              return (
                <div key={w} className="flex flex-col gap-1">
                  {weekCells.map((c) => (
                    <button
                      key={c.iso}
                      title={`${c.iso} · ${c.intensity} session${c.intensity === 1 ? "" : "s"}`}
                      onClick={() => {
                        const target = document.getElementById(`day-${c.iso}`);
                        target?.scrollIntoView({ behavior: "smooth", block: "center" });
                      }}
                      className={
                        "h-3.5 w-3.5 rounded-sm transition-colors " +
                        (c.intensity === 0
                          ? "bg-bg-raised hover:bg-bg-raised/80"
                          : c.intensity === 1
                            ? "bg-accent/40 hover:bg-accent/60"
                            : c.intensity === 2
                              ? "bg-accent/65 hover:bg-accent/75"
                              : "bg-accent hover:bg-accent-hover")
                      }
                    />
                  ))}
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex items-center justify-between text-micro text-text-tertiary uppercase tracking-wider">
            <span>{HEATMAP_WEEKS} weeks ago</span>
            <div className="flex items-center gap-1">
              <span>less</span>
              <div className="flex gap-0.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-bg-raised" />
                <span className="h-2.5 w-2.5 rounded-sm bg-accent/40" />
                <span className="h-2.5 w-2.5 rounded-sm bg-accent/65" />
                <span className="h-2.5 w-2.5 rounded-sm bg-accent" />
              </div>
              <span>more</span>
            </div>
          </div>
        </Card>

        <SegmentedControl options={FILTER_OPTS} value={filter} onChange={setFilter} />

        {filtered === null ? (
          <Card padding="md">
            <div className="h-24 animate-pulse rounded bg-bg-raised" />
          </Card>
        ) : filtered.length === 0 ? (
          <Card padding="md">
            <EmptyState
              icon={CalendarIcon}
              title="No sessions yet"
              body="Log your first jump."
              action={{ label: "Log session", onClick: () => nav("/log") }}
            />
          </Card>
        ) : (
          grouped.map((g) => (
            <div key={g.label}>
              <h2 className="mb-2 px-1 text-micro font-semibold uppercase tracking-wider text-text-tertiary">
                {g.label}
              </h2>
              <div className="space-y-2">
                {g.rows.map((s) => (
                  <SessionCard key={s.id} session={s} fmt={fmt} />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}

function SessionCard({
  session,
  fmt,
}: {
  session: Session & { attempts?: Attempt[] };
  fmt: (mm: number | null | undefined) => string;
}) {
  // Most session rows in /sessions/mine/list don't include attempts; the
  // detail call does. We show attempt-count + top height when available, and
  // fall back gracefully when it's not.
  const top = session.attempts
    ?.filter((a) => a.result === "clear")
    .reduce<Attempt | null>(
      (best, a) => (!best || a.bar_height_mm > best.bar_height_mm ? a : best),
      null,
    );
  return (
    <Link to={`/log/${session.id}`} id={`day-${session.date}`} className="block">
      <Card interactive padding="sm" className="!p-4">
        <div className="flex items-start gap-3">
          <div className="w-12 shrink-0 text-center">
            <div className="font-display text-display-md font-semibold tabular-nums text-text-primary">
              {new Date(session.date + "T00:00:00").getDate()}
            </div>
            <div className="text-micro uppercase tracking-wider text-text-tertiary">
              {new Date(session.date + "T00:00:00").toLocaleDateString(undefined, {
                month: "short",
              })}
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <Tag variant="neutral">{session.type}</Tag>
              {session.surface && <Tag variant="neutral">{session.surface}</Tag>}
            </div>
            {session.location && (
              <p className="mt-1.5 truncate text-caption text-text-secondary">
                {session.location}
              </p>
            )}
          </div>
          {top && (
            <div className="text-right">
              <div className="font-display text-display-md font-semibold tabular-nums text-text-primary">
                {fmt(top.bar_height_mm)}
              </div>
              <div className="text-micro uppercase tracking-wider text-text-tertiary">top</div>
            </div>
          )}
        </div>
      </Card>
    </Link>
  );
}
