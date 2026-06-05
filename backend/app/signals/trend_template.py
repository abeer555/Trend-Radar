"""
Minervini Trend Template — 8-criterion checklist.

Each criterion is binary (pass/fail).  The score is the weighted sum of
passing criteria, scaled 0-100.  A stock must pass ALL 8 to get the
`trend_template_pass` flag.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from dataclasses import dataclass, field


@dataclass
class TrendTemplateResult:
    score: float                      # 0-100
    passes: bool                      # True only if all 8 criteria pass
    criteria: dict[str, bool] = field(default_factory=dict)
    ma50:   float | None = None
    ma150:  float | None = None
    ma200:  float | None = None


# Equal weight per criterion — 100 / 8 ≈ 12.5 pts each.
# Adjust weights here if you want to emphasise certain criteria.
_CRITERION_WEIGHTS = {
    "above_ma50":        12.5,
    "above_ma150":       12.5,
    "above_ma200":       12.5,
    "ma150_above_ma200": 12.5,
    "ma200_rising":      12.5,
    "above_52wk_low":    12.5,
    "near_52wk_high":    12.5,
    "rs_rank_gate":      12.5,
}


def compute_trend_template(df: pd.DataFrame, rs_rank: float) -> TrendTemplateResult:
    """
    Parameters
    ----------
    df       : OHLCV DataFrame, date-indexed, at least 200 rows.
    rs_rank  : precomputed 1-99 RS rank for this stock.

    Returns
    -------
    TrendTemplateResult
    """
    from app.config import (
        TT_MA200_LOOKBACK_DAYS,
        TT_MIN_ABOVE_52WK_LOW,
        TT_MAX_BELOW_52WK_HIGH,
        TT_MIN_RS_RANK,
    )

    empty = TrendTemplateResult(score=0.0, passes=False)
    if df is None or df.empty or "Close" not in df.columns:
        return empty

    closes = df["Close"].dropna()
    if len(closes) < 200:
        return empty

    price  = float(closes.iloc[-1])
    ma50   = float(closes.iloc[-50:].mean())
    ma150  = float(closes.iloc[-150:].mean())
    ma200  = float(closes.iloc[-200:].mean())

    # 200-day MA 1 month ago
    if len(closes) >= 200 + TT_MA200_LOOKBACK_DAYS:
        ma200_1m_ago = float(closes.iloc[-(200 + TT_MA200_LOOKBACK_DAYS):-TT_MA200_LOOKBACK_DAYS].mean())
    else:
        ma200_1m_ago = ma200  # can't determine → treat as flat

    week52_high = float(closes.iloc[-252:].max())
    week52_low  = float(closes.iloc[-252:].min())

    criteria = {
        "above_ma50":        price > ma50,
        "above_ma150":       price > ma150,
        "above_ma200":       price > ma200,
        "ma150_above_ma200": ma150 > ma200,
        "ma200_rising":      ma200 > ma200_1m_ago,
        "above_52wk_low":    (price - week52_low) / (week52_low + 1e-9) >= TT_MIN_ABOVE_52WK_LOW,
        "near_52wk_high":    (week52_high - price) / (week52_high + 1e-9) <= TT_MAX_BELOW_52WK_HIGH,
        "rs_rank_gate":      rs_rank >= TT_MIN_RS_RANK,
    }

    score = sum(_CRITERION_WEIGHTS[k] for k, v in criteria.items() if v)

    return TrendTemplateResult(
        score    = round(score, 2),
        passes   = all(criteria.values()),
        criteria = criteria,
        ma50     = round(ma50, 2),
        ma150    = round(ma150, 2),
        ma200    = round(ma200, 2),
    )
