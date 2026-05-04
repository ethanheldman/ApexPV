import { Link } from "react-router-dom";
import type { Post } from "../types";
import Avatar from "./Avatar";
import { mmToMeters, RESULT_COLOR, RESULT_LABEL, relTime } from "../lib/format";
import { useUnit } from "../lib/unit";
import { MISS_TAG_LABEL } from "../lib/missTags";
import { api } from "../api";
import { useState } from "react";
import { useAuth } from "../auth";

export default function PostCard({ post: initial, embedded }: { post: Post; embedded?: boolean }) {
  const [post, setPost] = useState(initial);
  const { user: me } = useAuth();
  const { unit, fmt } = useUnit();
  const author = post.author;
  const isOwner = me?.id === post.user_id;
  const isRepost = !!post.original;

  const toggleKudos = async () => {
    if (isOwner) return;
    const before = post.my_kudos;
    setPost((p) => ({
      ...p,
      my_kudos: !before,
      kudos_count: p.kudos_count + (before ? -1 : 1),
    }));
    try {
      if (before) await api(`/api/posts/${post.id}/kudos`, { method: "DELETE" });
      else await api(`/api/posts/${post.id}/kudos`, { method: "POST" });
    } catch {
      setPost((p) => ({
        ...p,
        my_kudos: before,
        kudos_count: p.kudos_count + (before ? 1 : -1),
      }));
    }
  };

  const repost = async () => {
    if (!me || isOwner) return;
    const r = await api<Post>(`/api/posts/${post.id}/repost`, {
      method: "POST",
      json: { visibility: "followers" },
    });
    window.location.assign(`/p/${r.id}`);
  };

  const share = async () => {
    const url = `${window.location.origin}/p/${post.id}`;
    try {
      if (navigator.share) await navigator.share({ url });
      else await navigator.clipboard.writeText(url);
    } catch {
      try {
        await navigator.clipboard.writeText(url);
      } catch {}
    }
  };

  const isFirst = post.is_first_clearance === 1;
  const isPr = post.is_pr === 1;

  // If this is a repost, render the wrapper + an embedded version of the original
  if (isRepost && post.original && !embedded) {
    return (
      <article className="card overflow-hidden">
        <header className="flex items-center gap-2 px-4 py-2.5 bg-bg-raised/30 border-b border-border-subtle text-xs">
          <Avatar
            seed={author.avatar_seed ?? author.handle}
            url={author.avatar_url}
            size={20}
          />
          <span className="text-text-secondary">
            <Link to={`/u/${author.handle}`} className="font-semibold hover:underline">
              {author.display_name}
            </Link>{" "}
            reposted
          </span>
          <span className="text-text-tertiary ml-auto">{relTime(post.created_at)}</span>
        </header>
        {post.caption && (
          <p className="px-4 pt-2 pb-1 text-[14px]">{post.caption}</p>
        )}
        <div className="m-3 mt-2 rounded-xl border border-border-subtle overflow-hidden">
          <PostCard post={post.original} embedded />
        </div>
      </article>
    );
  }

  const pinned = post.attempts ?? [];
  const top = pinned.find((a) => a.result === "clear") ?? pinned[0];

  return (
    <article
      className={
        "card overflow-hidden transition-shadow hover:shadow-sm " +
        (isFirst ? "ring-2 ring-accent/70 shadow-[0_0_0_4px_rgba(255,90,31,0.08)]" : "")
      }
    >
      <header className="flex items-start gap-3 p-4 pb-2">
        <Link to={`/u/${author.handle}`}>
          <Avatar seed={author.avatar_seed ?? author.handle} url={author.avatar_url} size={40} />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <Link to={`/u/${author.handle}`} className="font-semibold hover:underline">
              {author.display_name}
            </Link>
            <span className="text-text-secondary text-sm">@{author.handle}</span>
            {author.school && (
              <span className="text-text-tertiary text-sm">· {author.school}</span>
            )}
            {!embedded && (
              <span className="text-text-tertiary text-xs ml-auto">{relTime(post.created_at)}</span>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            {isFirst && top && (
              <span className="pill bg-accent text-white">
                ★ first @ {fmt(top.bar_height_mm)}
              </span>
            )}
            {isPr && !isFirst && <span className="pill bg-emerald-500 text-white">PR</span>}
            {post.visibility === "private" && (
              <span className="pill bg-bg-raised text-text-primary">🔒 private</span>
            )}
            {post.visibility === "followers" && (
              <span className="pill bg-bg-raised text-text-primary">followers</span>
            )}
          </div>
        </div>
      </header>

      {post.caption && (
        <p className="px-4 pt-1 pb-2 text-[15px] leading-snug whitespace-pre-wrap">
          {post.caption}
        </p>
      )}

      {top?.video_url?.startsWith("/uploads/") && (
        <div className="mx-4 mb-2 mt-1 rounded-xl overflow-hidden bg-bg-sunken">
          <video
            src={top.video_url}
            controls
            preload="metadata"
            className="w-full max-h-96 object-contain"
          />
        </div>
      )}
      {top && (
        <Link
          to={`/p/${post.id}`}
          className="mx-4 mb-3 mt-2 block rounded-xl border border-border-subtle bg-bg-raised/30 hover:bg-bg-raised transition-colors p-4"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="label">Top clearance</div>
              <div className="font-display font-extrabold text-3xl tracking-tight">
                {fmt(top.bar_height_mm)}
              </div>
              <div className="text-xs text-text-secondary mt-0.5">
                {unit === "metric"
                  ? `${(top.bar_height_mm / 25.4 / 12 | 0)}'${Math.round(((top.bar_height_mm / 25.4) - ((top.bar_height_mm / 25.4 / 12) | 0) * 12) * 4) / 4}"`
                  : mmToMeters(top.bar_height_mm)}
              </div>
            </div>
            <div className="text-right">
              <span className={"pill " + RESULT_COLOR[top.result]}>
                {RESULT_LABEL[top.result]}
              </span>
              {top.miss_tags && (
                <div className="mt-2 text-[11px] text-text-secondary">
                  {(JSON.parse(top.miss_tags) as string[])
                    .map((t) => MISS_TAG_LABEL[t] ?? t)
                    .join(" · ")}
                </div>
              )}
              {top.video_url &&
                (top.video_url.startsWith("/uploads/") ? (
                  <span className="text-xs text-emerald-700 font-semibold mt-2 inline-block">
                    🎥 video below
                  </span>
                ) : (
                  <a
                    href={top.video_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-accent hover:underline font-semibold mt-2 inline-block"
                    onClick={(e) => e.stopPropagation()}
                  >
                    ▶ watch video
                  </a>
                ))}
            </div>
          </div>
        </Link>
      )}

      {!embedded && (
        <footer className="flex items-center gap-1 px-3 pb-3 border-t border-border-subtle pt-2">
          <button
            onClick={toggleKudos}
            disabled={isOwner}
            title={isOwner ? "You can't Up & Over your own session" : ""}
            className={
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed " +
              (post.my_kudos
                ? "bg-accent/15 text-accent"
                : "text-text-secondary hover:bg-bg-raised")
            }
          >
            ↑ Up & Over
            <span className="text-text-secondary font-normal">{post.kudos_count}</span>
          </button>
          <Link
            to={`/p/${post.id}`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-text-secondary hover:bg-bg-raised"
          >
            💬 <span>Comments</span>
            <span className="text-text-secondary font-normal">{post.comments_count}</span>
          </Link>
          {me && !isOwner && (
            <button
              onClick={repost}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-text-secondary hover:bg-bg-raised"
              title="Repost to your followers"
            >
              ⟲ <span>Repost</span>
            </button>
          )}
          <button
            onClick={share}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-text-secondary hover:bg-bg-raised ml-auto"
            title="Copy link"
          >
            ↗ <span className="hidden sm:inline">Share</span>
          </button>
        </footer>
      )}
    </article>
  );
}
