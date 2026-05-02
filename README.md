# ApexPV

A pole-vault-specific training journal — kind of like Strava, but for the only sport where you go upside-down on purpose.

Log every attempt with full context (height, pole, grip, run-up, miss tags), upload videos by drag-and-drop, share results from a meet that auto-posts as you log, follow other vaulters, and watch your apex (your peak clearance) climb over time.

## Features

- **Sessions + attempts** — practice or meet, with bar height, pole, grip, step, run-up, miss-tag taxonomy, and free-text notes
- **Drag-and-drop videos** — drop an `.mp4` / `.mov` / `.webm` and it plays inline on the post
- **Auto-posting meets** — meet sessions become a public post the moment you log your first attempt and update as you keep logging
- **Meet pages** — tag a session to a meet and everyone else who was there shows up on the meet page with their best clearance and videos
- **Heights done right** — all heights stored as millimeters so imperial values round-trip exactly, and the rendered "14'12"" bug is impossible
- **Imperial / metric toggle** — flip between `13'9"` and `4.19m` everywhere from Settings
- **Profile** — height-progression chart, miss-tag breakdown, pole bag, follow / unfollow, follower count, total attempts / clearances
- **Leaderboard** — top PRs with proper IAAF/NCAA tiebreak (earliest date wins), filter by gender / level
- **Engagement** — Up & Over kudos, threaded comments, reposts with the original embedded, share button
- **Notifications** — bell with unread count for kudos / comments / new follows
- **Search** — type-ahead over athletes and posts
- **Step calculator** — recommends an approach + pole spec from your body height + weight + experience
- **iPhone-ready** — bottom tab bar, 16px inputs (no auto-zoom), safe-area insets, add-to-home-screen icon

## Stack

- **Backend** — Fastify 5, `better-sqlite3`, JWT, Zod, `@fastify/multipart` for video uploads, `@fastify/static` for serving them
- **Frontend** — Vite, React 18, Tailwind, Recharts, react-router v6 with v7 future flags
- **DB** — SQLite at `server/apex.db` (gitignored)
- **Storage** — videos in `server/uploads/` (gitignored)

## Run it locally

```bash
git clone https://github.com/ethanheldman/ApexPV.git
cd ApexPV
npm run install:all
cd server && npm run seed && cd ..
npm run dev
```

Then open http://localhost:4010 — or, if your iPhone is on the same WiFi, the LAN URL the server prints in a box on startup (e.g. `http://172.20.10.5:4010`).

## Demo logins

Password for all demo accounts: `apex1234`

| Handle  | Bio                                                  |
|---------|------------------------------------------------------|
| `mona`  | 13'9" PR · Bowdoin · indoor szn                      |
| `kai`   | 5.40m PR · Oregon · 2x state champ                   |
| `jules` | Stanford · rebuilding the run-up                     |
| `ollie` | Princeton · masters vaulter / coach                  |
| `sam`   | Texas · first season on the big poles                |
| `demo`  | Apex HS · fresh account, follows everyone            |

`mona` has the richest seeded data — she's at a meet (`/meets/1`), has uploaded a video, and her session has cues filled out.

## Project layout

```
Apex/
├── server/
│   └── src/
│       ├── routes/        # auth, users, poles, sessions, attempts, posts,
│       │                  # feed, notifications, search, meets, fun, calc, uploads
│       ├── lib/           # meetPost auto-publish helper
│       ├── db.ts          # schema (mm-stored heights, soft-deleted poles, notifications)
│       ├── seed.ts        # demo data
│       └── index.ts       # Fastify bootstrap, prints LAN URLs
└── client/
    └── src/
        ├── routes/        # Feed, Profile, LogSession, MeetMode, MeetDetail,
        │                  # Settings, Notifications, Discover, Leaderboard, …
        ├── components/    # PostCard, AttemptRow, VideoDrop, MobileTabBar, Avatar, …
        └── lib/           # format helpers (mmToFtIn, canonicalize, unit hook)
```

## License

Private project. Not open source.
