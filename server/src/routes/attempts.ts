import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { q, qAll, qOne, tx, txQ } from "../db.js";
import type { Attempt, Session } from "../types.js";
import { upsertMeetPost, refreshMeetPostAfterDelete } from "../lib/meetPost.js";

const AttemptBody = z.object({
  session_id: z.number().int().positive(),
  bar_height_mm: z.number().int().min(1500).max(7000),
  result: z.enum(["clear", "knock", "pass", "bail"]),
  pole_id: z.number().int().positive().nullable().optional(),
  grip_in: z.number().min(40).max(200).nullable().optional(),
  step_in: z.number().min(0).max(200).nullable().optional(),
  run_up_steps: z.number().int().min(0).max(40).nullable().optional(),
  miss_tags: z.array(z.string().max(40)).max(10).optional(),
  notes: z.string().max(500).nullable().optional(),
  video_url: z.string().max(500).nullable().optional(),
});

export async function attemptRoutes(app: FastifyInstance) {
  app.post("/", { preHandler: (app as any).auth }, async (req: any, reply) => {
    const parsed = AttemptBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.message });
    const a = parsed.data;

    const session = await qOne<Session>("SELECT * FROM sessions WHERE id = ?", [a.session_id]);
    if (!session) return reply.code(404).send({ error: "session not found" });
    if (session.user_id !== req.user.id) return reply.code(403).send({ error: "forbidden" });

    const id = await tx(async (client) => {
      const ord = await txQ<{ o: number }>(
        client,
        "SELECT COALESCE(MAX(ordinal), 0)::int AS o FROM attempts WHERE session_id = ?",
        [a.session_id],
      );
      const ordinal = ord.rows[0].o + 1;

      const ins = await txQ<{ id: number }>(
        client,
        `INSERT INTO attempts (session_id, user_id, ordinal, bar_height_mm, result, pole_id,
            grip_in, step_in, run_up_steps, miss_tags, notes, video_url)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
        [
          a.session_id,
          req.user.id,
          ordinal,
          a.bar_height_mm,
          a.result,
          a.pole_id ?? null,
          a.grip_in ?? null,
          a.step_in ?? null,
          a.run_up_steps ?? null,
          a.miss_tags ? JSON.stringify(a.miss_tags) : null,
          a.notes ?? null,
          a.video_url ?? null,
        ],
      );

      if (a.pole_id) {
        await txQ(
          client,
          "UPDATE poles SET attempts_count = attempts_count + 1 WHERE id = ?",
          [a.pole_id],
        );
      }

      if (a.result === "clear") {
        const u = (
          await txQ<{ pr_height_mm: number | null }>(
            client,
            "SELECT pr_height_mm FROM users WHERE id = ?",
            [req.user.id],
          )
        ).rows[0];
        if (!u?.pr_height_mm || a.bar_height_mm > u.pr_height_mm) {
          await txQ(
            client,
            "UPDATE users SET pr_height_mm = ?, pr_date = ? WHERE id = ?",
            [a.bar_height_mm, session.date, req.user.id],
          );
        }
      }

      return ins.rows[0].id;
    });

    await upsertMeetPost(a.session_id);
    return qOne<Attempt>("SELECT * FROM attempts WHERE id = ?", [id]);
  });

  app.patch<{ Params: { id: string } }>(
    "/:id",
    { preHandler: (app as any).auth },
    async (req: any, reply) => {
      const id = Number(req.params.id);
      const att = await qOne<Attempt>("SELECT * FROM attempts WHERE id = ?", [id]);
      if (!att) return reply.code(404).send({ error: "not found" });
      if (att.user_id !== req.user.id) return reply.code(403).send({ error: "forbidden" });

      const body = (req.body ?? {}) as any;
      const tags = Array.isArray(body.miss_tags) ? JSON.stringify(body.miss_tags) : undefined;
      await q(
        `UPDATE attempts SET
          bar_height_mm = COALESCE(?, bar_height_mm),
          result        = COALESCE(?, result),
          pole_id       = COALESCE(?, pole_id),
          grip_in       = COALESCE(?, grip_in),
          step_in       = COALESCE(?, step_in),
          run_up_steps  = COALESCE(?, run_up_steps),
          miss_tags     = COALESCE(?, miss_tags),
          notes         = COALESCE(?, notes),
          video_url     = COALESCE(?, video_url)
         WHERE id = ?`,
        [
          body.bar_height_mm ?? null,
          body.result ?? null,
          body.pole_id ?? null,
          body.grip_in ?? null,
          body.step_in ?? null,
          body.run_up_steps ?? null,
          tags ?? null,
          body.notes ?? null,
          body.video_url ?? null,
          id,
        ],
      );
      await upsertMeetPost(att.session_id);
      return qOne<Attempt>("SELECT * FROM attempts WHERE id = ?", [id]);
    },
  );

  app.delete<{ Params: { id: string } }>(
    "/:id",
    { preHandler: (app as any).auth },
    async (req: any, reply) => {
      const id = Number(req.params.id);
      const att = await qOne<{
        user_id: number;
        pole_id: number | null;
        session_id: number;
      }>("SELECT user_id, pole_id, session_id FROM attempts WHERE id = ?", [id]);
      if (!att) return reply.code(404).send({ error: "not found" });
      if (att.user_id !== req.user.id) return reply.code(403).send({ error: "forbidden" });
      await q("DELETE FROM attempts WHERE id = ?", [id]);
      if (att.pole_id) {
        await q(
          "UPDATE poles SET attempts_count = GREATEST(0, attempts_count - 1) WHERE id = ?",
          [att.pole_id],
        );
      }
      await refreshMeetPostAfterDelete(att.session_id);
      return { ok: true };
    },
  );

  app.get<{ Params: { handle: string } }>("/stats/:handle/progression", async (req, reply) => {
    const u = await qOne<{ id: number }>("SELECT id FROM users WHERE handle = ?", [
      req.params.handle,
    ]);
    if (!u) return reply.code(404).send({ error: "not found" });
    return qAll(
      `SELECT s.date AS date, MAX(a.bar_height_mm) AS height
       FROM attempts a
       JOIN sessions s ON s.id = a.session_id
       WHERE a.user_id = ? AND a.result = 'clear'
       GROUP BY s.date
       ORDER BY s.date ASC`,
      [u.id],
    );
  });

  // Step quality — count attempts as under / on / out compared to each pole's
  // target_step_in. Tolerance ±2 inches counts as 'on'. Attempts on poles
  // with no target_step_in (or with no step logged) are bucketed as 'untagged'
  // so we don't lie about coverage.
  app.get<{ Params: { handle: string } }>("/stats/:handle/step-quality", async (req, reply) => {
    const u = await qOne<{ id: number }>("SELECT id FROM users WHERE handle = ?", [
      req.params.handle,
    ]);
    if (!u) return reply.code(404).send({ error: "not found" });
    const TOL = 2.0;
    const row = await qOne<{
      under_n: number;
      on_n: number;
      out_n: number;
      untagged_n: number;
      total_n: number;
    }>(
      `SELECT
         COUNT(*) FILTER (WHERE p.target_step_in IS NOT NULL AND a.step_in IS NOT NULL
                           AND a.step_in < p.target_step_in - ?)::int AS under_n,
         COUNT(*) FILTER (WHERE p.target_step_in IS NOT NULL AND a.step_in IS NOT NULL
                           AND ABS(a.step_in - p.target_step_in) <= ?)::int AS on_n,
         COUNT(*) FILTER (WHERE p.target_step_in IS NOT NULL AND a.step_in IS NOT NULL
                           AND a.step_in > p.target_step_in + ?)::int AS out_n,
         COUNT(*) FILTER (WHERE p.target_step_in IS NULL OR a.step_in IS NULL)::int AS untagged_n,
         COUNT(*)::int AS total_n
       FROM attempts a
       LEFT JOIN poles p ON p.id = a.pole_id
       WHERE a.user_id = ?`,
      [TOL, TOL, TOL, u.id],
    );
    return {
      under: row?.under_n ?? 0,
      on: row?.on_n ?? 0,
      out: row?.out_n ?? 0,
      untagged: row?.untagged_n ?? 0,
      total: row?.total_n ?? 0,
    };
  });

  app.get<{ Params: { handle: string } }>("/stats/:handle/miss-tags", async (req, reply) => {
    const u = await qOne<{ id: number }>("SELECT id FROM users WHERE handle = ?", [
      req.params.handle,
    ]);
    if (!u) return reply.code(404).send({ error: "not found" });
    const rows = await qAll<{ miss_tags: string }>(
      `SELECT miss_tags FROM attempts
       WHERE user_id = ? AND miss_tags IS NOT NULL AND result != 'clear'`,
      [u.id],
    );
    const counts: Record<string, number> = {};
    for (const r of rows) {
      try {
        const tags = JSON.parse(r.miss_tags) as string[];
        for (const t of tags) counts[t] = (counts[t] ?? 0) + 1;
      } catch {}
    }
    return Object.entries(counts)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count);
  });
}
