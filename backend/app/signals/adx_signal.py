"""
ADX (Average Directional Index) — trend-strength filter.
Uses the in-house ta_impl; falls back to pandas-ta if available.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from dataclasses import dataclass


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

    try:
        # Try pandas-ta first (faster)
        try:
            import pandas_ta as ta  # type: ignore
            adx_df = ta.adx(df["High"], df["Low"], df["Close"], length=ADX_PERIOD)
            if adx_df is not None and not adx_df.empty:
                adx_col = [c for c in adx_df.columns if c.upper().startswith("ADX_") and "DM" not in c and "DI" not in c]
                if adx_col:
                    adx_val = float(adx_df[adx_col[0]].dropna().iloc[-1])
                    if not np.isnan(adx_val):
                        return _make_result(adx_val, ADX_TRENDING_FLOOR, ADX_STRONG_TREND)
        except (ImportError, Exception):
            pass

        # Fallback: in-house implementation
        from app.signals.ta_impl import adx as _adx
        adx_series = _adx(df["High"], df["Low"], df["Close"], length=ADX_PERIOD)
        adx_val = float(adx_series.dropna().iloc[-1]) if not adx_series.dropna().empty else 0.0
        if np.isnan(adx_val):
            return _null
        return _make_result(adx_val, ADX_TRENDING_FLOOR, ADX_STRONG_TREND)
    except Exception:
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
