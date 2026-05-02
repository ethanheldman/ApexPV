import type { Attempt, Pole } from "../types";
import { mmToFtIn, mmToMeters, poleLenToFtIn, inchesToFtIn, RESULT_COLOR, RESULT_LABEL } from "../lib/format";
import { MISS_TAG_LABEL } from "../lib/missTags";
import { useUnit } from "../lib/unit";

export default function AttemptRow({
  attempt,
  pole,
  index,
  onDelete,
}: {
  attempt: Attempt;
  pole?: Pole;
  index: number;
  onDelete?: (a: Attempt) => void;
}) {
  const { unit, fmt } = useUnit();
  const tags = attempt.miss_tags ? (JSON.parse(attempt.miss_tags) as string[]) : [];
  return (
    <div className="grid grid-cols-[28px_1fr_auto] gap-3 items-center px-3 py-2 hover:bg-stone-50 rounded-lg group">
      <div className="text-stone-400 text-xs font-mono text-right">{index}</div>
      <div className="min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="font-display font-bold text-lg tracking-tight">
            {fmt(attempt.bar_height_mm)}
          </span>
          <span className={"pill " + RESULT_COLOR[attempt.result]}>
            {RESULT_LABEL[attempt.result]}
          </span>
          {pole && (
            <span className="text-xs text-stone-500">
              {poleLenToFtIn(pole.length_in)} / {pole.weight_lb}lb{" "}
              {pole.nickname ? `· ${pole.nickname}` : ""}
            </span>
          )}
          {attempt.grip_in != null && (
            <span className="text-xs text-stone-400">
              grip {inchesToFtIn(attempt.grip_in)}
            </span>
          )}
          {attempt.video_url &&
            (attempt.video_url.startsWith("/uploads/") ? (
              <span className="text-xs text-emerald-700 font-semibold">🎥 has video</span>
            ) : (
              <a
                href={attempt.video_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-accent hover:underline font-semibold"
                onClick={(e) => e.stopPropagation()}
              >
                ▶ video
              </a>
            ))}
        </div>
        {tags.length > 0 && (
          <div className="text-[11px] text-stone-500 mt-0.5">
            {tags.map((t) => MISS_TAG_LABEL[t] ?? t).join(" · ")}
          </div>
        )}
        {attempt.notes && (
          <div className="text-[12px] text-stone-600 mt-0.5 italic">"{attempt.notes}"</div>
        )}
      </div>
      <div className="flex items-center gap-2">
        <div className="text-[11px] text-stone-400 font-mono">
          {unit === "metric" ? mmToFtIn(attempt.bar_height_mm) : mmToMeters(attempt.bar_height_mm)}
        </div>
        {onDelete && (
          <button
            onClick={() => onDelete(attempt)}
            title="Delete this attempt"
            className="text-stone-300 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-opacity text-sm"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
