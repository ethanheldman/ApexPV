// Postgres connection layer. Used to be SQLite via better-sqlite3 (sync); now
// it's pg (async) with a small helper that lets the existing query strings
// keep their `?` placeholders. We translate `?` -> `$1, $2, ...` on the fly so
// the route files don't have to be re-numbered everywhere.

import pg from "pg";

const { Pool, types } = pg;

// Have BIGINT come back as a regular Number. Our IDs comfortably fit in
// 2^53; pg's default behavior of returning BIGINT as a string would force
// every consumer to cast.
types.setTypeParser(20, (v) => (v == null ? null : parseInt(v, 10)));

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is not set. Point it at your Supabase Postgres (Session pooler URL) before starting the server.",
  );
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Supabase requires SSL.
  ssl: process.env.DATABASE_URL.includes("supabase.")
    ? { rejectUnauthorized: false }
    : undefined,
  // Free-tier-safe defaults; Render's tiny dyno + Supabase's pooler don't
  // benefit from a huge pool.
  max: 5,
  idleTimeoutMillis: 30_000,
  // Short connect timeout — fail fast on bad URL / paused project rather than
  // hanging long enough to time out Render's port-binding window.
  connectionTimeoutMillis: 8_000,
});

pool.on("error", (err) => {
  console.error("[pg pool] unexpected error", err);
});

/**
 * Convert SQLite-style `?` placeholders into Postgres-style `$1, $2, ...`.
 * Doesn't touch `?` characters inside string literals — we don't have any
 * `?` literals in our queries so this naive replace is safe.
 */
function pgify(sql: string): string {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

/** Run a raw query; returns the full result. */
export async function q<T = any>(sql: string, params: any[] = []) {
  return pool.query<T>(pgify(sql), params);
}

/** Convenience: first row or null. */
export async function qOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
  const r = await q<T>(sql, params);
  return r.rows[0] ?? null;
}

/** Convenience: array of rows. */
export async function qAll<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const r = await q<T>(sql, params);
  return r.rows;
}

/** Convenience: insert + return the new id (relies on RETURNING id in the SQL). */
export async function qInsertId(sql: string, params: any[] = []): Promise<number> {
  const r = await q<{ id: number }>(sql, params);
  return r.rows[0].id;
}

/** Run a sequence of queries inside a single transaction. */
export async function tx<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (e) {
    try {
      await client.query("ROLLBACK");
    } catch {}
    throw e;
  } finally {
    client.release();
  }
}

/** Send a query through a specific client (for inside transactions). */
export async function txQ<T = any>(client: pg.PoolClient, sql: string, params: any[] = []) {
  return client.query<T>(pgify(sql), params);
}
