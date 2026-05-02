import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { q, qAll, qInsertId, qOne } from "../db.js";
import type { Meet, Attempt } from "../types.js";

const MeetBody = z.object({
  name: z.string().min(2).max(120),
  location: z.string().max(120).nullable().optional(),
  date: z.string(),
});

export async function meetRoutes(app: FastifyInstance) {
  app.get("/", async () => {
    return qAll(
      `SELECT m.*, COUNT(DISTINCT s.user_id)::int AS participant_count
       FROM meets m LEFT JOIN sessions s ON s.meet_id = m.id
       GROUP BY m.id ORDER BY m.date DESC LIMIT 50`,
    );
  });

  app.post("/", { preHandler: (app as any).auth }, async (req: any, reply) => {
    const parsed = MeetBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.message });
    const { name, location, date } = parsed.data;
    const existing = await qOne<Meet>(
      "SELECT * FROM meets WHERE name = ? AND date = ?",
      [name, date],
    );
    if (existing) return existing;
    const id = await qInsertId(
      "INSERT INTO meets (name, location, date, host_user_id) VALUES (?, ?, ?, ?) RETURNING id",
      [name, location ?? null, date, req.user.id],
    );
    return qOne<Meet>("SELECT * FROM meets WHERE id = ?", [id]);
  });

  app.get<{ Params: { id: string } }>("/:id", async (req, reply) => {
    const id = Number(req.params.id);
    const meet = await qOne<Meet>("SELECT * FROM meets WHERE id = ?", [id]);
    if (!meet) return reply.code(404).send({ error: "not found" });

    const participants = await qAll<any>(
      `SELECT s.id AS session_id, u.id AS user_id, u.handle, u.display_name,
              u.school, u.avatar_seed, u.avatar_url, u.gender, u.level
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.meet_id = ?`,
      [id],
    );

    const enriched = [];
    for (const p of participants) {
      const attempts = await qAll<Attempt>(
        "SELECT * FROM attempts WHERE session_id = ? ORDER BY ordinal ASC",
        [p.session_id],
      );
      const best = attempts
        .filter((a) => a.result === "clear")
        .reduce<Attempt | null>(
          (acc, a) => (!acc || a.bar_height_mm > acc.bar_height_mm ? a : acc),
          null,
        );
      const videos = attempts.filter((a) => a.video_url);
      enriched.push({ ...p, attempts, best, videos });
    }

    enriched.sort((a, b) => (b.best?.bar_height_mm ?? 0) - (a.best?.bar_height_mm ?? 0));

    return { ...meet, participants: enriched };
  });

  app.get<{ Querystring: { q?: string } }>("/search", async (req) => {
    const search = (req.query.q ?? "").trim();
    if (!search) {
      return qAll<Meet>("SELECT * FROM meets ORDER BY date DESC LIMIT 10");
    }
    return qAll<Meet>(
      "SELECT * FROM meets WHERE name ILIKE ? OR location ILIKE ? ORDER BY date DESC LIMIT 10",
      [`%${search}%`, `%${search}%`],
    );
  });
}
