"""
Supplementary technical indicators for the detail view:
RSI, MACD, Stochastic, ATR, Bollinger Bands.

Tries pandas-ta first; falls back to the in-house ta_impl module.
None of these contribute to the composite score — they are display-only.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from dataclasses import dataclass, field


@dataclass
class TechnicalIndicators:
    rsi:           float | None = None
    macd:          float | None = None
    macd_signal:   float | None = None
    macd_hist:     float | None = None
    stoch_k:       float | None = None
    stoch_d:       float | None = None
    atr:           float | None = None
    bb_upper:      float | None = None
    bb_middle:     float | None = None
    bb_lower:      float | None = None
    rsi_read:      str = ""
    macd_read:     str = ""
    stoch_read:    str = ""
    atr_read:      str = ""
    adx_read:      str = ""


def compute_technicals(df: pd.DataFrame, adx_val: float = 0.0) -> TechnicalIndicators:
    from app.config import ATR_PERIOD, ATR_STOP_MULTIPLIER

    result = TechnicalIndicators()
    if df is None or df.empty:
        return result

    h = df.get("High")
    l = df.get("Low")
    c = df.get("Close")
    if c is None:
        return result

    try:
        from app.signals.ta_impl import rsi, macd, atr, stoch, bbands
    except ImportError:
        return result

    # RSI
    try:
        rsi_s = rsi(c, 14)
        result.rsi = _last(rsi_s)
    except Exception:
        pass

    # MACD
    try:
        macd_line, sig_line, hist = macd(c, 12, 26, 9)
        result.macd        = _last(macd_line)
        result.macd_signal = _last(sig_line)
        result.macd_hist   = _last(hist)
    except Exception:
        pass

    # Stochastic
    try:
        if h is not None and l is not None:
            pct_k, pct_d = stoch(h, l, c, 14, 3, 3)
            result.stoch_k = _last(pct_k)
            result.stoch_d = _last(pct_d)
    except Exception:
        pass

    # ATR
    try:
        if h is not None and l is not None:
            atr_s = atr(h, l, c, ATR_PERIOD)
            result.atr = _last(atr_s)
    except Exception:
        pass

    # Bollinger Bands
    try:
        bb_u, bb_m, bb_l = bbands(c, 20, 2.0)
        result.bb_upper  = _last(bb_u)
        result.bb_middle = _last(bb_m)
        result.bb_lower  = _last(bb_l)
    except Exception:
        pass

    # Human-readable reads
    result.rsi_read   = _rsi_read(result.rsi)
    result.macd_read  = _macd_read(result.macd, result.macd_signal)
    result.stoch_read = _stoch_read(result.stoch_k, result.stoch_d)
    result.atr_read   = _atr_read(result.atr, _last(c), ATR_STOP_MULTIPLIER)
    result.adx_read   = _adx_read(adx_val)

    return result


def _last(s: pd.Series) -> float | None:
    v = s.dropna()
    if v.empty:
        return None
    val = float(v.iloc[-1])
    return None if np.isnan(val) else val


def _rsi_read(rsi: float | None) -> str:
    if rsi is None:
        return "Insufficient data"
    if rsi >= 70:
        return f"Overbought ({rsi:.1f}) — momentum strong but watch for reversal"
    if rsi <= 30:
        return f"Oversold ({rsi:.1f}) — potential bounce but trend may be weak"
    if rsi >= 50:
        return f"Bullish ({rsi:.1f}) — above midline, upward bias"
    return f"Bearish ({rsi:.1f}) — below midline, downward bias"


def _macd_read(macd: float | None, signal: float | None) -> str:
    if macd is None or signal is None:
        return "Insufficient data"
    hist = macd - signal
    if macd > 0 and hist > 0:
        return f"Bullish — MACD above zero and above signal ({macd:.3f} vs {signal:.3f})"
    if macd > 0 and hist < 0:
        return f"Weakening — MACD above zero but crossed below signal ({macd:.3f} vs {signal:.3f})"
    if macd < 0 and hist < 0:
        return f"Bearish — MACD below zero and below signal ({macd:.3f} vs {signal:.3f})"
    return f"Recovering — MACD below zero but crossed above signal ({macd:.3f} vs {signal:.3f})"


def _stoch_read(k: float | None, d: float | None) -> str:
    if k is None:
        return "Insufficient data"
    if k >= 80:
        direction = "momentum still strong" if (d is not None and k > d) else "watch for rollover"
        return f"Overbought zone (K={k:.1f}) — {direction}"
    if k <= 20:
        direction = "potential reversal forming" if (d is not None and k > d) else "still under pressure"
        return f"Oversold zone (K={k:.1f}) — {direction}"
    if d is not None and k > d:
        return f"Bullish crossover (K={k:.1f} > D={d:.1f})"
    return f"Neutral (K={k:.1f})"


def _atr_read(atr: float | None, price: float | None, mult: float) -> str:
    if atr is None or price is None:
        return "Insufficient data"
    stop = price - mult * atr
    pct  = (mult * atr / price) * 100
    return f"ATR={atr:.2f}; suggested stop at {stop:.2f} ({pct:.1f}% below current price)"


def _adx_read(adx: float) -> str:
    if adx >= 40:
        return f"Strong trend (ADX={adx:.1f}) — trend is well-established"
    if adx >= 25:
        return f"Trending (ADX={adx:.1f}) — directional bias present"
    if adx >= 20:
        return f"Weakly trending (ADX={adx:.1f}) — trend developing"
    return f"Choppy / ranging (ADX={adx:.1f}) — low directional conviction"
