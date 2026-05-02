import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db.js";
import type { Meet, Session, Attempt } from "../types.js";

const MeetBody = z.object({
  name: z.string().min(2).max(120),
  location: z.string().max(120).nullable().optional(),
  date: z.string(),
});

export async function meetRoutes(app: FastifyInstance) {
  app.get("/", async () => {
    return db
      .prepare(
        `SELECT m.*, COUNT(DISTINCT s.user_id) AS participant_count
         FROM meets m LEFT JOIN sessions s ON s.meet_id = m.id
         GROUP BY m.id ORDER BY m.date DESC LIMIT 50`,
      )
      .all();
  });

  app.post("/", { preHandler: (app as any).auth }, async (req: any, reply) => {
    const parsed = MeetBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.message });
    const { name, location, date } = parsed.data;
    // Reuse meet if same name + date already exists
    const existing = db
      .prepare("SELECT * FROM meets WHERE name = ? AND date = ?")
      .get(name, date);
    if (existing) return existing;
    const r = db
      .prepare(
        "INSERT INTO meets (name, location, date, host_user_id) VALUES (?, ?, ?, ?)",
      )
      .run(name, location ?? null, date, req.user.id);
    return db.prepare("SELECT * FROM meets WHERE id = ?").get(r.lastInsertRowid);
  });

  app.get<{ Params: { id: string } }>("/:id", async (req, reply) => {
    const id = Number(req.params.id);
    const meet = db.prepare("SELECT * FROM meets WHERE id = ?").get(id) as Meet | undefined;
    if (!meet) return reply.code(404).send({ error: "not found" });

    // For each participant: their session, their best clearance, all attempts with video
    const participants = db
      .prepare(
        `SELECT s.id AS session_id, u.id AS user_id, u.handle, u.display_name,
                u.school, u.avatar_seed, u.avatar_url, u.gender, u.level
         FROM sessions s JOIN users u ON u.id = s.user_id
         WHERE s.meet_id = ?`,
      )
      .all(id) as any[];

    const enriched = participants.map((p) => {
      const attempts = db
        .prepare(
          "SELECT * FROM attempts WHERE session_id = ? ORDER BY ordinal ASC",
        )
        .all(p.session_id) as Attempt[];
      const best = attempts
        .filter((a) => a.result === "clear")
        .reduce<Attempt | null>((acc, a) => (!acc || a.bar_height_mm > acc.bar_height_mm ? a : acc), null);
      const videos = attempts.filter((a) => a.video_url);
      return { ...p, attempts, best, videos };
    });

    // Rank by best clearance
    enriched.sort((a, b) => (b.best?.bar_height_mm ?? 0) - (a.best?.bar_height_mm ?? 0));

    return { ...meet, participants: enriched };
  });

  // Quick search — used in the session form's "Tag a meet" combobox
  app.get<{ Querystring: { q?: string } }>("/search", async (req) => {
    const q = (req.query.q ?? "").trim();
    if (!q) {
      return db
        .prepare("SELECT * FROM meets ORDER BY date DESC LIMIT 10")
        .all();
    }
    return db
      .prepare(
        "SELECT * FROM meets WHERE name LIKE ? OR location LIKE ? ORDER BY date DESC LIMIT 10",
      )
      .all(`%${q}%`, `%${q}%`);
  });
}
