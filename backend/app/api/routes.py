"""
FastAPI route handlers.

All endpoints read from SQLite (pre-computed by the scanner) so they respond
instantly without live API calls.  The /scan endpoint triggers an on-demand
scan which may take several minutes.
"""

from __future__ import annotations

import json
import threading
from datetime import date
from typing import Annotated, Any

from fastapi import APIRouter, BackgroundTasks, HTTPException, Query
from pydantic import BaseModel

from app.database import (
    get_engine,
    get_last_completed_scan,
    get_last_scan_status,
    get_sectors,
    latest_completed_scan_age_hours,
    load_leaderboard,
    load_scan_result,
)

router = APIRouter(prefix="/api")


# ---------------------------------------------------------------------------
# Pydantic response models (loose — extra fields pass through)
# ---------------------------------------------------------------------------

class LeaderboardRow(BaseModel):
    model_config = {"extra": "allow"}
    ticker:            str
    name:              str | None
    sector:            str | None
    last_price:        float | None
    pct_change_1d:     float | None
    composite_score:   float | None
    rs_rank:           float | None
    trend_template_pass: bool | None
    vcp_detected:      bool | None
    sparkline_json:    str | None


class ScanResponse(BaseModel):
    status: str
    message: str


# ---------------------------------------------------------------------------
# Leaderboard
# ---------------------------------------------------------------------------

@router.get("/leaderboard", response_model=list[dict])
def get_leaderboard(
    sector:         str | None = Query(None, description="Filter by sector name"),
    min_price:      float | None = Query(None, ge=0),
    min_rs:         float | None = Query(None, ge=0, le=99),
    trend_template: bool | None = Query(None, description="Only trend-template passes"),
    vcp:            bool | None = Query(None, description="Only VCP setups"),
    sort_by:        str = Query("composite_score"),
    order:          str = Query("desc", pattern="^(asc|desc)$"),
    limit:          int = Query(100, ge=1, le=500),
    scan_date:      str | None = Query(None, description="YYYY-MM-DD; defaults to latest"),
):
    engine = get_engine()
    sd = date.fromisoformat(scan_date) if scan_date else None

    rows = load_leaderboard(
        engine         = engine,
        scan_date      = sd,
        sector         = sector,
        min_price      = min_price,
        min_rs         = min_rs,
        trend_template = trend_template,
        vcp            = vcp,
        sort_by        = sort_by,
        descending     = order == "desc",
        limit          = limit,
    )

    # Parse sparkline JSON for convenience
    for row in rows:
        if row.get("sparkline_json"):
            try:
                row["sparkline"] = json.loads(row["sparkline_json"])
            except (json.JSONDecodeError, TypeError):
                row["sparkline"] = []
        else:
            row["sparkline"] = []

    return rows


# ---------------------------------------------------------------------------
# Single-stock detail
# ---------------------------------------------------------------------------

@router.get("/stock/{ticker}")
def get_stock(ticker: str, scan_date: str | None = Query(None)) -> dict[str, Any]:
    engine = get_engine()
    sd = date.fromisoformat(scan_date) if scan_date else None

    row = load_scan_result(ticker.upper(), engine, scan_date=sd)
    if row is None:
        raise HTTPException(status_code=404, detail=f"No data for ticker {ticker!r}")

    # Parse JSON blobs
    for key in ("sparkline_json", "top_factors_json"):
        raw = row.pop(key, None)
        field_name = key.replace("_json", "")
        try:
            row[field_name] = json.loads(raw) if raw else []
        except (json.JSONDecodeError, TypeError):
            row[field_name] = []

    # Build human-readable technical reads from stored values
    from app.signals.technicals import (
        _rsi_read, _macd_read, _stoch_read, _atr_read, _adx_read,
    )
    from app.config import ATR_STOP_MULTIPLIER

    row["rsi_read"]   = _rsi_read(row.get("rsi"))
    row["macd_read"]  = _macd_read(row.get("macd"), row.get("macd_signal"))
    row["stoch_read"] = _stoch_read(row.get("stoch_k"), row.get("stoch_d"))
    row["atr_read"]   = _atr_read(row.get("atr"), row.get("last_price"), ATR_STOP_MULTIPLIER)
    row["adx_read"]   = _adx_read(row.get("adx") or 0.0)

    # Entry signal
    row["entry_signal"] = _entry_signal(row)

    # Trend template criteria (stored as JSON booleans from scanner)
    # Re-compute from price data for the detail view
    row["trend_template_criteria"] = _get_tt_criteria(ticker.upper(), row)

    return row


# ---------------------------------------------------------------------------
# Scan control
# ---------------------------------------------------------------------------

_scan_lock = threading.Lock()
_scan_running = False


