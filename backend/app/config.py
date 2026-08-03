"""
Central configuration for TrendRadar.

Edit this file to change signal weights, universe, and thresholds without
touching any other code. All values are read at import time; restart the
backend server after changing.
"""

from __future__ import annotations
import os
from typing import Literal

# ---------------------------------------------------------------------------
# Universe selection — one-line switch
# ---------------------------------------------------------------------------
UNIVERSE: Literal["nifty500", "sp500"] = "nifty500"

# Path to universe CSV (relative to the backend/ directory)
NIFTY500_CSV = "data/nifty500.csv"
SP500_CSV    = "data/sp500.csv"   # fetched from Wikipedia on first run

# ---------------------------------------------------------------------------
# Data / caching
# ---------------------------------------------------------------------------
SQLITE_DB_PATH   = os.environ.get("SQLITE_DB_PATH", "market_predictor.db")
PRICE_HISTORY_DAYS = 380                   # enough for 52-wk + MA200 + buffer
YFINANCE_CHUNK   = 50                      # tickers per bulk-download call
YFINANCE_THREADS = 4                       # parallel download threads
CACHE_PRICE_HOURS = 6                      # skip re-download if data is fresh
FUNDAMENTALS_CACHE_DAYS = 3               # re-fetch fundamentals every N days

# ---------------------------------------------------------------------------
# Composite score weights  (must sum to 1.0)
# ---------------------------------------------------------------------------
SIGNAL_WEIGHTS: dict[str, float] = {
    "rs_rank":                0.25,   # IBD-style relative-strength percentile
    "momentum_12_1":          0.15,   # 12-month return skipping last month
    "trend_template":         0.20,   # Minervini trend-template score (0-100)
    "vcp":                    0.10,   # Volatility Contraction Pattern flag
    "mansfield_stage2":       0.05,   # Mansfield Stage-2 uptrend flag
    "high_proximity":         0.05,   # closeness to 52-week high
    "frog_in_pan":            0.05,   # path-smoothness / information discreteness
    "risk_adjusted_momentum": 0.08,   # Sharpe-like trailing return / volatility
    "volume_surge":           0.04,   # pocket-pivot / volume-surge flag
    "adx":                    0.03,   # ADX trend-strength filter
}

assert abs(sum(SIGNAL_WEIGHTS.values()) - 1.0) < 1e-9, \
    "SIGNAL_WEIGHTS must sum to 1.0"

# ---------------------------------------------------------------------------
# RS-rank / momentum windows  (trading days)
# ---------------------------------------------------------------------------
RS_WEIGHTS = {
    "3m":  0.40,   # weight of 3-month return in the composite RS score
    "6m":  0.20,
    "9m":  0.20,
    "12m": 0.20,
}
# Calendar-day approximations for yfinance period lookups
PERIOD_TRADING_DAYS = {"3m": 63, "6m": 126, "9m": 189, "12m": 252}

# ---------------------------------------------------------------------------
# Trend Template (Minervini) thresholds
# ---------------------------------------------------------------------------
TT_MIN_RS_RANK           = 70     # RS rank gate for full bonus
TT_MIN_ABOVE_52WK_LOW    = 0.30   # at least 30 % above 52-week low
TT_MAX_BELOW_52WK_HIGH   = 0.25   # within 25 % of 52-week high
TT_MA200_LOOKBACK_DAYS   = 22     # "200-day MA rising for 1 month"

# ---------------------------------------------------------------------------
# VCP thresholds
# ---------------------------------------------------------------------------
VCP_LOOKBACK_DAYS           = 126   # ~6 months of history to scan
VCP_MIN_CONTRACTIONS        = 3     # need at least 3 consolidation stages
VCP_MAX_CONTRACTION_PCT     = 0.20  # first pullback ≤ 20 %
VCP_TIGHTENING_TOLERANCE    = 0.02  # each swing must be tighter by at least 2 %
VCP_VOLUME_TIGHTENING       = True  # require volume to dry up
VCP_PIVOT_LOOKBACK_DAYS     = 10    # days to look back for pivot high

