"""
Mansfield Relative Strength & Stage Analysis (Stan Weinstein).

Stage classification:
  Stage 1 — Basing    : price consolidating near the 30-week MA.
  Stage 2 — Advancing : price above a rising 30-week MA.  ← we want this.
  Stage 3 — Topping   : price rolling over near the 30-week MA.
  Stage 4 — Declining : price below a falling 30-week MA.

Mansfield RS = ((Stock / Benchmark) / 52-week-ago ratio) - 1
Positive Mansfield RS → outperforming benchmark over 52 weeks.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from dataclasses import dataclass


@dataclass
class MansFieldResult:
    stage: int           # 1-4
    stage2: bool         # True if Stage 2
    mansfield_rs: float  # relative-strength vs benchmark; > 0 means outperforming
    score: float         # 0-100 for composite


# Default benchmark tickers by universe
_BENCHMARK = {
    "nifty500": "^NSEI",   # Nifty 50 index
    "sp500":    "^GSPC",
}


def compute_mansfield(
    df: pd.DataFrame,
    benchmark_df: pd.DataFrame,
) -> MansFieldResult:
    """
    Parameters
    ----------
    df           : OHLCV for the stock (date-indexed).
    benchmark_df : OHLCV for the benchmark index.

    Returns
    -------
    MansFieldResult
    """
    from app.config import MANSFIELD_MA_PERIOD

    _null = MansFieldResult(stage=0, stage2=False, mansfield_rs=0.0, score=0.0)

    if df is None or df.empty or benchmark_df is None or benchmark_df.empty:
        return _null

    if "Close" not in df.columns or "Close" not in benchmark_df.columns:
        return _null

    # Align on common dates
    stock = df["Close"].dropna()
    bench = benchmark_df["Close"].dropna()
    common = stock.index.intersection(bench.index)
    if len(common) < 150:
        return _null

    stock = stock.loc[common]
    bench = bench.loc[common]

    # 30-week MA (≈ 150 trading days)
    ma_period_td = MANSFIELD_MA_PERIOD * 5  # weeks → trading days
    if len(stock) < ma_period_td:
        return _null

    ma = stock.rolling(ma_period_td).mean()
    current_price = float(stock.iloc[-1])
    current_ma    = float(ma.iloc[-1])
    prev_ma       = float(ma.iloc[-22]) if len(ma) >= 22 else current_ma  # 1 month ago

    # ── Stage classification ──────────────────────────────────────────────
    ma_rising   = current_ma > prev_ma
    above_ma    = current_price > current_ma

    if above_ma and ma_rising:
        stage = 2   # Advancing — the one we want
    elif not above_ma and not ma_rising:
        stage = 4   # Declining
    elif above_ma and not ma_rising:
        stage = 3   # Topping
    else:
        stage = 1   # Basing

    # ── Mansfield RS ─────────────────────────────────────────────────────
    # Compare 52-week return of stock vs benchmark
    lookback = 252
    if len(stock) >= lookback and len(bench) >= lookback:
        stock_ret = (stock.iloc[-1] / stock.iloc[-lookback]) - 1.0
        bench_ret = (bench.iloc[-1] / bench.iloc[-lookback]) - 1.0
        mansfield_rs = stock_ret - bench_ret
    else:
        mansfield_rs = 0.0

    # ── Score ─────────────────────────────────────────────────────────────
    # Stage 2 + positive Mansfield RS → high score
    if stage == 2:
        base_score = 75.0
        rs_bonus   = min(25.0, max(0.0, mansfield_rs * 50))   # cap at 25 pts
        score      = base_score + rs_bonus
    elif stage == 1:
        score = 35.0
    elif stage == 3:
        score = 20.0
    else:  # stage 4
        score = 0.0

    return MansFieldResult(
        stage       = stage,
        stage2      = stage == 2,
        mansfield_rs= round(mansfield_rs, 4),
        score       = round(min(score, 100.0), 2),
    )
