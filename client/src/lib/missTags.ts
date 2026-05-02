export const MISS_TAG_GROUPS: { group: string; tags: { id: string; label: string }[] }[] = [
  {
    group: "Approach",
    tags: [
      { id: "short_runway", label: "short on runway" },
      { id: "blew_through", label: "blew through" },
      { id: "drift_left", label: "drifted left" },
      { id: "drift_right", label: "drifted right" },
      { id: "slow_penultimate", label: "slow penultimate" },
    ],
  },
  {
    group: "Plant",
    tags: [
      { id: "late_plant", label: "late plant" },
      { id: "low_plant", label: "low plant" },
      { id: "off_center", label: "off-center plant" },
    ],
  },
  {
    group: "Drive",
    tags: [
      { id: "dead_drive", label: "dead drive knee" },
      { id: "arms_collapse", label: "arms collapsed" },
      { id: "no_swing", label: "no swing" },
      { id: "late_drive", label: "late drive" },
      { id: "didnt_take_up", label: "didn't take it up" },
    ],
  },
  {
    group: "Inversion",
    tags: [
      { id: "late_tap", label: "late tap" },
      { id: "open_hips", label: "open hips" },
      { id: "no_shoot", label: "no shoot" },
    ],
  },
  {
    group: "Bar",
    tags: [
      { id: "chest_knock", label: "chest knock" },
      { id: "thigh_knock", label: "thigh knock" },
      { id: "arm_knock", label: "arm knock" },
      { id: "came_down", label: "came down on it" },
    ],
  },
];

const ALL = MISS_TAG_GROUPS.flatMap((g) => g.tags);
export const MISS_TAG_LABEL: Record<string, string> = Object.fromEntries(
  ALL.map((t) => [t.id, t.label]),
);
