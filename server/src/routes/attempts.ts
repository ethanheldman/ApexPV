import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db.js";
import type { Attempt, Session } from "../types.js";
import { upsertMeetPost, refreshMeetPostAfterDelete } from "../lib/meetPost.js";

const AttemptBody = z.object({
  session_id: z.number().int().positive(),
  bar_height_mm: z.number().int().min(1500).max(7000), // ~5'-23'
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

    const session = db.prepare("SELECT * FROM sessions WHERE id = ?").get(a.session_id) as Session;
    if (!session) return reply.code(404).send({ error: "session not found" });
    if (session.user_id !== req.user.id) return reply.code(403).send({ error: "forbidden" });

    const last = db
      .prepare("SELECT COALESCE(MAX(ordinal), 0) AS o FROM attempts WHERE session_id = ?")
      .get(a.session_id) as { o: number };
    const ordinal = last.o + 1;

    const tx = db.transaction(() => {
      const r = db
        .prepare(
          `INSERT INTO attempts (session_id, user_id, ordinal, bar_height_mm, result, pole_id,
              grip_in, step_in, run_up_steps, miss_tags, notes, video_url)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
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
        );

      if (a.pole_id) {
        db.prepare("UPDATE poles SET attempts_count = attempts_count + 1 WHERE id = ?").run(
          a.pole_id,
        );
      }

      if (a.result === "clear") {
        const u = db.prepare("SELECT pr_height_mm FROM users WHERE id = ?").get(req.user.id) as
          | { pr_height_mm: number | null }
          | undefined;
        if (!u?.pr_height_mm || a.bar_height_mm > u.pr_height_mm) {
          db.prepare("UPDATE users SET pr_height_mm = ?, pr_date = ? WHERE id = ?").run(
            a.bar_height_mm,
            session.date,
            req.user.id,
          );
        }
      }
      return r.lastInsertRowid;
    });
    const id = tx();
    upsertMeetPost(a.session_id);
    return db.prepare("SELECT * FROM attempts WHERE id = ?").get(id);
  });

  app.patch<{ Params: { id: string } }>(
    "/:id",
    { preHandler: (app as any).auth },
    async (req: any, reply) => {
      const id = Number(req.params.id);
      const att = db.prepare("SELECT * FROM attempts WHERE id = ?").get(id) as Attempt | undefined;
      if (!att) return reply.code(404).send({ error: "not found" });
      if (att.user_id !== req.user.id) return reply.code(403).send({ error: "forbidden" });

      const body = (req.body ?? {}) as any;
      const tags = Array.isArray(body.miss_tags) ? JSON.stringify(body.miss_tags) : undefined;
      db.prepare(
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
      ).run(
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
      );
      upsertMeetPost(att.session_id);
      return db.prepare("SELECT * FROM attempts WHERE id = ?").get(id);
    },
  );

  app.delete<{ Params: { id: string } }>(
    "/:id",
    { preHandler: (app as any).auth },
    async (req: any, reply) => {
      const id = Number(req.params.id);
      const att = db
        .prepare("SELECT user_id, pole_id, session_id FROM attempts WHERE id = ?")
        .get(id) as { user_id: number; pole_id: number | null; session_id: number } | undefined;
      if (!att) return reply.code(404).send({ error: "not found" });
      if (att.user_id !== req.user.id) return reply.code(403).send({ error: "forbidden" });
      db.prepare("DELETE FROM attempts WHERE id = ?").run(id);
      if (att.pole_id) {
        db.prepare(
          "UPDATE poles SET attempts_count = MAX(0, attempts_count - 1) WHERE id = ?",
        ).run(att.pole_id);
      }
      refreshMeetPostAfterDelete(att.session_id);
      return { ok: true };
    },
  );

  app.get<{ Params: { handle: string } }>("/stats/:handle/progression", async (req, reply) => {
    const u = db.prepare("SELECT id FROM users WHERE handle = ?").get(req.params.handle) as
      | { id: number }
      | undefined;
    if (!u) return reply.code(404).send({ error: "not found" });
    const rows = db
      .prepare(
        `SELECT s.date AS date, MAX(a.bar_height_mm) AS height
         FROM attempts a
         JOIN sessions s ON s.id = a.session_id
         WHERE a.user_id = ? AND a.result = 'clear'
         GROUP BY s.date
         ORDER BY s.date ASC`,
      )
      .all(u.id);
    return rows;
  });

  app.get<{ Params: { handle: string } }>("/stats/:handle/miss-tags", async (req, reply) => {
    const u = db.prepare("SELECT id FROM users WHERE handle = ?").get(req.params.handle) as
      | { id: number }
      | undefined;
    if (!u) return reply.code(404).send({ error: "not found" });
    const rows = db
      .prepare(
        `SELECT miss_tags FROM attempts
         WHERE user_id = ? AND miss_tags IS NOT NULL AND result != 'clear'`,
      )
      .all(u.id) as { miss_tags: string }[];
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
