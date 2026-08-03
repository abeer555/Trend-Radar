# TrendRadar — Momentum Dashboard

A free, rule-based swing-trading momentum screener inspired by SwingAlgo.
**Educational tool only — not investment advice.**

## What it does

- Scans the **Nifty 500** universe daily (after NSE market close) using
  entirely deterministic formulas — no AI, no ML, no runtime API calls.
- Ranks every stock 0-100 using a configurable composite momentum score.
- Page 1: sortable/filterable leaderboard with sparklines.
- Page 2: per-stock detail with chart, setup panel, technicals scorecard,
  fundamentals, risk metrics, and composite score attribution.

## Architecture

```
backend/   FastAPI + SQLite + yfinance + pandas-ta
frontend/  Next.js 14 + Tailwind + Lightweight Charts
```

Data flows: yfinance → SQLite cache → API → Next.js (SSR).

## Quick start

### Option A — Local laptop (recommended for occasional use)

The backend is designed to be **run for ~5 minutes then closed**.  When you
boot it, it auto-detects missing or stale data and starts a scan in the
background.  When you Ctrl+C, the DB stays consistent (orphan "running" scan
rows are auto-recovered on next boot).

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Start the API server — scans automatically if data is stale
uvicorn app.main:app --port 8000
```

Open http://localhost:8000/api/scan/status to watch progress.  Once
`is_running: false`, the dashboard is populated.  Ctrl+C to close; re-run
`uvicorn` whenever you want fresher data.

### Making the Vercel frontend talk to your laptop backend

While the backend runs on your laptop, tunnel it:

```bash
cloudflared tunnel --url http://localhost:8000        # or: ngrok http 8000
```

Copy the `https://…trycloudflare.com` URL (or ngrok URL), then in your
Vercel project → **Settings → Environment Variables** set
`NEXT_PUBLIC_BACKEND_URL=https://your-tunnel-url` and trigger a **Redeploy**.
The frontend will now show your laptop's fresh data.

### Option B — Full-stack local dev (3 terminals)

```bash
# Backend
cd backend && source .venv/bin/activate
uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend && npm install
npm run dev      # opens http://localhost:3000

# Manual scan (usually not needed — auto-scan handles it)
curl -X POST http://localhost:8000/api/scan
```

### Option C — Docker / Railway

```bash
cd backend && docker build -t trendradar . && docker run -p 8000:8000 trendradar
```

The scheduler triggers automatically every day at 10:15 UTC (NSE close).

## Configuration

All weights, thresholds, and the universe switch live in **one file**:

```
backend/app/config.py
```

To switch to S&P 500:
```python
UNIVERSE: Literal["nifty500", "sp500"] = "sp500"
```

### Environment variables

Copy `backend/.env.example` to `backend/.env` (or export the variables).
The two you'll most likely touch:

| Variable | Default | What it does |
|---|---|---|
| `AUTO_SCAN_ON_STARTUP` | `true` | Scan automatically at boot when data is stale |
| `STALE_SCAN_MAX_AGE_HOURS` | `18` | How old (hours) the last scan must be before auto-scan kicks in |
| `DISABLE_SCHEDULER` | `0` | Set to `1` on a laptop to skip the fixed-hour cron |
| `SQLITE_DB_PATH` | `market_predictor.db` | Where scan results + price cache are stored |
| `CORS_ORIGINS` | — | Extra allowed origins (comma-separated) |

## Running tests

```bash
cd backend
pytest tests/test_signals.py -v
```

## Signals computed

| Signal | Method |
|--------|--------|
| RS Rank | IBD-style percentile of weighted trailing return (40/20/20/20 for 3/6/9/12m) |
| 12-1 Momentum | 12-month return skipping the most recent month |
| Trend Template | Minervini's 8-criterion checklist |
| VCP | Volatility Contraction Pattern (decreasing swings + volume dry-up) |
| Mansfield Stage | Weinstein Stage Analysis (Stage 2 = advancing) |
| 52-wk High Proximity | Closeness to annual high |
| Frog-in-Pan | Information Discreteness (Bhattacharya & Galpin) |
| Risk-Adjusted Momentum | Sharpe-like return/volatility ratio |
| Volume / Pocket Pivot | Gil Morales pocket pivot + volume surge |
| ADX | Trend strength filter; suppresses choppy names |

## Backtest notice

`/api/backtest/{ticker}` is a stub.  See `backend/app/backtest.py` for:
- Lookahead-bias guidance
- Survivorship-bias warning
- Overfitting caveats
- Transaction cost note
- Implementation skeleton

## Legal

Educational tool.  Not investment advice.  Past performance does not predict
future results.

**India users**: sharing stock recommendations publicly may require SEBI
Research Analyst (RA) or Investment Adviser (IA) registration under the
SEBI (Research Analysts) Regulations, 2014.

## Universe CSV format

Nifty 500 CSV columns: `Symbol, Company Name, Industry, Series`

The backend automatically appends `.NS` if no exchange suffix is present.
Replace `backend/data/nifty500.csv` with the official NSE list downloaded from
[nseindia.com](https://www.nseindia.com/market-data/securities-available-for-trading).
