"""
Pure pandas/numpy implementations of all technical indicators.
No external TA library required — every formula is explicit and auditable.

Note: Wilder-style smoothing (RSI, ADX, ATR) is implemented with
`ewm(alpha=1/n, adjust=False)`, which converges to true Wilder smoothing
exponentially but differs slightly in the first ~n outputs.  That's a well-
understood approximation; for scoring purposes the difference vanishes
within a few bars past the warm-up period.
"""

from __future__ import annotations

import numpy as np
import pandas as pd


def rsi(close: pd.Series, length: int = 14) -> pd.Series:
    """Wilder's RSI."""
    delta = close.diff()
    gain  = delta.clip(lower=0)
    loss  = -delta.clip(upper=0)
    avg_gain = gain.ewm(alpha=1 / length, min_periods=length, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1 / length, min_periods=length, adjust=False).mean()
    rs = avg_gain / (avg_loss + 1e-12)
    return 100 - (100 / (1 + rs))


def macd(
    close: pd.Series,
    fast: int = 12,
    slow: int = 26,
    signal: int = 9,
) -> tuple[pd.Series, pd.Series, pd.Series]:
    """Returns (macd_line, signal_line, histogram)."""
    ema_fast   = close.ewm(span=fast,   adjust=False).mean()
    ema_slow   = close.ewm(span=slow,   adjust=False).mean()
    macd_line  = ema_fast - ema_slow
    signal_line = macd_line.ewm(span=signal, adjust=False).mean()
    histogram   = macd_line - signal_line
    return macd_line, signal_line, histogram


def atr(high: pd.Series, low: pd.Series, close: pd.Series, length: int = 14) -> pd.Series:
    """Average True Range."""
    prev_close = close.shift(1)
    tr = pd.concat([
        high - low,
        (high - prev_close).abs(),
        (low  - prev_close).abs(),
    ], axis=1).max(axis=1)
    return tr.ewm(alpha=1 / length, min_periods=length, adjust=False).mean()


def stoch(
    high: pd.Series,
    low:  pd.Series,
    close: pd.Series,
    k: int = 14,
    d: int = 3,
    smooth_k: int = 3,
) -> tuple[pd.Series, pd.Series]:
    """Stochastic oscillator — returns (%K, %D)."""
    lo_k  = low.rolling(k).min()
    hi_k  = high.rolling(k).max()
    raw_k = 100 * (close - lo_k) / (hi_k - lo_k + 1e-12)
    pct_k = raw_k.rolling(smooth_k).mean()
    pct_d = pct_k.rolling(d).mean()
    return pct_k, pct_d


def bbands(
    close: pd.Series,
    length: int = 20,
    std: float = 2.0,
) -> tuple[pd.Series, pd.Series, pd.Series]:
    """Bollinger Bands — returns (upper, middle, lower)."""
    mid   = close.rolling(length).mean()
    sigma = close.rolling(length).std()
    return mid + std * sigma, mid, mid - std * sigma


def adx(
    high: pd.Series,
    low:  pd.Series,
    close: pd.Series,
    length: int = 14,
) -> pd.Series:
    """Average Directional Index."""
    prev_high  = high.shift(1)
    prev_low   = low.shift(1)
    prev_close = close.shift(1)

    tr = pd.concat([
        high - low,
        (high - prev_close).abs(),
        (low  - prev_close).abs(),
    ], axis=1).max(axis=1)

    plus_dm  = np.where((high - prev_high) > (prev_low - low), np.maximum(high - prev_high, 0), 0)
    minus_dm = np.where((prev_low - low) > (high - prev_high), np.maximum(prev_low - low, 0), 0)

    plus_dm_s  = pd.Series(plus_dm,  index=close.index).ewm(alpha=1/length, min_periods=length, adjust=False).mean()
    minus_dm_s = pd.Series(minus_dm, index=close.index).ewm(alpha=1/length, min_periods=length, adjust=False).mean()
    tr_s       = tr.ewm(alpha=1/length, min_periods=length, adjust=False).mean()

    plus_di  = 100 * plus_dm_s  / (tr_s + 1e-12)
    minus_di = 100 * minus_dm_s / (tr_s + 1e-12)
    dx       = 100 * (plus_di - minus_di).abs() / (plus_di + minus_di + 1e-12)
    adx_val  = dx.ewm(alpha=1/length, min_periods=length, adjust=False).mean()
    return adx_val
