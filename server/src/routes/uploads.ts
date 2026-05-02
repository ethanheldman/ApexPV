// Drag-and-drop video uploads. Saves to server/uploads/ on disk;
// the static plugin serves them at /uploads/<filename>.
import type { FastifyInstance } from "fastify";
import path from "node:path";
import { mkdirSync, createWriteStream, existsSync } from "node:fs";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const UPLOAD_DIR = path.resolve(__dirname, "../../uploads");

const ALLOWED_EXT = new Set([".mp4", ".mov", ".webm", ".m4v", ".quicktime"]);
const ALLOWED_MIME = new Set([
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

if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true });

export async function uploadRoutes(app: FastifyInstance) {
  app.post("/video", { preHandler: (app as any).auth }, async (req: any, reply) => {
    const file = await req.file();
    if (!file) return reply.code(400).send({ error: "no file" });

    const origExt = path.extname(file.filename ?? "").toLowerCase();
    const mime = (file.mimetype ?? "").toLowerCase();
    if (!ALLOWED_EXT.has(origExt) && !ALLOWED_MIME.has(mime)) {
      return reply
        .code(415)
        .send({ error: `unsupported video type: ${mime || origExt || "unknown"}` });
    }
    const ext = origExt || ".mp4";
    const safeName =
      `${Date.now()}-` +
      crypto.randomBytes(6).toString("hex") +
      ext;
    const targetPath = path.join(UPLOAD_DIR, safeName);

    try {
      await pipeline(file.file, createWriteStream(targetPath));
    } catch (e: any) {
      return reply.code(500).send({ error: e.message ?? "upload failed" });
    }

    if (file.file.truncated) {
      // File exceeded the configured limit
      return reply.code(413).send({ error: "file too large (>200MB)" });
    }

    return { url: `/uploads/${safeName}` };
  });

  // Profile picture upload — same disk + URL pattern, narrower MIME allow-list.
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
    const ext = origExt || ".jpg";
    const safeName =
      `img-${Date.now()}-` + crypto.randomBytes(6).toString("hex") + ext;
    const targetPath = path.join(UPLOAD_DIR, safeName);

    try {
      await pipeline(file.file, createWriteStream(targetPath));
    } catch (e: any) {
      return reply.code(500).send({ error: e.message ?? "upload failed" });
    }

    if (file.file.truncated) {
      return reply.code(413).send({ error: "file too large (>200MB)" });
    }

    return { url: `/uploads/${safeName}` };
  });
}
