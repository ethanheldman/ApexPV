import type { FastifyInstance } from "fastify";
import { db } from "../db.js";

export async function notifRoutes(app: FastifyInstance) {
  app.get("/", { preHandler: (app as any).auth }, async (req: any) => {
    const rows = db
      .prepare(
        `SELECT n.*, a.handle AS actor_handle, a.display_name AS actor_name,
                a.avatar_seed AS actor_seed, c.body AS comment_body
         FROM notifications n
         LEFT JOIN users a ON a.id = n.actor_id
         LEFT JOIN comments c ON c.id = n.comment_id
         WHERE n.user_id = ?
         ORDER BY n.id DESC LIMIT 100`,
      )
      .all(req.user.id);
    return rows;
  });

  app.get("/unread-count", { preHandler: (app as any).auth }, async (req: any) => {
    const row = db
      .prepare("SELECT COUNT(*) as c FROM notifications WHERE user_id = ? AND read_at IS NULL")
      .get(req.user.id) as { c: number };
    return { count: row.c };
  });

  app.post("/mark-all-read", { preHandler: (app as any).auth }, async (req: any) => {
    db.prepare(
      "UPDATE notifications SET read_at = datetime('now') WHERE user_id = ? AND read_at IS NULL",
    ).run(req.user.id);
    return { ok: true };
  });
}
