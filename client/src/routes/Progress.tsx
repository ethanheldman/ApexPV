// Progress screen per brief §5.5.
// PR over time line chart, jumps per week bars, height distribution
// histogram, pole rotation donut. All data comes from existing endpoints
// derived client-side.

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "../api";
import { useAuth } from "../auth";
import { AppHeader, Card, EmptyState, SegmentedControl, Stat } from "../components/ui";
import { useUnit } from "../lib/unit";
import { mmToFtIn, mmToMeters, poleLenToFtIn } from "../lib/format";
import type { Pole } from "../types";

type ProgPoint = { date: string; height: number };
type Window = "4w" | "12w" | "1y" | "all";

const WINDOW_OPTS = [
  { value: "4w" as const, label: "4w" },
  { value: "12w" as const, label: "12w" },
  { value: "1y" as const, label: "1y" },
  { value: "all" as const, label: "All" },
];

const WINDOW_DAYS: Record<Window, number | null> = {
  "4w": 28,
  "12w": 84,
  "1y": 365,
  all: null,
};

const DAY_MS = 24 * 60 * 60 * 1000;

export default function Progress() {
  const { user } = useAuth();
  const { unit, fmt } = useUnit();
  const [window, setWindow] = useState<Window>("12w");
  const [progression, setProgression] = useState<ProgPoint[] | null>(null);
  const [poles, setPoles] = useState<Pole[]>([]);

  useEffect(() => {
    if (!user) return;
    api<ProgPoint[]>(`/api/attempts/stats/${user.handle}/progression`)
      .then(setProgression)
      .catch(() => setProgression([]));
    api<Pole[]>(`/api/poles/by/${user.handle}`).then(setPoles).catch(() => setPoles([]));
  }, [user]);

  // Filter the progression by window.
  const windowed = useMemo(() => {
    if (!progression) return null;
    const days = WINDOW_DAYS[window];
    if (days == null) return progression;
    const cutoff = Date.now() - days * DAY_MS;
    return progression.filter(
      (p) => new Date(p.date + "T00:00:00Z").getTime() >= cutoff,
    );
  }, [progression, window]);

  // Running PR over the window — at each point, the cumulative max so far.
  const prSeries = useMemo(() => {
    if (!windowed) return [];
    let max = 0;
    return windowed.map((p) => {
      max = Math.max(max, p.height);
      return { date: p.date, mm: max, raw: p.height };
    });
  }, [windowed]);

  // Jumps-per-week (using session days as a proxy — coarse but works).
  const weeklyBars = useMemo(() => {
    if (!windowed) return [];
    const buckets: Record<string, number> = {};
    for (const p of windowed) {
      const d = new Date(p.date + "T00:00:00Z");
      // Week starting Monday
      const day = d.getUTCDay() || 7;
      const monday = new Date(d.getTime() - (day - 1) * DAY_MS);
      const k = monday.toISOString().slice(0, 10);
      buckets[k] = (buckets[k] ?? 0) + 1;
    }
    return Object.entries(buckets)
      .sort()
      .map(([week, sessions]) => ({ week, sessions }));
  }, [windowed]);

  // Height distribution: bucket clearances by 6 inches imperial / 15 cm metric.
  const histogram = useMemo(() => {
    if (!windowed) return [];
    const bucketMm = unit === "metric" ? 150 : Math.round(6 * 25.4);
    const counts: Record<number, number> = {};
    for (const p of windowed) {
      const k = Math.floor(p.height / bucketMm) * bucketMm;
      counts[k] = (counts[k] ?? 0) + 1;
    }
    return Object.entries(counts)
      .map(([mm, count]) => ({ mm: Number(mm), count }))
      .sort((a, b) => a.mm - b.mm);
  }, [windowed, unit]);

  // Pole rotation — count attempts referencing each pole. Approx via attempts_count.
  const poleSlices = useMemo(() => {
    return poles
      .filter((p) => p.attempts_count > 0)
      .map((p) => ({
        name: `${poleLenToFtIn(p.length_in)} / ${p.weight_lb}lb`,
        value: p.attempts_count,
        nickname: p.nickname,
      }))
      .sort((a, b) => b.value - a.value);
  }, [poles]);

  const POLE_COLORS = [
    "#22D3EE", "#67E8F9", "#0E7490",
    "#A1A6B0", "#6B7280", "#3F4651",
    "#4ADE80", "#60A5FA",
  ];

  const noData = windowed !== null && windowed.length === 0;

  return (
    <>
      <AppHeader title="Progress" />

      <div className="mx-auto max-w-md space-y-5 px-gutter pt-4 pb-6">
        <SegmentedControl
          options={WINDOW_OPTS}
          value={window}
          onChange={setWindow}
        />

        {noData ? (
          <Card padding="md">
            <EmptyState
              title="No clearances in this window"
              body="Try a wider time range, or log some clears."
            />
          </Card>
        ) : (
          <>
            {/* PR over time */}
            <Card padding="md">
              <p className="text-micro font-semibold uppercase tracking-wider text-text-tertiary">
                PR over time
              </p>
              <div className="mt-3 flex items-baseline gap-3">
                <Stat
                  value={fmt(user?.pr_height_mm ?? null)}
                  label="standing PR"
                  size="lg"
                />
              </div>
              {prSeries.length === 0 ? (
                <div className="mt-4 h-40 grid place-items-center text-caption text-text-tertiary">
                  No data
                </div>
              ) : (
                <div className="mt-4 h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={prSeries} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 10, fill: "#6B7280" }}
                        tickFormatter={(s: string) => {
                          const d = new Date(s + "T12:00:00");
                          return d.toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                          });
                        }}
                        stroke="#20232A"
                      />
                      <YAxis
                        domain={["dataMin - 100", "dataMax + 100"]}
                        tick={{ fontSize: 10, fill: "#6B7280" }}
                        tickFormatter={(v: number) =>
                          unit === "metric"
                            ? `${(v / 1000).toFixed(2)}m`
                            : mmToFtIn(v)
                        }
                        stroke="#20232A"
                        width={48}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "#0A0B0D",
                          border: "1px solid #20232A",
                          borderRadius: 8,
                          fontSize: 12,
                          color: "#F4F5F7",
                        }}
                        formatter={(v: any) => [fmt(v as number), "PR"]}
                        labelFormatter={(s: string) => s}
                      />
                      <Line
                        type="stepAfter"
                        dataKey="mm"
                        stroke="#22D3EE"
                        strokeWidth={2}
                        dot={{ r: 2.5, stroke: "#22D3EE", fill: "#0A0B0D", strokeWidth: 1.5 }}
                        activeDot={{ r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>

            {/* Jumps per week */}
            <Card padding="md">
              <p className="text-micro font-semibold uppercase tracking-wider text-text-tertiary">
                Days logged per week
              </p>
              {weeklyBars.length === 0 ? (
                <div className="mt-4 h-32 grid place-items-center text-caption text-text-tertiary">
                  No data
                </div>
              ) : (
                <div className="mt-3 h-36">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={weeklyBars} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                      <XAxis
                        dataKey="week"
                        tick={{ fontSize: 10, fill: "#6B7280" }}
                        tickFormatter={(s: string) =>
                          new Date(s + "T12:00:00").toLocaleDateString(undefined, {
                            month: "numeric",
                            day: "numeric",
                          })
                        }
                        stroke="#20232A"
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fontSize: 10, fill: "#6B7280" }}
                        stroke="#20232A"
                        width={28}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "#0A0B0D",
                          border: "1px solid #20232A",
                          borderRadius: 8,
                          fontSize: 12,
                          color: "#F4F5F7",
                        }}
                        cursor={{ fill: "#14161A" }}
                      />
                      <Bar dataKey="sessions" fill="#22D3EE" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>

            {/* Height distribution */}
            <Card padding="md">
              <p className="text-micro font-semibold uppercase tracking-wider text-text-tertiary">
                Clearance distribution
              </p>
              {histogram.length === 0 ? (
                <div className="mt-4 h-32 grid place-items-center text-caption text-text-tertiary">
                  No data
                </div>
              ) : (
                <div className="mt-3 space-y-1.5">
                  {histogram.map((b) => {
                    const max = Math.max(...histogram.map((x) => x.count));
                    const pct = (b.count / max) * 100;
                    return (
                      <div key={b.mm} className="flex items-center gap-3">
                        <span className="w-16 text-caption tabular-nums text-text-secondary">
                          {fmt(b.mm)}
                        </span>
                        <div className="flex-1 h-3 rounded-full bg-bg-raised overflow-hidden">
                          <div
                            className="h-full bg-accent/70"
                            style={{ width: `${Math.max(6, pct)}%` }}
                          />
                        </div>
                        <span className="w-6 text-right text-caption tabular-nums text-text-tertiary">
                          {b.count}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            {/* Pole rotation */}
            <Card padding="md">
              <p className="text-micro font-semibold uppercase tracking-wider text-text-tertiary">
                Pole rotation
              </p>
              {poleSlices.length === 0 ? (
                <div className="mt-4 h-32 grid place-items-center text-caption text-text-tertiary">
                  No pole-tagged attempts in this window
                </div>
              ) : (
                <div className="mt-3 grid grid-cols-[140px_1fr] gap-4 items-center">
                  <div className="h-32">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={poleSlices}
                          dataKey="value"
                          innerRadius={32}
                          outerRadius={56}
                          stroke="none"
                        >
                          {poleSlices.map((_, i) => (
                            <Cell
                              key={i}
                              fill={POLE_COLORS[i % POLE_COLORS.length]}
                            />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <ul className="space-y-1.5">
                    {poleSlices.slice(0, 6).map((s, i) => (
                      <li key={i} className="flex items-center gap-2 text-caption">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ background: POLE_COLORS[i % POLE_COLORS.length] }}
                        />
                        <span className="text-text-secondary tabular-nums">
                          {s.name}
                        </span>
                        <span className="ml-auto text-text-tertiary tabular-nums">
                          {s.value}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          </>
        )}

        {/* Tail: link to the social leaderboard since it's not in the bottom nav. */}
        <Card padding="md" interactive>
          <a href="/leaderboard" className="flex items-center justify-between">
            <div>
              <p className="text-micro font-semibold uppercase tracking-wider text-text-tertiary">
                vs. everyone
              </p>
              <p className="mt-1 text-body text-text-primary">
                Standing leaderboard — see how your PR ranks
              </p>
            </div>
            <span className="text-text-tertiary">→</span>
          </a>
        </Card>
      </div>
    </>
  );
}
