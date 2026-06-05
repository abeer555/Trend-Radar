import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title:       "Market Predictor — Momentum Dashboard",
  description: "Free, rule-based swing-trading momentum screener. Educational tool only.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-bg text-text">
        <nav className="sticky top-0 z-50 border-b border-border bg-surface/80 backdrop-blur-sm">
          <div className="mx-auto flex max-w-screen-2xl items-center justify-between px-4 py-3">
            <a href="/" className="flex items-center gap-2">
              <span className="text-lg font-bold text-accent">◈ Market Predictor</span>
              <span className="hidden text-xs text-muted sm:block">Momentum Dashboard</span>
            </a>
            <div className="flex items-center gap-4 text-sm text-text-dim">
              <a href="/" className="hover:text-text transition-colors">Leaderboard</a>
              <span className="text-border">|</span>
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-text transition-colors"
              >
                GitHub
              </a>
            </div>
          </div>
        </nav>
        <main className="mx-auto max-w-screen-2xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
