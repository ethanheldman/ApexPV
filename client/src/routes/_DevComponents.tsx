// Visual QA route for the new design system primitives.
// Renders every component from src/components/ui on a `bg-bg-base` canvas
// so we can verify them before migrating real screens.
//
// Reachable at /_dev/components when the redesign is in progress.

import { useState } from "react";
import {
  Activity,
  ArrowLeft,
  BarChart3,
  Bell,
  Calendar,
  ChevronRight,
  Home,
  Plus,
  Settings as SettingsIcon,
  Trophy,
  User,
} from "lucide-react";
import {
  AppHeader,
  BottomNav,
  Button,
  Card,
  EmptyState,
  Field,
  HeightPicker,
  IconButton,
  NumberStepper,
  SegmentedControl,
  Sheet,
  Stat,
  Tag,
  type Tab,
} from "../components/ui";

const TABS: Tab[] = [
  { to: "/_dev/components", label: "Today", icon: Home },
  { to: "/_dev/components/sessions", label: "Sessions", icon: Calendar },
  { to: "/_dev/components/progress", label: "Progress", icon: BarChart3 },
  { to: "/_dev/components/profile", label: "Profile", icon: User },
];

const RANGE_OPTS = [
  { value: "4w", label: "4w" },
  { value: "12w", label: "12w" },
  { value: "1y", label: "1y" },
  { value: "all", label: "All" },
] as const;

export default function DevComponents() {
  const [seg, setSeg] = useState<(typeof RANGE_OPTS)[number]["value"]>("12w");
  const [grip, setGrip] = useState(165);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [unit, setUnit] = useState<"imperial" | "metric">("imperial");
  const [heightMm, setHeightMm] = useState(4191); // 13'9" exact

  return (
    <div className="min-h-screen bg-bg-base text-text-primary">
      <AppHeader
        title="Components"
        leading={
          <IconButton aria-label="Back" variant="ghost">
            <ArrowLeft className="h-5 w-5" strokeWidth={1.75} />
          </IconButton>
        }
        trailing={
          <IconButton aria-label="Notifications" variant="ghost">
            <Bell className="h-5 w-5" strokeWidth={1.75} />
          </IconButton>
        }
      />

      <main className="mx-auto max-w-md space-y-10 px-gutter pb-32 pt-6">
        <Section title="Type scale">
          <div className="space-y-2">
            <p className="text-display-xl font-display font-semibold tabular-nums tracking-tight">
              14′ 6″
            </p>
            <p className="text-display-lg font-display font-semibold tabular-nums">13′ 9″</p>
            <p className="text-display-md font-display font-semibold tabular-nums">4.19m</p>
            <p className="text-title font-semibold">Title — 20/26</p>
            <p className="text-body text-text-secondary">Body — 15/22</p>
            <p className="text-caption text-text-tertiary">Caption — 13/18</p>
            <p className="text-micro text-text-tertiary uppercase tracking-wider">
              Micro — 11/14 caps
            </p>
          </div>
        </Section>

        <Section title="Buttons">
          <div className="flex flex-wrap gap-2">
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
            <Button size="lg">Large</Button>
            <Button loading>Loading</Button>
            <Button disabled>Disabled</Button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <IconButton aria-label="add">
              <Plus className="h-5 w-5" strokeWidth={1.75} />
            </IconButton>
            <IconButton aria-label="settings" variant="primary">
              <SettingsIcon className="h-5 w-5" strokeWidth={1.75} />
            </IconButton>
            <IconButton aria-label="ghost" variant="ghost">
              <Activity className="h-5 w-5" strokeWidth={1.75} />
            </IconButton>
          </div>
        </Section>

        <Section title="Cards & stats">
          <Card>
            <div className="text-micro uppercase tracking-wider text-text-tertiary">
              Personal best
            </div>
            <Stat value="14′ 6″" label="set 23 days ago at Bowdoin" size="xl" />
            <div className="mt-3">
              <Tag variant="accent" dot>
                ▲ new PR this week
              </Tag>
            </div>
          </Card>
          <div className="grid grid-cols-3 gap-3">
            <Card padding="sm">
              <Stat value="6" label="Sessions" />
            </Card>
            <Card padding="sm">
              <Stat value="42" label="Jumps" delta={{ value: 8, direction: "up" }} />
            </Card>
            <Card padding="sm">
              <Stat value="4.10" unit="m" label="Avg top" />
            </Card>
          </div>
          <Card interactive>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-caption text-text-tertiary">Last session</div>
                <div className="mt-1 font-display text-display-md font-semibold tabular-nums">
                  13′ 9″
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-text-tertiary" strokeWidth={1.75} />
            </div>
          </Card>
        </Section>

        <Section title="Tags">
          <div className="flex flex-wrap gap-2">
            <Tag>Indoor</Tag>
            <Tag variant="accent" dot>
              PR
            </Tag>
            <Tag variant="success">Clear</Tag>
            <Tag variant="warn">Bail</Tag>
            <Tag variant="danger">Miss</Tag>
          </div>
        </Section>

        <Section title="Segmented control">
          <SegmentedControl options={RANGE_OPTS} value={seg} onChange={setSeg} />
        </Section>

        <Section title="Number stepper">
          <NumberStepper value={grip} onChange={setGrip} min={120} max={200} unit="in" />
          <p className="mt-2 text-caption text-text-tertiary">
            Long-press the buttons to accelerate.
          </p>
        </Section>

        <Section title="Field">
          <div className="space-y-3">
            <Field label="Display name" placeholder="e.g. Mona Reyes" />
            <Field
              label="Grip"
              placeholder="0"
              type="number"
              inputMode="decimal"
              rightAdornment="in"
              helper="Up to 200 inches"
            />
            <Field label="Email" type="email" defaultValue="not-an-email" error="Enter a valid email." />
          </div>
        </Section>

        <Section title="Height picker">
          <Card>
            <div className="mb-3 flex items-center justify-between">
              <Stat value={(heightMm / 25.4 / 12).toFixed(0) + "′"} label="ft" size="sm" />
              <SegmentedControl
                options={[
                  { value: "imperial", label: "ft / in" },
                  { value: "metric", label: "m" },
                ]}
                value={unit}
                onChange={setUnit}
                fullWidth={false}
              />
            </div>
            <HeightPicker valueMm={heightMm} onChange={setHeightMm} unit={unit} />
            <p className="mt-3 text-center text-caption text-text-tertiary">
              {(heightMm / 1000).toFixed(2)}m · stored as {heightMm}mm
            </p>
          </Card>
        </Section>

        <Section title="Sheet">
          <Button onClick={() => setSheetOpen(true)} variant="secondary">
            Open bottom sheet
          </Button>
          <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Log a jump">
            <div className="space-y-4">
              <Field label="Result" placeholder="Clear / Miss / Bail" />
              <Field label="Notes" placeholder="Felt heavy on takeoff" />
              <Button fullWidth>Save jump</Button>
            </div>
          </Sheet>
        </Section>

        <Section title="Empty state">
          <EmptyState
            icon={Trophy}
            title="No PR yet"
            body="Go set one. Log a session and your highest cleared height shows up here."
            action={{ label: "Log session", onClick: () => {} }}
          />
        </Section>
      </main>

      <BottomNav tabs={TABS} />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-micro font-semibold uppercase tracking-wider text-text-tertiary">
        {title}
      </h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