@router.post("/scan", response_model=ScanResponse)
def trigger_scan(background_tasks: BackgroundTasks, force_refresh: bool = False):
    """
    Kick off a scan in the background.

    The `_scan_running` flag is set *here* (under the lock) rather than inside
    the background task, so two quick `POST /api/scan` calls can never both
    slip through.  It's cleared in `_run_scan_bg`'s `finally`.
    """
    global _scan_running
    with _scan_lock:
        if _scan_running:
            return ScanResponse(status="already_running", message="A scan is already in progress.")
        _scan_running = True
        background_tasks.add_task(_run_scan_bg, force_refresh)
    return ScanResponse(status="started", message="Scan started in background. Check /api/scan/status.")


@router.get("/scan/status")
def scan_status() -> dict:
    """
    Rich scan status for the frontend.

    `is_running` reflects the *in-process* flag (accurate while this process is
    alive), while `last_completed`/`data_age_hours`/`is_stale` come from the DB
    so they survive restarts and are correct even when the server just booted.
    """
    from datetime import datetime
    engine = get_engine()
    last       = get_last_scan_status(engine)
    completed  = get_last_completed_scan(engine)
    age_hours  = latest_completed_scan_age_hours(engine)

    with _scan_lock:
        running = _scan_running

    # The DB `status='running'` row can exist without the in-process flag being
    # set when the server restarted mid-scan; recovery on startup flips those to
    # 'failed', so here they should agree.
    is_stale = age_hours is None or age_hours > _stale_threshold()

    return {
        **(last or {"status": "no_scan_run"}),
        "is_running":            running,
        "has_data":              completed is not None,
        "last_completed_at":     (completed or {}).get("finished_at"),
        "data_age_hours":        round(age_hours, 2) if age_hours is not None else None,
        "is_stale":              is_stale,
        "stale_threshold_hours": _stale_threshold(),
        "server_time":           datetime.utcnow().isoformat() + "Z",
    }


def _stale_threshold() -> int:
    from app.config import STALE_SCAN_MAX_AGE_HOURS
    return STALE_SCAN_MAX_AGE_HOURS


# ---------------------------------------------------------------------------
# Sectors list
# ---------------------------------------------------------------------------

@router.get("/sectors")
def list_sectors() -> list[str]:
    return get_sectors(get_engine())


# ---------------------------------------------------------------------------
# Config snapshot
# ---------------------------------------------------------------------------

@router.get("/config")
def get_config() -> dict:
    from app.config import (
        UNIVERSE,
        SIGNAL_WEIGHTS,
        RS_WEIGHTS,
        TT_MIN_RS_RANK,
        VCP_MIN_CONTRACTIONS,
        ADX_TRENDING_FLOOR,
    )
    return {
        "universe":           UNIVERSE,
        "signal_weights":     SIGNAL_WEIGHTS,
        "rs_return_weights":  RS_WEIGHTS,
        "tt_min_rs_rank":     TT_MIN_RS_RANK,
        "vcp_min_contractions": VCP_MIN_CONTRACTIONS,
        "adx_trending_floor": ADX_TRENDING_FLOOR,
    }


# ---------------------------------------------------------------------------
# Backtest (stub)
# ---------------------------------------------------------------------------

@router.get("/backtest/{ticker}")
def backtest(
    ticker:     str,
    start_date: str = Query("2020-01-01"),
    end_date:   str = Query("2024-12-31"),
) -> dict:
    from app.backtest import backtest_stub
    return backtest_stub(
        ticker     = ticker.upper(),
        start_date = date.fromisoformat(start_date),
        end_date   = date.fromisoformat(end_date),
    )


# ---------------------------------------------------------------------------
# OHLCV chart data for the detail view
# ---------------------------------------------------------------------------

