/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0c0a09",
        cream: "#f7f5f0",
        accent: "#ff5a1f",
        bar: "#0f1115",
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', '"Inter"', "ui-sans-serif", "system-ui"],
        sans: ['"Inter"', "ui-sans-serif", "system-ui"],
        mono: ['"JetBrains Mono"', "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
