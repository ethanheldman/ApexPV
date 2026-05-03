export type User = {
  id: number;
  handle: string;
  email: string;
  display_name: string;
  bio: string | null;
  school: string | null;
  gender: "m" | "f" | null;
  level: "hs" | "college" | "open" | "masters" | null;
  pr_height_mm: number | null;
  pr_date: string | null;
  avatar_seed: string | null;
  avatar_url: string | null;
  height_cm: number | null;
  weight_lb: number | null;
  unit_pref: "imperial" | "metric";
  created_at: string;
};

export type Pole = {
  id: number;
  user_id: number;
  make: string;
  length_in: number;
  weight_lb: number;
  flex: number | null;
  nickname: string | null;
  retired: number;
  attempts_count: number;
  deleted_at: string | null;
  created_at: string;
};

export type Meet = {
  id: number;
  name: string;
  location: string | null;
  date: string;
  host_user_id: number | null;
  created_at: string;
};

export type Session = {
  id: number;
  user_id: number;
  type: "practice" | "meet";
  date: string;
  location: string | null;
  surface: "indoor" | "outdoor" | null;
  wind_ms: number | null;
  temp_f: number | null;
  energy: number | null;
  notes: string | null;
  cues_had: string | null;
  cues_work: string | null;
  meet_id: number | null;
  created_at: string;
};

export type Attempt = {
  id: number;
  session_id: number;
  user_id: number;
  ordinal: number;
  bar_height_mm: number;
  result: "clear" | "knock" | "pass" | "bail";
  pole_id: number | null;
  grip_in: number | null;
  step_in: number | null;
  run_up_steps: number | null;
  miss_tags: string | null;
  notes: string | null;
  video_url: string | null;
  coach_note: string | null;
  created_at: string;
};

export type Post = {
  id: number;
  user_id: number;
  session_id: number | null;
  visibility: "private" | "followers" | "public";
  caption: string | null;
  pinned_attempt_ids: string | null;
  is_pr: number;
  is_first_clearance: number;
  repost_of_id: number | null;
  created_at: string;
  updated_at: string | null;
};
