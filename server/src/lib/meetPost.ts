// Auto-post helper for meet sessions. Every meet session has a single public
// post that tracks the session's best clearance and updates as attempts come in.
import { q, qOne, qAll } from "../db.js";

type Attempt = {
  id: number;
  bar_height_mm: number;
  result: string;
};

export async function upsertMeetPost(sessionId: number): Promise<number | null> {
  const session = await qOne<{
    id: number;
    user_id: number;
    type: string;
    date: string;
    meet_id: number | null;
  }>("SELECT id, user_id, type, date, meet_id FROM sessions WHERE id = ?", [sessionId]);
  if (!session) return null;
  if (session.type !== "meet") return null;

  const attempts = await qAll<Attempt>(
    "SELECT id, bar_height_mm, result FROM attempts WHERE session_id = ? ORDER BY id ASC",
    [sessionId],
  );
  if (attempts.length === 0) return null;

  const clears = attempts.filter((a) => a.result === "clear");
  const top = clears.length
    ? clears.reduce((m, a) => (a.bar_height_mm > m.bar_height_mm ? a : m))
    : attempts[attempts.length - 1];

  const u = await qOne<{ pr_height_mm: number | null }>(
    "SELECT pr_height_mm FROM users WHERE id = ?",
    [session.user_id],
  );
  const isPr = clears.length && u?.pr_height_mm && top.bar_height_mm >= u.pr_height_mm ? 1 : 0;

  let isFirst = 0;
  if (top.result === "clear") {
    const prior = await qOne<{ c: number }>(
      `SELECT COUNT(*)::int AS c FROM attempts a
       JOIN sessions s ON s.id = a.session_id
       WHERE a.user_id = ? AND a.bar_height_mm = ? AND a.result = 'clear'
         AND a.session_id != ?`,
      [session.user_id, top.bar_height_mm, sessionId],
    );
    if ((prior?.c ?? 0) === 0) isFirst = 1;
  }

  const meet = session.meet_id
    ? await qOne<{ name: string }>("SELECT name FROM meets WHERE id = ?", [session.meet_id])
    : null;

  const existing = await qOne<{ id: number; caption: string | null }>(
    "SELECT id, caption FROM posts WHERE session_id = ? AND user_id = ? ORDER BY id DESC LIMIT 1",
    [sessionId, session.user_id],
  );

  const pinnedJson = JSON.stringify([top.id]);

  if (existing) {
    await q(
      `UPDATE posts SET pinned_attempt_ids = ?, is_pr = ?, is_first_clearance = ?, updated_at = now()
       WHERE id = ?`,
      [pinnedJson, isPr, isFirst, existing.id],
    );
    return existing.id;
  }

  const captionParts: string[] = [];
  if (meet?.name) captionParts.push(`Meet: ${meet.name}`);
  if (top.result === "clear") {
    const ft = Math.floor(top.bar_height_mm / 25.4 / 12);
    const inches = Math.round(((top.bar_height_mm / 25.4) - ft * 12) * 4) / 4;
    captionParts.push(
      `Best: ${ft}'${inches === Math.floor(inches) ? inches.toFixed(0) : inches}"`,
    );
  }
  const caption = captionParts.length > 0 ? captionParts.join(" · ") : null;

  const ins = await qOne<{ id: number }>(
    `INSERT INTO posts (user_id, session_id, visibility, caption, pinned_attempt_ids, is_pr, is_first_clearance)
     VALUES (?, ?, 'public', ?, ?, ?, ?) RETURNING id`,
    [session.user_id, sessionId, caption, pinnedJson, isPr, isFirst],
  );
  return ins?.id ?? null;
}

export async function refreshMeetPostAfterDelete(sessionId: number): Promise<void> {
  const session = await qOne<{ id: number; user_id: number; type: string }>(
    "SELECT id, user_id, type FROM sessions WHERE id = ?",
    [sessionId],
  );
  if (!session || session.type !== "meet") return;

  const remaining = await qOne<{ c: number }>(
    "SELECT COUNT(*)::int AS c FROM attempts WHERE session_id = ?",
    [sessionId],
  );
  if ((remaining?.c ?? 0) === 0) {
    await q(
      "DELETE FROM posts WHERE session_id = ? AND user_id = ? AND visibility = 'public'",
      [sessionId, session.user_id],
    );
    return;
  }
  await upsertMeetPost(sessionId);
}
