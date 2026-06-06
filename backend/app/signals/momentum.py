"""
Momentum signals:
  - 12-1 momentum   : 12-month return skipping the most recent month.
  - Risk-adjusted    : trailing return / annualised volatility (Sharpe-like).
  - 52-week-high proximity.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from dataclasses import dataclass


@dataclass
class MomentumResult:
    momentum_12_1:         float   # raw 12-1 return
    momentum_12_1_score:   float   # 0-100 (ranked across universe later)
    risk_adj_momentum:     float   # annualised return / annualised vol
    risk_adj_score:        float   # 0-100
    high_proximity:        float   # 0-1 (1 = at 52-wk high)
    high_proximity_score:  float   # 0-100
    week52_high:           float
    week52_low:            float
    pct_change_1d:         float


def compute_momentum(df: pd.DataFrame) -> MomentumResult:
    """
    Parameters
    ----------
    df : OHLCV DataFrame with 'Close', date-indexed.
    """
    from app.config import (
        RISK_ANNUALIZATION_FACTOR,
        RISK_FREE_RATE_ANNUAL,
        PERIOD_TRADING_DAYS,
    )

    _null = MomentumResult(
        momentum_12_1=0.0, momentum_12_1_score=50.0,
        risk_adj_momentum=0.0, risk_adj_score=50.0,
        high_proximity=0.5, high_proximity_score=50.0,
        week52_high=float("nan"), week52_low=float("nan"),
        pct_change_1d=0.0,
    )

    if df is None or df.empty or "Close" not in df.columns:
        return _null

    closes = df["Close"].dropna()
    n = len(closes)
    if n < 22:
        return _null

    # ── 12-1 momentum ──────────────────────────────────────────────────────
    p12 = PERIOD_TRADING_DAYS["12m"]
    p1m = 21
    if n > p12 + 1:
        price_12m_ago = float(closes.iloc[-(p12 + 1)])
        price_1m_ago  = float(closes.iloc[-(p1m + 1)])
        # 12-month return from 12 months ago to 1 month ago (skip last month)
        mom_12_1 = (price_1m_ago / price_12m_ago) - 1.0 if price_12m_ago else 0.0
    else:
        mom_12_1 = 0.0

    # ── Risk-adjusted momentum (Sharpe-like, 6-month window) ──────────────
    window = min(126, n)
    segment = closes.iloc[-window:]
    daily_returns = segment.pct_change().dropna()
    if len(daily_returns) < 20:
        risk_adj = 0.0
    else:
        ann_ret  = float(daily_returns.mean()) * RISK_ANNUALIZATION_FACTOR
        ann_vol  = float(daily_returns.std())  * np.sqrt(RISK_ANNUALIZATION_FACTOR)
        if ann_vol < 1e-9:
            risk_adj = 0.0
        else:
            risk_adj = (ann_ret - RISK_FREE_RATE_ANNUAL) / ann_vol

    # ── 52-week metrics ────────────────────────────────────────────────────
    wk52 = closes.iloc[-min(252, n):]
    week52_high = float(wk52.max())
    week52_low  = float(wk52.min())
    current     = float(closes.iloc[-1])

    high_proximity = (current - week52_low) / (week52_high - week52_low + 1e-9)
    high_proximity = float(np.clip(high_proximity, 0.0, 1.0))

    # ── 1-day change ───────────────────────────────────────────────────────
    # Stored as a *fraction* (e.g. 0.0123 = +1.23%), consistent with
    # momentum_12_1. The frontend multiplies by 100 for display, so emitting a
    # percent here would double-count (a real +5% would render as +500%).
    #
    # `closes` has already been dropna()'d, so a NULL latest row (yfinance can
    # return a placeholder NaN close for the in-progress / non-trading session)
    # is skipped and we compare the two most recent *valid* closes. We still
    # null out implausible jumps (>50% in a day) that indicate a corrupt or
    # mis-adjusted source row rather than fabricating a clamped value.
    if n >= 2:
        prev_close = float(closes.iloc[-2])
        pct_1d = (float(closes.iloc[-1]) / prev_close - 1.0) if prev_close else 0.0
        if not np.isfinite(pct_1d) or abs(pct_1d) > 0.5:
            pct_1d = float("nan")   # corrupt source data → emit null downstream
    else:
        pct_1d = 0.0

    # Scores (scored against universe percentiles in scanner.py; provide raw here)
    # We cap risk_adj at ±3 for the score mapping
    risk_adj_score = float(np.clip((risk_adj + 3) / 6 * 100, 0, 100))

    return MomentumResult(
        momentum_12_1        = round(mom_12_1, 4),
        momentum_12_1_score  = 50.0,      # placeholder; ranked in scanner
        risk_adj_momentum    = round(risk_adj, 4),
        risk_adj_score       = round(risk_adj_score, 2),
        high_proximity       = round(high_proximity, 4),
        high_proximity_score = round(high_proximity * 100, 2),
        week52_high          = round(week52_high, 2),
        week52_low           = round(week52_low, 2),
        pct_change_1d        = (round(float(pct_1d), 6)
                               if np.isfinite(pct_1d) else float("nan")),
    )
