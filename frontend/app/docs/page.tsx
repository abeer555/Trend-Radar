import type { Metadata } from "next";
import {
  BarChart3, TrendingUp, Target, Search, Filter,
  ArrowUpRight, CheckCircle2, AlertTriangle, BookOpen,
  ChevronRight, Activity, Layers, WifiOff,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Docs — TrendRadar",
  description: "How to use TrendRadar: indicators, scores, filters, and charts explained simply.",
};

const NAV = [
  { id: "overview",    label: "Overview" },
  { id: "leaderboard", label: "The Leaderboard" },
  { id: "score",       label: "Composite Score" },
  { id: "rs-rank",     label: "RS Rank" },
  { id: "trend",       label: "Trend Template" },
  { id: "vcp",         label: "VCP Setup" },
  { id: "chart",       label: "Stock Chart" },
  { id: "filters",     label: "Filters & Search" },
  { id: "watchlist",   label: "Watchlist" },
  { id: "compare",     label: "Compare" },
  { id: "offline",     label: "Offline mode" },
  { id: "selfhost",    label: "Self-hosting" },
  { id: "disclaimer",  label: "Disclaimer" },
];

function Section({
  id, title, icon: Icon, children,
}: {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20">
      <div className="mb-4 flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10">
          <Icon className="h-4 w-4 text-accent" />
        </span>
        <h2 className="text-xl font-semibold text-text">{title}</h2>
      </div>
      <div className="flex flex-col gap-4 text-sm leading-relaxed text-text-dim">
        {children}
      </div>
    </section>
  );
}

function Card({ children, tint = "border-border" }: { children: React.ReactNode; tint?: string }) {
  return (
    <div className={`rounded-lg border bg-surface p-4 ${tint}`}>
      {children}
    </div>
  );
}

function Term({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-surface p-4">
      <span className="font-mono text-[13px] font-semibold text-text">{name}</span>
      <span className="text-sm text-text-dim leading-relaxed">{children}</span>
    </div>
  );
}

function Rule({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-accent/10 font-mono text-xs font-semibold text-accent">
        {n}
      </span>
      <span className="text-sm text-text-dim leading-relaxed pt-0.5">{children}</span>
    </div>
  );
}

