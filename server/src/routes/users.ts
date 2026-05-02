import type { FastifyInstance } from "fastify";
import { db } from "../db.js";
import type { User } from "../types.js";

function publicUser(u: any) {
  if (!u) return null;
  const { password_hash, email, ...rest } = u;
  return rest;
}

export async function userRoutes(app: FastifyInstance) {
  // Public profile by handle
  app.get<{ Params: { handle: string } }>("/:handle", async (req, reply) => {
    const u = db.prepare("SELECT * FROM users WHERE handle = ?").get(req.params.handle) as User;
    if (!u) return reply.code(404).send({ error: "not found" });

    const followers = (db
      .prepare("SELECT COUNT(*) as c FROM follows WHERE followee_id = ?")
      .get(u.id) as any).c as number;
    const following = (db
      .prepare("SELECT COUNT(*) as c FROM follows WHERE follower_id = ?")
      .get(u.id) as any).c as number;
    const total_attempts = (db
      .prepare("SELECT COUNT(*) as c FROM attempts WHERE user_id = ?")
      .get(u.id) as any).c as number;
    const total_clearances = (db
      .prepare("SELECT COUNT(*) as c FROM attempts WHERE user_id = ? AND result = 'clear'")
      .get(u.id) as any).c as number;

    return { ...publicUser(u), followers, following, total_attempts, total_clearances };
  });

  // List users (with optional filters)
  app.get<{ Querystring: { gender?: string; level?: string; q?: string } }>(
    "/",
    async (req) => {
      const { gender, level, q } = req.query;
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
      if (q) {
        where.push("(handle LIKE ? OR display_name LIKE ? OR school LIKE ?)");
        const t = `%${q}%`;
        params.push(t, t, t);
      }
      const sql =
        "SELECT * FROM users" +
        (where.length ? ` WHERE ${where.join(" AND ")}` : "") +
        " ORDER BY (pr_height_mm IS NULL), pr_height_mm DESC";
      const rows = db.prepare(sql).all(...params) as User[];
      return rows.map(publicUser);
    },
  );

  // Demo summary for /login (always-current PRs, no auth)
  app.get("/demo/summary", async () => {
    const handles = ["mona", "kai", "jules", "demo"];
    const ph = handles.map(() => "?").join(",");
    const rows = db
      .prepare(
        `SELECT handle, display_name, school, pr_height_mm, level
         FROM users WHERE handle IN (${ph})`,
      )
      .all(...handles);
    return rows;
  });

  // Follow / unfollow
  app.post<{ Params: { handle: string } }>(
    "/:handle/follow",
    { preHandler: (app as any).auth },
    async (req: any, reply) => {
      const target = db.prepare("SELECT id FROM users WHERE handle = ?").get(req.params.handle) as
        | { id: number }
        | undefined;
      if (!target) return reply.code(404).send({ error: "not found" });
      if (target.id === req.user.id) return reply.code(400).send({ error: "cannot follow self" });
      const existing = db
        .prepare("SELECT 1 FROM follows WHERE follower_id = ? AND followee_id = ?")
        .get(req.user.id, target.id);
      db.prepare("INSERT OR IGNORE INTO follows (follower_id, followee_id) VALUES (?, ?)").run(
        req.user.id,
        target.id,
      );
      if (!existing) {
        db.prepare(
          "INSERT INTO notifications (user_id, actor_id, type) VALUES (?, ?, 'follow')",
        ).run(target.id, req.user.id);
      }
      return { ok: true };
    },
  );

  app.delete<{ Params: { handle: string } }>(
    "/:handle/follow",
    { preHandler: (app as any).auth },
    async (req: any, reply) => {
      const target = db.prepare("SELECT id FROM users WHERE handle = ?").get(req.params.handle) as
        | { id: number }
        | undefined;
      if (!target) return reply.code(404).send({ error: "not found" });
      db.prepare("DELETE FROM follows WHERE follower_id = ? AND followee_id = ?").run(
        req.user.id,
        target.id,
      );
      return { ok: true };
    },
  );

  app.get<{ Params: { handle: string } }>(
    "/:handle/follow-status",
    { preHandler: (app as any).auth },
    async (req: any, reply) => {
      const target = db.prepare("SELECT id FROM users WHERE handle = ?").get(req.params.handle) as
        | { id: number }
        | undefined;
      if (!target) return reply.code(404).send({ error: "not found" });
      const row = db
        .prepare("SELECT 1 FROM follows WHERE follower_id = ? AND followee_id = ?")
        .get(req.user.id, target.id);
      return { following: !!row };
    },
  );
}
