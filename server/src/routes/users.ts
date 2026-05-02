import type { FastifyInstance } from "fastify";
import { q, qAll, qOne } from "../db.js";
import type { User } from "../types.js";

function publicUser(u: any) {
  if (!u) return null;
  const { password_hash, email, ...rest } = u;
  return rest;
}

export async function userRoutes(app: FastifyInstance) {
  // Public profile by handle
  app.get<{ Params: { handle: string } }>("/:handle", async (req, reply) => {
    const u = await qOne<User>("SELECT * FROM users WHERE handle = ?", [req.params.handle]);
    if (!u) return reply.code(404).send({ error: "not found" });

    const followers = (
      await qOne<{ c: number }>("SELECT COUNT(*)::int as c FROM follows WHERE followee_id = ?", [u.id])
    )!.c;
    const following = (
      await qOne<{ c: number }>("SELECT COUNT(*)::int as c FROM follows WHERE follower_id = ?", [u.id])
    )!.c;
    const total_attempts = (
      await qOne<{ c: number }>("SELECT COUNT(*)::int as c FROM attempts WHERE user_id = ?", [u.id])
    )!.c;
    const total_clearances = (
      await qOne<{ c: number }>(
        "SELECT COUNT(*)::int as c FROM attempts WHERE user_id = ? AND result = 'clear'",
        [u.id],
      )
    )!.c;

    return { ...publicUser(u), followers, following, total_attempts, total_clearances };
  });

  // List users (with optional filters)
  app.get<{ Querystring: { gender?: string; level?: string; q?: string } }>(
    "/",
    async (req) => {
      const { gender, level, q: search } = req.query;
      const where: string[] = [];
      const params: any[] = [];
      if (gender) {
        where.push("gender = ?");
        params.push(gender);
      }
      if (level) {
        where.push("level = ?");
        params.push(level);
      }
      if (search) {
        where.push("(handle ILIKE ? OR display_name ILIKE ? OR school ILIKE ?)");
        const t = `%${search}%`;
        params.push(t, t, t);
      }
      const sql =
        "SELECT * FROM users" +
        (where.length ? ` WHERE ${where.join(" AND ")}` : "") +
        " ORDER BY (pr_height_mm IS NULL), pr_height_mm DESC";
      const rows = await qAll<User>(sql, params);
      return rows.map(publicUser);
    },
  );

  // Demo summary for /login (always-current PRs, no auth)
  app.get("/demo/summary", async () => {
    const handles = ["mona", "kai", "jules", "demo"];
    const ph = handles.map(() => "?").join(",");
    return qAll(
      `SELECT handle, display_name, school, pr_height_mm, level
       FROM users WHERE handle IN (${ph})`,
      handles,
    );
  });

  // Follow / unfollow
  app.post<{ Params: { handle: string } }>(
    "/:handle/follow",
    { preHandler: (app as any).auth },
    async (req: any, reply) => {
      const target = await qOne<{ id: number }>("SELECT id FROM users WHERE handle = ?", [
        req.params.handle,
      ]);
      if (!target) return reply.code(404).send({ error: "not found" });
      if (target.id === req.user.id) return reply.code(400).send({ error: "cannot follow self" });
      const existing = await qOne(
        "SELECT 1 FROM follows WHERE follower_id = ? AND followee_id = ?",
        [req.user.id, target.id],
      );
      await q(
        "INSERT INTO follows (follower_id, followee_id) VALUES (?, ?) ON CONFLICT DO NOTHING",
        [req.user.id, target.id],
      );
      if (!existing) {
        await q(
          "INSERT INTO notifications (user_id, actor_id, type) VALUES (?, ?, 'follow')",
          [target.id, req.user.id],
        );
      }
      return { ok: true };
    },
  );

  app.delete<{ Params: { handle: string } }>(
    "/:handle/follow",
    { preHandler: (app as any).auth },
    async (req: any, reply) => {
      const target = await qOne<{ id: number }>("SELECT id FROM users WHERE handle = ?", [
        req.params.handle,
      ]);
      if (!target) return reply.code(404).send({ error: "not found" });
      await q("DELETE FROM follows WHERE follower_id = ? AND followee_id = ?", [
        req.user.id,
        target.id,
      ]);
      return { ok: true };
    },
  );

  app.get<{ Params: { handle: string } }>(
    "/:handle/follow-status",
    { preHandler: (app as any).auth },
    async (req: any, reply) => {
      const target = await qOne<{ id: number }>("SELECT id FROM users WHERE handle = ?", [
        req.params.handle,
      ]);
      if (!target) return reply.code(404).send({ error: "not found" });
      const row = await qOne(
        "SELECT 1 FROM follows WHERE follower_id = ? AND followee_id = ?",
        [req.user.id, target.id],
      );
      return { following: !!row };
    },
  );
}