function Pill({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${color}`}>
      {children}
    </span>
  );
}

export default function DocsPage() {
  return (
    <div className="mx-auto flex max-w-screen-xl gap-8 py-2">
      {/* Sidebar */}
      <aside className="hidden w-52 flex-shrink-0 lg:block">
        <div className="sticky top-20">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted">
            On this page
          </p>
          <nav className="flex flex-col gap-0.5">
            {NAV.map(item => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-text-dim transition-colors hover:bg-surface-2 hover:text-text"
              >
                <ChevronRight className="h-3 w-3 text-muted" />
                {item.label}
              </a>
            ))}
          </nav>

          <div className="mt-6 rounded-lg border border-border bg-surface p-3 text-xs text-muted leading-relaxed">
            <p className="font-medium text-text-dim">Need help?</p>
            <p className="mt-1">Use <kbd className="rounded border border-border bg-bg px-1 py-px font-mono text-[10px]">⌘K</kbd> anywhere to search stocks instantly.</p>
          </div>
        </div>
      </aside>

      {/* Content */}
      <main className="min-w-0 flex-1">
        {/* Page header */}
        <div className="mb-10">
          <div className="flex items-center gap-2 text-xs text-muted mb-3">
            <BookOpen className="h-3.5 w-3.5" />
            <span>Documentation</span>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-text">
            How TrendRadar works
          </h1>
          <p className="mt-2 text-base text-text-dim max-w-2xl">
            A plain-English guide to every number, signal, and button on the dashboard — no finance degree needed.
          </p>
        </div>

        <div className="flex flex-col gap-14">

          {/* ── OVERVIEW ───────────────────────────────────── */}
          <Section id="overview" title="Overview" icon={Layers}>
            <p>
              TrendRadar is a free, rule-based momentum screener for{" "}
              <strong className="text-text">Nifty 500</strong> stocks. Every day after the
              market closes, it downloads price data for all 500 stocks, runs a set of
              technical checks, and ranks them from strongest to weakest.
            </p>
            <p>
              It doesn&apos;t predict the future. It just surfaces stocks that are currently
              behaving the way historically strong stocks have behaved — trending up, holding
              above key moving averages, and consolidating quietly before potential moves.
            </p>
            <Card tint="border-warn/30">
              <div className="flex gap-2.5">
                <AlertTriangle className="h-4 w-4 flex-shrink-0 text-warn mt-0.5" />
                <p className="text-warn/90">
                  This is an educational tool, not investment advice. Never buy or sell a
                  stock based solely on what you see here. Always do your own research.
                </p>
              </div>
            </Card>
          </Section>

          {/* ── LEADERBOARD ────────────────────────────────── */}
          <Section id="leaderboard" title="The Leaderboard" icon={BarChart3}>
            <p>
              The main table ranks every Nifty 500 stock by its{" "}
              <strong className="text-text">Composite Score</strong> (highest = strongest
              momentum). Here&apos;s what each column means:
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Term name="# (Rank)">
                The stock&apos;s position today. Rank 1 means the highest composite score in
                the universe. The top 3 are highlighted in gold, silver, and bronze.
              </Term>
              <Term name="Ticker / Name">
                The NSE stock symbol (e.g. <span className="font-mono text-accent">RELIANCE.NS</span>)
                and the company name. Click any row to open the full stock detail page.
              </Term>
              <Term name="Sector">
                The industry the company belongs to. Click a sector chip to instantly filter
                the table to that sector only.
              </Term>
              <Term name="Price">
                The last traded price in Indian Rupees (₹), as of the most recent scan.
              </Term>
              <Term name="1D %">
                How much the stock moved yesterday.{" "}
                <Pill color="bg-bull/10 text-bull">+2.4%</Pill> means it went up,{" "}
                <Pill color="bg-bear/10 text-bear">−1.1%</Pill> means it fell.
              </Term>
              <Term name="Score">
                The composite momentum score (0–100). The bar is visually scaled to the
                current filtered list so differences between stocks are easy to spot.
                Hover for the exact number.
              </Term>
              <Term name="RS">
                Relative Strength rank (0–100). How the stock has performed compared to
                all other Nifty 500 stocks over the past year. Higher is better.
              </Term>
              <Term name="Trend">
                A <CheckCircle2 className="inline h-3.5 w-3.5 text-bull" /> means the stock
                passes the Minervini Trend Template — all 8 price/MA rules are satisfied.
              </Term>
              <Term name="VCP">
                A <Pill color="bg-accent-2/10 text-accent-2">VCP</Pill> badge means a
                Volatility Contraction Pattern was detected — the stock is forming a tight
                base after a strong run.
              </Term>
              <Term name="30D">
                A mini sparkline showing the last 30 days of price movement at a glance.
              </Term>
            </div>
          </Section>

          {/* ── COMPOSITE SCORE ────────────────────────────── */}
          <Section id="score" title="Composite Score" icon={Activity}>
            <p>
              The composite score is a weighted sum of <strong className="text-text">10 rule-based
              signals</strong> — every sub-score is normalised to 0–100, multiplied by its weight,
              and added up:
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Card><p className="font-medium text-text mb-1">RS Rank <span className="ml-1 text-[10px] font-normal text-muted">25%</span></p>
                <p>IBD-style percentile vs the rest of the Nifty 500 trailing return.</p></Card>
              <Card><p className="font-medium text-text mb-1">12-1 Momentum <span className="ml-1 text-[10px] font-normal text-muted">15%</span></p>
                <p>12-month return skipping the last month; ranked across the universe.</p></Card>
              <Card><p className="font-medium text-text mb-1">Trend Template <span className="ml-1 text-[10px] font-normal text-muted">20%</span></p>
                <p>How many of the 8 Minervini trend rules the stock passes.</p></Card>
              <Card><p className="font-medium text-text mb-1">VCP Setup <span className="ml-1 text-[10px] font-normal text-muted">10%</span></p>
                <p>Volatility contraction + volume dry-up; rewards tight bases.</p></Card>
              <Card><p className="font-medium text-text mb-1">Mansfield Stage <span className="ml-1 text-[10px] font-normal text-muted">5%</span></p>
                <p>Stage 2 uptrend vs the Nifty 50 benchmark (Weinstein analysis).</p></Card>
              <Card><p className="font-medium text-text mb-1">52-wk High Proximity <span className="ml-1 text-[10px] font-normal text-muted">5%</span></p>
                <p>How close to the yearly high — near-high stocks tend to keep trending.</p></Card>
              <Card><p className="font-medium text-text mb-1">Frog-in-Pan <span className="ml-1 text-[10px] font-normal text-muted">5%</span></p>
                <p>Many small gains beat a few large jumps (Bhattacharya &amp; Galpin).</p></Card>
              <Card><p className="font-medium text-text mb-1">Risk-Adjusted Momentum <span className="ml-1 text-[10px] font-normal text-muted">8%</span></p>
                <p>Sharpe-like: return ÷ volatility. Smooth trends rank higher.</p></Card>
              <Card><p className="font-medium text-text mb-1">Volume Surge <span className="ml-1 text-[10px] font-normal text-muted">4%</span></p>
                <p>Pocket pivots and ≥1.5× average volume days signal accumulation.</p></Card>
              <Card><p className="font-medium text-text mb-1">ADX Trend Strength <span className="ml-1 text-[10px] font-normal text-muted">3%</span></p>
                <p>Trend conviction filter; choppy names are suppressed.</p></Card>
            </div>
            <p className="text-xs text-muted">
              Weights are configurable in <code className="font-mono text-accent">backend/app/config.py</code>.
              The leaderboard bar is min-max normalised per view; the raw number is the true 0–100 score.
            </p>
          </Section>

          {/* ── RS RANK ────────────────────────────────────── */}
          <Section id="rs-rank" title="RS Rank (Relative Strength)" icon={TrendingUp}>
            <p>
              Relative Strength compares how a stock has performed against all other stocks
              in the universe over the past year. It has nothing to do with the RSI indicator
              — this is purely about price performance.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <Card tint="border-bull/20">
                <p className="font-semibold text-bull">RS 80–100</p>
                <p className="mt-1">Top 20% performer. This stock has been outpacing 80%+ of peers. Most strong breakouts come from high-RS stocks.</p>
              </Card>
              <Card tint="border-accent/20">
                <p className="font-semibold text-accent">RS 50–79</p>
                <p className="mt-1">Average to above-average performance. Worth watching, but not yet showing clear leadership.</p>
              </Card>
              <Card tint="border-border">
                <p className="font-semibold text-muted">RS 0–49</p>
                <p className="mt-1">Underperforming the majority. Momentum investors typically avoid these unless there&apos;s a specific catalyst.</p>
              </Card>
            </div>
            <p>
              The concept comes from William O&apos;Neil&apos;s CAN SLIM method, popularised
              by Investors Business Daily. Stocks that go on to have big moves almost always
              show strong RS <em>before</em> the breakout.
            </p>
          </Section>

          {/* ── TREND TEMPLATE ─────────────────────────────── */}
          <Section id="trend" title="Trend Template (Minervini)" icon={CheckCircle2}>
            <p>
              The Trend Template is a checklist of 8 rules invented by Mark Minervini, a US
              trader who won the US Investing Championship. A stock must pass <em>all 8</em>{" "}
              to get the <CheckCircle2 className="inline h-3.5 w-3.5 text-bull" /> tick on
              the leaderboard.
            </p>
            <p>Here are the 8 rules in plain English:</p>
            <div className="flex flex-col gap-3">
              <Rule n={1}>
                The stock&apos;s current price is <strong className="text-text">above</strong> its
                150-day moving average (MA150) — it&apos;s in an uptrend on a medium-term basis.
              </Rule>
              <Rule n={2}>
                The stock&apos;s current price is <strong className="text-text">above</strong> its
                200-day moving average (MA200) — it&apos;s in an uptrend on a long-term basis.
              </Rule>
              <Rule n={3}>
                The 150-day MA is <strong className="text-text">above</strong> the 200-day MA —
                the medium-term trend is stronger than the long-term trend (healthy sign).
              </Rule>
              <Rule n={4}>
                The 200-day MA has been <strong className="text-text">rising</strong> for at least
                a month — the long-term trend is accelerating, not rolling over.
              </Rule>
              <Rule n={5}>
                The 50-day MA is <strong className="text-text">above</strong> both the 150-day
                and 200-day MAs — short-term strength is the highest of the three.
              </Rule>
              <Rule n={6}>
                The current price is <strong className="text-text">above</strong> its 50-day MA
                — the stock is trading above its recent average, not dragging below it.
              </Rule>
              <Rule n={7}>
                The stock is trading <strong className="text-text">at least 25% above</strong>{" "}
                its 52-week low — it has made a significant recovery and has real upward momentum.
              </Rule>
              <Rule n={8}>
                The stock is trading <strong className="text-text">within 25% of its 52-week
                high</strong> — it&apos;s near the top of its yearly range, not fading.
              </Rule>
            </div>
            <Card tint="border-accent/20">
              <p>
                <strong className="text-text">Why does this matter?</strong> Minervini studied
                hundreds of the biggest stock market winners throughout history and found they all
                shared these properties before their biggest moves. Passing all 8 doesn&apos;t
                guarantee a move — but it means the stock&apos;s structure matches the pattern.
              </p>
            </Card>
          </Section>

          {/* ── VCP ────────────────────────────────────────── */}
          <Section id="vcp" title="VCP Setup (Volatility Contraction Pattern)" icon={Target}>
            <p>
              A VCP is a specific chart pattern — also from Minervini — that appears when a
              stock is &quot;coiling&quot; before a potential breakout. Think of it like
              compressing a spring.
            </p>
            <div className="rounded-lg border border-border bg-surface p-5">
              <p className="font-medium text-text mb-3">How a VCP forms:</p>
              <div className="flex flex-col gap-2.5 text-sm text-text-dim">
                <div className="flex gap-2.5">
                  <span className="text-accent font-mono text-xs pt-0.5 flex-shrink-0">①</span>
                  <p>After a strong upward run, the stock pulls back — this is the first &quot;contraction&quot;.</p>
                </div>
                <div className="flex gap-2.5">
                  <span className="text-accent font-mono text-xs pt-0.5 flex-shrink-0">②</span>
                  <p>It then recovers partially and pulls back again — but this second dip is <em>smaller</em> than the first.</p>
                </div>
                <div className="flex gap-2.5">
                  <span className="text-accent font-mono text-xs pt-0.5 flex-shrink-0">③</span>
                  <p>This continues 2–4 times. Each pullback is shallower. Volume also dries up during the quiet phases.</p>
                </div>
                <div className="flex gap-2.5">
                  <span className="text-accent font-mono text-xs pt-0.5 flex-shrink-0">④</span>
                  <p>A breakout above the &quot;pivot point&quot; (the last swing high) on rising volume is the entry signal.</p>
                </div>
              </div>
            </div>
            <p>
              On the stock detail page, TrendRadar shows the detected pivot price. If the
              current price has already broken above that pivot, it shows{" "}
              <Pill color="bg-warn/10 text-warn">Extended</Pill> — meaning the ideal entry
              has already passed and chasing it carries more risk.
            </p>
          </Section>

          {/* ── CHART ──────────────────────────────────────── */}
          <Section id="chart" title="Stock Chart" icon={BarChart3}>
            <p>
              The chart on each stock&apos;s detail page shows candlestick price data with
              overlaid technical indicators. You can view 3 months, 6 months, or 1 year of
              history using the buttons in the top-left.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Term name="Candlesticks">
                Each candle = one trading day.{" "}
                <span className="text-bull font-semibold">Green</span> = the stock closed
                higher than it opened.{" "}
                <span className="text-bear font-semibold">Red</span> = it closed lower.
                The thin lines (wicks) show the intraday high and low.
              </Term>
              <Term name="MA50 (amber line)">
                The 50-day moving average — the average closing price over the last 50 trading
                days. It tracks short-term momentum. Price above MA50 is generally bullish.
              </Term>
              <Term name="MA150 (blue line)">
                The 150-day moving average. Minervini rules 1 and 3 both reference this line.
                It smooths out short-term noise and shows the medium-term direction.
              </Term>
              <Term name="MA200 (purple line)">
                The 200-day moving average — the most watched long-term indicator in the
                market. Fund managers often use it to decide whether to hold or reduce positions.
              </Term>
              <Term name="Bollinger Bands (purple dotted)">
                Two bands drawn 2 standard deviations above and below the 20-day MA. When
                the bands get very narrow (a &quot;squeeze&quot;), volatility is low — often
                before a big move in either direction.
              </Term>
              <Term name="Volume (bars at bottom)">
                How many shares traded each day. Green volume = up day, red = down day.
                A breakout on high volume is more reliable than one on low volume.
              </Term>
            </div>
            <Card tint="border-accent/20">
              <p>
                <strong className="text-text">Tip:</strong> Click the legend labels
                (MA50, MA150, MA200, BBands) in the top-right of the chart to toggle each
                line on or off. This helps you focus on what matters.
              </p>
            </Card>
          </Section>

          {/* ── FILTERS ────────────────────────────────────── */}
          <Section id="filters" title="Filters &amp; Search" icon={Filter}>
            <p>
              The filter bar above the leaderboard lets you narrow down the 500 stocks to
              exactly what you&apos;re looking for. All filters work together — the stock count
              on the right updates instantly.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Term name="Search bar  [ / ]">
                Type a ticker (e.g. <span className="font-mono text-accent">INFY</span>) or
                company name. Press <kbd className="rounded border border-border bg-bg px-1.5 py-px font-mono text-[10px]">/</kbd> anywhere
                on the leaderboard page to jump to the search box instantly.
              </Term>
              <Term name="⌘K  Command Palette">
                Press <kbd className="rounded border border-border bg-bg px-1.5 py-px font-mono text-[10px]">⌘K</kbd> (or{" "}
                <kbd className="rounded border border-border bg-bg px-1.5 py-px font-mono text-[10px]">Ctrl+K</kbd> on Windows)
                anywhere on any page to open a fast search over all 500 stocks with price,
                RS rank, and 1D% shown inline.
              </Term>
              <Term name="Sector dropdown">
                Filter to one sector (e.g. &quot;Information Technology&quot;). You can also
                click any sector chip directly in the table to do the same thing.
              </Term>
              <Term name="RS ≥ preset">
                Quickly show only stocks with an RS Rank above a threshold. &quot;RS ≥ 80&quot;
                gives you the top 20% of momentum performers.
              </Term>
              <Term name="Price ≥ preset">
                Filter by minimum stock price in rupees. Useful if you want to avoid very
                low-priced stocks or focus on mid/large caps.
              </Term>
              <Term name="Trend Template toggle">
                Show only stocks passing all 8 Minervini rules. The count shown next to the
                label tells you how many stocks qualify with your current other filters.
              </Term>
              <Term name="VCP Setup toggle">
                Show only stocks where a Volatility Contraction Pattern was detected. These
                are potential setup candidates — not buy signals.
              </Term>
            </div>
            <Card>
              <p>
                <strong className="text-text">Active filters</strong> appear as chips below
                the filter bar so you can always see what&apos;s applied. Click the{" "}
                <span className="font-mono text-xs text-accent">×</span> on any chip to remove
                that filter, or use &quot;Clear all&quot; to reset everything.
              </p>
            </Card>
            <p>
              Filtered views are <strong className="text-text">shareable</strong> — the URL
              updates automatically as you filter, so you can copy and send a link and the
              recipient will see the same filtered table.
            </p>
          </Section>

          {/* ── WATCHLIST ────────────────────────────────────── */}
          <Section id="watchlist" title="Watchlist" icon={Target}>
            <p>
              Star any stock on the leaderboard or a stock detail page and it lands on your{" "}
              <a href="/watchlist" className="text-accent underline-offset-2 hover:underline">Watchlist</a>.
              The list lives in your browser&apos;s localStorage — no account, no sync, private to you.
              Click the star again (or clear the list) to remove an entry.
            </p>
          </Section>

          {/* ── COMPARE ─────────────────────────────────────── */}
          <Section id="compare" title="Compare" icon={ArrowUpRight}>
            <p>
              The <a href="/compare" className="text-accent underline-offset-2 hover:underline">Compare</a>{" "}
              page puts two stocks side-by-side: price action rebased to 100 so relative strength is
              obvious, plus winner-highlighted rows for composite, RS rank, trend template, ADX,
              valuation, and risk metrics.
            </p>
          </Section>

          {/* ── OFFLINE MODE ─────────────────────────────────── */}
          <Section id="offline" title="Offline mode &amp; refresh" icon={WifiOff}>
            <p>
              TrendRadar is designed around an intermittent backend: run it once (or let the
              daily scheduler run) and the site keeps working after you shut it down.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Term name="Three data tiers">
                Every page first asks the live backend.  If it is unreachable the site
                serves (1) the last successful responses cached in your browser, or
                (2) a static snapshot of the last completed scan shipped with the site
                itself.  You always see <em>data</em>, just possibly older data.
              </Term>
              <Term name="Nav-bar status pill">
                The refresh button in the top bar doubles as a status light:
                green = live and fresh, amber = data is stale or you are
                reading cached/snapshot data (label shows the age), red = backend
                unreachable and nothing cached yet.  Scanning requires the backend.
              </Term>
            </div>
            <Card>
              <p>
                <strong className="text-text">How the snapshot is made:</strong> after every
                completed scan the backend exports the full dataset (leaderboard, all 500
                stock details, and price charts) as JSON into{" "}
                <code className="font-mono text-accent">frontend/public/data/</code>.  Commit
                those files and your deployed frontend survives any backend downtime —
                no database, no API, fully static.  Disable the export with{" "}
                <code className="font-mono">STATIC_EXPORT_DIR=</code> (empty value).
              </p>
            </Card>
          </Section>

          {/* ── SELF-HOSTING ─────────────────────────────────── */}
          <Section id="selfhost" title="Self-hosting the backend" icon={BookOpen}>
            <p>
              The frontend on Vercel reads from a FastAPI backend you run yourself — most people
              just run it on a laptop for a few minutes whenever they want fresh data.
            </p>
            <Card>
              <pre className="overflow-x-auto font-mono text-xs leading-relaxed text-text-dim">
{`# 1. Start the backend (auto-scans if data is missing or stale)
cd backend
source .venv/bin/activate        # or: python -m venv .venv && pip install -r requirements.txt
uvicorn app.main:app --port 8000

# 2. (optional) Expose it so the Vercel frontend can reach it
cloudflared tunnel --url http://localhost:8000
#    or: ngrok http 8000

# 3. Paste the tunnel URL into Vercel → your app’s Settings → Env Vars:
#    NEXT_PUBLIC_BACKEND_URL=https://<your-tunnel>.trycloudflare.com
#    then trigger a redeploy of the frontend.

# Ctrl+C to stop. Scan results persist in SQLite — nothing is lost.`}
              </pre>
            </Card>
            <p className="text-xs text-muted">
              Behaviour knobs live in <code className="font-mono text-accent">backend/.env.example</code>:
              {" "}<code className="font-mono">AUTO_SCAN_ON_STARTUP</code>,{" "}
              <code className="font-mono">STALE_SCAN_MAX_AGE_HOURS</code>,{" "}
              <code className="font-mono">DISABLE_SCHEDULER</code>.
            </p>
          </Section>

          {/* ── DISCLAIMER ─────────────────────────────────── */}
          <Section id="disclaimer" title="Disclaimer" icon={AlertTriangle}>
            <Card tint="border-warn/30">
              <div className="flex gap-3">
                <AlertTriangle className="h-5 w-5 flex-shrink-0 text-warn mt-0.5" />
                <div className="flex flex-col gap-2 text-text-dim">
                  <p>
                    TrendRadar is an <strong className="text-text">educational tool</strong>.
                    All signals are rule-based and mechanical. They are based on past price
                    data, which does not predict future returns.
                  </p>
                  <p>
                    This tool does <strong className="text-text">not</strong> recommend buying
                    or selling any security. Passing the Trend Template or having a VCP setup
                    does not mean a stock will go up.
                  </p>
                  <p>
                    In India, providing buy/sell recommendations publicly may require SEBI
                    Research Analyst (RA) or Investment Adviser (IA) registration under the
                    SEBI (Research Analysts) Regulations, 2014.
                  </p>
                  <p>
                    Always consult a SEBI-registered adviser before making investment decisions.
                    Never invest money you cannot afford to lose.
                  </p>
                </div>
              </div>
            </Card>
          </Section>

          {/* Bottom CTA */}
          <div className="rounded-xl border border-border bg-surface p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-text">Ready to explore?</p>
              <p className="text-sm text-muted mt-0.5">Head back to the leaderboard and try the filters.</p>
            </div>
            <a
              href="/"
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent/80 flex-shrink-0"
            >
              Open Leaderboard
              <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          </div>

        </div>
      </main>
    </div>
  );
}
