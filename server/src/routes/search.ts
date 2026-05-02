import type { FastifyInstance } from "fastify";
import { db } from "../db.js";

export async function searchRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { q?: string } }>("/", async (req) => {
    const q = (req.query.q ?? "").trim();
    if (!q) return { users: [], posts: [] };
    const t = `%${q}%`;
    const users = db
      .prepare(
        `SELECT id, handle, display_name, school, avatar_seed, pr_height_mm
         FROM users
         WHERE handle LIKE ? OR display_name LIKE ? OR school LIKE ?
         ORDER BY pr_height_mm DESC LIMIT 8`,
      )
      .all(t, t, t);
    const posts = db
      .prepare(
        `SELECT p.id, p.caption, p.created_at, u.handle, u.display_name, u.avatar_seed
         FROM posts p JOIN users u ON u.id = p.user_id
         WHERE p.visibility = 'public' AND p.caption LIKE ?
         ORDER BY p.id DESC LIMIT 8`,
      )
      .all(t);
    return { users, posts };
  });
}
