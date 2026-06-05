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
        // Dark dashboard palette
        bg:          "#0d0f14",
        surface:     "#161a23",
        "surface-2": "#1e2433",
        border:      "#2a3040",
        muted:       "#6b7a99",
        text:        "#e2e8f0",
        "text-dim":  "#94a3b8",
        accent:      "#3b82f6",
        "accent-2":  "#6366f1",
        bull:        "#22c55e",
        bear:        "#ef4444",
        warn:        "#f59e0b",
        gold:        "#fbbf24",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
    },
  },
  plugins: [],
};
