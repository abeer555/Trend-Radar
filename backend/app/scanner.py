"""
Full-universe scanner.

Runs after market close (triggered by scheduler.py or the /api/scan endpoint).
Steps:
  1. Load universe from config.
  2. Ensure prices are cached in SQLite.
  3. Compute all signals for every ticker.
  4. Rank RS across the universe.
  5. Upsert scan_results rows.
"""

from __future__ import annotations

import json
import logging
import traceback
from datetime import date, datetime
from typing import Any

import numpy as np
import pandas as pd

from app.config import PRICE_HISTORY_DAYS, LEADERBOARD_DEFAULT_LIMIT
from app.data.fetcher import (
    ensure_fundamentals,
    ensure_prices,
    get_fundamentals,
    get_price_df,
)
from app.data.universe import load_universe
from app.database import (
    get_engine,
    log_scan_end,
    log_scan_start,
    upsert_scan_result,
)
from app.signals.adx_signal import compute_adx
from app.signals.composite import compute_composite
from app.signals.frog_in_pan import compute_fip
from app.signals.mansfield import compute_mansfield
from app.signals.momentum import compute_momentum
from app.signals.relative_strength import compute_rs_raw, rank_universe, rs_score_to_0_100
from app.signals.technicals import compute_technicals
from app.signals.trend_template import compute_trend_template
from app.signals.vcp import compute_vcp
from app.signals.volume import compute_volume

log = logging.getLogger(__name__)


def run_full_scan(force_refresh: bool = False) -> dict[str, Any]:
    """
    Execute a full universe scan.  Returns a summary dict.
    Designed to be safe to call concurrently — upsert is atomic per row.
    """
    engine   = get_engine()
    log_id   = log_scan_start(engine)
    scan_dt  = date.today()
    universe = load_universe()
    tickers  = [s.ticker for s in universe]
    info_map = {s.ticker: s for s in universe}

    log.info("Starting scan for %d tickers (date=%s)", len(tickers), scan_dt)

    # ── Step 1: Bulk-download prices ──────────────────────────────────────
    ensure_prices(tickers, force_refresh=force_refresh)

    # ── Step 2: Load benchmark for Mansfield RS ───────────────────────────
    from app.config import UNIVERSE
    benchmark_ticker = "^NSEI" if UNIVERSE == "nifty500" else "^GSPC"
    try:
        ensure_prices([benchmark_ticker], force_refresh=force_refresh)
        bench_df = get_price_df(benchmark_ticker)
    except Exception:
        bench_df = pd.DataFrame()

    # ── Step 3: Compute RS raw scores + momentum (one pass, no DataFrame cache) ──
    rs_raw_scores: dict[str, float] = {}
    mom_results_raw: dict[str, Any] = {}
    mom_12_1_raw: dict[str, float] = {}
    for ticker in tickers:
        try:
            df = get_price_df(ticker)
            rs_raw_scores[ticker] = compute_rs_raw(df)
        except Exception as exc:
            log.warning("RS raw failed for %s: %s", ticker, exc)
            rs_raw_scores[ticker] = float("nan")
            df = pd.DataFrame()
        try:
            m = compute_momentum(df)
            mom_results_raw[ticker] = m
            mom_12_1_raw[ticker] = m.momentum_12_1
        except Exception:
            mom_12_1_raw[ticker] = float("nan")

    rs_ranks = rank_universe(rs_raw_scores)

    # Percentile-rank 12-1 momentum
    valid_mom = {t: v for t, v in mom_12_1_raw.items() if not np.isnan(v)}
    if valid_mom:
        from scipy.stats import rankdata
        mom_tickers = list(valid_mom.keys())
        mom_vals    = np.array([valid_mom[t] for t in mom_tickers])
        ranks_raw   = rankdata(mom_vals, method="average")
        ranks_100   = ranks_raw / len(ranks_raw) * 100
        mom_12_1_score_map = dict(zip(mom_tickers, ranks_100))
    else:
        mom_12_1_score_map = {}

    # Also bulk-fetch fundamentals (non-blocking failures)
    try:
        ensure_fundamentals(tickers)
    except Exception as exc:
        log.warning("Fundamentals bulk-fetch error: %s", exc)

    scanned = 0
    errors  = 0
    for ticker in tickers:
        try:
            _scan_single(
                ticker       = ticker,
                df           = get_price_df(ticker),
                bench_df     = bench_df,
                rs_rank      = rs_ranks.get(ticker, 50.0),
                mom_result   = mom_results_raw.get(ticker),
                mom_12_1_score = mom_12_1_score_map.get(ticker, 50.0),
                info         = info_map.get(ticker),
                scan_dt      = scan_dt,
                engine       = engine,
            )
            scanned += 1
        except Exception as exc:
            errors += 1
            log.error("Scan failed for %s: %s", ticker, traceback.format_exc())

    status = "completed" if errors == 0 else f"completed_with_{errors}_errors"
    log_scan_end(log_id, scanned, status, None, engine)
    log.info("Scan complete: %d scanned, %d errors.", scanned, errors)
    return {"scanned": scanned, "errors": errors, "scan_date": str(scan_dt)}