@router.get("/stock/{ticker}/chart")
def get_chart_data(
    ticker: str,
    days:   int = Query(365, ge=30, le=730),
) -> dict[str, Any]:
    from app.data.fetcher import get_price_df
    import numpy as np

    df = get_price_df(ticker.upper())
    if df is None or df.empty:
        raise HTTPException(status_code=404, detail=f"No price data for {ticker!r}")

    df = df.tail(days)

    # Moving averages
    closes = df["Close"]
    ma50  = closes.rolling(50, min_periods=1).mean()
    ma150 = closes.rolling(150, min_periods=1).mean()
    ma200 = closes.rolling(200, min_periods=1).mean()

    # Bollinger Bands (20-day, 2σ)
    bb_mid   = closes.rolling(20, min_periods=1).mean()
    bb_std   = closes.rolling(20, min_periods=1).std()
    bb_upper = bb_mid + 2 * bb_std
    bb_lower = bb_mid - 2 * bb_std

    def _series_to_list(s):
        return [
            {"time": str(idx.date()), "value": round(float(v), 2) if not np.isnan(v) else None}
            for idx, v in s.items()
        ]

    candles = []
    for idx, row in df.iterrows():
        o, h, l, c = row["Open"], row["High"], row["Low"], row["Close"]
        if any(np.isnan(v) for v in (o, h, l, c)):
            continue
        candles.append({
            "time":   str(idx.date()),
            "open":   round(float(o), 2),
            "high":   round(float(h), 2),
            "low":    round(float(l), 2),
            "close":  round(float(c), 2),
            "volume": int(row["Volume"]) if not np.isnan(row["Volume"]) else 0,
        })

    return {
        "candles":  candles,
        "ma50":     _series_to_list(ma50),
        "ma150":    _series_to_list(ma150),
        "ma200":    _series_to_list(ma200),
        "bb_upper": _series_to_list(bb_upper),
        "bb_lower": _series_to_list(bb_lower),
        "bb_mid":   _series_to_list(bb_mid),
    }


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _entry_signal(row: dict) -> dict:
    """Return a simple Signal label and reasoning."""
    score = row.get("composite_score") or 0
    tt    = row.get("trend_template_pass") or False
    vcp   = row.get("vcp_detected") or False
    rs    = row.get("rs_rank") or 0
    pivot = row.get("vcp_pivot")
    price = row.get("last_price")

    # A VCP pivot is only an actionable buy-point while price is still at/below
    # it. If price has already pushed above the pivot, the base has broken out
    # (or the detected base is stale) — telling the user to "buy above pivot"
    # below the current price is misleading. Detect that case explicitly.
    pivot_cleared = (
        vcp and pivot is not None and price is not None and float(price) > float(pivot)
    )

    if pivot_cleared and tt and rs >= 70:
        label  = "Extended"
        reason = (
            f"VCP base pivot ({pivot}) is already cleared — price ({price}) is "
            "trading above the entry. The breakout has occurred; chasing here "
            "means buying extended. Wait for a new base or a pullback toward the pivot."
        )
        entry  = f"Pivot already cleared — extended above entry ({pivot}). Avoid chasing."
    elif vcp and tt and rs >= 70:
        label  = "Breakout"
        reason = "VCP setup + Trend Template pass + RS ≥ 70. Watch for volume breakout above pivot."
        entry  = f"Buy above pivot: {pivot}" if pivot else "Watch for volume breakout above base high."
    elif tt and rs >= 70:
        label  = "Setup forming"
        reason = "Trend Template criteria met and RS strong. Waiting for VCP tightening."
        entry  = "Wait for a low-volume consolidation followed by a volume breakout."
    elif score >= 60:
        label  = "Watch"
        reason = "Composite score is elevated but setup criteria not fully met."
        entry  = "Monitor for Trend Template improvement and volume confirmation."
    else:
        label  = "No setup"
        reason = "Insufficient momentum or trend conditions."
        entry  = "Do not enter. Re-evaluate if fundamentals or price action improves."

    return {
        "label":  label,
        "reason": reason,
        "entry":  entry,
        # Surfaced so consumers can render the pivot as informational (already
        # cleared) rather than as an actionable buy trigger.
        "pivot":          pivot,
        "pivot_cleared":  pivot_cleared,
        "disclaimer": (
            "This is an educational signal based on historical patterns. "
            "It is NOT investment advice. Past patterns do not guarantee future results."
        ),
    }


def _get_tt_criteria(ticker: str, row: dict) -> dict:
    """Return a mapping of Trend Template criterion → pass/fail."""
    return {
        "Price > 50-day MA":         _bool(row.get("last_price"), row.get("ma50"), "gt"),
        "Price > 150-day MA":        _bool(row.get("last_price"), row.get("ma150"), "gt"),
        "Price > 200-day MA":        _bool(row.get("last_price"), row.get("ma200"), "gt"),
        "150-day MA > 200-day MA":   _bool(row.get("ma150"), row.get("ma200"), "gt"),
        "Price ≥ 30% above 52-wk low":
            _pct_above(row.get("last_price"), row.get("week52_low"), 0.30),
        "Price within 25% of 52-wk high":
            _pct_within(row.get("last_price"), row.get("week52_high"), 0.25),
        "RS Rank ≥ 70":              (row.get("rs_rank") or 0) >= 70,
        "200-day MA rising":         None,  # requires time-series; marked unknown here
    }


def _bool(a, b, op: str) -> bool | None:
    if a is None or b is None:
        return None
    if op == "gt":
        return float(a) > float(b)
    return None


def _pct_above(price, low, threshold: float) -> bool | None:
    if price is None or low is None or low == 0:
        return None
    return (float(price) - float(low)) / float(low) >= threshold


def _pct_within(price, high, tolerance: float) -> bool | None:
    if price is None or high is None or high == 0:
        return None
    return (float(high) - float(price)) / float(high) <= tolerance


def _run_scan_bg(force_refresh: bool) -> None:
    """
    Wrap `run_full_scan` so an exception always:
      1. marks scan_log as failed (see scanner.run_full_scan's own try/except), and
      2. releases the in-process running flag so future scans can be triggered.
    """
    global _scan_running
    try:
        from app.scanner import run_full_scan
        run_full_scan(force_refresh=force_refresh)
    except Exception:
        import logging
        logging.getLogger(__name__).exception("Background scan crashed")
    finally:
        with _scan_lock:
            _scan_running = False
