// Idempotent seed — only runs if the users table is empty. Safe to re-import
// on every boot; first deploy populates demo data, subsequent boots no-op.
import bcrypt from "bcryptjs";
import { pool, q, qInsertId, qOne, qAll } from "./db.js";

export async function seedIfEmpty() {
  const u = await qOne<{ c: number }>("SELECT COUNT(*)::int AS c FROM users");
  if ((u?.c ?? 0) > 0) return;

  console.log("[apex] empty database — seeding demo data...");
  await runSeed();
  console.log("[apex] seed complete.");
}

export async function runSeed() {
  const pw = bcrypt.hashSync("apex1234", 10);
  const ftin = (ft: number, inches: number) =>
    Math.round(ft * 304.8 + inches * 25.4);
  const meters = (m: number) => Math.round(m * 1000);

  const userRows = [
    { handle: "mona", name: "Mona Reyes", school: "Bowdoin", bio: "outdoor szn", gender: "f", level: "college", height: 168, weight: 130 },
    { handle: "kai", name: "Kai Brennan", school: "Oregon", bio: "2x state champ", gender: "m", level: "college", height: 188, weight: 175 },
    { handle: "jules", name: "Jules Park", school: "Stanford", bio: "rebuilding the run-up", gender: "f", level: "college", height: 170, weight: 138 },
    { handle: "ollie", name: "Ollie Tran", school: "Princeton", bio: "masters vaulter / coach", gender: "m", level: "masters", height: 178, weight: 165 },
    { handle: "sam", name: "Sam Adeyemi", school: "Texas", bio: "first season on the big poles", gender: "x", level: "college", height: 173, weight: 145 },
    { handle: "demo", name: "Demo Athlete", school: "Apex HS", bio: "try out the app here", gender: "f", level: "hs", height: 165, weight: 125 },
  ];

  const userIds: Record<string, number> = {};
  for (const u of userRows) {
    const id = await qInsertId(
      `INSERT INTO users (handle, email, password_hash, display_name, school, bio, gender, level, avatar_seed, height_cm, weight_lb)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      [
        u.handle,
        `${u.handle}@apex.dev`,
        pw,
        u.name,
        u.school,
        u.bio,
        u.gender,
        u.level,
        u.handle,
        u.height,
        u.weight,
      ],
    );
    userIds[u.handle] = id;
  }

  const follows: [string, string][] = [
    ["demo", "mona"],
    ["demo", "kai"],
    ["demo", "jules"],
    ["mona", "kai"],
    ["mona", "jules"],
    ["kai", "mona"],
    ["jules", "mona"],
    ["jules", "ollie"],
    ["sam", "kai"],
    ["sam", "mona"],
    ["sam", "demo"],
    ["ollie", "jules"],
  ];
  for (const [a, b] of follows) {
    await q(
      "INSERT INTO follows (follower_id, followee_id) VALUES (?, ?) ON CONFLICT DO NOTHING",
      [userIds[a], userIds[b]],
    );
  }

  const poleSeeds: { user: string; make: string; len: number; wt: number; flex?: number; nick?: string }[] = [
    { user: "mona", make: "ESSX", len: 13.5, wt: 145, flex: 14.6, nick: "Greenie" },
    { user: "mona", make: "UCS Spirit", len: 14.0, wt: 150, flex: 14.0, nick: "the Stick" },
    { user: "mona", make: "ESSX", len: 14.0, wt: 155, flex: 13.4, nick: "Big Green" },
    { user: "kai", make: "Pacer FX", len: 15.0, wt: 170, flex: 11.8, nick: "Sting" },
    { user: "kai", make: "Pacer FX", len: 15.0, wt: 175, flex: 11.4, nick: "Stinger" },
    { user: "kai", make: "ESSX", len: 14.7, wt: 165, flex: 12.6, nick: "Practice" },
    { user: "jules", make: "UCS Spirit", len: 13.7, wt: 150, flex: 13.8 },
    { user: "jules", make: "ESSX", len: 14.0, wt: 155, flex: 13.2 },
    { user: "ollie", make: "Pacer FX", len: 14.0, wt: 160, flex: 12.8, nick: "Old Reliable" },
    { user: "sam", make: "UCS Spirit", len: 13.0, wt: 140, flex: 15.2, nick: "Trainer" },
    { user: "sam", make: "ESSX", len: 13.5, wt: 145, flex: 14.4 },
    { user: "demo", make: "UCS Spirit", len: 13.0, wt: 135, flex: 15.6, nick: "Beginner" },
    { user: "demo", make: "ESSX", len: 13.5, wt: 145, flex: 14.6 },
  ];
  const poleIds: Record<string, number[]> = {};
  for (const p of poleSeeds) {
    const id = await qInsertId(
      `INSERT INTO poles (user_id, make, length_in, weight_lb, flex, nickname)
       VALUES (?, ?, ?, ?, ?, ?) RETURNING id`,
      [userIds[p.user], p.make, p.len, p.wt, p.flex ?? null, p.nick ?? null],
    );
    (poleIds[p.user] ??= []).push(id);
  }

  // Meets
  const meet1 = await qInsertId(
    `INSERT INTO meets (name, location, date, host_user_id) VALUES (?, ?, ?, ?) RETURNING id`,
    ["NESCAC Indoor Champs", "Boston Univ.", dateAgo(2), userIds["mona"]],
  );
  const meet2 = await qInsertId(
    `INSERT INTO meets (name, location, date, host_user_id) VALUES (?, ?, ?, ?) RETURNING id`,
    ["Pac-12 Indoor", "Eugene, OR", dateAgo(3), userIds["kai"]],
  );

  type Att = {
    height: number;
    result: "clear" | "knock" | "pass" | "bail";
    poleIdx?: number;
    grip?: number;
    step?: number;
    runUp?: number;
    missTags?: string[];
    notes?: string;
  };
  type SessSeed = {
    user: string;
    type: "practice" | "meet";
    daysAgo: number;
    location?: string;
    surface?: "indoor" | "outdoor";
    wind?: number;
    temp?: number;
    energy?: number;
    notes?: string;
    cuesHad?: string;
    cuesWork?: string;
    meetId?: number;
    attempts: Att[];
    caption?: string;
    visibility?: "private" | "followers" | "public";
    pinFirstClear?: boolean;
  };

  const sessions: SessSeed[] = [
    {
      user: "mona", type: "meet", daysAgo: 2,
      location: "NESCAC Indoor Champs · Boston", surface: "indoor", energy: 5,
      notes: "PR day — finally cleared 13'9\".",
      cuesHad: "tall plant, drove the knee, finished the swing through hips",
      cuesWork: "stay patient on inversion — don't rush the shoot",
      meetId: meet1,
      visibility: "public", pinFirstClear: true,
      caption: "13'9\" on the second attempt. season's been building for this 🪶",
      attempts: [
        { height: ftin(12, 6), result: "clear", poleIdx: 0, grip: 154, step: 100, runUp: 14 },
        { height: ftin(13, 0), result: "clear", poleIdx: 1, grip: 156, step: 102, runUp: 14 },
        { height: ftin(13, 6), result: "clear", poleIdx: 1, grip: 158, step: 104, runUp: 14, notes: "smooth swing" },
        { height: ftin(13, 9), result: "knock", poleIdx: 2, grip: 160, step: 105, runUp: 14, missTags: ["chest_knock"] },
        { height: ftin(13, 9), result: "clear", poleIdx: 2, grip: 160, step: 105, runUp: 14, notes: "PR" },
        { height: ftin(14, 0), result: "knock", poleIdx: 2, grip: 161, step: 106, runUp: 14, missTags: ["arm_knock"] },
        { height: ftin(14, 0), result: "pass", poleIdx: 2, grip: 161, step: 103, runUp: 14, missTags: ["short_runway"] },
        { height: ftin(14, 0), result: "knock", poleIdx: 2, grip: 161, step: 105, runUp: 14, missTags: ["chest_knock"] },
      ],
    },
    {
      user: "mona", type: "practice", daysAgo: 5,
      location: "Farley Field House", surface: "indoor", energy: 4,
      visibility: "followers",
      cuesHad: "tall plant",
      cuesWork: "patience on inversion; don't rush",
      caption: "tune-up before champs",
      attempts: [
        { height: ftin(11, 6), result: "clear", poleIdx: 0, grip: 152, step: 99, runUp: 12 },
        { height: ftin(12, 6), result: "clear", poleIdx: 0, grip: 154, step: 101, runUp: 14 },
        { height: ftin(13, 0), result: "knock", poleIdx: 1, missTags: ["late_drive"] },
        { height: ftin(13, 0), result: "clear", poleIdx: 1, grip: 156, step: 102, runUp: 14 },
      ],
    },
    {
      user: "kai", type: "meet", daysAgo: 3,
      location: "Pac-12 Indoor", surface: "indoor", energy: 5,
      meetId: meet2,
      visibility: "public",
      caption: "5.40m clear. on the 15'/170 today, felt like a new pole",
      cuesHad: "fast pen, drove the knee through",
      cuesWork: "shoulder turn at top — bar's come down off chest 3 times now",
      attempts: [
        { height: meters(5.0), result: "clear", poleIdx: 0, grip: 175, step: 115, runUp: 18 },
        { height: meters(5.2), result: "clear", poleIdx: 0, grip: 175, step: 116, runUp: 18 },
        { height: meters(5.4), result: "clear", poleIdx: 1, grip: 177, step: 117, runUp: 18, notes: "second attempt" },
        { height: meters(5.55), result: "knock", poleIdx: 1, missTags: ["chest_knock"] },
        { height: meters(5.55), result: "knock", poleIdx: 1, missTags: ["chest_knock"] },
        { height: meters(5.55), result: "pass", poleIdx: 1, missTags: ["blew_through"] },
      ],
    },
    {
      user: "jules", type: "practice", daysAgo: 1,
      surface: "outdoor", wind: 1.2, temp: 64, energy: 4,
      visibility: "public",
      cuesHad: "step is finally landing on the runway",
      cuesWork: "drive knee — still dropping at takeoff",
      caption: "rebuilt the approach from scratch this week. step is finally landing",
      attempts: [
        { height: ftin(11, 9), result: "clear", poleIdx: 0, grip: 150, step: 100, runUp: 12 },
        { height: ftin(12, 9), result: "clear", poleIdx: 0, grip: 152, step: 102, runUp: 14 },
        { height: ftin(13, 6), result: "clear", poleIdx: 1, grip: 154, step: 103, runUp: 14, notes: "this is the one" },
        { height: ftin(13, 9), result: "knock", poleIdx: 1, missTags: ["late_tap", "didnt_take_up"] },
        { height: ftin(13, 9), result: "clear", poleIdx: 1, grip: 154, step: 103, runUp: 14 },
      ],
    },
    {
      user: "ollie", type: "practice", daysAgo: 6,
      surface: "indoor",
      visibility: "public",
      caption: "masters meet sat. just keeping the rhythm",
      attempts: [
        { height: ftin(11, 9), result: "clear", poleIdx: 0, grip: 154 },
        { height: ftin(12, 6), result: "clear", poleIdx: 0, grip: 156 },
        { height: ftin(13, 0), result: "knock", poleIdx: 0, missTags: ["chest_knock"] },
        { height: ftin(13, 0), result: "clear", poleIdx: 0, grip: 156 },
      ],
    },
    {
      user: "sam", type: "meet", daysAgo: 12,
      location: "Spring Opener · Austin", surface: "outdoor", energy: 4,
      visibility: "public",
      caption: "first meet of the year. cleared a height!",
      attempts: [
        { height: ftin(9, 6), result: "clear", poleIdx: 0, grip: 136 },
        { height: ftin(10, 6), result: "clear", poleIdx: 0, grip: 138 },
        { height: ftin(11, 0), result: "knock", poleIdx: 0, missTags: ["chest_knock"] },
      ],
    },
    {
      user: "demo", type: "meet", daysAgo: 2,
      location: "NESCAC Indoor Champs · Boston", surface: "indoor", energy: 4,
      meetId: meet1,
      visibility: "public",
      caption: "first meet at NESCAC. a bit of a chud session lol",
      cuesHad: "felt fast",
      cuesWork: "every miss-tag in the book today",
      attempts: [
        { height: ftin(9, 0), result: "clear", poleIdx: 0, grip: 132, step: 88, runUp: 10 },
        { height: ftin(9, 6), result: "clear", poleIdx: 0, grip: 134, step: 90, runUp: 10 },
        { height: ftin(10, 6), result: "clear", poleIdx: 1, grip: 138, step: 92, runUp: 12 },
        { height: ftin(11, 0), result: "knock", poleIdx: 1, missTags: ["chest_knock"] },
        { height: ftin(11, 0), result: "clear", poleIdx: 1, grip: 138, step: 93, runUp: 12 },
        { height: ftin(11, 6), result: "pass", poleIdx: 1, missTags: ["short_runway"] },
        { height: ftin(11, 6), result: "knock", poleIdx: 1, missTags: ["didnt_take_up"] },
      ],
    },
  ];

  for (const s of sessions) {
    const sessionId = await qInsertId(
      `INSERT INTO sessions (user_id, type, date, location, surface, wind_ms, temp_f, energy, notes, cues_had, cues_work, meet_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      [
        userIds[s.user], s.type, dateAgo(s.daysAgo),
        s.location ?? null, s.surface ?? null,
        s.wind ?? null, s.temp ?? null, s.energy ?? null,
        s.notes ?? null, s.cuesHad ?? null, s.cuesWork ?? null,
        s.meetId ?? null,
      ],
    );
    const attemptIds: number[] = [];
    let bestClear = 0;
    let bestClearAttemptId: number | null = null;
    for (let i = 0; i < s.attempts.length; i++) {
      const a = s.attempts[i];
      const polesForUser = poleIds[s.user] ?? [];
      const poleId = a.poleIdx !== undefined ? polesForUser[a.poleIdx] : null;
      const aid = await qInsertId(
        `INSERT INTO attempts (session_id, user_id, ordinal, bar_height_mm, result, pole_id, grip_in,
             step_in, run_up_steps, miss_tags, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
        [
          sessionId, userIds[s.user], i + 1, a.height, a.result,
          poleId,
          a.grip ?? null, a.step ?? null, a.runUp ?? null,
          a.missTags ? JSON.stringify(a.missTags) : null,
          a.notes ?? null,
        ],
      );
      attemptIds.push(aid);
      if (poleId) {
        await q("UPDATE poles SET attempts_count = attempts_count + 1 WHERE id = ?", [poleId]);
      }
      if (a.result === "clear" && a.height > bestClear) {
        bestClear = a.height;
        bestClearAttemptId = aid;
      }
    }

    if (bestClear > 0) {
      const u = await qOne<{ pr_height_mm: number | null }>(
        "SELECT pr_height_mm FROM users WHERE id = ?",
        [userIds[s.user]],
      );
      if (!u?.pr_height_mm || bestClear > u.pr_height_mm) {
        await q("UPDATE users SET pr_height_mm = ?, pr_date = ? WHERE id = ?", [
          bestClear, dateAgo(s.daysAgo), userIds[s.user],
        ]);
      }
    }

    if (s.visibility) {
      const pinned = bestClearAttemptId ? [bestClearAttemptId] : attemptIds.slice(0, 1);
      await q(
        `INSERT INTO posts (user_id, session_id, visibility, caption, pinned_attempt_ids, is_pr, is_first_clearance)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          userIds[s.user], sessionId, s.visibility,
          s.caption ?? null, JSON.stringify(pinned),
          s.pinFirstClear ? 1 : 0,
          s.pinFirstClear ? 1 : 0,
        ],
      );
    }
  }

  // Comments + kudos on a few public posts
  const publicPosts = await qAll<{ id: number; user_id: number }>(
    "SELECT id, user_id FROM posts WHERE visibility = 'public' ORDER BY id DESC",
  );

  const commenters = ["mona", "kai", "jules", "ollie", "sam", "demo"];
  const lines = [
    "send it 🚀",
    "huge!! big up & over",
    "the swing on that one was dialed",
    "what grip were you on?",
    "approach looks so much smoother than last meet",
    "lfg",
    "literally insane",
    "pole bend was perfect",
  ];

  for (let idx = 0; idx < Math.min(8, publicPosts.length); idx++) {
    const p = publicPosts[idx];
    const c1 = commenters[idx % commenters.length];
    const c2 = commenters[(idx + 1) % commenters.length];
    if (userIds[c1] !== p.user_id) {
      const cid = await qInsertId(
        "INSERT INTO comments (post_id, user_id, body) VALUES (?, ?, ?) RETURNING id",
        [p.id, userIds[c1], lines[idx % lines.length]],
      );
      await q(
        "INSERT INTO notifications (user_id, actor_id, type, post_id, comment_id) VALUES (?, ?, 'comment', ?, ?)",
        [p.user_id, userIds[c1], p.id, cid],
      );
    }
    if (userIds[c2] !== p.user_id) {
      const cid = await qInsertId(
        "INSERT INTO comments (post_id, user_id, body) VALUES (?, ?, ?) RETURNING id",
        [p.id, userIds[c2], lines[(idx + 3) % lines.length]],
      );
      await q(
        "INSERT INTO notifications (user_id, actor_id, type, post_id, comment_id) VALUES (?, ?, 'comment', ?, ?)",
        [p.user_id, userIds[c2], p.id, cid],
      );
    }
    for (const u of commenters) {
      if (userIds[u] !== p.user_id) {
        await q(
          "INSERT INTO kudos (post_id, user_id) VALUES (?, ?) ON CONFLICT DO NOTHING",
          [p.id, userIds[u]],
        );
        await q(
          "INSERT INTO notifications (user_id, actor_id, type, post_id) VALUES (?, ?, 'kudos', ?)",
          [p.user_id, userIds[u], p.id],
        );
      }
    }
  }
}

function dateAgo(daysAgo: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

// CLI usage: tsx src/seed.ts → forces a re-seed (but only if empty)
if (import.meta.url === `file://${process.argv[1]}`) {
  seedIfEmpty()
    .then(async () => {
      await pool.end();
      console.log("seed done.");
    })
    .catch(async (e) => {
      console.error(e);
      await pool.end();
      process.exit(1);
    });
}