def _scan_single(
    ticker: str,
    df: pd.DataFrame,
    bench_df: pd.DataFrame,
    rs_rank: float,
    mom_result: Any,
    mom_12_1_score: float,
    info: Any,
    scan_dt: date,
    engine: Any,
) -> None:
    from app.config import (
        ATR_PERIOD,
        ATR_STOP_MULTIPLIER,
        RISK_ANNUALIZATION_FACTOR,
        RISK_FREE_RATE_ANNUAL,
        RISK_LOW_VOL_THRESHOLD,
        RISK_MED_VOL_THRESHOLD,
    )

    if df is None or df.empty or len(df) < 22:
        return

    closes = df["Close"].dropna()
    if len(closes) < 22:
        return
    current_price = float(closes.iloc[-1])

    # ── Signals ───────────────────────────────────────────────────────────
    rs_score  = rs_score_to_0_100(rs_rank)
    tt        = compute_trend_template(df, rs_rank)
    vcp       = compute_vcp(df)
    mansfield = compute_mansfield(df, bench_df)
    mom       = mom_result if mom_result is not None else compute_momentum(df)
    fip       = compute_fip(df)
    volume    = compute_volume(df)
    adx_r     = compute_adx(df)
    tech      = compute_technicals(df, adx_r.adx)

    # ── Composite ─────────────────────────────────────────────────────────
    comp = compute_composite(
        rs_score             = rs_score,
        momentum_12_1_score  = mom_12_1_score,
        trend_template_score = tt.score,
        vcp_score            = vcp.score,
        mansfield_score      = mansfield.score,
        high_proximity_score = mom.high_proximity_score,
        fip_score            = fip.fip_score,
        risk_adj_score       = mom.risk_adj_score,
        volume_score         = volume.score,
        adx_score            = adx_r.score,
    )

    # ── MAs ───────────────────────────────────────────────────────────────
    ma50  = float(closes.iloc[-50:].mean())  if len(closes) >= 50  else None
    ma150 = float(closes.iloc[-150:].mean()) if len(closes) >= 150 else None
    ma200 = float(closes.iloc[-200:].mean()) if len(closes) >= 200 else None

    # ── Risk metrics ──────────────────────────────────────────────────────
    rets_252 = closes.pct_change().dropna().iloc[-252:]
    ann_vol  = float(rets_252.std() * np.sqrt(RISK_ANNUALIZATION_FACTOR)) if len(rets_252) > 20 else float("nan")
    ann_ret  = float(rets_252.mean() * RISK_ANNUALIZATION_FACTOR) if len(rets_252) > 20 else float("nan")
    sharpe   = (ann_ret - RISK_FREE_RATE_ANNUAL) / ann_vol if (not np.isnan(ann_vol) and ann_vol > 0) else float("nan")

    # Max drawdown over 1 year
    roll_max = closes.iloc[-252:].cummax()
    drawdown = (closes.iloc[-252:] - roll_max) / (roll_max + 1e-9)
    max_dd   = float(drawdown.min()) if not drawdown.empty else float("nan")

    # ATR-based stop
    suggested_stop = None
    if tech.atr is not None:
        suggested_stop = round(current_price - ATR_STOP_MULTIPLIER * tech.atr, 2)

    # Risk label
    if np.isnan(ann_vol):
        risk_label = "Unknown"
    elif ann_vol < RISK_LOW_VOL_THRESHOLD:
        risk_label = "Low"
    elif ann_vol < RISK_MED_VOL_THRESHOLD:
        risk_label = "Medium"
    else:
        risk_label = "High"

    # Sparkline — last 30 closes
    sparkline = [round(float(p), 2) for p in closes.iloc[-30:].tolist()]

    # Fundamentals
    fund = get_fundamentals(ticker)

    # Name / sector from universe info or fundamentals fallback
    name     = (info.name if info else None) or fund.get("name", ticker)
    sector   = (info.sector if info else None) or fund.get("sector", "Unknown")
    industry = (info.industry if info else None) or fund.get("industry", "Unknown")

    # ── Build record ──────────────────────────────────────────────────────
    record: dict[str, Any] = {
        "ticker":    ticker,
        "scan_date": scan_dt,
        "name":      name,
        "sector":    sector,
        "industry":  industry,

        "last_price":    round(current_price, 2),
        "pct_change_1d": round(mom.pct_change_1d, 4),
        "week52_high":   mom.week52_high,
        "week52_low":    mom.week52_low,

        "composite_score":         comp.composite_score,
        "rs_rank":                 round(rs_rank, 2),
        "rs_score":                round(rs_score, 2),
        "momentum_12_1":           mom.momentum_12_1,
        "momentum_12_1_score":     round(mom_12_1_score, 2),
        "trend_template_score":    tt.score,
        "trend_template_pass":     bool(tt.passes),
        "vcp_detected":            bool(vcp.detected),
        "vcp_contractions":        vcp.contractions,
        "vcp_pivot":               vcp.pivot,
        "vcp_score":               vcp.score,
        "mansfield_stage2":        bool(mansfield.stage2),
        "mansfield_rs":            mansfield.mansfield_rs,
        "mansfield_score":         mansfield.score,
        "high_proximity":          mom.high_proximity,
        "high_proximity_score":    mom.high_proximity_score,
        "frog_in_pan":             fip.id_metric,
        "frog_in_pan_score":       fip.fip_score,
        "risk_adj_momentum":       mom.risk_adj_momentum,
        "risk_adj_score":          mom.risk_adj_score,
        "volume_surge":            bool(volume.volume_surge),
        "pocket_pivot":            bool(volume.pocket_pivot),
        "volume_score":            volume.score,
        "adx":                     adx_r.adx,
        "adx_score":               adx_r.score,

        "rsi":          tech.rsi,
        "macd":         tech.macd,
        "macd_signal":  tech.macd_signal,
        "stoch_k":      tech.stoch_k,
        "stoch_d":      tech.stoch_d,
        "atr":          tech.atr,
        "bb_upper":     tech.bb_upper,
        "bb_lower":     tech.bb_lower,
        "ma50":         round(ma50, 2) if ma50 else None,
        "ma150":        round(ma150, 2) if ma150 else None,
        "ma200":        round(ma200, 2) if ma200 else None,

        "pe_ratio":        fund.get("pe_ratio"),
        "pb_ratio":        fund.get("pb_ratio"),
        "ev_ebitda":       fund.get("ev_ebitda"),
        "revenue_growth":  fund.get("revenue_growth"),
        "earnings_growth": fund.get("earnings_growth"),
        "debt_equity":     fund.get("debt_equity"),
        "roe":             fund.get("roe"),
        "gross_margin":    fund.get("gross_margin"),
        "market_cap":      fund.get("market_cap"),

        "beta":           fund.get("beta"),
        "volatility":     round(ann_vol, 4) if not np.isnan(ann_vol) else None,
        "max_drawdown":   round(max_dd, 4) if not np.isnan(max_dd) else None,
        "sharpe":         round(sharpe, 4) if not np.isnan(sharpe) else None,
        "suggested_stop": suggested_stop,
        "risk_label":     risk_label,

        "sparkline_json":   json.dumps(sparkline),
        "top_factors_json": json.dumps(comp.top_factors),
    }

    upsert_scan_result(record, engine)
