-- Add `target_step_in` to poles so each pole carries its expected step
-- distance (inches from box at takeoff). Used to derive under/on/out for
-- every attempt logged on that pole.
--
-- Paste this into Supabase → SQL editor → Run, before deploying the matching
-- backend code.

alter table poles
  add column if not exists target_step_in real;

-- Optional: backfill nothing — leave existing poles with target_step_in NULL
-- so attempts on them just show "no target set" until the owner sets one.
