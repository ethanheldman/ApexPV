// Chud leaderboards — silly stats nobody puts on their profile.
import type { FastifyInstance } from "fastify";
import { qAll } from "../db.js";

export async function funRoutes(app: FastifyInstance) {
  app.get("/run-throughs", async () => {
    return qAll(
      `SELECT u.handle, u.display_name, u.avatar_seed, u.avatar_url, u.school,
              COUNT(*)::int AS count
       FROM attempts a
       JOIN users u ON u.id = a.user_id
       WHERE a.result = 'pass'
          OR (a.miss_tags IS NOT NULL AND a.miss_tags LIKE '%blew_through%')
       GROUP BY u.id, u.handle, u.display_name, u.avatar_seed, u.avatar_url, u.school
       ORDER BY count DESC LIMIT 25`,
    );
  });

  app.get("/under-the-bar", async () => {
    return qAll(
      `SELECT u.handle, u.display_name, u.avatar_seed, u.avatar_url, u.school,
              COUNT(*)::int AS count
       FROM attempts a
       JOIN users u ON u.id = a.user_id
       WHERE a.miss_tags IS NOT NULL
         AND (a.miss_tags LIKE '%short_runway%' OR a.miss_tags LIKE '%didnt_take_up%')
       GROUP BY u.id, u.handle, u.display_name, u.avatar_seed, u.avatar_url, u.school
       ORDER BY count DESC LIMIT 25`,
    );
  });

  app.get("/grip-misuse", async () => {
    return qAll(
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
       GROUP BY u.id, u.handle, u.display_name, u.avatar_seed, u.avatar_url, u.school
       HAVING MAX(worst.gap_in) IS NOT NULL
       ORDER BY gap_in DESC LIMIT 25`,
    );
  });

  app.get("/most-stuck", async () => {
    return qAll(
      `SELECT u.handle, u.display_name, u.avatar_seed, u.avatar_url, u.school,
              a.bar_height_mm, COUNT(*)::int AS knocks
       FROM attempts a JOIN users u ON u.id = a.user_id
       WHERE a.result = 'knock'
       GROUP BY u.id, u.handle, u.display_name, u.avatar_seed, u.avatar_url, u.school, a.bar_height_mm
       ORDER BY knocks DESC LIMIT 25`,
    );
  });
}
