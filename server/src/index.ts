import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import multipart from "@fastify/multipart";
import staticPlugin from "@fastify/static";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "./db.js";
import { seedIfEmpty } from "./seed.js";
import { uploadRoutes } from "./routes/uploads.js";
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

// Loud startup banner — log to stdout immediately so we can see anything in
// Render's log even if a later step hangs.
console.log("[apex] starting", {
  node: process.version,
  port: PORT,
  hasDatabaseUrl: !!process.env.DATABASE_URL,
  hasSupabaseUrl: !!process.env.SUPABASE_URL,
  hasSupabaseKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  databaseHost: (() => {
    try {
      return new URL(process.env.DATABASE_URL ?? "").host;
    } catch {
      return "(invalid DATABASE_URL)";
    }
  })(),
});

// Warm up Postgres in the background so we can still bind a port even if
// connection is slow/dead — Render kills us if no port opens within ~60s.
pool
  .query("SELECT 1")
  .then(async () => {
    console.log("[apex] Postgres connection OK");
    try {
      await seedIfEmpty();
    } catch (e: any) {
      console.error("[apex] seed failed:", e.message ?? e);
    }
  })
  .catch((e: any) => {
    console.error("[apex] Postgres connection FAILED:", e.message ?? e);
    console.error("[apex] Server is up but DB calls will fail until DATABASE_URL is fixed.");
  });

const app = Fastify({ logger: true });

await app.register(cors, { origin: true, credentials: true });
await app.register(jwt, { secret: JWT_SECRET });
await app.register(multipart, {
  limits: {
    fileSize: 200 * 1024 * 1024,
    files: 1,
  },
});

// Production: serve the built client (vite build output) at /
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(__dirname, "../../client/dist");
const serveClient = existsSync(path.join(clientDist, "index.html"));
if (serveClient) {
  await app.register(staticPlugin, {
    root: clientDist,
    prefix: "/",
    decorateReply: true,
  });
}

app.decorate("auth", async (req: any, reply: any) => {
  try {
    await req.jwtVerify();
  } catch {
    reply.code(401).send({ error: "unauthorized" });
  }
});

// Global error handler — log the full error (so we can see it in Render logs)
// and return a meaningful message instead of a generic 500.
app.setErrorHandler((err, req, reply) => {
  const status = (err as any).statusCode ?? 500;
  req.log.error(
    { err, url: req.url, method: req.method, body: req.body, code: (err as any).code },
    "[apex] request failed",
  );
  // Surface the underlying Postgres / app message so we can diagnose without
  // shell access. Will tighten before any sensitive-data prod release.
  reply.code(status).send({
    error: err.message ?? "internal error",
    code: (err as any).code ?? undefined,
    detail: (err as any).detail ?? undefined,
  });
});

app.get("/api/health", async () => ({ ok: true, name: "apex" }));

// Diagnostic endpoint — confirms each expected table is reachable. Helpful when
// debugging deploy issues; safe because it leaks only schema names, not data.
app.get("/api/_diag", async () => {
  const out: Record<string, any> = {
    db_host: (() => {
      try {
        return new URL(process.env.DATABASE_URL ?? "").host;
      } catch {
        return null;
      }
    })(),
    has_supabase_url: !!process.env.SUPABASE_URL,
    has_supabase_key: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
  const tables = [
    "users",
    "follows",
    "poles",
    "meets",
    "sessions",
    "attempts",
    "posts",
    "comments",
    "kudos",
    "notifications",
  ];
  for (const t of tables) {
    try {
      const r = await pool.query(`SELECT COUNT(*)::int AS c FROM ${t}`);
      out[t] = { count: r.rows[0]?.c };
    } catch (e: any) {
      out[t] = { error: e.message ?? String(e), code: e.code };
    }
  }
  return out;
});

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

// SPA fallback: anything not matched by an API route or a static asset gets index.html
if (serveClient) {
  app.setNotFoundHandler((req: any, reply: any) => {
    if (req.url.startsWith("/api/") || req.url.startsWith("/uploads/")) {
      return reply.code(404).send({ error: "not found" });
    }
    return reply.sendFile("index.html", clientDist);
  });
  app.log.info(`serving client from ${clientDist}`);
}

try {
  await app.listen({ port: PORT, host: "0.0.0.0" });
  app.log.info(`Apex API running on http://0.0.0.0:${PORT}`);

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
