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
        // Dark terminal palette
        bg:              "#0b0d12",
        surface:         "#11141c",
        "surface-2":     "#181d28",
        border:          "#232936",
        "border-strong": "#323b4d",
        muted:           "#7e8899",
        text:            "#e7ebf3",
        "text-dim":      "#a3adc2",
        accent:          "#3b82f6",
        "accent-2":      "#6366f1",
        bull:            "#22c55e",
        bear:            "#ef4444",
        warn:            "#f59e0b",
        gold:            "#fbbf24",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
