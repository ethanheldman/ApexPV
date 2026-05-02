import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { q, qAll, qInsertId, qOne } from "../db.js";
import type { Post, Attempt } from "../types.js";

const PostBody = z.object({
  session_id: z.number().int().positive().nullable().optional(),
  visibility: z.enum(["private", "followers", "public"]),
  caption: z.string().max(1000).nullable().optional(),
  pinned_attempt_ids: z.array(z.number().int().positive()).max(10).optional(),
});

const CommentBody = z.object({ body: z.string().min(1).max(500) });

async function canSee(viewerId: number | null, post: Post): Promise<boolean> {
  if (post.visibility === "public") return true;
  if (!viewerId) return false;
  if (post.user_id === viewerId) return true;
  if (post.visibility === "followers") {
    const f = await qOne(
      "SELECT 1 FROM follows WHERE follower_id = ? AND followee_id = ?",
      [viewerId, post.user_id],
    );
    return !!f;
  }
  return false;
}

async function hydratePost(post: Post, viewerId: number | null): Promise<any> {
  const author = await qOne(
    "SELECT id, handle, display_name, school, avatar_seed, avatar_url, pr_height_mm FROM users WHERE id = ?",
    [post.user_id],
  );
  const pinned = post.pinned_attempt_ids ? (JSON.parse(post.pinned_attempt_ids) as number[]) : [];
  const attempts =
    pinned.length > 0
      ? await qAll<Attempt>(
          `SELECT * FROM attempts WHERE id IN (${pinned.map(() => "?").join(",")})`,
          pinned,
        )
      : [];
  const kudosCount = (
    await qOne<{ c: number }>("SELECT COUNT(*)::int as c FROM kudos WHERE post_id = ?", [post.id])
  )!.c;
  const commentsCount = (
    await qOne<{ c: number }>("SELECT COUNT(*)::int as c FROM comments WHERE post_id = ?", [post.id])
  )!.c;
  const myKudos = viewerId
    ? !!(await qOne(
        "SELECT 1 FROM kudos WHERE post_id = ? AND user_id = ?",
        [post.id, viewerId],
      ))
    : false;
  let original = null;
  if (post.repost_of_id) {
    const orig = await qOne<Post>("SELECT * FROM posts WHERE id = ?", [post.repost_of_id]);
    if (orig) original = await hydratePost(orig, viewerId);
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
      const rows = await qAll<Attempt>(
        `SELECT * FROM attempts WHERE id IN (${ids.map(() => "?").join(",")})`,
        ids,
      );
      const clears = rows.filter((a) => a.result === "clear");
      if (clears.length) {
        const max = Math.max(...clears.map((a) => a.bar_height_mm));
        const u = await qOne<{ pr_height_mm: number | null }>(
          "SELECT pr_height_mm FROM users WHERE id = ?",
          [req.user.id],
        );
        if (u?.pr_height_mm && max >= u.pr_height_mm) isPr = 1;

        const prior = await qOne<{ c: number }>(
          `SELECT COUNT(*)::int AS c FROM attempts a
           JOIN sessions s ON s.id = a.session_id
           WHERE a.user_id = ? AND a.bar_height_mm = ? AND a.result = 'clear'
             AND a.id NOT IN (${ids.map(() => "?").join(",")})`,
          [req.user.id, max, ...ids],
        );
        if ((prior?.c ?? 0) === 0) isFirst = 1;
      }
    }

    const id = await qInsertId(
      `INSERT INTO posts (user_id, session_id, visibility, caption, pinned_attempt_ids, is_pr, is_first_clearance)
       VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      [
        req.user.id,
        p.session_id ?? null,
        p.visibility,
        p.caption ?? null,
        p.pinned_attempt_ids ? JSON.stringify(p.pinned_attempt_ids) : null,
        isPr,
        isFirst,
      ],
    );
    const post = (await qOne<Post>("SELECT * FROM posts WHERE id = ?", [id]))!;
    return hydratePost(post, req.user.id);
  });

  app.get<{ Params: { id: string } }>("/:id", async (req: any, reply) => {
    const id = Number(req.params.id);
    let viewerId: number | null = null;
    try {
      await req.jwtVerify();
      viewerId = req.user.id;
    } catch {}
    const post = await qOne<Post>("SELECT * FROM posts WHERE id = ?", [id]);
    if (!post) return reply.code(404).send({ error: "not found" });
    if (!(await canSee(viewerId, post))) return reply.code(403).send({ error: "forbidden" });
    return hydratePost(post, viewerId);
  });

  app.get<{ Params: { handle: string } }>("/by/:handle", async (req: any, reply) => {
    const u = await qOne<{ id: number }>("SELECT id FROM users WHERE handle = ?", [
      req.params.handle,
    ]);
    if (!u) return reply.code(404).send({ error: "not found" });

    let viewerId: number | null = null;
    try {
      await req.jwtVerify();
      viewerId = req.user.id;
    } catch {}

    const all = await qAll<Post>(
      "SELECT * FROM posts WHERE user_id = ? ORDER BY id DESC",
      [u.id],
    );
    const visible: Post[] = [];
    for (const p of all) {
      if (await canSee(viewerId, p)) visible.push(p);
    }
    const hydrated = [];
    for (const p of visible) hydrated.push(await hydratePost(p, viewerId));
    return {
      posts: hydrated,
      hidden_count: all.length - visible.length,
    };
  });

  app.patch<{ Params: { id: string } }>(
    "/:id",
    { preHandler: (app as any).auth },
    async (req: any, reply) => {
      const id = Number(req.params.id);
      const post = await qOne<Post>("SELECT * FROM posts WHERE id = ?", [id]);
      if (!post) return reply.code(404).send({ error: "not found" });
      if (post.user_id !== req.user.id) return reply.code(403).send({ error: "forbidden" });
      const Body = z.object({
        visibility: z.enum(["private", "followers", "public"]).optional(),
        caption: z.string().max(1000).nullable().optional(),
      });
      const parsed = Body.safeParse(req.body);
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.message });
      await q(
        `UPDATE posts SET visibility = COALESCE(?, visibility),
                          caption = COALESCE(?, caption),
                          updated_at = now()
         WHERE id = ?`,
        [parsed.data.visibility ?? null, parsed.data.caption ?? null, id],
      );
      const updated = (await qOne<Post>("SELECT * FROM posts WHERE id = ?", [id]))!;
      return hydratePost(updated, req.user.id);
    },
  );

  app.delete<{ Params: { id: string } }>(
    "/:id",
    { preHandler: (app as any).auth },
    async (req: any, reply) => {
      const id = Number(req.params.id);
      const post = await qOne<{ user_id: number }>("SELECT user_id FROM posts WHERE id = ?", [id]);
      if (!post) return reply.code(404).send({ error: "not found" });
      if (post.user_id !== req.user.id) return reply.code(403).send({ error: "forbidden" });
      await q("DELETE FROM posts WHERE id = ?", [id]);
      return { ok: true };
    },
  );

  // Repost
  app.post<{ Params: { id: string } }>(
    "/:id/repost",
    { preHandler: (app as any).auth },
    async (req: any, reply) => {
      const id = Number(req.params.id);
      const original = await qOne<Post>("SELECT * FROM posts WHERE id = ?", [id]);
      if (!original) return reply.code(404).send({ error: "not found" });
      if (!(await canSee(req.user.id, original)))
        return reply.code(403).send({ error: "forbidden" });
      const Body = z.object({
        caption: z.string().max(1000).nullable().optional(),
        visibility: z.enum(["private", "followers", "public"]).optional(),
      });
      const parsed = Body.safeParse(req.body ?? {});
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.message });
      const order = { private: 0, followers: 1, public: 2 } as const;
      const requested = parsed.data.visibility ?? "followers";
      const vis =
        order[requested] > order[original.visibility] ? original.visibility : requested;
      const newId = await qInsertId(
        `INSERT INTO posts (user_id, visibility, caption, repost_of_id)
         VALUES (?, ?, ?, ?) RETURNING id`,
        [req.user.id, vis, parsed.data.caption ?? null, id],
      );
      if (original.user_id !== req.user.id) {
        await q(
          "INSERT INTO notifications (user_id, actor_id, type, post_id) VALUES (?, ?, 'kudos', ?)",
          [original.user_id, req.user.id, id],
        );
      }
      const post = (await qOne<Post>("SELECT * FROM posts WHERE id = ?", [newId]))!;
      return hydratePost(post, req.user.id);
    },
  );

  // Kudos
  app.post<{ Params: { id: string } }>(
    "/:id/kudos",
    { preHandler: (app as any).auth },
    async (req: any, reply) => {
      const id = Number(req.params.id);
      const post = await qOne<Post>("SELECT * FROM posts WHERE id = ?", [id]);
      if (!post) return reply.code(404).send({ error: "not found" });
      if (post.user_id === req.user.id)
        return reply.code(400).send({ error: "cannot kudos your own post" });
      if (!(await canSee(req.user.id, post))) return reply.code(403).send({ error: "forbidden" });
      const before = await qOne(
        "SELECT 1 FROM kudos WHERE post_id = ? AND user_id = ?",
        [id, req.user.id],
      );
      await q(
        "INSERT INTO kudos (post_id, user_id) VALUES (?, ?) ON CONFLICT DO NOTHING",
        [id, req.user.id],
      );
      if (!before) {
        await q(
          "INSERT INTO notifications (user_id, actor_id, type, post_id) VALUES (?, ?, 'kudos', ?)",
          [post.user_id, req.user.id, id],
        );
      }
      return { ok: true };
    },
  );

  app.delete<{ Params: { id: string } }>(
    "/:id/kudos",
    { preHandler: (app as any).auth },
    async (req: any, reply) => {
      const id = Number(req.params.id);
      await q("DELETE FROM kudos WHERE post_id = ? AND user_id = ?", [id, req.user.id]);
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
    const post = await qOne<Post>("SELECT * FROM posts WHERE id = ?", [id]);
    if (!post) return reply.code(404).send({ error: "not found" });
    if (!(await canSee(viewerId, post))) return reply.code(403).send({ error: "forbidden" });
    return qAll(
      `SELECT c.*, u.handle, u.display_name, u.avatar_seed, u.avatar_url
       FROM comments c JOIN users u ON u.id = c.user_id
       WHERE c.post_id = ? ORDER BY c.id ASC`,
      [id],
    );
  });

  app.post<{ Params: { id: string } }>(
    "/:id/comments",
    { preHandler: (app as any).auth },
    async (req: any, reply) => {
      const id = Number(req.params.id);
      const parsed = CommentBody.safeParse(req.body);
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.message });
      const post = await qOne<Post>("SELECT * FROM posts WHERE id = ?", [id]);
      if (!post) return reply.code(404).send({ error: "not found" });
      if (!(await canSee(req.user.id, post))) return reply.code(403).send({ error: "forbidden" });
      const cid = await qInsertId(
        "INSERT INTO comments (post_id, user_id, body) VALUES (?, ?, ?) RETURNING id",
        [id, req.user.id, parsed.data.body],
      );
      if (post.user_id !== req.user.id) {
        await q(
          "INSERT INTO notifications (user_id, actor_id, type, post_id, comment_id) VALUES (?, ?, 'comment', ?, ?)",
          [post.user_id, req.user.id, id, cid],
        );
      }
      return qOne(
        `SELECT c.*, u.handle, u.display_name, u.avatar_seed, u.avatar_url
         FROM comments c JOIN users u ON u.id = c.user_id WHERE c.id = ?`,
        [cid],
      );
    },
  );

  app.patch<{ Params: { cid: string } }>(
    "/comments/:cid",
    { preHandler: (app as any).auth },
    async (req: any, reply) => {
      const cid = Number(req.params.cid);
      const parsed = CommentBody.safeParse(req.body);
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.message });
      const c = await qOne<{ user_id: number }>(
        "SELECT user_id FROM comments WHERE id = ?",
        [cid],
      );
      if (!c) return reply.code(404).send({ error: "not found" });
      if (c.user_id !== req.user.id) return reply.code(403).send({ error: "forbidden" });
      await q("UPDATE comments SET body = ?, updated_at = now() WHERE id = ?", [
        parsed.data.body,
        cid,
      ]);
      return qOne(
        `SELECT c.*, u.handle, u.display_name, u.avatar_seed, u.avatar_url
         FROM comments c JOIN users u ON u.id = c.user_id WHERE c.id = ?`,
        [cid],
      );
    },
  );

  app.delete<{ Params: { cid: string } }>(
    "/comments/:cid",
    { preHandler: (app as any).auth },
    async (req: any, reply) => {
      const cid = Number(req.params.cid);
      const c = await qOne<{ user_id: number }>(
        "SELECT user_id FROM comments WHERE id = ?",
        [cid],
      );
      if (!c) return reply.code(404).send({ error: "not found" });
      if (c.user_id !== req.user.id) return reply.code(403).send({ error: "forbidden" });
      await q("DELETE FROM comments WHERE id = ?", [cid]);
      return { ok: true };
    },
  );
}
