import type { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { q, qInsertId, qOne } from "../db.js";
import type { User } from "../types.js";

const SignupBody = z.object({
  handle: z
    .string()
    .min(2)
    .max(24)
    .regex(/^[^\s/\\?#&%<>"]+$/, {
      message: "Handle can't contain whitespace or any of: / \\ ? # & % < > \"",
    }),
  email: z.string().email(),
  password: z.string().min(6),
  display_name: z.string().min(1).max(60),
  school: z.string().max(80).optional(),
  gender: z.enum(["m", "f", "x"]).optional(),
  level: z.enum(["hs", "college", "open", "masters"]).optional(),
  bio: z.string().max(280).optional(),
});

const LoginBody = z.object({
  handle: z.string(),
  password: z.string(),
});

function publicUser(u: User) {
  const { password_hash, ...rest } = u as any;
  return rest;
}

export async function authRoutes(app: FastifyInstance) {
  app.post("/signup", async (req, reply) => {
    const parsed = SignupBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.message });
    const { handle, email, password, display_name, school, gender, level, bio } = parsed.data;

    const exists = await qOne(
      "SELECT id FROM users WHERE handle = ? OR email = ?",
      [handle, email],
    );
    if (exists) return reply.code(409).send({ error: "handle or email taken" });

    const hash = bcrypt.hashSync(password, 10);
    const seed = handle.toLowerCase();
    const id = await qInsertId(
      `INSERT INTO users (handle, email, password_hash, display_name, school, bio, gender, level, avatar_seed)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      [handle, email, hash, display_name, school ?? null, bio ?? null, gender ?? null, level ?? null, seed],
    );
    const user = (await qOne<User>("SELECT * FROM users WHERE id = ?", [id]))!;
    const token = app.jwt.sign({ id: user.id, handle: user.handle });
    return { token, user: publicUser(user) };
  });

  app.post("/login", async (req, reply) => {
    const parsed = LoginBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.message });
    const { handle, password } = parsed.data;

    const row = await qOne<User & { password_hash: string }>(
      "SELECT * FROM users WHERE handle = ? OR email = ?",
      [handle, handle],
    );
    if (!row) return reply.code(401).send({ error: "invalid credentials" });
    const ok = bcrypt.compareSync(password, row.password_hash);
    if (!ok) return reply.code(401).send({ error: "invalid credentials" });

    const token = app.jwt.sign({ id: row.id, handle: row.handle });
    return { token, user: publicUser(row) };
  });

  app.get("/me", { preHandler: (app as any).auth }, async (req: any) => {
    const user = await qOne<User>("SELECT * FROM users WHERE id = ?", [req.user.id]);
    return publicUser(user!);
  });

  // Profile / account update
  const UpdateMe = z.object({
    display_name: z.string().min(1).max(60).optional(),
    school: z.string().max(80).nullable().optional(),
    bio: z.string().max(280).nullable().optional(),
    gender: z.enum(["m", "f", "x"]).nullable().optional(),
    level: z.enum(["hs", "college", "open", "masters"]).nullable().optional(),
    email: z.string().email().optional(),
    avatar_url: z.string().url().max(500).nullable().optional(),
    height_cm: z.number().int().min(120).max(230).nullable().optional(),
    weight_lb: z.number().int().min(60).max(400).nullable().optional(),
    unit_pref: z.enum(["imperial", "metric"]).optional(),
  });
  app.patch("/me", { preHandler: (app as any).auth }, async (req: any, reply) => {
    const parsed = UpdateMe.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.message });
    const p = parsed.data;
    if (p.email) {
      const taken = await qOne(
        "SELECT id FROM users WHERE email = ? AND id != ?",
        [p.email, req.user.id],
      );
      if (taken) return reply.code(409).send({ error: "email taken" });
    }
    await q(
      `UPDATE users SET
        display_name = COALESCE(?, display_name),
        school       = COALESCE(?, school),
        bio          = COALESCE(?, bio),
        gender       = COALESCE(?, gender),
        level        = COALESCE(?, level),
        email        = COALESCE(?, email),
        avatar_url   = COALESCE(?, avatar_url),
        height_cm    = COALESCE(?, height_cm),
        weight_lb    = COALESCE(?, weight_lb),
        unit_pref    = COALESCE(?, unit_pref)
       WHERE id = ?`,
      [
        p.display_name ?? null,
        p.school === undefined ? null : p.school,
        p.bio === undefined ? null : p.bio,
        p.gender === undefined ? null : p.gender,
        p.level === undefined ? null : p.level,
        p.email ?? null,
        p.avatar_url === undefined ? null : p.avatar_url,
        p.height_cm === undefined ? null : p.height_cm,
        p.weight_lb === undefined ? null : p.weight_lb,
        p.unit_pref ?? null,
        req.user.id,
      ],
    );
    const user = await qOne<User>("SELECT * FROM users WHERE id = ?", [req.user.id]);
    return publicUser(user!);
  });

  // Password change
  app.post("/me/password", { preHandler: (app as any).auth }, async (req: any, reply) => {
    const Body = z.object({ current: z.string(), next: z.string().min(6) });
    const parsed = Body.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.message });
    const u = await qOne<{ password_hash: string }>(
      "SELECT password_hash FROM users WHERE id = ?",
      [req.user.id],
    );
    if (!u || !bcrypt.compareSync(parsed.data.current, u.password_hash))
      return reply.code(401).send({ error: "current password incorrect" });
    await q("UPDATE users SET password_hash = ? WHERE id = ?", [
      bcrypt.hashSync(parsed.data.next, 10),
      req.user.id,
    ]);
    return { ok: true };
  });
}
