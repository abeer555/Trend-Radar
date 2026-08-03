import type { Metadata } from "next";
import Link from "next/link";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import { Github, Star } from "lucide-react";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import CommandPalette from "@/components/CommandPalette";
import RefreshControl from "@/components/RefreshControl";
import { OfflineProvider } from "@/lib/offline";
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
    <span className="relative inline-flex h-[22px] w-[22px] items-center justify-center">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="10" stroke="#4f8eff" strokeOpacity="0.25" strokeWidth="1.5" />
        <circle cx="12" cy="12" r="5.5" stroke="#4f8eff" strokeOpacity="0.55" strokeWidth="1.5" />
        <path d="M12 12 L18.5 5.5" stroke="#4f8eff" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="16.2" cy="7.8" r="1.8" fill="#2fd672" />
      </svg>
    </span>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-md px-3 py-1.5 text-sm text-text-dim transition-colors hover:bg-surface-2 hover:text-text"
    >
      {children}
    </Link>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${plexSans.variable} ${plexMono.variable}`}>
      <body className="flex min-h-screen flex-col bg-bg font-sans text-text antialiased">
        <OfflineProvider>
        <nav className="sticky top-0 z-50 border-b border-border/70 bg-surface/70 backdrop-blur-xl backdrop-saturate-150">
          <div className="mx-auto flex h-14 w-full max-w-screen-2xl items-center justify-between gap-3 px-4">
            <Link href="/" className="flex items-center gap-2.5 shrink-0">
              <Logo />
              <span className="text-[15px] font-semibold tracking-tightest text-text">
                TrendRadar
              </span>
              <span className="hidden rounded-full border border-border bg-surface-2 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted lg:block">
                Momentum
              </span>
            </Link>

            <div className="flex items-center gap-1.5 md:gap-2">
              <RefreshControl />
              <CommandPalette />

              <div className="hidden items-center gap-1 border-l border-border pl-2 md:flex">
                <NavLink href="/">Leaderboard</NavLink>
                <NavLink href="/sectors">Sectors</NavLink>
                <NavLink href="/compare">Compare</NavLink>
                <NavLink href="/docs">Docs</NavLink>
              </div>

              <Link
                href="/watchlist"
                className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm text-text-dim transition-colors hover:bg-surface-2 hover:text-gold"
                title="Your watchlist"
              >
                <Star className="h-4 w-4" />
                <span className="hidden xl:inline">Watchlist</span>
              </Link>

              <a
                href={REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-text-dim transition-colors hover:bg-surface-2 hover:text-text"
                title="View source on GitHub"
              >
                <Github className="h-4 w-4" />
              </a>
            </div>
          </div>
        </nav>

        <main className="mx-auto w-full max-w-screen-2xl flex-1 px-4 py-6">{children}</main>

        <Analytics />
        <SpeedInsights />

        <footer className="mt-16 border-t border-border/60 bg-surface/40">
          <div className="mx-auto w-full max-w-screen-2xl px-4 py-10 text-xs leading-relaxed text-muted">
            <div className="grid gap-8 md:grid-cols-3">
              <div>
                <p className="font-semibold text-text">TrendRadar</p>
                <p className="mt-2 max-w-sm">
                  A rule-based swing-trading momentum screener covering the Nifty 500.
                  10 deterministic signals, no AI — every score is reproducible.
                </p>
              </div>
              <div>
                <p className="font-semibold text-text-dim">Educational Tool — Not Investment Advice</p>
                <p className="mt-2 max-w-sm">
                  All signals are rule-based and historical. Past performance does not
                  predict future results. This tool does not recommend buying or selling
                  securities.
                </p>
              </div>
              <div>
                <p className="font-semibold text-text-dim">Regulatory note</p>
                <p className="mt-2 max-w-sm">
                  India users: sharing stock recommendations publicly may require SEBI
                  Research Analyst (RA) or Investment Adviser (IA) registration under
                  SEBI (Research Analysts) Regulations, 2014.
                </p>
              </div>
            </div>
            <div className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-border/50 pt-6 text-muted-2">
              <span>Nifty 500 universe · Market data via Yahoo Finance</span>
              <span>Scans run daily after NSE close · Backend refresh is manual by design</span>
            </div>
          </div>
        </footer>
        </OfflineProvider>
      </body>
    </html>
  );
}
