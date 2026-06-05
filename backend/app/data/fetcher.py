"""
Data fetcher — bulk-downloads OHLCV and fundamentals via yfinance with caching.

Design principles:
- Always read from SQLite first; only hit yfinance when data is stale.
- Bulk-download in chunks to avoid rate limits.
- Never raise on individual-ticker failures; log and continue.
"""

from __future__ import annotations

import logging
import time
from datetime import date, datetime, timedelta
from typing import Sequence

import numpy as np
import pandas as pd
import yfinance as yf

# Point yfinance's internal timezone cache at a dedicated directory so its
# peewee/SQLite cache doesn't contend with concurrent download threads
# (the source of transient "database is locked" errors from yfinance itself).
try:
    from pathlib import Path as _Path
    _CACHE_DIR = _Path(__file__).parent.parent.parent / "cache"
    _CACHE_DIR.mkdir(parents=True, exist_ok=True)
    yf.set_tz_cache_location(str(_CACHE_DIR))
except Exception:
    pass

from app.config import (
    CACHE_PRICE_HOURS,
    FUNDAMENTALS_CACHE_DAYS,
    PRICE_HISTORY_DAYS,
    YFINANCE_CHUNK,
    YFINANCE_THREADS,
)
from app.database import (
    get_engine,
    latest_price_date,
    load_prices,
    upsert_prices,
)
from sqlalchemy import text

log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def ensure_prices(tickers: Sequence[str], force_refresh: bool = False) -> None:
    """
    Make sure SQLite has up-to-date OHLCV for every ticker.
    Skips a ticker if its data is fresher than CACHE_PRICE_HOURS.
    Downloads in chunks to stay within yfinance rate limits.
    """
    engine = get_engine()
    cutoff = datetime.utcnow() - timedelta(hours=CACHE_PRICE_HOURS)
    stale = []
    for t in tickers:
        latest = latest_price_date(t, engine)
        if force_refresh or latest is None or _is_stale(latest, cutoff):
            stale.append(t)

    if not stale:
        log.info("All %d tickers are fresh; skipping download.", len(tickers))
        return

    log.info("Downloading price history for %d tickers …", len(stale))
    for chunk in _chunks(stale, YFINANCE_CHUNK):
        _download_chunk(chunk, engine)
        time.sleep(0.5)   # be polite to the free API

    # Retry pass: a transient lock/timeout can leave a ticker with no rows.
    # Re-fetch any stale ticker that still has no data, one at a time.
    missing = [t for t in stale if latest_price_date(t, engine) is None]
    if missing:
        log.info("Retrying %d tickers that returned no data …", len(missing))
        for t in missing:
            _download_chunk([t], engine)
            time.sleep(0.3)


def get_price_df(ticker: str) -> pd.DataFrame:
    """Return a DataFrame of OHLCV for `ticker`, refreshing if needed."""
    ensure_prices([ticker])
    return load_prices(ticker, get_engine(), days=PRICE_HISTORY_DAYS)


def ensure_fundamentals(tickers: Sequence[str], force_refresh: bool = False) -> None:
    """Cache fundamental data for tickers that are stale or missing."""
    engine = get_engine()
    cutoff = datetime.utcnow() - timedelta(days=FUNDAMENTALS_CACHE_DAYS)
    stale = _stale_fundamentals(tickers, cutoff, engine)
    if not stale:
        return
    log.info("Refreshing fundamentals for %d tickers …", len(stale))
    for t in stale:
        try:
            _fetch_fundamentals(t, engine)
            time.sleep(0.2)
        except Exception as exc:
            log.warning("Fundamentals fetch failed for %s: %s", t, exc)