# ---------------------------------------------------------------------------
# Volume / pocket-pivot
# ---------------------------------------------------------------------------
VOLUME_LOOKBACK_DOWN_DAYS   = 10    # look back 10 sessions for pocket-pivot
VOLUME_SURGE_MULTIPLIER     = 1.50  # flag if today's vol >= 1.5× 20-day avg

# ---------------------------------------------------------------------------
# ADX
# ---------------------------------------------------------------------------
ADX_PERIOD          = 14
ADX_TRENDING_FLOOR  = 20    # below this → choppy / filtered out
ADX_STRONG_TREND    = 40    # above this → strong trend bonus

# ---------------------------------------------------------------------------
# Frog-in-the-Pan (Information Discreteness)
# ---------------------------------------------------------------------------
FIP_LOOKBACK_DAYS = 252    # 12 months

# ---------------------------------------------------------------------------
# Risk metrics
# ---------------------------------------------------------------------------
RISK_ANNUALIZATION_FACTOR = 252     # trading days in a year
RISK_FREE_RATE_ANNUAL     = 0.065   # approximate India T-bill; change for US
ATR_PERIOD                = 14
ATR_STOP_MULTIPLIER       = 2.0     # stop-loss = price − (ATR_MULTIPLIER × ATR)

# Risk label thresholds (based on annualised volatility)
RISK_LOW_VOL_THRESHOLD    = 0.20    # < 20 % vol → Low
RISK_MED_VOL_THRESHOLD    = 0.35    # < 35 % vol → Medium (else High)

# ---------------------------------------------------------------------------
# Mansfield / Stage Analysis
# ---------------------------------------------------------------------------
MANSFIELD_MA_PERIOD       = 30      # 30-week (150-day) moving average

# ---------------------------------------------------------------------------
# Scheduler (market-close scan)
# ---------------------------------------------------------------------------
# NSE close: 15:30 IST = 10:00 UTC.  Change for S&P 500: 21:00 UTC (4 PM ET).
SCHEDULER_HOUR_UTC   = int(os.environ.get("SCHEDULER_HOUR_UTC", "10"))
SCHEDULER_MINUTE_UTC = int(os.environ.get("SCHEDULER_MINUTE_UTC", "15"))
SCHEDULER_TIMEZONE   = os.environ.get("SCHEDULER_TIMEZONE", "UTC")
# Set DISABLE_SCHEDULER=1 on a laptop you close frequently — the scheduler
# is only useful when the process stays up 24/7.
DISABLE_SCHEDULER    = os.environ.get("DISABLE_SCHEDULER", "0").lower() in {"1", "true", "yes"}

# ---------------------------------------------------------------------------
# Auto-scan on startup  (for the "run the backend on my laptop for 5 min" flow)
# ---------------------------------------------------------------------------
# When True, the server starts a scan in the background as soon as it boots
# if the most recent completed scan is missing or older than STALE_SCAN_MAX_AGE_HOURS.
AUTO_SCAN_ON_STARTUP: bool = os.environ.get("AUTO_SCAN_ON_STARTUP", "true").lower() in {"1", "true", "yes"}
# A completed scan older than this many hours is considered stale and triggers
# an auto-scan on next startup.  18h default → after NSE close, next morning is stale.
STALE_SCAN_MAX_AGE_HOURS: int = int(os.environ.get("STALE_SCAN_MAX_AGE_HOURS", "18"))

# ---------------------------------------------------------------------------
# API
# ---------------------------------------------------------------------------
LEADERBOARD_DEFAULT_LIMIT = 100
_extra_origins = os.environ.get("CORS_ORIGINS", "")
CORS_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    *[o.strip() for o in _extra_origins.split(",") if o.strip()],
]
