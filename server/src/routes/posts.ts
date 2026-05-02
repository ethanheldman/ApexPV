import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db.js";
import type { Post, Attempt } from "../types.js";

const PostBody = z.object({
  session_id: z.number().int().positive().nullable().optional(),
  visibility: z.enum(["private", "followers", "public"]),
  caption: z.string().max(1000).nullable().optional(),
  pinned_attempt_ids: z.array(z.number().int().positive()).max(10).optional(),
});

const CommentBody = z.object({ body: z.string().min(1).max(500) });

function canSee(viewerId: number | null, post: Post): boolean {
  if (post.visibility === "public") return true;
  if (!viewerId) return false;
  if (post.user_id === viewerId) return true;
  if (post.visibility === "followers") {
    const f = db
      .prepare("SELECT 1 FROM follows WHERE follower_id = ? AND followee_id = ?")
      .get(viewerId, post.user_id);
    return !!f;
  }
  return false;
}

function hydratePost(post: Post, viewerId: number | null): any {
  const author = db
    .prepare(
      "SELECT id, handle, display_name, school, avatar_seed, avatar_url, pr_height_mm FROM users WHERE id = ?",
    )
    .get(post.user_id);
  const pinned = post.pinned_attempt_ids ? (JSON.parse(post.pinned_attempt_ids) as number[]) : [];
  const attempts =
    pinned.length > 0
      ? (db
          .prepare(
            `SELECT * FROM attempts WHERE id IN (${pinned.map(() => "?").join(",")})`,
          )
          .all(...pinned) as Attempt[])
      : [];
  const kudosCount = (db
    .prepare("SELECT COUNT(*) as c FROM kudos WHERE post_id = ?")
    .get(post.id) as any).c as number;
  const commentsCount = (db
    .prepare("SELECT COUNT(*) as c FROM comments WHERE post_id = ?")
    .get(post.id) as any).c as number;
  const myKudos = viewerId
    ? !!db.prepare("SELECT 1 FROM kudos WHERE post_id = ? AND user_id = ?").get(post.id, viewerId)
    : false;
  let original = null;
  if (post.repost_of_id) {
    const orig = db.prepare("SELECT * FROM posts WHERE id = ?").get(post.repost_of_id) as
      | Post
      | undefined;
    if (orig) original = hydratePost(orig, viewerId);
  }
  return {
    ...post,
    author,
    attempts,
    kudos_count: kudosCount,
    comments_count: commentsCount,
    my_kudos: myKudos,
    original,
  };
}

