// Chud leaderboards — silly stats nobody puts on their profile.
import type { FastifyInstance } from "fastify";
import { db } from "../db.js";

export async function funRoutes(app: FastifyInstance) {
  // Most run-throughs (passes/blew_through tagged misses)
  app.get("/run-throughs", async () => {
    const rows = db
      .prepare(
        `SELECT u.handle, u.display_name, u.avatar_seed, u.avatar_url, u.school,
                COUNT(*) AS count
         FROM attempts a
         JOIN users u ON u.id = a.user_id
         WHERE a.result = 'pass'
            OR (a.miss_tags IS NOT NULL AND a.miss_tags LIKE '%blew_through%')
         GROUP BY u.id
         ORDER BY count DESC LIMIT 25`,
      )
      .all();
    return rows;
  });

  // Most "short on runway" / "didnt take up" — under-cooked attempts
  app.get("/under-the-bar", async () => {
    const rows = db
      .prepare(
        `SELECT u.handle, u.display_name, u.avatar_seed, u.avatar_url, u.school,
                COUNT(*) AS count
         FROM attempts a
         JOIN users u ON u.id = a.user_id
         WHERE a.miss_tags IS NOT NULL
           AND (a.miss_tags LIKE '%short_runway%' OR a.miss_tags LIKE '%didnt_take_up%')
         GROUP BY u.id
         ORDER BY count DESC LIMIT 25`,
      )
      .all();
    return rows;
  });

  // Worst grip-vs-clearance: highest grip used to clear the lowest height
  // i.e. you have a giant grip but you keep clearing tiny bars on it.
  // Compute (grip_in - bar_height_in) where higher = worse use of the grip.
  app.get("/grip-misuse", async () => {
    const rows = db
      .prepare(
        `WITH worst AS (
           SELECT a.user_id, a.id,
                  a.grip_in,
                  a.bar_height_mm,
                  (a.grip_in - (a.bar_height_mm / 25.4)) AS gap_in
           FROM attempts a
           WHERE a.result = 'clear' AND a.grip_in IS NOT NULL
         )
         SELECT u.handle, u.display_name, u.avatar_seed, u.avatar_url, u.school,
                MAX(worst.gap_in) AS gap_in,
                MAX(worst.grip_in) AS grip_in,
                MIN(worst.bar_height_mm) AS bar_height_mm
         FROM worst JOIN users u ON u.id = worst.user_id
         GROUP BY u.id
         HAVING gap_in IS NOT NULL
         ORDER BY gap_in DESC LIMIT 25`,
      )
      .all();
    return rows;
  });

  // Most attempts at a single height without clearing it — the "stuck"
  // leaderboard. Counts knocks per user, per height.
  app.get("/most-stuck", async () => {
    const rows = db
      .prepare(
        `SELECT u.handle, u.display_name, u.avatar_seed, u.avatar_url, u.school,
                a.bar_height_mm, COUNT(*) AS knocks
         FROM attempts a JOIN users u ON u.id = a.user_id
         WHERE a.result = 'knock'
         GROUP BY u.id, a.bar_height_mm
         ORDER BY knocks DESC LIMIT 25`,
      )
      .all();
    return rows;
  });
}
