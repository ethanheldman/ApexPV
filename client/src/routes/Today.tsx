// Today screen — landing page per brief §5.1.
//
// Above the fold: app header + hero PR card + quick-log row + this-week strip
// + last-session card. Pulls from existing endpoints; no new server work.

import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Bell, Settings as SettingsIcon, Trophy } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../auth";
import {
  AppHeader,
  Card,
  EmptyState,
  IconButton,
  Stat,
  Tag,
} from "../components/ui";
import { fmtDate, mmToFtIn, mmToMeters } from "../lib/format";
import { useUnit } from "../lib/unit";
import type { Attempt, Session } from "../types";

type FullSession = Session & { attempts: Attempt[] };

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfWeekUtc(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  // Start week on Monday for athletic context.
  const day = d.getUTCDay() || 7;
  if (day !== 1) d.setUTCDate(d.getUTCDate() - (day - 1));
  return d;
}

export default function Today() {
  const { user } = useAuth();
  const { fmt } = useUnit();
  const nav = useNavigate();
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [last, setLast] = useState<FullSession | null>(null);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!user) return;
    api<Session[]>("/api/sessions/mine/list")
      .then(async (rows) => {
        setSessions(rows);
        if (rows.length) {
          const full = await api<FullSession>(`/api/sessions/${rows[0].id}`).catch(
            () => null,
          );
          setLast(full);
        }
      })
      .catch(() => setSessions([]));
    api<{ count: number }>("/api/notifications/unread-count")
      .then((r) => setUnread(r.count))
      .catch(() => {});
  }, [user]);

  // 7-day completion strip — Mon..Sun, filled if a session was logged that day.
  const weekDots = useMemo(() => {
    const start = startOfWeekUtc(new Date());
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start.getTime() + i * DAY_MS);
      return d.toISOString().slice(0, 10);
    });
    const hits = new Set((sessions ?? []).map((s) => s.date));
    return days.map((iso, i) => ({
      iso,
      label: ["M", "T", "W", "T", "F", "S", "S"][i],
      logged: hits.has(iso),
    }));
  }, [sessions]);

  // This-week aggregate stats.
  const weekStats = useMemo(() => {
    const start = startOfWeekUtc(new Date()).getTime();
    const cur = (sessions ?? []).filter(
      (s) => new Date(s.date + "T00:00:00Z").getTime() >= start,
    );
    return {
      sessions: cur.length,
      // Jumps require attempts list which we only have for the latest session.
      // Aggregate via a lightweight helper later if perf becomes an issue;
      // for now we read from the last session, which is the common case.
      sessionDates: cur.map((s) => s.date),
    };
  }, [sessions]);

  // PR set this week?
  const prWasSetThisWeek = useMemo(() => {
    if (!user?.pr_date) return false;
    const start = startOfWeekUtc(new Date()).getTime();
    return new Date(user.pr_date + "T00:00:00Z").getTime() >= start;
  }, [user?.pr_date]);

  const lastTopAttempt = useMemo(() => {
    if (!last) return null;
    return last.attempts
      .filter((a) => a.result === "clear")
      .reduce<Attempt | null>(
        (best, a) => (!best || a.bar_height_mm > best.bar_height_mm ? a : best),
        null,
      );
  }, [last]);

  const prSetAgo = useMemo(() => {
    if (!user?.pr_date) return null;
    const days = Math.floor(
      (Date.now() - new Date(user.pr_date + "T00:00:00Z").getTime()) / DAY_MS,
    );
    if (days === 0) return "today";
    if (days === 1) return "yesterday";
    return `${days} days ago`;
  }, [user?.pr_date]);

  return (
    <>
      <AppHeader
        title={
          <span className="font-display text-title font-semibold tracking-tight">
            apex
          </span>
        }
        trailing={
          <>
            <IconButton
              aria-label="Notifications"
              variant="ghost"
              onClick={() => nav("/notifications")}
              className="relative"
            >
              <Bell className="h-5 w-5" strokeWidth={1.75} />
              {unread > 0 && (
                <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-accent" />
              )}
            </IconButton>
            <IconButton
              aria-label="Settings"
              variant="ghost"
              onClick={() => nav("/settings")}
            >
              <SettingsIcon className="h-5 w-5" strokeWidth={1.75} />
            </IconButton>
          </>
        }
      />

      <div className="mx-auto max-w-md space-y-5 px-gutter pt-4 pb-6">
        {/* Hero PR card */}
        <Card padding="md">
          <div className="flex items-center justify-between">
            <p className="text-micro font-semibold uppercase tracking-wider text-text-tertiary">
              Personal best
            </p>
            {prWasSetThisWeek && (
              <Tag variant="accent" dot>
                ▲ this week
              </Tag>
            )}
          </div>
          {user?.pr_height_mm ? (
            <>
              <div className="mt-3 font-display text-display-xl font-semibold tracking-tight tabular-nums">
                {fmt(user.pr_height_mm)}
              </div>
              <p className="mt-1 text-caption text-text-secondary">
                set {prSetAgo} · {mmToMeters(user.pr_height_mm)}
              </p>
            </>
          ) : (
            <div className="mt-2">
              <EmptyState
                icon={Trophy}
                title="No PR yet"
                body="Go set one. Log a session and your highest cleared height shows up here."
                action={{ label: "Log session", onClick: () => nav("/log") }}
              />
            </div>
          )}
        </Card>

        {/* Quick log row */}
        <div className="grid grid-cols-3 gap-3">
          <QuickAction title="Log session" onClick={() => nav("/log")} />
          <QuickAction title="Meet mode" onClick={() => nav("/meet")} />
          <QuickAction title="Pole bag" onClick={() => nav("/poles")} />
        </div>

        {/* This week strip */}
        <Card padding="md">
          <p className="text-micro font-semibold uppercase tracking-wider text-text-tertiary">
            This week
          </p>
          <div className="mt-3 flex justify-between">
            {weekDots.map((d) => (
              <div key={d.iso} className="flex flex-col items-center gap-1.5">
                <span
                  className={
                    "h-3 w-3 rounded-full " +
                    (d.logged ? "bg-accent" : "bg-bg-raised border border-border-strong")
                  }
                  aria-label={d.logged ? "logged" : "no session"}
                />
                <span className="text-micro uppercase text-text-tertiary">{d.label}</span>
              </div>
            ))}
          </div>
          <div className="mt-5 grid grid-cols-3 gap-3 border-t border-border-subtle pt-4">
            <Stat value={weekStats.sessions} label="Sessions" size="sm" />
            <Stat
              value={lastTopAttempt ? fmt(lastTopAttempt.bar_height_mm) : "—"}
              label="Last top"
              size="sm"
            />
            <Stat
              value={user?.total_clearances ?? 0}
              label="Total clears"
              size="sm"
            />
          </div>
        </Card>

        {/* Last session card */}
        {last ? (
          <Link to={`/log/${last.id}`} className="block">
            <Card interactive padding="md">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-micro font-semibold uppercase tracking-wider text-text-tertiary">
                    Last session · {fmtDate(last.date)}
                  </p>
                  <div className="mt-2 font-display text-display-lg font-semibold tracking-tight tabular-nums">
                    {lastTopAttempt ? fmt(lastTopAttempt.bar_height_mm) : "—"}
                  </div>
                  <p className="mt-1 text-caption text-text-secondary capitalize">
                    {last.type}
                    {last.location && ` · ${last.location}`}
                    {" · "}
                    {last.attempts.length} attempt
                    {last.attempts.length === 1 ? "" : "s"}
                  </p>
                </div>
                <ArrowRight className="h-5 w-5 text-text-tertiary" strokeWidth={1.75} />
              </div>
            </Card>
          </Link>
        ) : sessions !== null ? (
          <Card padding="md">
            <EmptyState
              icon={Trophy}
              title="No sessions yet"
              body="Log your first jump to see your training history here."
              action={{ label: "Log session", onClick: () => nav("/log") }}
            />
          </Card>
        ) : (
          <Card padding="md">
            <div className="h-24 animate-pulse rounded bg-bg-raised" />
          </Card>
        )}
      </div>
    </>
  );
}

function QuickAction({ title, onClick }: { title: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-md border border-border-subtle bg-bg-elevated px-3 py-4 text-center transition-all duration-press ease-apex active:scale-[0.97] hover:bg-bg-raised"
    >
      <span className="text-caption font-medium text-text-primary">{title}</span>
    </button>
  );
}
