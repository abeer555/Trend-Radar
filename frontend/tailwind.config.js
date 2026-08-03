/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Premium dark palette — deeper blues, richer text contrast
        bg:              "#080a0f",
        surface:         "#0f131c",
        "surface-2":     "#161b27",
        "surface-3":     "#1c2333",
        border:          "#232b3d",
        "border-strong": "#374258",
        muted:           "#7e8aa3",
        "muted-2":       "#5d6a84",
        text:            "#eef2fa",
        "text-dim":      "#aab4cc",
        accent:          "#4f8eff",
        "accent-2":      "#7c6cff",
        bull:            "#2fd672",
        bear:            "#ff5257",
        warn:            "#f5a623",
        gold:            "#ffd166",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        card:      "0 1px 0 rgba(255,255,255,0.03) inset, 0 1px 2px rgba(0,0,0,0.35)",
        "card-lg": "0 1px 0 rgba(255,255,255,0.04) inset, 0 4px 16px rgba(0,0,0,0.45)",
        glow:      "0 0 0 1px rgba(79,142,255,0.25), 0 0 24px rgba(79,142,255,0.12)",
        "glow-bull": "0 0 0 1px rgba(47,214,114,0.25), 0 0 24px rgba(47,214,114,0.10)",
        "glow-bear": "0 0 0 1px rgba(255,82,87,0.25), 0 0 24px rgba(255,82,87,0.10)",
      },
      letterSpacing: {
        tightest: "-0.03em",
      },
    },
  },
  plugins: [],
};
