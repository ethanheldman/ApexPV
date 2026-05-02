import type { FastifyInstance } from "fastify";
import { qAll, qOne } from "../db.js";
import type { Post, Attempt } from "../types.js";

async function hydrate(post: Post, viewerId: number | null): Promise<any> {
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
  const kudos_count = (
    await qOne<{ c: number }>("SELECT COUNT(*)::int as c FROM kudos WHERE post_id = ?", [post.id])
  )!.c;
  const comments_count = (
    await qOne<{ c: number }>("SELECT COUNT(*)::int as c FROM comments WHERE post_id = ?", [post.id])
  )!.c;
  const my_kudos = viewerId
    ? !!(await qOne(
        "SELECT 1 FROM kudos WHERE post_id = ? AND user_id = ?",
        [post.id, viewerId],
      ))
    : false;
  let original = null;
  if (post.repost_of_id) {
    const orig = await qOne<Post>("SELECT * FROM posts WHERE id = ?", [post.repost_of_id]);
    if (orig) original = await hydrate(orig, viewerId);
  }
  return { ...post, author, attempts, kudos_count, comments_count, my_kudos, original };
}

export async function feedRoutes(app: FastifyInstance) {
  app.get("/", { preHandler: (app as any).auth }, async (req: any) => {
    const id = req.user.id as number;
    const posts = await qAll<Post>(
      `SELECT * FROM posts
       WHERE (user_id = ? AND visibility != 'private')
          OR (visibility = 'public' AND user_id IN (SELECT followee_id FROM follows WHERE follower_id = ?))
          OR (visibility = 'followers' AND user_id IN (SELECT followee_id FROM follows WHERE follower_id = ?))
       ORDER BY id DESC LIMIT 100`,
      [id, id, id],
    );
    const out = [];
    for (const p of posts) out.push(await hydrate(p, id));
    return out;
  });

  app.get("/discover", async (req: any) => {
    let viewerId: number | null = null;
    try {
      await req.jwtVerify();
      viewerId = req.user.id;
    } catch {}
    const { gender, level } = (req.query ?? {}) as { gender?: string; level?: string };
    const where = ["p.visibility = 'public'"];
    const params: any[] = [];
    if (gender) {
      where.push("u.gender = ?");
      params.push(gender);
    }
    if (level) {
      where.push("u.level = ?");
      params.push(level);
    }
    const posts = await qAll<Post>(
      `SELECT p.* FROM posts p JOIN users u ON u.id = p.user_id
       WHERE ${where.join(" AND ")} ORDER BY p.id DESC LIMIT 100`,
      params,
    );
    const out = [];
    for (const p of posts) out.push(await hydrate(p, viewerId));
    return out;
  });

  app.get<{ Querystring: { gender?: string; level?: string } }>(
    "/leaderboard",
    async (req) => {
      const { gender, level } = req.query;
      const where = ["pr_height_mm IS NOT NULL"];
      const params: any[] = [];
      if (gender) {
        where.push("gender = ?");
        params.push(gender);
      }
      if (level) {
        where.push("level = ?");
        params.push(level);
      }
      const rows = await qAll<any>(
        `SELECT handle, display_name, school, avatar_seed, avatar_url, pr_height_mm, pr_date, gender, level
         FROM users
         WHERE ${where.join(" AND ")}
         ORDER BY pr_height_mm DESC, pr_date ASC NULLS LAST, handle ASC
         LIMIT 50`,
        params,
      );
      let lastH: number | null = null;
      let lastRank = 0;
      return rows.map((r, i) => {
        if (r.pr_height_mm !== lastH) {
          lastRank = i + 1;
          lastH = r.pr_height_mm;
        }
        const tiedCount = rows.filter((x) => x.pr_height_mm === r.pr_height_mm).length;
        return { ...r, rank: lastRank, tied: tiedCount > 1 };
      });
    },
  );
}
