"""
IBD-style Relative Strength Rank.

RS = weighted composite of trailing returns:
    40% × 3-month  +  20% × 6-month  +  20% × 9-month  +  20% × 12-month

The raw RS score for each ticker is then percentile-ranked across the full
universe to produce the familiar 1-99 RS rank.
"""

from __future__ import annotations

import numpy as np
import pandas as pd


def compute_rs_raw(df: pd.DataFrame) -> float:
    """
    Compute the raw (unranked) RS composite for a single ticker.

    Parameters
    ----------
    df : DataFrame with a 'Close' column, at least 252 rows, index = dates.

    Returns
    -------
    float — weighted return composite, or NaN if insufficient data.
    """
    from app.config import RS_WEIGHTS, PERIOD_TRADING_DAYS

    if df is None or df.empty or "Close" not in df.columns:
        return float("nan")

    closes = df["Close"].dropna()
    n = len(closes)

    def _trailing_return(period_days: int) -> float | None:
        if n <= period_days:
            return None
        end_price   = closes.iloc[-1]
        start_price = closes.iloc[-(period_days + 1)]
        if start_price == 0:
            return None
        return (end_price / start_price) - 1.0

    weighted = 0.0
    weight_sum = 0.0
    for label, weight in RS_WEIGHTS.items():
        days = PERIOD_TRADING_DAYS[label]
        ret = _trailing_return(days)
        if ret is not None:
            weighted   += weight * ret
            weight_sum += weight

    if weight_sum == 0:
        return float("nan")
    return weighted / weight_sum   # normalise in case some periods missing


def rank_universe(raw_scores: dict[str, float]) -> dict[str, float]:
    """
    Convert raw RS scores to 1-99 percentile ranks.

    Parameters
    ----------
    raw_scores : {ticker: raw_rs_score}

    Returns
    -------
    {ticker: rs_rank}  where rs_rank is in [1, 99].
    """
    valid = {t: s for t, s in raw_scores.items() if not np.isnan(s)}
    if not valid:
        return {t: 50.0 for t in raw_scores}

    tickers = list(valid.keys())
    scores  = np.array([valid[t] for t in tickers], dtype=float)

    # scipy rankdata gives 1-based ranks; scale to 1-99
    from scipy.stats import rankdata
    ranks_raw = rankdata(scores, method="average")
    ranks_99  = 1 + (ranks_raw - 1) * 98 / (len(ranks_raw) - 1 or 1)
    ranks_99  = np.clip(ranks_99, 1, 99)

    rank_map = dict(zip(tickers, ranks_99))
    # Assign median rank (50) to tickers with NaN raw scores
    return {t: rank_map.get(t, 50.0) for t in raw_scores}


def rs_score_to_0_100(rs_rank: float) -> float:
    """Map the 1-99 RS rank to a 0-100 normalised score for composite calc."""
    return float(np.clip((rs_rank - 1) / 98 * 100, 0, 100))
