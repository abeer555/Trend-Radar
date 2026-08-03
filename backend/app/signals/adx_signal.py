"""
ADX (Average Directional Index) — trend-strength filter.
Uses pandas-ta if installed; otherwise the in-house ta_impl implementation.
"""

from __future__ import annotations

import logging
import numpy as np
import pandas as pd
from dataclasses import dataclass

log = logging.getLogger(__name__)


@dataclass
class ADXResult:
    adx:   float   # raw ADX value (0-100)
    score: float   # 0-100 mapped score


def compute_adx(df: pd.DataFrame) -> ADXResult:
    from app.config import ADX_PERIOD, ADX_TRENDING_FLOOR, ADX_STRONG_TREND

    _null = ADXResult(adx=0.0, score=0.0)

    if df is None or df.empty:
        return _null
    if not {"High", "Low", "Close"}.issubset(df.columns):
        return _null
    if len(df) < ADX_PERIOD + 10:
        return _null

    # ── Try pandas-ta first (faster, vectorised) ────────────────────────
    try:
        import pandas_ta as ta  # type: ignore
    except ImportError:
        ta = None

    if ta is not None:
        try:
            adx_df = ta.adx(df["High"], df["Low"], df["Close"], length=ADX_PERIOD)
            if adx_df is not None and not adx_df.empty:
                adx_col = [c for c in adx_df.columns
                           if c.upper().startswith("ADX_") and "DM" not in c and "DI" not in c]
                if adx_col:
                    adx_val = float(adx_df[adx_col[0]].dropna().iloc[-1])
                    if np.isfinite(adx_val):
                        return _make_result(adx_val, ADX_TRENDING_FLOOR, ADX_STRONG_TREND)
        except Exception as exc:
            # pandas-ta can break in subtle ways on new pandas versions —
            # log it, then fall through to the in-house implementation.
            log.debug("pandas-ta ADX failed; falling back to ta_impl: %s", exc)

    # ── In-house implementation ─────────────────────────────────────────
    try:
        from app.signals.ta_impl import adx as _adx
        adx_series = _adx(df["High"], df["Low"], df["Close"], length=ADX_PERIOD)
        clean = adx_series.dropna()
        if clean.empty:
            return _null
        adx_val = float(clean.iloc[-1])
        if not np.isfinite(adx_val):
            return _null
        return _make_result(adx_val, ADX_TRENDING_FLOOR, ADX_STRONG_TREND)
    except Exception as exc:
        log.warning("compute_adx failed (both pandas-ta and ta_impl): %s", exc)
        return _null


def _make_result(adx_val: float, floor: float, strong: float) -> ADXResult:
    if adx_val < floor:
        score = adx_val / floor * 20
    elif adx_val < strong:
        fraction = (adx_val - floor) / (strong - floor)
        score = 20 + fraction * 60
    else:
        score = 80 + min(20, (adx_val - strong) / 10 * 20)
    return ADXResult(adx=round(adx_val, 2), score=round(float(score), 2))
