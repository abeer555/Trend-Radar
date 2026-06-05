"""
Volatility Contraction Pattern (VCP) — Mark Minervini.

A VCP is detected when:
1. The stock is in a Stage-2 uptrend (price above rising MAs).
2. There are ≥ 3 price contractions (high-to-low swings).
3. Each successive contraction is shallower than the prior one.
4. Volume dries up on each contraction.
5. The most recent contraction is tight (the stock is "coiling").

Returns a VCPResult with:
  - detected: bool
  - contractions: int     number of contractions found
  - pivot: float          suggested buy-point (high of the last base)
  - score: float 0-100   0 if not detected, scales with quality
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from dataclasses import dataclass, field


@dataclass
class VCPResult:
    detected: bool
    contractions: int
    pivot: float | None
    score: float
    contraction_pcts: list[float] = field(default_factory=list)
    volume_ratios: list[float] = field(default_factory=list)


def compute_vcp(df: pd.DataFrame) -> VCPResult:
    """
    Parameters
    ----------
    df : OHLCV DataFrame with columns Open/High/Low/Close/Volume, date-indexed.
         Needs at least 80 rows.

    Returns
    -------
    VCPResult
    """
    from app.config import (
        VCP_LOOKBACK_DAYS,
        VCP_MIN_CONTRACTIONS,
        VCP_MAX_CONTRACTION_PCT,
        VCP_TIGHTENING_TOLERANCE,
        VCP_VOLUME_TIGHTENING,
        VCP_PIVOT_LOOKBACK_DAYS,
    )

    _null = VCPResult(detected=False, contractions=0, pivot=None, score=0.0)

    if df is None or df.empty:
        return _null

    cols = {"Close", "High", "Low", "Volume"}
    if not cols.issubset(df.columns):
        return _null

    window = df.tail(VCP_LOOKBACK_DAYS).copy()
    if len(window) < 60:
        return _null

    closes  = window["Close"].values
    highs   = window["High"].values
    lows    = window["Low"].values
    volumes = window["Volume"].values

    # ── Step 1: Require Stage-2-like condition (price above 50-day MA) ──────
    ma50 = float(np.mean(closes[-min(50, len(closes)):]))
    if closes[-1] < ma50 * 0.95:
        return _null   # not in an uptrend

    # ── Step 2: Find swing highs and swing lows ─────────────────────────────
    swing_highs = _find_swings(highs, kind="high", window=5)
    swing_lows  = _find_swings(lows, kind="low",  window=5)

    if len(swing_highs) < 2 or len(swing_lows) < 2:
        return _null

    # ── Step 3: Build contraction stages ────────────────────────────────────
    # Pair each swing high with the subsequent swing low → one stage
    stages = []
    for hi_idx in swing_highs:
        # Find the first swing low AFTER this high
        subsequent_lows = [lo for lo in swing_lows if lo > hi_idx]
        if not subsequent_lows:
            continue
        lo_idx = subsequent_lows[0]
        hi_price = highs[hi_idx]
        lo_price = lows[lo_idx]
        contraction = (hi_price - lo_price) / (hi_price + 1e-9)
        # Volume during the contraction (from hi_idx to lo_idx)
        vol_segment = volumes[hi_idx:lo_idx + 1]
        avg_vol = float(np.mean(vol_segment)) if len(vol_segment) > 0 else float("nan")
        stages.append({
            "hi_idx":      hi_idx,
            "lo_idx":      lo_idx,
            "hi_price":    hi_price,
            "lo_price":    lo_price,
            "contraction": contraction,
            "avg_vol":     avg_vol,
        })

    if len(stages) < VCP_MIN_CONTRACTIONS:
        return _null

    # Keep only the last N stages (most recent)
    stages = stages[-6:]

    # ── Step 4: Verify each contraction is shallower ────────────────────────
    contraction_pcts: list[float] = []
    vol_ratios: list[float] = []
    valid_count = 0

    for i, stage in enumerate(stages):
        contraction_pcts.append(round(stage["contraction"] * 100, 2))
        if i > 0:
            prev_contraction = stages[i - 1]["contraction"]
            is_tighter = stage["contraction"] < prev_contraction - VCP_TIGHTENING_TOLERANCE
            if not is_tighter:
                continue
            if VCP_VOLUME_TIGHTENING and not np.isnan(stage["avg_vol"]) and not np.isnan(stages[i - 1]["avg_vol"]):
                vol_declining = stage["avg_vol"] < stages[i - 1]["avg_vol"]
                if not vol_declining:
                    continue
                vol_ratio = stage["avg_vol"] / (stages[i - 1]["avg_vol"] + 1e-9)
                vol_ratios.append(round(vol_ratio, 3))
            valid_count += 1

    if valid_count < VCP_MIN_CONTRACTIONS - 1:
        return _null

    # First contraction shouldn't be too extreme
    if stages[0]["contraction"] > VCP_MAX_CONTRACTION_PCT * 2:
        return _null

    # ── Step 5: Pivot — high of the most recent consolidation stage ──────────
    recent_high_idx = stages[-1]["hi_idx"]
    pivot = float(highs[recent_high_idx])

    # ── Step 6: Score (0-100) ───────────────────────────────────────────────
    # Quality: more contractions + tighter final + lower vol → higher score
    tightness = 1.0 - stages[-1]["contraction"]         # 0-1; tighter = higher
    n_factor  = min(valid_count / 4.0, 1.0)            # maxes out at 4 contractions
    score = round((0.4 * tightness + 0.6 * n_factor) * 100, 1)

    return VCPResult(
        detected        = True,
        contractions    = valid_count + 1,
        pivot           = round(pivot, 2),
        score           = score,
        contraction_pcts= contraction_pcts,
        volume_ratios   = vol_ratios,
    )


# ---------------------------------------------------------------------------
# Helper: swing-point detection
# ---------------------------------------------------------------------------

def _find_swings(series: np.ndarray, kind: str, window: int = 5) -> list[int]:
    """
    Find indices of swing highs (kind='high') or swing lows (kind='low').
    A swing high is a local maximum within ±`window` bars.
    """
    result = []
    n = len(series)
    for i in range(window, n - window):
        neighbourhood = series[i - window : i + window + 1]
        if kind == "high" and series[i] == neighbourhood.max():
            result.append(i)
        elif kind == "low" and series[i] == neighbourhood.min():
            result.append(i)
    return result
