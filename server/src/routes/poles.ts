import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { q, qAll, qInsertId, qOne } from "../db.js";
import type { Pole } from "../types.js";

const PoleBody = z.object({
  make: z.string().min(1).max(40),
  length_in: z.number().min(6).max(18),
  weight_lb: z.number().int().min(60).max(220),
  flex: z.number().min(5).max(30).nullable().optional(),
  nickname: z.string().max(40).nullable().optional(),
  retired: z.boolean().optional(),
  target_step_in: z.number().min(0).max(200).nullable().optional(),
});

const ACTIVE = "deleted_at IS NULL";

export async function poleRoutes(app: FastifyInstance) {
  app.get("/mine", { preHandler: (app as any).auth }, async (req: any) => {
    return qAll<Pole>(
      `SELECT * FROM poles WHERE user_id = ? AND ${ACTIVE} ORDER BY retired ASC, weight_lb DESC`,
      [req.user.id],
    );
  });

  app.get<{ Params: { handle: string } }>("/by/:handle", async (req, reply) => {
    const user = await qOne<{ id: number }>("SELECT id FROM users WHERE handle = ?", [
      req.params.handle,
    ]);
    if (!user) return reply.code(404).send({ error: "not found" });
    return qAll<Pole>(
      `SELECT * FROM poles WHERE user_id = ? AND ${ACTIVE} ORDER BY retired ASC, weight_lb DESC`,
      [user.id],
    );
  });

  app.post("/", { preHandler: (app as any).auth }, async (req: any, reply) => {
    const parsed = PoleBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.message });
    const p = parsed.data;
    const id = await qInsertId(
      `INSERT INTO poles (user_id, make, length_in, weight_lb, flex, nickname, retired, target_step_in)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      [
        req.user.id,
        p.make,
        p.length_in,
        p.weight_lb,
        p.flex ?? null,
        p.nickname ?? null,
        p.retired ? 1 : 0,
        p.target_step_in ?? null,
      ],
    );
    return qOne<Pole>("SELECT * FROM poles WHERE id = ?", [id]);
  });

  // Pole detail — basic info + aggregate stats for anyone, full attempt list
  // for the pole's owner only (it's their training journal).
  app.get<{ Params: { id: string } }>("/:id", async (req: any, reply) => {
    const id = Number(req.params.id);
    const pole = await qOne<Pole>(
      "SELECT * FROM poles WHERE id = ? AND deleted_at IS NULL",
      [id],
    );
    if (!pole) return reply.code(404).send({ error: "not found" });

    let viewerId: number | null = null;
    try {
      await req.jwtVerify();
      viewerId = req.user.id;
    } catch {}
    const isOwner = pole.user_id === viewerId;

    const stats = await qOne<{
      total_attempts: number;
      clears: number;
      knocks: number;
      passes: number;
      best_clearance_mm: number | null;
    }>(
      `SELECT
         COUNT(*)::int AS total_attempts,
         COUNT(*) FILTER (WHERE result = 'clear')::int AS clears,
         COUNT(*) FILTER (WHERE result = 'knock')::int AS knocks,
         COUNT(*) FILTER (WHERE result = 'pass')::int AS passes,
         MAX(CASE WHEN result = 'clear' THEN bar_height_mm END)::int AS best_clearance_mm
       FROM attempts WHERE pole_id = ?`,
      [id],
    );

    const owner = await qOne(
      "SELECT handle, display_name, avatar_seed, avatar_url FROM users WHERE id = ?",
      [pole.user_id],
    );

    let attempts: any[] = [];
    if (isOwner) {
      attempts = await qAll(
        `SELECT a.*, s.date AS session_date, s.type AS session_type, s.location AS session_location,
                s.id AS session_id
         FROM attempts a
         JOIN sessions s ON s.id = a.session_id
         WHERE a.pole_id = ?
         ORDER BY a.id DESC LIMIT 200`,
        [id],
      );
    }

    return {
      ...pole,
      is_owner: isOwner,
      owner,
      stats,
      attempts,
    };
  });

  app.patch<{ Params: { id: string } }>(
    "/:id",
    { preHandler: (app as any).auth },
    async (req: any, reply) => {
      const id = Number(req.params.id);
      const pole = await qOne<Pole>("SELECT * FROM poles WHERE id = ?", [id]);
      if (!pole) return reply.code(404).send({ error: "not found" });
      if (pole.user_id !== req.user.id) return reply.code(403).send({ error: "forbidden" });

      const parsed = PoleBody.partial().safeParse(req.body);
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.message });
      const p = parsed.data;

      await q(
        `UPDATE poles SET
          make = COALESCE(?, make),
          length_in = COALESCE(?, length_in),
          weight_lb = COALESCE(?, weight_lb),
          flex = COALESCE(?, flex),
          nickname = COALESCE(?, nickname),
          retired = COALESCE(?, retired),
          target_step_in = COALESCE(?, target_step_in)
         WHERE id = ?`,
        [
          p.make ?? null,
          p.length_in ?? null,
          p.weight_lb ?? null,
          p.flex ?? null,
          p.nickname ?? null,
          p.retired === undefined ? null : p.retired ? 1 : 0,
          p.target_step_in ?? null,
          id,
        ],
      );
      return qOne<Pole>("SELECT * FROM poles WHERE id = ?", [id]);
    },
  );

  // Soft delete
  app.delete<{ Params: { id: string } }>(
    "/:id",
    { preHandler: (app as any).auth },
    async (req: any, reply) => {
      const id = Number(req.params.id);
      const pole = await qOne<Pole>("SELECT * FROM poles WHERE id = ?", [id]);
      if (!pole) return reply.code(404).send({ error: "not found" });
      if (pole.user_id !== req.user.id) return reply.code(403).send({ error: "forbidden" });
      await q("UPDATE poles SET deleted_at = now() WHERE id = ?", [id]);
      return { ok: true };
    },
  );

  // Restore (undo)
  app.post<{ Params: { id: string } }>(
    "/:id/restore",
    { preHandler: (app as any).auth },
    async (req: any, reply) => {
      const id = Number(req.params.id);
      const pole = await qOne<Pole>("SELECT * FROM poles WHERE id = ?", [id]);
      if (!pole) return reply.code(404).send({ error: "not found" });
      if (pole.user_id !== req.user.id) return reply.code(403).send({ error: "forbidden" });
      await q("UPDATE poles SET deleted_at = NULL WHERE id = ?", [id]);
      return qOne<Pole>("SELECT * FROM poles WHERE id = ?", [id]);
    },
  );
}
