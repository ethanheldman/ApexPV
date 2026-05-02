import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import multipart from "@fastify/multipart";
import staticPlugin from "@fastify/static";
import { unlinkSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { initSchema } from "./db.js";
import { uploadRoutes, UPLOAD_DIR } from "./routes/uploads.js";
import { authRoutes } from "./routes/auth.js";
import { userRoutes } from "./routes/users.js";
import { poleRoutes } from "./routes/poles.js";
import { sessionRoutes } from "./routes/sessions.js";
import { attemptRoutes } from "./routes/attempts.js";
import { postRoutes } from "./routes/posts.js";
import { feedRoutes } from "./routes/feed.js";
import { notifRoutes } from "./routes/notifications.js";
import { searchRoutes } from "./routes/search.js";
import { meetRoutes } from "./routes/meets.js";
import { funRoutes } from "./routes/fun.js";
import { calcRoutes } from "./routes/calc.js";

const PORT = Number(process.env.PORT ?? 4011);
const JWT_SECRET = process.env.JWT_SECRET ?? "apex-dev-secret-do-not-use-in-prod";

// Schema migration: if an old DB exists with `bar_height_cm` columns,
// blow it away so the dev experience is clean. We re-seed afterwards.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const oldDbCheck = path.resolve(__dirname, "../apex.db");
if (existsSync(oldDbCheck)) {
  try {
    const probe = (await import("better-sqlite3")).default(oldDbCheck);
    const cols = probe.prepare("PRAGMA table_info(attempts)").all() as { name: string }[];
    const userCols = probe.prepare("PRAGMA table_info(users)").all() as { name: string }[];
    const hasOldHeight = cols.some((c) => c.name === "bar_height_cm");
    const hasNewUserFields = userCols.some((c) => c.name === "unit_pref");
    probe.close();
    if (hasOldHeight || !hasNewUserFields) {
      console.log("[apex] detected legacy schema — wiping db for migration");
      unlinkSync(oldDbCheck);
      const wal = oldDbCheck + "-wal";
      const shm = oldDbCheck + "-shm";
      if (existsSync(wal)) unlinkSync(wal);
      if (existsSync(shm)) unlinkSync(shm);
    }
  } catch {}
}

initSchema();

const app = Fastify({ logger: true });

await app.register(cors, { origin: true, credentials: true });
await app.register(jwt, { secret: JWT_SECRET });
await app.register(multipart, {
  limits: {
    fileSize: 200 * 1024 * 1024, // 200 MB cap per upload
    files: 1,
  },
});
await app.register(staticPlugin, {
  root: UPLOAD_DIR,
  prefix: "/uploads/",
  decorateReply: false,
});

app.decorate("auth", async (req: any, reply: any) => {
  try {
    await req.jwtVerify();
  } catch {
    reply.code(401).send({ error: "unauthorized" });
  }
});

app.get("/api/health", async () => ({ ok: true, name: "apex" }));

await app.register(authRoutes, { prefix: "/api/auth" });
await app.register(userRoutes, { prefix: "/api/users" });
await app.register(poleRoutes, { prefix: "/api/poles" });
await app.register(sessionRoutes, { prefix: "/api/sessions" });
await app.register(attemptRoutes, { prefix: "/api/attempts" });
await app.register(postRoutes, { prefix: "/api/posts" });
await app.register(feedRoutes, { prefix: "/api/feed" });
await app.register(notifRoutes, { prefix: "/api/notifications" });
await app.register(searchRoutes, { prefix: "/api/search" });
await app.register(meetRoutes, { prefix: "/api/meets" });
await app.register(funRoutes, { prefix: "/api/fun" });
await app.register(calcRoutes, { prefix: "/api/calc" });
await app.register(uploadRoutes, { prefix: "/api/uploads" });

try {
  // Bind 0.0.0.0 so the same-WiFi iPhone can reach the API directly if needed.
  // (The Vite dev proxy is the primary path; this is just a safety net.)
  await app.listen({ port: PORT, host: "0.0.0.0" });
  app.log.info(`Apex API running on http://0.0.0.0:${PORT}`);

  // Print every reachable LAN URL so the user can open it on their phone.
  const os = await import("node:os");
  const nets = os.networkInterfaces();
  const lan: string[] = [];
  for (const name of Object.keys(nets)) {
    for (const ni of nets[name] ?? []) {
      if (ni.family === "IPv4" && !ni.internal) lan.push(ni.address);
    }
  }
  if (lan.length) {
    const port = 4010;
    console.log("");
    console.log("╭─ open Apex on your iPhone (same WiFi) ─────────────╮");
    for (const ip of lan) console.log(`│  http://${ip}:${port}`.padEnd(54) + "│");
    console.log("╰────────────────────────────────────────────────────╯");
    console.log("");
  }
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
