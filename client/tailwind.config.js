/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // ── New design system (Apex 2026 redesign brief §2) ────────────────
        // Backgrounds — elevation by lightness, no shadows.
        "bg-base": "#0A0B0D",
        "bg-elevated": "#14161A",
        "bg-raised": "#1C1F25",
        "bg-sunken": "#07080A",
        // Borders — 1px hairlines that delineate without shadow.
        "border-subtle": "#20232A",
        "border-strong": "#2C313B",
        // Text scale — primary > secondary > tertiary > disabled.
        "text-primary": "#F4F5F7",
        "text-secondary": "#A1A6B0",
        "text-tertiary": "#6B7280",
        "text-disabled": "#3F4651",
        // Single accent — electric cyan. Used sparingly: PRs, primary CTA,
        // active nav, focus rings, chart strokes.
        accent: "#22D3EE",
        "accent-hover": "#67E8F9",
        "accent-pressed": "#0891B2",
        "accent-ink": "#0A0B0D",
        // States — rare, never a primary surface color.
        success: "#4ADE80",
        warn: "#FBBF24",
        danger: "#F87171",
        info: "#60A5FA",

        // (Legacy ink/cream/bar tokens removed — all references migrated to
        // the new bg-base / text-primary / bg-sunken system above.)
      },
      fontFamily: {
        // Display numerals — tabular figures for heights, grips, PRs.
        display: ['"JetBrains Mono"', '"Inter"', "ui-monospace", "monospace"],
        // UI / body — Inter, with tabular-nums set globally in styles.css.
        sans: ['"Inter"', "ui-sans-serif", "system-ui"],
        mono: ['"JetBrains Mono"', "ui-monospace", "monospace"],
      },
      fontSize: {
        // Brief §2 type scale (mobile)
        "display-xl": ["56px", { lineHeight: "56px", letterSpacing: "-0.015em" }],
        "display-lg": ["40px", { lineHeight: "44px", letterSpacing: "-0.01em" }],
        "display-md": ["28px", { lineHeight: "32px", letterSpacing: "-0.005em" }],
        title: ["20px", { lineHeight: "26px" }],
        body: ["15px", { lineHeight: "22px" }],
        caption: ["13px", { lineHeight: "18px", letterSpacing: "0.01em" }],
        micro: ["11px", { lineHeight: "14px", letterSpacing: "0.06em" }],
      },
      spacing: {
        // 4 / 8 / 12 / 16 / 20 / 24 / 32 / 48 / 64 are mostly default; add named gutters
        gutter: "16px",
        "gutter-md": "24px",
      },
      borderRadius: {
        sm: "8px",
        md: "12px",
        lg: "16px",
        xl: "20px",
        // pill stays at default 9999
      },
      transitionTimingFunction: {
        // Brief §2 standard easing
        apex: "cubic-bezier(0.2, 0.8, 0.2, 1)",
      },
      transitionDuration: {
        press: "100ms",
        page: "180ms",
      },
    },
  },
  plugins: [],
};
