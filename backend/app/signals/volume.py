"""
Volume-based signals:
  - Volume surge: today's volume ≥ N× the 20-day average.
  - Pocket pivot: Gil Morales / Chris Kacher.
      An up-day where volume exceeds the highest volume recorded on any
      DOWN day in the prior 10 trading sessions.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from dataclasses import dataclass


@dataclass
class VolumeResult:
    volume_surge:  bool
    pocket_pivot:  bool
    vol_ratio:     float   # today's vol / 20-day avg
    score:         float   # 0-100


def compute_volume(df: pd.DataFrame) -> VolumeResult:
    """
    Parameters
    ----------
    df : OHLCV DataFrame with columns Close/Volume, date-indexed.
    """
    from app.config import VOLUME_LOOKBACK_DOWN_DAYS, VOLUME_SURGE_MULTIPLIER

    _null = VolumeResult(volume_surge=False, pocket_pivot=False, vol_ratio=1.0, score=0.0)

    if df is None or df.empty:
        return _null
    if "Volume" not in df.columns or "Close" not in df.columns:
        return _null

    closes  = df["Close"].dropna()
    volumes = df["Volume"].dropna()
    if len(volumes) < 21:
        return _null

    today_vol    = float(volumes.iloc[-1])
    avg_20d_vol  = float(volumes.iloc[-21:-1].mean())
    if avg_20d_vol == 0:
        return _null

    vol_ratio = today_vol / avg_20d_vol

    # Volume surge
    volume_surge = vol_ratio >= VOLUME_SURGE_MULTIPLIER

    # Pocket pivot
    pocket_pivot = False
    if len(closes) >= VOLUME_LOOKBACK_DOWN_DAYS + 1 and len(volumes) >= VOLUME_LOOKBACK_DOWN_DAYS + 1:
        # Today is an up-day if close > prior close
        today_is_up = float(closes.iloc[-1]) > float(closes.iloc[-2])
        if today_is_up:
            # Highest volume on a down-day in the prior 10 sessions (excluding today)
            lookback_c = closes.iloc[-(VOLUME_LOOKBACK_DOWN_DAYS + 1):-1]
            lookback_v = volumes.iloc[-(VOLUME_LOOKBACK_DOWN_DAYS + 1):-1]
            # Position-based boolean indexing (avoids the fragile `.values`
            # alignment gnarliness and makes the NaN-at-position-0 from
            # `.diff()` explicit instead of relying on `NaN < 0 → False`).
            daily_diff = lookback_c.diff()
            down_mask  = daily_diff.notna() & (daily_diff < 0)
            down_vols  = lookback_v[down_mask]
            if len(down_vols) > 0:
                max_down_vol = float(down_vols.max())
                pocket_pivot = today_vol > max_down_vol

    # Score
    if pocket_pivot:
        score = 100.0
    elif volume_surge:
        score = float(np.clip((vol_ratio - 1.0) / 2.0 * 100, 50, 100))
    else:
        score = float(np.clip((vol_ratio - 0.5) / 1.0 * 50, 0, 50))

    return VolumeResult(
        volume_surge = volume_surge,
        pocket_pivot = pocket_pivot,
        vol_ratio    = round(vol_ratio, 3),
        score        = round(score, 2),
    )