def get_fundamentals(ticker: str) -> dict:
    engine = get_engine()
    with engine.connect() as conn:
        row = conn.execute(
            text("SELECT * FROM fundamentals_cache WHERE ticker = :t"),
            {"t": ticker},
        ).mappings().fetchone()
    if row:
        return dict(row)
    # Try to fetch on demand
    try:
        _fetch_fundamentals(ticker, engine)
    except Exception as exc:
        log.warning("Could not fetch fundamentals for %s: %s", ticker, exc)
        return {}
    with engine.connect() as conn:
        row = conn.execute(
            text("SELECT * FROM fundamentals_cache WHERE ticker = :t"),
            {"t": ticker},
        ).mappings().fetchone()
    return dict(row) if row else {}


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _is_stale(latest: date, cutoff: datetime) -> bool:
    """True if the latest data is older than cutoff (market close today counts as fresh)."""
    latest_dt = datetime.combine(latest, datetime.min.time())
    # Market data from today is always considered fresh
    if latest == date.today():
        return False
    return latest_dt < cutoff


def _chunks(lst: list, n: int):
    for i in range(0, len(lst), n):
        yield lst[i : i + n]


def _download_chunk(tickers: list[str], engine) -> None:
    joined = " ".join(tickers)
    start = (datetime.utcnow() - timedelta(days=PRICE_HISTORY_DAYS + 10)).strftime("%Y-%m-%d")
    try:
        raw = yf.download(
            joined,
            start=start,
            auto_adjust=True,
            progress=False,
            threads=YFINANCE_THREADS,
        )
    except Exception as exc:
        log.error("yfinance bulk download failed: %s", exc)
        return

    if raw.empty:
        log.warning("yfinance returned empty DataFrame for chunk: %s", tickers[:5])
        return

    # yfinance returns multi-level columns when multiple tickers
    if isinstance(raw.columns, pd.MultiIndex):
        for ticker in tickers:
            try:
                df = raw.xs(ticker, axis=1, level=1)
                if not df.empty:
                    upsert_prices(ticker, df, engine)
            except KeyError:
                log.warning("No data returned for %s", ticker)
    else:
        # Single ticker
        if len(tickers) == 1:
            upsert_prices(tickers[0], raw, engine)


def _stale_fundamentals(tickers: Sequence[str], cutoff: datetime, engine) -> list[str]:
    stale = []
    for t in tickers:
        with engine.connect() as conn:
            row = conn.execute(
                text("SELECT last_updated FROM fundamentals_cache WHERE ticker = :t"),
                {"t": t},
            ).fetchone()
        if row is None or row[0] is None:
            stale.append(t)
            continue
        updated = row[0]
        if isinstance(updated, str):
            updated = datetime.fromisoformat(updated)
        if updated < cutoff:
            stale.append(t)
    return stale


def _fetch_fundamentals(ticker: str, engine) -> None:
    tk = yf.Ticker(ticker)
    info = tk.info or {}

    def _safe(key: str, default=None):
        v = info.get(key)
        if v is None or (isinstance(v, float) and np.isnan(v)):
            return default
        return v

    # Revenue growth: try trailing12Months first, then annual
    rev_growth = _safe("revenueGrowth")
    if rev_growth is not None:
        rev_growth = float(rev_growth)

    earn_growth = _safe("earningsGrowth")
    if earn_growth is not None:
        earn_growth = float(earn_growth)

    record = {
        "ticker":          ticker,
        "last_updated":    datetime.utcnow(),
        "name":            _safe("longName", _safe("shortName", ticker)),
        "sector":          _safe("sector", "Unknown"),
        "industry":        _safe("industry", "Unknown"),
        "pe_ratio":        _safe("trailingPE"),
        "pb_ratio":        _safe("priceToBook"),
        "ev_ebitda":       _safe("enterpriseToEbitda"),
        "revenue_growth":  rev_growth,
        "earnings_growth": earn_growth,
        "debt_equity":     _safe("debtToEquity"),
        "roe":             _safe("returnOnEquity"),
        "gross_margin":    _safe("grossMargins"),
        "market_cap":      _safe("marketCap"),
        "beta":            _safe("beta"),
    }

    cols = ", ".join(record.keys())
    vals = ", ".join(f":{k}" for k in record.keys())
    with engine.connect() as conn:
        conn.execute(
            text(f"INSERT OR REPLACE INTO fundamentals_cache ({cols}) VALUES ({vals})"),
            record,
        )
        conn.commit()
