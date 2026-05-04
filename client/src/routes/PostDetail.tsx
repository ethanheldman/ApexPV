import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import Avatar from "../components/Avatar";
import AttemptRow from "../components/AttemptRow";
import NotFound from "../components/NotFound";
import ConfirmDialog from "../components/ConfirmDialog";
import { relTime } from "../lib/format";
import { useUnit } from "../lib/unit";
import type { CommentRow, Pole, Post } from "../types";

export default function PostDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { fmt } = useUnit();
  const nav = useNavigate();
  const [post, setPost] = useState<Post | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [poles, setPoles] = useState<Record<number, Pole>>({});
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [editingPost, setEditingPost] = useState(false);
  const [editCaption, setEditCaption] = useState("");
  const [editVisibility, setEditVisibility] = useState<"private" | "followers" | "public">("public");
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
  const [editCommentBody, setEditCommentBody] = useState("");
  const [confirmDeletePost, setConfirmDeletePost] = useState(false);
  const [confirmDeleteCommentId, setConfirmDeleteCommentId] = useState<number | null>(null);

  useEffect(() => {
    if (!id) return;
    api<Post>(`/api/posts/${id}`)
      .then(async (p) => {
        setPost(p);
        setEditCaption(p.caption ?? "");
        setEditVisibility(p.visibility);
        const polesByUser: Record<number, Pole> = {};
        const list = await api<Pole[]>(`/api/poles/by/${p.author.handle}`).catch(() => []);
        for (const pole of list) polesByUser[pole.id] = pole;
        setPoles(polesByUser);
      })
      .catch((e) => {
        if (e.message?.includes("not found") || e.message?.startsWith("404"))
          setNotFound(true);
        else if (e.message?.includes("forbidden") || e.message?.startsWith("403"))
          setForbidden(true);
      });
    api<CommentRow[]>(`/api/posts/${id}/comments`).then(setComments).catch(() => {});
  }, [id]);

  const submitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim() || !id || busy) return;
    setBusy(true);
    try {
      const c = await api<CommentRow>(`/api/posts/${id}/comments`, {
        method: "POST",
        json: { body: body.trim() },
      });
      setComments((cs) => [...cs, c]);
      setBody("");
      if (post) setPost({ ...post, comments_count: post.comments_count + 1 });
    } finally {
      setBusy(false);
    }
  };

  const saveCommentEdit = async (cid: number) => {
    if (!editCommentBody.trim()) return;
    const updated = await api<CommentRow>(`/api/posts/comments/${cid}`, {
      method: "PATCH",
      json: { body: editCommentBody.trim() },
    });
    setComments((cs) => cs.map((c) => (c.id === cid ? updated : c)));
    setEditingCommentId(null);
  };

  const deleteComment = async (cid: number) => {
    await api(`/api/posts/comments/${cid}`, { method: "DELETE" });
    setComments((cs) => cs.filter((c) => c.id !== cid));
    if (post) setPost({ ...post, comments_count: Math.max(0, post.comments_count - 1) });
    setConfirmDeleteCommentId(null);
  };

  const savePostEdit = async () => {
    if (!post) return;
    const updated = await api<Post>(`/api/posts/${post.id}`, {
      method: "PATCH",
      json: { caption: editCaption, visibility: editVisibility },
    });
    setPost(updated);
    setEditingPost(false);
  };

  const deletePost = async () => {
    if (!post) return;
    await api(`/api/posts/${post.id}`, { method: "DELETE" });
    nav("/");
  };

  const toggleKudos = async () => {
    if (!post || !user) return;
    if (post.user_id === user.id) return; // BUG-23
    const before = post.my_kudos;
    setPost({ ...post, my_kudos: !before, kudos_count: post.kudos_count + (before ? -1 : 1) });
    try {
      if (before) await api(`/api/posts/${post.id}/kudos`, { method: "DELETE" });
      else await api(`/api/posts/${post.id}/kudos`, { method: "POST" });
    } catch {
      setPost({ ...post, my_kudos: before, kudos_count: post.kudos_count });
    }
  };

  if (notFound) return <NotFound subject="post" />;
  if (forbidden)
    return (
      <NotFound
        subject="post"
        detail="That post is private or for followers only."
      />
    );
  if (!post) return <div className="px-5 pt-6 text-text-tertiary">loading…</div>;

  const isOwner = user?.id === post.user_id;
  const isFirst = post.is_first_clearance === 1;
  const top = post.attempts.find((a) => a.result === "clear") ?? post.attempts[0];

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-5 pt-6 pb-10">
      <article
        className={
          "card p-5 mb-4 " +
          (isFirst ? "ring-2 ring-accent/70 shadow-[0_0_0_4px_rgba(255,90,31,0.08)]" : "")
        }
      >
        <header className="flex items-start gap-3">
          <Link to={`/u/${post.author.handle}`}>
            <Avatar
              seed={post.author.avatar_seed ?? post.author.handle}
              url={post.author.avatar_url}
              size={44}
            />
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 flex-wrap">
              <Link to={`/u/${post.author.handle}`} className="font-semibold hover:underline">
                {post.author.display_name}
              </Link>
              <span className="text-text-secondary text-sm">@{post.author.handle}</span>
              {post.author.school && (
                <span className="text-text-tertiary text-sm">· {post.author.school}</span>
              )}
              <span className="text-text-tertiary text-xs ml-auto">{relTime(post.created_at)}</span>
            </div>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              {isFirst && top && (
                <span className="pill bg-accent text-white">
                  ★ first @ {fmt(top.bar_height_mm)}
                </span>
              )}
              {post.is_pr === 1 && !isFirst && (
                <span className="pill bg-emerald-500 text-white">PR</span>
              )}
              {post.visibility !== "public" && (
                <span className="pill bg-bg-raised text-text-primary">{post.visibility}</span>
              )}
            </div>
          </div>
          {isOwner && !editingPost && (
            <div className="flex gap-1">
              <button
                onClick={() => setEditingPost(true)}
                className="text-xs text-text-secondary hover:text-text-primary px-2 py-1 rounded hover:bg-bg-raised"
              >
                Edit
              </button>
              <button
                onClick={() => setConfirmDeletePost(true)}
                className="text-xs text-rose-700 hover:text-rose-900 px-2 py-1 rounded hover:bg-rose-50"
              >
                Delete
              </button>
            </div>
          )}
        </header>

        {editingPost ? (
          <div className="mt-3 space-y-2">
            <textarea
              className="input min-h-[60px] resize-none"
              value={editCaption}
              onChange={(e) => setEditCaption(e.target.value)}
              maxLength={1000}
            />
            <div className="flex gap-2 items-center">
              <div className="label">Visibility:</div>
              {(["private", "followers", "public"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setEditVisibility(v)}
                  className={
                    "px-2.5 py-1 rounded-full text-[12px] font-semibold capitalize " +
                    (editVisibility === v
                      ? "bg-bg-sunken text-text-primary"
                      : "bg-bg-raised text-text-primary hover:bg-bg-raised")
                  }
                >
                  {v}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={savePostEdit} className="btn-primary">Save</button>
              <button
                onClick={() => {
                  setEditingPost(false);
                  setEditCaption(post.caption ?? "");
                  setEditVisibility(post.visibility);
                }}
                className="btn-ghost"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          post.caption && (
            <p className="mt-3 text-[15px] whitespace-pre-wrap">{post.caption}</p>
          )
        )}

        {post.attempts
          .filter((a) => a.video_url?.startsWith("/uploads/"))
          .map((a) => (
            <div
              key={`v-${a.id}`}
              className="mt-3 rounded-xl overflow-hidden bg-bg-sunken"
            >
              <video
                src={a.video_url ?? undefined}
                controls
                preload="metadata"
                className="w-full max-h-[480px] object-contain"
              />
            </div>
          ))}

        <section className="mt-4 rounded-xl border border-border-subtle bg-bg-raised/30/60 p-2">
          <div className="px-2 pt-1 pb-2 flex items-baseline justify-between">
            <div className="label">Attempts in this session</div>
            {post.session_id && (
              <Link
                to={`/log/${post.session_id}`}
                className="text-xs text-text-secondary hover:underline"
              >
                Open session →
              </Link>
            )}
          </div>
          {post.attempts.length === 0 ? (
            <div className="text-text-tertiary text-sm py-4 text-center">No attempts pinned.</div>
          ) : (
            post.attempts.map((a, i) => (
              <AttemptRow
                key={a.id}
                attempt={a}
                pole={a.pole_id ? poles[a.pole_id] : undefined}
                index={a.ordinal ?? i + 1}
              />
            ))
          )}
        </section>

        <footer className="mt-4 flex items-center gap-2 border-t border-border-subtle pt-3">
          <button
            onClick={toggleKudos}
            disabled={!user || isOwner}
            title={isOwner ? "You can't Up & Over your own session" : ""}
            className={
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed " +
              (post.my_kudos ? "bg-accent/15 text-accent" : "text-text-primary hover:bg-bg-raised")
            }
          >
            ↑ Up & Over
            <span className="text-text-secondary font-normal">{post.kudos_count}</span>
          </button>
        </footer>
      </article>

      <section>
        <div className="label mb-2">Comments</div>
        <div className="space-y-2 mb-3">
          {comments.length === 0 && (
            <div className="text-text-tertiary text-sm">Be the first to say something.</div>
          )}
          {comments.map((c) => (
            <div key={c.id} className="card p-3 flex gap-3">
              <Avatar seed={c.avatar_seed ?? c.handle} url={c.avatar_url} size={32} />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <Link to={`/u/${c.handle}`} className="font-semibold text-sm hover:underline">
                    {c.display_name}
                  </Link>
                  <span className="text-text-tertiary text-xs">{relTime(c.created_at)}</span>
                  {c.updated_at && (
                    <span className="text-text-tertiary text-xs italic">(edited)</span>
                  )}
                  {user?.id === c.user_id && editingCommentId !== c.id && (
                    <span className="ml-auto flex gap-1">
                      <button
                        onClick={() => {
                          setEditingCommentId(c.id);
                          setEditCommentBody(c.body);
                        }}
                        className="text-xs text-text-secondary hover:text-text-primary"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setConfirmDeleteCommentId(c.id)}
                        className="text-xs text-rose-700 hover:text-rose-900"
                      >
                        Delete
                      </button>
                    </span>
                  )}
                </div>
                {editingCommentId === c.id ? (
                  <div className="mt-1 flex gap-1">
                    <input
                      className="input flex-1 text-sm"
                      value={editCommentBody}
                      onChange={(e) => setEditCommentBody(e.target.value)}
                      maxLength={500}
                      autoFocus
                    />
                    <button
                      onClick={() => saveCommentEdit(c.id)}
                      className="btn-primary !py-1 text-xs"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingCommentId(null)}
                      className="btn-ghost !py-1 text-xs"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="text-sm text-stone-800 mt-0.5">{c.body}</div>
                )}
              </div>
            </div>
          ))}
        </div>

        {user ? (
          <form onSubmit={submitComment} className="flex gap-2">
            <input
              className="input flex-1"
              placeholder={`Reply as ${user.display_name}…`}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={500}
              disabled={busy}
            />
            <button className="btn-primary" disabled={busy || !body.trim()}>
              {busy ? "Posting…" : "Post"}
            </button>
          </form>
        ) : (
          <div className="text-text-secondary text-sm">
            <Link to="/login" className="font-semibold underline">
              Sign in
            </Link>{" "}
            to comment.
          </div>
        )}
      </section>

      <ConfirmDialog
        open={confirmDeletePost}
        title="Delete this post?"
        message="The post will be removed from feeds. The underlying session and attempts stay in your journal."
        confirmLabel="Delete"
        destructive
        onConfirm={deletePost}
        onCancel={() => setConfirmDeletePost(false)}
      />
      <ConfirmDialog
        open={confirmDeleteCommentId !== null}
        title="Delete this comment?"
        message="This can't be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={() => confirmDeleteCommentId && deleteComment(confirmDeleteCommentId)}
        onCancel={() => setConfirmDeleteCommentId(null)}
      />
    </div>
  );
}