export async function postRoutes(app: FastifyInstance) {
  app.post("/", { preHandler: (app as any).auth }, async (req: any, reply) => {
    const parsed = PostBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.message });
    const p = parsed.data;

    let isPr = 0;
    let isFirst = 0;
    if (p.pinned_attempt_ids && p.pinned_attempt_ids.length > 0) {
      const ids = p.pinned_attempt_ids;
      const rows = db
        .prepare(`SELECT * FROM attempts WHERE id IN (${ids.map(() => "?").join(",")})`)
        .all(...ids) as Attempt[];
      const clears = rows.filter((a) => a.result === "clear");
      if (clears.length) {
        const max = Math.max(...clears.map((a) => a.bar_height_mm));
        const u = db
          .prepare("SELECT pr_height_mm FROM users WHERE id = ?")
          .get(req.user.id) as { pr_height_mm: number | null };
        if (u.pr_height_mm && max >= u.pr_height_mm) isPr = 1;

        const prior = db
          .prepare(
            `SELECT COUNT(*) AS c FROM attempts a
             JOIN sessions s ON s.id = a.session_id
             WHERE a.user_id = ? AND a.bar_height_mm = ? AND a.result = 'clear'
               AND a.id NOT IN (${ids.map(() => "?").join(",")})`,
          )
          .get(req.user.id, max, ...ids) as { c: number };
        if (prior.c === 0) isFirst = 1;
      }
    }

    const r = db
      .prepare(
        `INSERT INTO posts (user_id, session_id, visibility, caption, pinned_attempt_ids, is_pr, is_first_clearance)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        req.user.id,
        p.session_id ?? null,
        p.visibility,
        p.caption ?? null,
        p.pinned_attempt_ids ? JSON.stringify(p.pinned_attempt_ids) : null,
        isPr,
        isFirst,
      );
    const post = db.prepare("SELECT * FROM posts WHERE id = ?").get(r.lastInsertRowid) as Post;
    return hydratePost(post, req.user.id);
  });

  app.get<{ Params: { id: string } }>("/:id", async (req: any, reply) => {
    const id = Number(req.params.id);
    let viewerId: number | null = null;
    try {
      await req.jwtVerify();
      viewerId = req.user.id;
    } catch {}
    const post = db.prepare("SELECT * FROM posts WHERE id = ?").get(id) as Post | undefined;
    if (!post) return reply.code(404).send({ error: "not found" });
    if (!canSee(viewerId, post)) return reply.code(403).send({ error: "forbidden" });
    return hydratePost(post, viewerId);
  });

  app.get<{ Params: { handle: string } }>("/by/:handle", async (req: any, reply) => {
    const u = db.prepare("SELECT id FROM users WHERE handle = ?").get(req.params.handle) as
      | { id: number }
      | undefined;
    if (!u) return reply.code(404).send({ error: "not found" });

    let viewerId: number | null = null;
    try {
      await req.jwtVerify();
      viewerId = req.user.id;
    } catch {}

    const all = db
      .prepare("SELECT * FROM posts WHERE user_id = ? ORDER BY id DESC")
      .all(u.id) as Post[];
    const visible = all.filter((p) => canSee(viewerId, p));
    const total = all.length;
    return {
      posts: visible.map((p) => hydratePost(p, viewerId)),
      hidden_count: total - visible.length,
    };
  });

  app.patch<{ Params: { id: string } }>(
    "/:id",
    { preHandler: (app as any).auth },
    async (req: any, reply) => {
      const id = Number(req.params.id);
      const post = db.prepare("SELECT * FROM posts WHERE id = ?").get(id) as Post | undefined;
      if (!post) return reply.code(404).send({ error: "not found" });
      if (post.user_id !== req.user.id) return reply.code(403).send({ error: "forbidden" });
      const Body = z.object({
        visibility: z.enum(["private", "followers", "public"]).optional(),
        caption: z.string().max(1000).nullable().optional(),
      });
      const parsed = Body.safeParse(req.body);
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.message });
      db.prepare(
        `UPDATE posts SET visibility = COALESCE(?, visibility),
                          caption = COALESCE(?, caption),
                          updated_at = datetime('now')
         WHERE id = ?`,
      ).run(parsed.data.visibility ?? null, parsed.data.caption ?? null, id);
      const updated = db.prepare("SELECT * FROM posts WHERE id = ?").get(id) as Post;
      return hydratePost(updated, req.user.id);
    },
  );

  app.delete<{ Params: { id: string } }>(
    "/:id",
    { preHandler: (app as any).auth },
    async (req: any, reply) => {
      const id = Number(req.params.id);
      const post = db.prepare("SELECT user_id FROM posts WHERE id = ?").get(id) as
        | { user_id: number }
        | undefined;
      if (!post) return reply.code(404).send({ error: "not found" });
      if (post.user_id !== req.user.id) return reply.code(403).send({ error: "forbidden" });
      db.prepare("DELETE FROM posts WHERE id = ?").run(id);
      return { ok: true };
    },
  );

  // Repost
  app.post<{ Params: { id: string } }>(
    "/:id/repost",
    { preHandler: (app as any).auth },
    async (req: any, reply) => {
      const id = Number(req.params.id);
      const original = db.prepare("SELECT * FROM posts WHERE id = ?").get(id) as Post | undefined;
      if (!original) return reply.code(404).send({ error: "not found" });
      if (!canSee(req.user.id, original))
        return reply.code(403).send({ error: "forbidden" });
      const Body = z.object({
        caption: z.string().max(1000).nullable().optional(),
        visibility: z.enum(["private", "followers", "public"]).optional(),
      });
      const parsed = Body.safeParse(req.body ?? {});
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.message });
      // Reposts inherit the original's visibility ceiling — can't be more public than the source.
      const order = { private: 0, followers: 1, public: 2 } as const;
      const requested = parsed.data.visibility ?? "followers";
      const vis =
        order[requested] > order[original.visibility] ? original.visibility : requested;
      const r = db
        .prepare(
          `INSERT INTO posts (user_id, visibility, caption, repost_of_id)
           VALUES (?, ?, ?, ?)`,
        )
        .run(req.user.id, vis, parsed.data.caption ?? null, id);
      if (original.user_id !== req.user.id) {
        db.prepare(
          "INSERT INTO notifications (user_id, actor_id, type, post_id) VALUES (?, ?, 'kudos', ?)",
        ).run(original.user_id, req.user.id, id);
      }
      const post = db.prepare("SELECT * FROM posts WHERE id = ?").get(r.lastInsertRowid) as Post;
      return hydratePost(post, req.user.id);
    },
  );

  // Kudos — with self-like prevention + notification
  app.post<{ Params: { id: string } }>(
    "/:id/kudos",
    { preHandler: (app as any).auth },
    async (req: any, reply) => {
      const id = Number(req.params.id);
      const post = db.prepare("SELECT * FROM posts WHERE id = ?").get(id) as Post | undefined;
      if (!post) return reply.code(404).send({ error: "not found" });
      if (post.user_id === req.user.id)
        return reply.code(400).send({ error: "cannot kudos your own post" });
      if (!canSee(req.user.id, post)) return reply.code(403).send({ error: "forbidden" });
      const before = db
        .prepare("SELECT 1 FROM kudos WHERE post_id = ? AND user_id = ?")
        .get(id, req.user.id);
      db.prepare("INSERT OR IGNORE INTO kudos (post_id, user_id) VALUES (?, ?)").run(
        id,
        req.user.id,
      );
      if (!before) {
        db.prepare(
          "INSERT INTO notifications (user_id, actor_id, type, post_id) VALUES (?, ?, 'kudos', ?)",
        ).run(post.user_id, req.user.id, id);
      }
      return { ok: true };
    },
  );

  app.delete<{ Params: { id: string } }>(
    "/:id/kudos",
    { preHandler: (app as any).auth },
    async (req: any, reply) => {
      const id = Number(req.params.id);
      db.prepare("DELETE FROM kudos WHERE post_id = ? AND user_id = ?").run(id, req.user.id);
      return { ok: true };
    },
  );

  // Comments
  app.get<{ Params: { id: string } }>("/:id/comments", async (req: any, reply) => {
    const id = Number(req.params.id);
    let viewerId: number | null = null;
    try {
      await req.jwtVerify();
      viewerId = req.user.id;
    } catch {}
    const post = db.prepare("SELECT * FROM posts WHERE id = ?").get(id) as Post | undefined;
    if (!post) return reply.code(404).send({ error: "not found" });
    if (!canSee(viewerId, post)) return reply.code(403).send({ error: "forbidden" });
    const rows = db
      .prepare(
        `SELECT c.*, u.handle, u.display_name, u.avatar_seed
         FROM comments c JOIN users u ON u.id = c.user_id
         WHERE c.post_id = ? ORDER BY c.id ASC`,
      )
      .all(id);
    return rows;
  });

  app.post<{ Params: { id: string } }>(
    "/:id/comments",
    { preHandler: (app as any).auth },
    async (req: any, reply) => {
      const id = Number(req.params.id);
      const parsed = CommentBody.safeParse(req.body);
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.message });
      const post = db.prepare("SELECT * FROM posts WHERE id = ?").get(id) as Post | undefined;
      if (!post) return reply.code(404).send({ error: "not found" });
      if (!canSee(req.user.id, post)) return reply.code(403).send({ error: "forbidden" });
      const r = db
        .prepare("INSERT INTO comments (post_id, user_id, body) VALUES (?, ?, ?)")
        .run(id, req.user.id, parsed.data.body);
      if (post.user_id !== req.user.id) {
        db.prepare(
          "INSERT INTO notifications (user_id, actor_id, type, post_id, comment_id) VALUES (?, ?, 'comment', ?, ?)",
        ).run(post.user_id, req.user.id, id, r.lastInsertRowid);
      }
      return db
        .prepare(
          `SELECT c.*, u.handle, u.display_name, u.avatar_seed
           FROM comments c JOIN users u ON u.id = c.user_id WHERE c.id = ?`,
        )
        .get(r.lastInsertRowid);
    },
  );

  app.patch<{ Params: { cid: string } }>(
    "/comments/:cid",
    { preHandler: (app as any).auth },
    async (req: any, reply) => {
      const cid = Number(req.params.cid);
      const parsed = CommentBody.safeParse(req.body);
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.message });
      const c = db.prepare("SELECT user_id FROM comments WHERE id = ?").get(cid) as
        | { user_id: number }
        | undefined;
      if (!c) return reply.code(404).send({ error: "not found" });
      if (c.user_id !== req.user.id) return reply.code(403).send({ error: "forbidden" });
      db.prepare(
        "UPDATE comments SET body = ?, updated_at = datetime('now') WHERE id = ?",
      ).run(parsed.data.body, cid);
      return db
        .prepare(
          `SELECT c.*, u.handle, u.display_name, u.avatar_seed
           FROM comments c JOIN users u ON u.id = c.user_id WHERE c.id = ?`,
        )
        .get(cid);
    },
  );

  app.delete<{ Params: { cid: string } }>(
    "/comments/:cid",
    { preHandler: (app as any).auth },
    async (req: any, reply) => {
      const cid = Number(req.params.cid);
      const c = db.prepare("SELECT user_id FROM comments WHERE id = ?").get(cid) as
        | { user_id: number }
        | undefined;
      if (!c) return reply.code(404).send({ error: "not found" });
      if (c.user_id !== req.user.id) return reply.code(403).send({ error: "forbidden" });
      db.prepare("DELETE FROM comments WHERE id = ?").run(cid);
      return { ok: true };
    },
  );
}
