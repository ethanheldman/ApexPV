// Auto-post helper for meet sessions. Every meet session has a single public
// post that tracks the session's best clearance and updates as attempts come in.
import { db } from "../db.js";

type Attempt = {
  id: number;
  bar_height_mm: number;
  result: string;
};

/**
 * Ensure a public post exists for the given meet session, with the best clearance
 * pinned. No-op for non-meet sessions and for sessions with zero attempts.
 *
 * Returns the post id (existing or newly created), or null if there's nothing
 * worth posting yet.
 */
export function upsertMeetPost(sessionId: number): number | null {
  const session = db
    .prepare("SELECT id, user_id, type, date, meet_id FROM sessions WHERE id = ?")
    .get(sessionId) as
    | { id: number; user_id: number; type: string; date: string; meet_id: number | null }
    | undefined;
  if (!session) return null;
  if (session.type !== "meet") return null;

  const attempts = db
    .prepare("SELECT id, bar_height_mm, result FROM attempts WHERE session_id = ? ORDER BY id ASC")
    .all(sessionId) as Attempt[];
  if (attempts.length === 0) return null;

  const clears = attempts.filter((a) => a.result === "clear");
  const top = clears.length
    ? clears.reduce((m, a) => (a.bar_height_mm > m.bar_height_mm ? a : m))
    : attempts[attempts.length - 1];

  // PR check
  const u = db
    .prepare("SELECT pr_height_mm FROM users WHERE id = ?")
    .get(session.user_id) as { pr_height_mm: number | null };
  const isPr = clears.length && u.pr_height_mm && top.bar_height_mm >= u.pr_height_mm ? 1 : 0;

  // First-clearance: no prior clearance at this height anywhere else
  let isFirst = 0;
  if (top.result === "clear") {
    const prior = db
      .prepare(
        `SELECT COUNT(*) AS c FROM attempts a
         JOIN sessions s ON s.id = a.session_id
         WHERE a.user_id = ? AND a.bar_height_mm = ? AND a.result = 'clear'
           AND a.session_id != ?`,
      )
      .get(session.user_id, top.bar_height_mm, sessionId) as { c: number };
    if (prior.c === 0) isFirst = 1;
  }

  // Build a default caption from the meet name if we have one.
  const meet = session.meet_id
    ? (db.prepare("SELECT name FROM meets WHERE id = ?").get(session.meet_id) as
        | { name: string }
        | undefined)
    : undefined;

  // Find an existing post for this session (by the session owner)
  const existing = db
    .prepare(
      "SELECT id, caption FROM posts WHERE session_id = ? AND user_id = ? ORDER BY id DESC LIMIT 1",
    )
    .get(sessionId, session.user_id) as { id: number; caption: string | null } | undefined;

  const pinnedJson = JSON.stringify([top.id]);

  if (existing) {
    // Don't overwrite a caption the user typed manually. Only refresh the pinned
    // attempt + computed flags.
    db.prepare(
      `UPDATE posts SET pinned_attempt_ids = ?, is_pr = ?, is_first_clearance = ?, updated_at = datetime('now')
       WHERE id = ?`,
    ).run(pinnedJson, isPr, isFirst, existing.id);
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

  const r = db
    .prepare(
      `INSERT INTO posts (user_id, session_id, visibility, caption, pinned_attempt_ids, is_pr, is_first_clearance)
       VALUES (?, ?, 'public', ?, ?, ?, ?)`,
    )
    .run(session.user_id, sessionId, caption, pinnedJson, isPr, isFirst);

  return Number(r.lastInsertRowid);
}

/**
 * Called when an attempt is deleted. If the meet session has zero attempts left,
 * delete the auto-post; otherwise re-pin to the new best.
 */
export function refreshMeetPostAfterDelete(sessionId: number): void {
  const session = db
    .prepare("SELECT id, user_id, type FROM sessions WHERE id = ?")
    .get(sessionId) as { id: number; user_id: number; type: string } | undefined;
  if (!session || session.type !== "meet") return;

  const remaining = db
    .prepare("SELECT COUNT(*) AS c FROM attempts WHERE session_id = ?")
    .get(sessionId) as { c: number };
  if (remaining.c === 0) {
    db.prepare(
      "DELETE FROM posts WHERE session_id = ? AND user_id = ? AND visibility = 'public'",
    ).run(sessionId, session.user_id);
    return;
  }
  upsertMeetPost(sessionId);
}
