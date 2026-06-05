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

### 1. Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Start the API server
uvicorn app.main:app --reload --port 8000
```

### 2. Run the scan

```bash
# Trigger a full scan (downloads ~380 days of OHLCV for ~240 stocks — takes a few minutes)
curl -X POST http://localhost:8000/api/scan
curl http://localhost:8000/api/scan/status     # poll status
```

The scheduler will also trigger automatically every day at 10:15 UTC (NSE close).

### 3. Frontend

```bash
cd frontend
npm install
npm run dev     # opens http://localhost:3000
```

## Configuration

All weights, thresholds, and the universe switch live in **one file**:

```
backend/app/config.py
```

To switch to S&P 500:
```python
UNIVERSE: Literal["nifty500", "sp500"] = "sp500"
```

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
