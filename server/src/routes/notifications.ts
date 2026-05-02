import type { FastifyInstance } from "fastify";
import { q, qAll, qOne } from "../db.js";

export async function notifRoutes(app: FastifyInstance) {
  app.get("/", { preHandler: (app as any).auth }, async (req: any) => {
    return qAll(
      `SELECT n.*, a.handle AS actor_handle, a.display_name AS actor_name,
              a.avatar_seed AS actor_seed, a.avatar_url AS actor_url, c.body AS comment_body
       FROM notifications n
       LEFT JOIN users a ON a.id = n.actor_id
       LEFT JOIN comments c ON c.id = n.comment_id
       WHERE n.user_id = ?
       ORDER BY n.id DESC LIMIT 100`,
      [req.user.id],
    );
  });

  app.get("/unread-count", { preHandler: (app as any).auth }, async (req: any) => {
    const row = await qOne<{ c: number }>(
      "SELECT COUNT(*)::int as c FROM notifications WHERE user_id = ? AND read_at IS NULL",
      [req.user.id],
    );
    return { count: row?.c ?? 0 };
  });

  app.post("/mark-all-read", { preHandler: (app as any).auth }, async (req: any) => {
    await q(
      "UPDATE notifications SET read_at = now() WHERE user_id = ? AND read_at IS NULL",
      [req.user.id],
    );
    return { ok: true };
  });
}
