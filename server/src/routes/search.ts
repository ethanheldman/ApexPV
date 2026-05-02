import type { FastifyInstance } from "fastify";
import { qAll } from "../db.js";

export async function searchRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { q?: string } }>("/", async (req) => {
    const q = (req.query.q ?? "").trim();
    if (!q) return { users: [], posts: [] };
    const t = `%${q}%`;
    const users = await qAll(
      `SELECT id, handle, display_name, school, avatar_seed, avatar_url, pr_height_mm
       FROM users
       WHERE handle ILIKE ? OR display_name ILIKE ? OR school ILIKE ?
       ORDER BY pr_height_mm DESC NULLS LAST LIMIT 8`,
      [t, t, t],
    );
    const posts = await qAll(
      `SELECT p.id, p.caption, p.created_at, u.handle, u.display_name, u.avatar_seed, u.avatar_url
       FROM posts p JOIN users u ON u.id = p.user_id
       WHERE p.visibility = 'public' AND p.caption ILIKE ?
       ORDER BY p.id DESC LIMIT 8`,
      [t],
    );
    return { users, posts };
  });
}
