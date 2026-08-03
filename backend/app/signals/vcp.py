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
    )

    # First contraction is allowed to be up to 2× the normal max — early pullbacks
    # in a fresh VCP are often deeper; tightening matters more than depth.
    VCP_FIRST_CONTRACTION_TOLERANCE_MULT = 2.0

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
    # NOTE: when history is short we silently fall back to a shorter-window
    # mean — less strict than a true 50-day MA, but avoids dismissing young
    # IPOs / recent listings entirely.
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

    # ── Dedupe stages that share the same trough ────────────────────────────
    # `_find_swings` uses `==` against the neighbourhood max, so two adjacent
    # bars with identical highs (common even in real data after dividend
    # adjustments or from low-float tickers) both get flagged.  Those duplicate
    # peaks both resolve to the *same* subsequent trough — keep only the first
    # (highest) peak per trough, otherwise the tightening check sees a stage
    # compared against its own duplicate and the chain breaks.
    by_lo: dict[int, dict] = {}
    for s in stages:
        # Two highs sharing the same low: prefer the *earlier* high index —
        # that's the peak that started the contraction.
        if s["lo_idx"] not in by_lo or s["hi_idx"] < by_lo[s["lo_idx"]]["hi_idx"]:
            by_lo[s["lo_idx"]] = s
    stages = sorted(by_lo.values(), key=lambda s: s["hi_idx"])

    if len(stages) < VCP_MIN_CONTRACTIONS:
        return _null

    # Keep only the last N stages (most recent)
    stages = stages[-6:]

    # ── Step 4: Verify each contraction is shallower (successively) ─────────
    # A real VCP has *successive* tightenings: stage N+1 is shallower than
    # stage N.  The old loop compared stage[i] to stage[i-1] even after a
    # non-tightening stage broke the chain, which could count a tightening
    # that wasn't actually part of a clean successive run.  We now track the
    # anchor stage and reset the run after a failed comparison.
    contraction_pcts: list[float] = [round(s["contraction"] * 100, 2) for s in stages]
    vol_ratios: list[float] = []
    valid_count = 0          # number of successive tightening transitions in the current run
    anchor = 0               # index of the last stage that *started* the current tightening run

    for i in range(1, len(stages)):
        stage = stages[i]
        prev  = stages[anchor]

        is_tighter = stage["contraction"] < prev["contraction"] - VCP_TIGHTENING_TOLERANCE
        if not is_tighter:
            anchor = i        # start a new run at this deeper/failed stage
            valid_count = 0
            continue

        if VCP_VOLUME_TIGHTENING and not np.isnan(stage["avg_vol"]) and not np.isnan(prev["avg_vol"]):
            vol_declining = stage["avg_vol"] < prev["avg_vol"]
            if not vol_declining:
                anchor = i    # volume expansion broke the run
                valid_count = 0
                continue
            vol_ratios.append(round(stage["avg_vol"] / (prev["avg_vol"] + 1e-9), 3))

        valid_count += 1
        anchor = i            # extend the successive-tightening run

    if valid_count < VCP_MIN_CONTRACTIONS - 1:
        return _null

    # First contraction of the *current tightening run* shouldn't be extreme
    first_of_run = stages[anchor - valid_count]
    if first_of_run["contraction"] > VCP_MAX_CONTRACTION_PCT * VCP_FIRST_CONTRACTION_TOLERANCE_MULT:
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
