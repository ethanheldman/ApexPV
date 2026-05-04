import { useRef, useState } from "react";
import { getToken } from "../api";

type Props = {
  value: string;
  onChange: (url: string) => void;
  /** When true, pasting a URL is also allowed; otherwise it's drag-only. */
  allowUrl?: boolean;
};

const ACCEPT = "video/mp4,video/quicktime,video/webm,video/x-m4v,.mp4,.mov,.webm,.m4v";
const MAX_BYTES = 200 * 1024 * 1024;

function isLocalUpload(url: string): boolean {
  return url.startsWith("/uploads/");
}

export default function VideoDrop({ value, onChange, allowUrl = true }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    setErr(null);
    if (file.size > MAX_BYTES) {
      setErr(`File is too big (${(file.size / 1024 / 1024).toFixed(0)}MB > 200MB).`);
      return;
    }
    if (!file.type.startsWith("video/")) {
      setErr(`That doesn't look like a video file (got ${file.type || "unknown"}).`);
      return;
    }
    setBusy(true);
    setProgress(0);
    try {
      const url = await new Promise<string>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/uploads/video");
        const tok = getToken();
        if (tok) xhr.setRequestHeader("Authorization", `Bearer ${tok}`);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const j = JSON.parse(xhr.responseText);
              resolve(j.url);
            } catch (e) {
              reject(new Error("bad response"));
            }
          } else {
            try {
              const j = JSON.parse(xhr.responseText);
              reject(new Error(j.error ?? `HTTP ${xhr.status}`));
            } catch {
              reject(new Error(`HTTP ${xhr.status}`));
            }
          }
        };
        xhr.onerror = () => reject(new Error("network error"));
        const form = new FormData();
        form.append("file", file);
        xhr.send(form);
      });
      onChange(url);
      setProgress(100);
    } catch (e: any) {
      setErr(e.message ?? "upload failed");
    } finally {
      setBusy(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) upload(f);
  };

  const clear = () => {
    onChange("");
    setErr(null);
    setProgress(0);
    if (fileInput.current) fileInput.current.value = "";
  };

  if (value && isLocalUpload(value)) {
    return (
      <div className="space-y-2">
        <video
          src={value}
          controls
          className="w-full rounded-xl bg-bg-sunken max-h-72 object-contain"
        />
        <div className="flex items-center gap-2 text-xs text-text-secondary">
          <span className="font-mono truncate flex-1">{value}</span>
          <button
            type="button"
            onClick={clear}
            className="text-rose-700 hover:underline"
          >
            remove
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div
        onClick={() => fileInput.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={
          "rounded-xl border-2 border-dashed px-4 py-6 text-center cursor-pointer transition-colors " +
          (dragOver
            ? "border-accent bg-accent/5 text-accent"
            : "border-border-subtle hover:border-border-strong text-text-secondary")
        }
      >
        <div className="font-display font-bold text-base">
          {busy ? `Uploading… ${progress}%` : "🎥 Drop a video here"}
        </div>
        <div className="text-[11px] mt-1">
          {busy ? (
            <div className="h-1 bg-bg-raised rounded-full overflow-hidden mt-2">
              <div
                className="h-full bg-accent transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          ) : (
            "or click to pick a file · mp4 / mov / webm · up to 200MB"
          )}
        </div>
        <input
          ref={fileInput}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(f);
          }}
        />
      </div>
      {allowUrl && (
        <details className="text-xs text-text-secondary">
          <summary className="cursor-pointer hover:text-text-primary">
            …or paste an external URL (YouTube, Vimeo)
          </summary>
          <input
            type="url"
            className="input mt-2"
            value={value && !isLocalUpload(value) ? value : ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=…"
          />
        </details>
      )}
      {value && !isLocalUpload(value) && (
        <div className="flex items-center gap-2 text-xs text-text-secondary">
          <span className="font-mono truncate flex-1">{value}</span>
          <button
            type="button"
            onClick={clear}
            className="text-rose-700 hover:underline"
          >
            remove
          </button>
        </div>
      )}
      {err && <div className="text-rose-700 text-sm">{err}</div>}
    </div>
  );
}
