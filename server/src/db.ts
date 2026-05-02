import Database from "better-sqlite3";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(__dirname, "../apex.db");

export const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

export function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      handle TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      bio TEXT,
      school TEXT,
      gender TEXT,
      level TEXT,
      pr_height_mm INTEGER,
      pr_date TEXT,
      avatar_seed TEXT,
      avatar_url TEXT,                       -- pfp URL (optional)
      height_cm INTEGER,                     -- body height for step calc
      weight_lb INTEGER,                     -- body weight for step calc
      unit_pref TEXT NOT NULL DEFAULT 'imperial',  -- 'imperial' | 'metric'
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS follows (
      follower_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      followee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (follower_id, followee_id)
    );

    CREATE TABLE IF NOT EXISTS poles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      make TEXT NOT NULL,
      length_in REAL NOT NULL,
      weight_lb INTEGER NOT NULL,
      flex REAL,
      nickname TEXT,
      retired INTEGER NOT NULL DEFAULT 0,
      attempts_count INTEGER NOT NULL DEFAULT 0,
      deleted_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS meets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      location TEXT,
      date TEXT NOT NULL,
      host_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,                    -- 'practice' | 'meet'
      date TEXT NOT NULL,
      location TEXT,
      surface TEXT,
      wind_ms REAL,
      temp_f REAL,
      energy INTEGER,
      notes TEXT,
      cues_had TEXT,                         -- cues that worked
      cues_work TEXT,                        -- cues to work on
      meet_id INTEGER REFERENCES meets(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      ordinal INTEGER NOT NULL,
      bar_height_mm INTEGER NOT NULL,
      result TEXT NOT NULL,                  -- 'clear' | 'knock' | 'pass' | 'bail'
      pole_id INTEGER REFERENCES poles(id) ON DELETE SET NULL,
      grip_in REAL,
      step_in REAL,
      run_up_steps INTEGER,
      miss_tags TEXT,
      notes TEXT,
      video_url TEXT,
      coach_note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      session_id INTEGER REFERENCES sessions(id) ON DELETE SET NULL,
      visibility TEXT NOT NULL,
      caption TEXT,
      pinned_attempt_ids TEXT,
      is_pr INTEGER NOT NULL DEFAULT 0,
      is_first_clearance INTEGER NOT NULL DEFAULT 0,
      repost_of_id INTEGER REFERENCES posts(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS kudos (
      post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (post_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      type TEXT NOT NULL,
      post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
      comment_id INTEGER REFERENCES comments(id) ON DELETE CASCADE,
      read_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_attempts_user ON attempts(user_id);
    CREATE INDEX IF NOT EXISTS idx_attempts_session ON attempts(session_id);
    CREATE INDEX IF NOT EXISTS idx_posts_user ON posts(user_id);
    CREATE INDEX IF NOT EXISTS idx_posts_visibility ON posts(visibility);
    CREATE INDEX IF NOT EXISTS idx_posts_repost ON posts(repost_of_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_meet ON sessions(meet_id);
    CREATE INDEX IF NOT EXISTS idx_notif_user_created ON notifications(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_notif_unread ON notifications(user_id, read_at);
  `);
}
