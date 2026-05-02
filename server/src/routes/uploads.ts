// Uploads route, backed by Supabase Storage. Each uploaded file gets a
// timestamped + random-suffixed key in the apex-uploads bucket and we return
// its public URL. The frontend stores that URL on the attempt or user.

import type { FastifyInstance } from "fastify";
import path from "node:path";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET ?? "apex-uploads";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn(
    "[apex] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set — uploads will fail.",
  );
}

const supabase =
  supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;

const ALLOWED_VIDEO_EXT = new Set([".mp4", ".mov", ".webm", ".m4v", ".quicktime"]);
const ALLOWED_VIDEO_MIME = new Set([
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-m4v",
]);

const ALLOWED_IMAGE_EXT = new Set([
  ".jpg", ".jpeg", ".png", ".gif", ".webp", ".heic", ".heif",
]);
const ALLOWED_IMAGE_MIME = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
  "image/heif",
]);

async function uploadToStorage(opts: {
  data: Buffer;
  prefix: string; // "video" | "image"
  origExt: string;
  mime: string;
}): Promise<string> {
  if (!supabase) throw new Error("Supabase Storage is not configured");
  const ext = opts.origExt || (opts.prefix === "video" ? ".mp4" : ".jpg");
  const key = `${opts.prefix}/${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(key, opts.data, {
    contentType: opts.mime || undefined,
    upsert: false,
  });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(key);
  return data.publicUrl;
}

export async function uploadRoutes(app: FastifyInstance) {
  app.post("/video", { preHandler: (app as any).auth }, async (req: any, reply) => {
    const file = await req.file();
    if (!file) return reply.code(400).send({ error: "no file" });

    const origExt = path.extname(file.filename ?? "").toLowerCase();
    const mime = (file.mimetype ?? "").toLowerCase();
    if (!ALLOWED_VIDEO_EXT.has(origExt) && !ALLOWED_VIDEO_MIME.has(mime)) {
      return reply
        .code(415)
        .send({ error: `unsupported video type: ${mime || origExt || "unknown"}` });
    }

    let buffer: Buffer;
    try {
      buffer = await file.toBuffer();
    } catch (e: any) {
      return reply.code(500).send({ error: e.message ?? "upload read failed" });
    }
    if (file.file.truncated) {
      return reply.code(413).send({ error: "file too large (>200MB)" });
    }
    try {
      const url = await uploadToStorage({ data: buffer, prefix: "video", origExt, mime });
      return { url };
    } catch (e: any) {
      return reply.code(500).send({ error: e.message ?? "upload failed" });
    }
  });

  app.post("/image", { preHandler: (app as any).auth }, async (req: any, reply) => {
    const file = await req.file();
    if (!file) return reply.code(400).send({ error: "no file" });

    const origExt = path.extname(file.filename ?? "").toLowerCase();
    const mime = (file.mimetype ?? "").toLowerCase();
    if (!ALLOWED_IMAGE_EXT.has(origExt) && !ALLOWED_IMAGE_MIME.has(mime)) {
      return reply
        .code(415)
        .send({ error: `unsupported image type: ${mime || origExt || "unknown"}` });
    }

    let buffer: Buffer;
    try {
      buffer = await file.toBuffer();
    } catch (e: any) {
      return reply.code(500).send({ error: e.message ?? "upload read failed" });
    }
    if (file.file.truncated) {
      return reply.code(413).send({ error: "file too large (>200MB)" });
    }
    try {
      const url = await uploadToStorage({ data: buffer, prefix: "image", origExt, mime });
      return { url };
    } catch (e: any) {
      return reply.code(500).send({ error: e.message ?? "upload failed" });
    }
  });
}
