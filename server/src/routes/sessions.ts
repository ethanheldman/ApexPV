import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db.js";
import type { Session, Attempt } from "../types.js";

const SessionBody = z.object({
  type: z.enum(["practice", "meet"]),
  date: z.string(),
  location: z.string().nullable().optional(),
  surface: z.enum(["indoor", "outdoor"]).nullable().optional(),
  wind_ms: z.number().nullable().optional(),
  temp_f: z.number().nullable().optional(),
  energy: z.number().int().min(1).max(5).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  cues_had: z.string().max(2000).nullable().optional(),
  cues_work: z.string().max(2000).nullable().optional(),
  meet_id: z.number().int().positive().nullable().optional(),
});

export async function sessionRoutes(app: FastifyInstance) {
  app.post("/", { preHandler: (app as any).auth }, async (req: any, reply) => {
    const parsed = SessionBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.message });
    const s = parsed.data;
    const r = db
      .prepare(
        `INSERT INTO sessions (user_id, type, date, location, surface, wind_ms, temp_f, energy, notes, cues_had, cues_work, meet_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        req.user.id,
        s.type,
        s.date,
        s.location ?? null,
        s.surface ?? null,
        s.wind_ms ?? null,
        s.temp_f ?? null,
        s.energy ?? null,
        s.notes ?? null,
        s.cues_had ?? null,
        s.cues_work ?? null,
        s.meet_id ?? null,
      );
    return db.prepare("SELECT * FROM sessions WHERE id = ?").get(r.lastInsertRowid);
  });

  app.patch<{ Params: { id: string } }>(
    "/:id",
    { preHandler: (app as any).auth },
    async (req: any, reply) => {
      const id = Number(req.params.id);
      const s = db.prepare("SELECT user_id FROM sessions WHERE id = ?").get(id) as
        | { user_id: number }
        | undefined;
      if (!s) return reply.code(404).send({ error: "not found" });
      if (s.user_id !== req.user.id) return reply.code(403).send({ error: "forbidden" });
      const parsed = SessionBody.partial().safeParse(req.body);
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.message });
      const p = parsed.data;
      db.prepare(
        `UPDATE sessions SET
          type      = COALESCE(?, type),
          date      = COALESCE(?, date),
          location  = COALESCE(?, location),
          surface   = COALESCE(?, surface),
          wind_ms   = COALESCE(?, wind_ms),
          temp_f    = COALESCE(?, temp_f),
          energy    = COALESCE(?, energy),
          notes     = COALESCE(?, notes),
          cues_had  = COALESCE(?, cues_had),
          cues_work = COALESCE(?, cues_work),
          meet_id   = COALESCE(?, meet_id)
         WHERE id = ?`,
      ).run(
        p.type ?? null,
        p.date ?? null,
        p.location === undefined ? null : p.location,
        p.surface === undefined ? null : p.surface,
        p.wind_ms === undefined ? null : p.wind_ms,
        p.temp_f === undefined ? null : p.temp_f,
        p.energy === undefined ? null : p.energy,
        p.notes === undefined ? null : p.notes,
        p.cues_had === undefined ? null : p.cues_had,
        p.cues_work === undefined ? null : p.cues_work,
        p.meet_id === undefined ? null : p.meet_id,
        id,
      );
      return db.prepare("SELECT * FROM sessions WHERE id = ?").get(id);
    },
  );

  app.get<{ Params: { id: string } }>("/:id", async (req: any, reply) => {
    const id = Number(req.params.id);
    const session = db.prepare("SELECT * FROM sessions WHERE id = ?").get(id) as Session;
    if (!session) return reply.code(404).send({ error: "not found" });
    let viewerId: number | null = null;
    try {
      await req.jwtVerify();
      viewerId = req.user.id;
    } catch {}
    const attempts = db
      .prepare("SELECT * FROM attempts WHERE session_id = ? ORDER BY ordinal ASC, id ASC")
      .all(id) as Attempt[];
    const owner = db
      .prepare("SELECT handle, display_name, avatar_seed, avatar_url FROM users WHERE id = ?")
      .get(session.user_id);
    const meet = session.meet_id
      ? db.prepare("SELECT * FROM meets WHERE id = ?").get(session.meet_id)
      : null;
    // The auto-generated post for meet sessions, if present
    const autoPost =
      session.type === "meet"
        ? (db
            .prepare(
              "SELECT id FROM posts WHERE session_id = ? AND user_id = ? ORDER BY id DESC LIMIT 1",
            )
            .get(session.id, session.user_id) as { id: number } | undefined)
        : undefined;
    return {
      ...session,
      attempts,
      is_owner: viewerId === session.user_id,
      owner,
      meet,
      auto_post_id: autoPost?.id ?? null,
    };
  });

  app.get("/mine/list", { preHandler: (app as any).auth }, async (req: any) => {
    return db
      .prepare("SELECT * FROM sessions WHERE user_id = ? ORDER BY date DESC, id DESC")
      .all(req.user.id);
  });

  app.get<{ Params: { handle: string } }>("/by/:handle", async (req, reply) => {
    const user = db.prepare("SELECT id FROM users WHERE handle = ?").get(req.params.handle) as
      | { id: number }
      | undefined;
    if (!user) return reply.code(404).send({ error: "not found" });
    return db
      .prepare("SELECT * FROM sessions WHERE user_id = ? ORDER BY date DESC, id DESC")
      .all(user.id);
  });

  app.delete<{ Params: { id: string } }>(
    "/:id",
    { preHandler: (app as any).auth },
    async (req: any, reply) => {
      const id = Number(req.params.id);
      const s = db.prepare("SELECT user_id FROM sessions WHERE id = ?").get(id) as
        | { user_id: number }
        | undefined;
      if (!s) return reply.code(404).send({ error: "not found" });
      if (s.user_id !== req.user.id) return reply.code(403).send({ error: "forbidden" });
      db.prepare("DELETE FROM sessions WHERE id = ?").run(id);
      return { ok: true };
    },
  );
}
