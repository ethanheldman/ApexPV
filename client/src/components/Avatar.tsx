type Props = {
  seed: string | null | undefined;
  url?: string | null;
  size?: number;
  ring?: boolean;
};

const PALETTE: [string, string][] = [
  ["#fde68a", "#92400e"],
  ["#fecaca", "#7f1d1d"],
  ["#bbf7d0", "#14532d"],
  ["#bfdbfe", "#1e3a8a"],
  ["#ddd6fe", "#4c1d95"],
  ["#fbcfe8", "#831843"],
  ["#fed7aa", "#7c2d12"],
];

function normalize(seed: string | null | undefined): string {
  if (!seed) return "?";
  return seed.trim().toLowerCase();
}

function pick(seed: string): [string, string] {
  let n = 0;
  for (const c of seed) n = (n * 31 + c.charCodeAt(0)) >>> 0;
  return PALETTE[n % PALETTE.length];
}

export default function Avatar({ seed, url, size = 40, ring }: Props) {
  const ringClass = ring ? "ring-2 ring-text-primary" : "";
  if (url) {
    return (
      <img
        src={url}
        alt=""
        className={"rounded-full object-cover " + ringClass}
        style={{ width: size, height: size }}
        onError={(e) => {
          // hide broken image; React will show initial fallback if we re-render
          (e.currentTarget as HTMLImageElement).style.display = "none";
        }}
      />
    );
  }
  const s = normalize(seed);
  const [bg, fg] = pick(s);
  const initial = s[0]?.toUpperCase() ?? "?";
  return (
    <div
      className={
        "relative inline-flex items-center justify-center rounded-full font-semibold select-none " +
        ringClass
      }
      style={{
        width: size,
        height: size,
        background: bg,
        color: fg,
        fontSize: size * 0.42,
        lineHeight: 1,
      }}
    >
      {initial}
    </div>
  );
}
