"""
Frog-in-the-Pan (FIP) / Information Discreteness — Bhattacharya & Galpin (2011).

Momentum built from many small daily gains (low information discreteness)
persists longer than momentum from a few large jumps.

Information Discreteness (ID):
    ID = sign(r) × (fraction_negative_days − fraction_positive_days)

Where r = 12-1 return.

Interpretation (Bhattacharya & Galpin convention — opposite of intuition,
so read carefully):
  − ID < 0  → for a *gainer*, means %pos > %neg → returns came from many
             small same-sign moves → continuous information → GOOD
  − ID > 0  → for a *gainer*, means %neg > %pos → the gain came from a few
             big up-jumps amid many small down days → FROG-IN-PAN: BAD

We score HIGH when ID is LOW (more continuous momentum).
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from dataclasses import dataclass


@dataclass
class FIPResult:
    id_metric: float   # raw Information Discreteness score
    fip_score: float   # 0-100; higher = more continuous / better momentum quality


def compute_fip(df: pd.DataFrame) -> FIPResult:
    """
    Parameters
    ----------
    df : OHLCV DataFrame with 'Close', date-indexed.
    """
    from app.config import FIP_LOOKBACK_DAYS, PERIOD_TRADING_DAYS

    _null = FIPResult(id_metric=0.0, fip_score=50.0)

    if df is None or df.empty or "Close" not in df.columns:
        return _null

    closes = df["Close"].dropna()
    n = len(closes)
    lookback = FIP_LOOKBACK_DAYS

    # We need at least 13 months to compute 12-1 return
    skip_1m = 21
    if n < lookback + 1:
        lookback = n - 2

    if lookback < 60:
        return _null

    # Compute 12-1 return (skip last month)
    price_start = float(closes.iloc[-(lookback + 1)])
    price_end   = float(closes.iloc[-(skip_1m + 1)])
    if price_start == 0:
        return _null

    r = (price_end / price_start) - 1.0

    # Count positive and negative days in the same window
    daily_rets = closes.iloc[-(lookback + 1):-(skip_1m)].pct_change().dropna()
    if len(daily_rets) < 20:
        return _null

    n_days    = len(daily_rets)
    n_pos     = int((daily_rets > 0).sum())
    n_neg     = int((daily_rets < 0).sum())
    frac_pos  = n_pos / n_days
    frac_neg  = n_neg / n_days

    # Information Discreteness
    id_metric = float(np.sign(r)) * (frac_neg - frac_pos)

    # Convert to 0-100 score.
    # ID ranges roughly −1 to +1.
    # We reward LOW id (continuous momentum) → invert.
    # score = 50 + (−id_metric × 50), clipped to [0, 100].
    score = float(np.clip(50.0 - id_metric * 50.0, 0.0, 100.0))

    return FIPResult(
        id_metric = round(id_metric, 4),
        fip_score = round(score, 2),
    )
