"""
Universe loader — returns a list of (ticker, name, sector, industry) for the
configured universe.  Switch UNIVERSE in config.py to change between Nifty 500
and S&P 500.  No code changes needed.
"""

from __future__ import annotations

import io
import logging
from pathlib import Path
from typing import NamedTuple

import pandas as pd

log = logging.getLogger(__name__)


class StockInfo(NamedTuple):
    ticker: str
    name: str
    sector: str
    industry: str


def load_universe() -> list[StockInfo]:
    from app.config import UNIVERSE, NIFTY500_CSV, SP500_CSV

    if UNIVERSE == "nifty500":
        return _load_nifty500(NIFTY500_CSV)
    elif UNIVERSE == "sp500":
        return _load_sp500(SP500_CSV)
    else:
        raise ValueError(f"Unknown UNIVERSE: {UNIVERSE!r}")


# ---------------------------------------------------------------------------
# Nifty 500
# ---------------------------------------------------------------------------

def _load_nifty500(csv_path: str) -> list[StockInfo]:
    path = Path(csv_path)
    if not path.is_absolute():
        # Resolve relative to the backend/ directory (parent of app/)
        path = Path(__file__).parent.parent.parent / csv_path

    df = pd.read_csv(path)
    # Normalise column names — NSE CSV uses various formats
    df.columns = [c.strip() for c in df.columns]

    col_map = {
        "Symbol":        "ticker",
        "Company Name":  "name",
        "Industry":      "sector",
        "ISIN Code":     "isin",
    }
    df = df.rename(columns={k: v for k, v in col_map.items() if k in df.columns})

    results: list[StockInfo] = []
    for _, row in df.iterrows():
        ticker = str(row.get("ticker", "")).strip()
        if not ticker:
            continue
        # Append .NS for yfinance if not already present
        if not ticker.endswith(".NS") and not ticker.endswith(".BO"):
            ticker = ticker + ".NS"
        results.append(StockInfo(
            ticker   = ticker,
            name     = str(row.get("name", ticker)).strip(),
            sector   = str(row.get("sector", "Unknown")).strip(),
            industry = str(row.get("industry", row.get("sector", "Unknown"))).strip(),
        ))
    log.info("Loaded %d tickers from Nifty 500 CSV", len(results))
    return results


# ---------------------------------------------------------------------------
# S&P 500  (scraped from Wikipedia; cached locally)
# ---------------------------------------------------------------------------

def _load_sp500(csv_path: str) -> list[StockInfo]:
    path = Path(csv_path)
    if not path.is_absolute():
        path = Path(__file__).parent.parent.parent / csv_path

    if not path.exists():
        log.info("S&P 500 CSV not found; fetching from Wikipedia …")
        _fetch_sp500_wikipedia(path)

    df = pd.read_csv(path)
    results: list[StockInfo] = []
    for _, row in df.iterrows():
        ticker = str(row.get("Symbol", "")).strip().replace(".", "-")
        if not ticker:
            continue
        results.append(StockInfo(
            ticker   = ticker,
            name     = str(row.get("Security", ticker)).strip(),
            sector   = str(row.get("GICS Sector", "Unknown")).strip(),
            industry = str(row.get("GICS Sub-Industry", "Unknown")).strip(),
        ))
    log.info("Loaded %d tickers from S&P 500 CSV", len(results))
    return results


def _fetch_sp500_wikipedia(save_path: Path) -> None:
    """Download the S&P 500 constituents table from Wikipedia."""
    import urllib.request

    url = "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies"
    with urllib.request.urlopen(url, timeout=30) as resp:
        html = resp.read().decode("utf-8")

    tables = pd.read_html(io.StringIO(html))
    df = tables[0]  # first table is the constituents
    save_path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(save_path, index=False)
    log.info("Saved S&P 500 universe to %s", save_path)
