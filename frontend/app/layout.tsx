import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import { Github } from "lucide-react";
import CommandPalette from "@/components/CommandPalette";
import "./globals.css";

const plexSans = IBM_Plex_Sans({
  subsets:  ["latin"],
  weight:   ["400", "500", "600", "700"],
  variable: "--font-sans",
  display:  "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets:  ["latin"],
  weight:   ["400", "500", "600"],
  variable: "--font-mono",
  display:  "swap",
});

const REPO_URL = "https://github.com/abeer555/Trend-Radar";

export const metadata: Metadata = {
  title:       "TrendRadar — Momentum Dashboard",
  description: "Free, rule-based swing-trading momentum screener. Educational tool only.",
};

function Logo() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="#3b82f6" strokeOpacity="0.3" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="5.5" stroke="#3b82f6" strokeOpacity="0.55" strokeWidth="1.5" />
      <path d="M12 12 L18.5 5.5" stroke="#3b82f6" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="16.2" cy="7.8" r="1.8" fill="#22c55e" />
    </svg>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${plexSans.variable} ${plexMono.variable}`}>
      <body className="flex min-h-screen flex-col bg-bg font-sans text-text">
        <nav className="sticky top-0 z-50 border-b border-border bg-surface/80 backdrop-blur-md">
          <div className="mx-auto flex h-14 w-full max-w-screen-2xl items-center justify-between px-4">
            <a href="/" className="flex items-center gap-2.5">
              <Logo />
              <span className="text-[15px] font-semibold tracking-tight text-text">
                TrendRadar
              </span>
              <span className="hidden rounded-full border border-border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted sm:block">
                Momentum
              </span>
            </a>
            <div className="flex items-center gap-2 text-sm">
              <CommandPalette />
              <a
                href="/"
                className="rounded-md px-3 py-1.5 text-text-dim transition-colors hover:bg-surface-2 hover:text-text"
              >
                Leaderboard
              </a>
              <a
                href="/docs"
                className="rounded-md px-3 py-1.5 text-text-dim transition-colors hover:bg-surface-2 hover:text-text"
              >
                Docs
              </a>
              <a
                href={REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-text-dim transition-colors hover:bg-surface-2 hover:text-text"
              >
                <Github className="h-4 w-4" />
                GitHub
              </a>
            </div>
          </div>
        </nav>

        <main className="mx-auto w-full max-w-screen-2xl flex-1 px-4 py-6">{children}</main>

        <footer className="mt-12 border-t border-border">
          <div className="mx-auto w-full max-w-screen-2xl px-4 py-8 text-xs leading-relaxed text-muted">
            <p className="font-semibold text-text-dim">
              Educational Tool — Not Investment Advice
            </p>
            <p className="mt-1.5 max-w-3xl">
              All signals are rule-based and historical. Past performance does not predict
              future results. This tool does not recommend buying or selling securities.
            </p>
            <p className="mt-1.5 max-w-3xl">
              India users: sharing stock recommendations publicly may require SEBI Research
              Analyst (RA) or Investment Adviser (IA) registration under SEBI (Research
              Analysts) Regulations, 2014.
            </p>
            <p className="mt-5 text-muted/70">
              TrendRadar · Nifty 500 universe · Market data via Yahoo Finance · Updated daily
              after market close
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
