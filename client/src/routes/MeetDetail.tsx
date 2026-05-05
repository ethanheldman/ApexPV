import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import Avatar from "../components/Avatar";
import NotFound from "../components/NotFound";
import { fmtDate, RESULT_COLOR, RESULT_LABEL } from "../lib/format";
import { useUnit } from "../lib/unit";
import type { Attempt } from "../types";

type Participant = {
  user_id: number;
  session_id: number;
  handle: string;
  display_name: string;
  school: string | null;
  avatar_seed: string | null;
  avatar_url: string | null;
  gender: string | null;
  level: string | null;
  attempts: Attempt[];
  best: Attempt | null;
  videos: Attempt[];
};

type Meet = {
  id: number;
  name: string;
  location: string | null;
  date: string;
  participants: Participant[];
};

export default function MeetDetail() {
  const { id } = useParams();
  const [meet, setMeet] = useState<Meet | null>(null);
  const [notFound, setNotFound] = useState(false);
  const { fmt } = useUnit();

  useEffect(() => {
    if (!id) return;
    api<Meet>(`/api/meets/${id}`)
      .then(setMeet)
      .catch((e) => {
        if (e.message?.includes("not found") || e.message?.startsWith("404"))
          setNotFound(true);
      });
  }, [id]);

  if (notFound) return <NotFound subject="meet" />;
  if (!meet) return <div className="px-5 pt-6 text-stone-400">loading…</div>;

  const allVideos = meet.participants.flatMap((p) =>
    p.videos.map((v) => ({ ...v, who: p })),
  );

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-5 pt-6 pb-10">
      <div className="card p-5 mb-5">
        <div className="label">Meet</div>
        <h1 className="font-display font-extrabold text-3xl tracking-tight">{meet.name}</h1>
        <div className="text-stone-500 text-sm">
          {fmtDate(meet.date)}
          {meet.location && ` · ${meet.location}`} · {meet.participants.length} participant
          {meet.participants.length === 1 ? "" : "s"}
        </div>
      </div>

      <div className="label mb-2">Results</div>
      <div className="card divide-y divide-stone-100 mb-6">
        {meet.participants.map((p, i) => (
          <div key={p.user_id} className="p-4 flex items-center gap-4">
            <div className="w-7 text-center font-mono font-bold text-stone-400">{i + 1}</div>
            <Link to={`/u/${p.handle}`}>
              <Avatar seed={p.avatar_seed ?? p.handle} url={p.avatar_url} size={40} />
            </Link>
            <div className="flex-1 min-w-0">
              <Link to={`/u/${p.handle}`} className="font-semibold hover:underline">
                {p.display_name}
              </Link>
              <div className="text-[11px] text-stone-500 truncate">
                @{p.handle}
                {p.school && ` · ${p.school}`}
              </div>
            </div>
            <div className="text-right">
              <div className="font-display font-extrabold text-xl">
                {p.best ? fmt(p.best.bar_height_mm) : "—"}
              </div>
              <div className="text-[11px] text-stone-400">
                {p.attempts.length} attempts ·{" "}
                {p.attempts.filter((a) => a.result === "clear").length} clears
                {p.videos.length > 0 && ` · ${p.videos.length} 🎥`}
              </div>
            </div>
            <Link
              to={`/log/${p.session_id}`}
              className="text-xs text-stone-500 hover:text-ink hover:underline ml-2"
            >
              session →
            </Link>
          </div>
        ))}
      </div>

      {allVideos.length > 0 && (
        <>
          <div className="label mb-2">Videos from this meet</div>
          <div className="grid sm:grid-cols-2 gap-3">
            {allVideos.map((v) => {
              const local = v.video_url?.startsWith("/uploads/");
              const Wrapper: any = local ? "div" : "a";
              const wrapperProps = local
                ? { className: "card overflow-hidden" }
                : {
                    href: v.video_url ?? "#",
                    target: "_blank",
                    rel: "noopener noreferrer",
                    className: "card p-4 hover:shadow-sm",
                  };
              return (
                <Wrapper key={v.id} {...wrapperProps}>
                  {local && (
                    <video
                      src={v.video_url ?? undefined}
                      controls
                      preload="metadata"
                      className="w-full bg-stone-900 max-h-64 object-contain"
                    />
                  )}
                  <div className={local ? "p-3" : ""}>
                    <div className="flex items-center gap-3 mb-2">
                      <Avatar
                        seed={v.who.avatar_seed ?? v.who.handle}
                        url={v.who.avatar_url}
                        size={28}
                      />
                      <div className="font-semibold text-sm">{v.who.display_name}</div>
                      <span className={"pill " + RESULT_COLOR[v.result]}>
                        {RESULT_LABEL[v.result]}
                      </span>
                    </div>
                    <div className="font-display font-bold text-2xl">
                      {fmt(v.bar_height_mm)}
                    </div>
                    {!local && (
                      <div className="text-xs text-accent mt-2 font-semibold">
                        ▶ Watch on external link
                      </div>
                    )}
                  </div>
                </Wrapper>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
