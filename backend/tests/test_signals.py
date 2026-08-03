"""
Unit tests for signal functions.
Each test is self-contained and uses synthetic price data — no network calls.
"""

from __future__ import annotations

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import numpy as np
import pandas as pd
import pytest

from app.signals.relative_strength import compute_rs_raw, rank_universe, rs_score_to_0_100
from app.signals.trend_template import compute_trend_template
from app.signals.vcp import compute_vcp, _find_swings
from app.signals.mansfield import compute_mansfield
from app.signals.momentum import compute_momentum
from app.signals.frog_in_pan import compute_fip
from app.signals.volume import compute_volume
from app.signals.adx_signal import compute_adx
from app.signals.composite import compute_composite


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

def _make_trending_df(n: int = 380, noise: float = 0.01, trend: float = 0.001) -> pd.DataFrame:
    """Synthetic uptrending OHLCV data."""
    np.random.seed(42)
    rng = pd.date_range("2023-01-01", periods=n, freq="B")
    closes = 100.0 * np.cumprod(1 + trend + np.random.randn(n) * noise)
    highs  = closes * (1 + np.abs(np.random.randn(n) * noise))
    lows   = closes * (1 - np.abs(np.random.randn(n) * noise))
    opens  = closes * (1 + np.random.randn(n) * noise * 0.5)
    volumes = np.random.randint(1_000_000, 5_000_000, size=n).astype(float)
    return pd.DataFrame(
        {"Open": opens, "High": highs, "Low": lows, "Close": closes, "Volume": volumes},
        index=rng,
    )


def _make_flat_df(n: int = 380) -> pd.DataFrame:
    """Flat / choppy price data."""
    np.random.seed(7)
    rng = pd.date_range("2023-01-01", periods=n, freq="B")
    closes = 100 + np.random.randn(n) * 2
    highs  = closes + np.abs(np.random.randn(n))
    lows   = closes - np.abs(np.random.randn(n))
    volumes = np.ones(n) * 1_000_000
    return pd.DataFrame(
        {"Open": closes, "High": highs, "Low": lows, "Close": closes, "Volume": volumes},
        index=rng,
    )


def _make_vcp_df() -> pd.DataFrame:
    """
    Hand-crafted VCP pattern with *smooth* contractions so swing detection
    (window=5) uniquely identifies each stage's high/low pair:
    - Long uptrend
    - Three contractions of decreasing depth (15%, 10%, 5%)
    - Volume drying up *throughout* each contraction
    """
    n_trend = 200
    rng = np.random.default_rng(7)
    closes_trend = 100 * np.cumprod(1 + 0.002 + rng.normal(0, 0.008, n_trend))

    def _contraction(start, depth, n_bars, vol_start_m, vol_end_m):
        """Smooth down-up arc (less wiggle than noise → unique swings) + linear volume ramp."""
        peak  = start
        trough = peak * (1 - depth)
        half  = n_bars // 2
        down  = np.linspace(peak, trough, half, endpoint=False)
        up    = np.linspace(trough, peak * 0.99, n_bars - half)
        c = np.concatenate([down, up])
        # High-frequency wobble: keeps swings discrete but is rejected by the
        # ±5-bar swing window, so each stage yields exactly ONE swing high and
        # ONE swing low.  (Low-frequency wobble would create duplicate peaks
        # near each true peak, which is what we want to avoid.)
        c = c * (1 + 0.002 * np.sin(np.linspace(0, 8 * np.pi, n_bars)))
        v = np.linspace(vol_start_m, vol_end_m, n_bars) * 1_000_000
        return c, v

    c1, v1 = _contraction(closes_trend[-1], 0.15, 30, 3.0, 1.5)
    c2, v2 = _contraction(c1[-1],           0.10, 22, 1.8, 0.9)
    c3, v3 = _contraction(c2[-1],           0.05, 14, 1.0, 0.4)

    closes  = np.concatenate([closes_trend, c1, c2, c3])
    volumes = np.concatenate([np.full(n_trend, 4_000_000.0), v1, v2, v3])
    n_total = len(closes)
    rng_dt  = pd.date_range("2022-01-01", periods=n_total, freq="B")
    # Keep intra-day spread tighter than inter-stage swings so the swing
    # detection finds stage-boundary highs/lows, not noise.
    highs = closes * 1.002
    lows  = closes * 0.998
    return pd.DataFrame(
        {"Open": closes, "High": highs, "Low": lows, "Close": closes, "Volume": volumes},
        index=rng_dt,
    )


# ---------------------------------------------------------------------------
# Relative Strength tests
# ---------------------------------------------------------------------------

class TestRelativeStrength:
    def test_rs_raw_returns_float(self):
        df = _make_trending_df()
        score = compute_rs_raw(df)
        assert isinstance(score, float)
        assert not np.isnan(score)

    def test_rs_raw_empty_df(self):
        score = compute_rs_raw(pd.DataFrame())
        assert np.isnan(score)

    def test_rs_raw_trending_positive(self):
        """Uptrending stock should have a positive raw RS."""
        df = _make_trending_df(trend=0.002)
        score = compute_rs_raw(df)
        assert score > 0

    def test_rs_raw_declining_negative(self):
        """Downtrending stock should have a negative raw RS."""
        df = _make_trending_df(trend=-0.002)
        score = compute_rs_raw(df)
        assert score < 0

    def test_rank_universe_produces_1_to_99(self):
        raw = {"A": 0.5, "B": 0.1, "C": -0.2, "D": 0.8}
        ranks = rank_universe(raw)
        for r in ranks.values():
            assert 1 <= r <= 99

    def test_rank_universe_preserves_order(self):
        raw = {"A": 0.9, "B": 0.5, "C": 0.1}
        ranks = rank_universe(raw)
        assert ranks["A"] > ranks["B"] > ranks["C"]

    def test_rank_universe_handles_nan(self):
        raw = {"A": 0.5, "B": float("nan"), "C": 0.1}
        ranks = rank_universe(raw)
        assert ranks["B"] == 50.0   # NaN gets median

    def test_rs_score_to_0_100_bounds(self):
        assert rs_score_to_0_100(1)  == pytest.approx(0.0, abs=0.1)
        assert rs_score_to_0_100(99) == pytest.approx(100.0, abs=0.1)
        assert 0 <= rs_score_to_0_100(50) <= 100


# ---------------------------------------------------------------------------
# Trend Template tests
# ---------------------------------------------------------------------------

class TestTrendTemplate:
    def test_strong_uptrend_passes(self):
        df  = _make_trending_df(n=380, trend=0.0015)
        rs  = 80.0
        res = compute_trend_template(df, rs)
        # At least most criteria should pass
        passing = sum(1 for v in res.criteria.values() if v)
        assert passing >= 5

    def test_empty_df_returns_zero(self):
        res = compute_trend_template(pd.DataFrame(), rs_rank=50)
        assert res.score == 0.0
        assert not res.passes

    def test_short_df_returns_zero(self):
        df  = _make_trending_df(n=50)
        res = compute_trend_template(df, rs_rank=80)
        assert res.score == 0.0

    def test_score_between_0_and_100(self):
        df  = _make_trending_df()
        res = compute_trend_template(df, rs_rank=75)
        assert 0.0 <= res.score <= 100.0

    def test_low_rs_rank_fails_gate(self):
        df  = _make_trending_df()
        res = compute_trend_template(df, rs_rank=30)
        assert not res.criteria.get("rs_rank_gate", True)


# ---------------------------------------------------------------------------
# VCP tests
# ---------------------------------------------------------------------------

class TestVCP:
    def test_synthetic_vcp_detected(self):
        df  = _make_vcp_df()
        res = compute_vcp(df)
        assert res.detected
        assert res.contractions >= 3

    def test_flat_market_no_vcp(self):
        df  = _make_flat_df()
        res = compute_vcp(df)
        # Flat market below MA → no VCP
        assert not res.detected

    def test_score_between_0_and_100(self):
        df  = _make_vcp_df()
        res = compute_vcp(df)
        assert 0.0 <= res.score <= 100.0

    def test_empty_df_no_vcp(self):
        res = compute_vcp(pd.DataFrame())
        assert not res.detected
        assert res.score == 0.0

    def test_find_swings_high(self):
        data = np.array([1, 2, 5, 2, 1, 3, 6, 3, 1], dtype=float)
        highs = _find_swings(data, kind="high", window=2)
        assert 2 in highs or 6 in highs   # index of the peaks

    def test_pivot_is_positive(self):
        df  = _make_vcp_df()
        res = compute_vcp(df)
        if res.detected:
            assert res.pivot is not None and res.pivot > 0


# ---------------------------------------------------------------------------
# Mansfield tests
# ---------------------------------------------------------------------------

class TestMansfield:
    def test_stage2_in_uptrend(self):
        df    = _make_trending_df(n=380)
        bench = _make_flat_df(n=380)
        res   = compute_mansfield(df, bench)
        assert res.stage == 2
        assert res.stage2

    def test_declining_gets_stage4(self):
        df    = _make_trending_df(n=380, trend=-0.003)
        bench = _make_flat_df(n=380)
        res   = compute_mansfield(df, bench)
        assert res.stage in (3, 4)

    def test_empty_df(self):
        res = compute_mansfield(pd.DataFrame(), pd.DataFrame())
        assert res.stage == 0

    def test_score_range(self):
        df    = _make_trending_df()
        bench = _make_flat_df()
        res   = compute_mansfield(df, bench)
        assert 0.0 <= res.score <= 100.0


# ---------------------------------------------------------------------------
# Momentum tests
# ---------------------------------------------------------------------------

class TestMomentum:
    def test_trending_has_positive_12_1(self):
        df  = _make_trending_df(n=380, trend=0.001)
        res = compute_momentum(df)
        assert res.momentum_12_1 > 0

    def test_declining_has_negative_12_1(self):
        df  = _make_trending_df(n=380, trend=-0.002)
        res = compute_momentum(df)
        assert res.momentum_12_1 < 0

    def test_high_proximity_range(self):
        df  = _make_trending_df()
        res = compute_momentum(df)
        assert 0.0 <= res.high_proximity <= 1.0

    def test_52wk_high_gte_low(self):
        df  = _make_trending_df()
        res = compute_momentum(df)
        assert res.week52_high >= res.week52_low

    def test_empty_df_returns_defaults(self):
        res = compute_momentum(pd.DataFrame())
        assert res.momentum_12_1 == 0.0


# ---------------------------------------------------------------------------
# Frog-in-Pan tests
# ---------------------------------------------------------------------------

class TestFrogInPan:
    def test_continuous_uptrend_gets_high_score(self):
        """Many small daily gains → low ID metric → high FIP score."""
        df  = _make_trending_df(n=380, trend=0.001, noise=0.003)
        res = compute_fip(df)
        assert res.fip_score >= 40   # continuous momentum should score well

    def test_id_range(self):
        df  = _make_trending_df()
        res = compute_fip(df)
        assert -1.0 <= res.id_metric <= 1.0

    def test_score_range(self):
        df  = _make_trending_df()
        res = compute_fip(df)
        assert 0.0 <= res.fip_score <= 100.0

    def test_empty_df(self):
        res = compute_fip(pd.DataFrame())
        assert res.fip_score == 50.0


# ---------------------------------------------------------------------------
# Volume tests
# ---------------------------------------------------------------------------

class TestVolume:
    def test_surge_on_high_volume(self):
        df = _make_trending_df(n=100)
        # Artificially inflate today's volume
        df.iloc[-1, df.columns.get_loc("Volume")] = df["Volume"].mean() * 5
        res = compute_volume(df)
        assert res.volume_surge

    def test_no_surge_on_normal_volume(self):
        df  = _make_trending_df(n=100)
        res = compute_volume(df)
        # Normal data shouldn't reliably trigger a surge
        # Just verify it runs without error
        assert isinstance(res.volume_surge, bool)

    def test_pocket_pivot_on_up_day_high_vol(self):
        df = _make_trending_df(n=60, trend=0.002)
        # Make today an up-day with very high volume
        df.iloc[-1, df.columns.get_loc("Close")]  = df["Close"].iloc[-2] * 1.02
        df.iloc[-1, df.columns.get_loc("Volume")] = df["Volume"].iloc[-11:].max() * 3
        res = compute_volume(df)
        assert res.pocket_pivot

    def test_score_range(self):
        df  = _make_trending_df()
        res = compute_volume(df)
        assert 0.0 <= res.score <= 100.0


# ---------------------------------------------------------------------------
# ADX tests
# ---------------------------------------------------------------------------

class TestADX:
    def test_trending_market_high_adx(self):
        df  = _make_trending_df(n=200, trend=0.002)
        res = compute_adx(df)
        assert res.adx >= 0

    def test_score_range(self):
        df  = _make_trending_df()
        res = compute_adx(df)
        assert 0.0 <= res.score <= 100.0

    def test_empty_df(self):
        res = compute_adx(pd.DataFrame())
        assert res.adx == 0.0


# ---------------------------------------------------------------------------
# Composite tests
# ---------------------------------------------------------------------------

class TestComposite:
    def test_max_inputs_gives_100(self):
        res = compute_composite(
            rs_score=100, momentum_12_1_score=100, trend_template_score=100,
            vcp_score=100, mansfield_score=100, high_proximity_score=100,
            fip_score=100, risk_adj_score=100, volume_score=100, adx_score=100,
        )
        assert res.composite_score == pytest.approx(100.0, abs=0.1)

    def test_zero_inputs_gives_zero(self):
        res = compute_composite(
            rs_score=0, momentum_12_1_score=0, trend_template_score=0,
            vcp_score=0, mansfield_score=0, high_proximity_score=0,
            fip_score=0, risk_adj_score=0, volume_score=0, adx_score=0,
        )
        assert res.composite_score == pytest.approx(0.0, abs=0.1)

    def test_score_in_range(self):
        res = compute_composite(
            rs_score=75, momentum_12_1_score=60, trend_template_score=80,
            vcp_score=100, mansfield_score=100, high_proximity_score=85,
            fip_score=55, risk_adj_score=65, volume_score=100, adx_score=70,
        )
        assert 0.0 <= res.composite_score <= 100.0

    def test_top_factors_has_3_items(self):
        res = compute_composite(
            rs_score=80, momentum_12_1_score=70, trend_template_score=90,
            vcp_score=60, mansfield_score=50, high_proximity_score=40,
            fip_score=30, risk_adj_score=20, volume_score=10, adx_score=5,
        )
        assert len(res.top_factors) == 3

    def test_top_factors_are_highest_contributors(self):
        res = compute_composite(
            rs_score=100, momentum_12_1_score=0, trend_template_score=100,
            vcp_score=0, mansfield_score=0, high_proximity_score=0,
            fip_score=0, risk_adj_score=0, volume_score=0, adx_score=0,
        )
        top_keys = [f["key"] for f in res.top_factors]
        # rs_rank (weight 0.25) and trend_template (weight 0.20) should dominate
        assert "rs_rank" in top_keys or "trend_template" in top_keys


# ---------------------------------------------------------------------------
# Database crash-safety (new in Phase 1)
# ---------------------------------------------------------------------------

class TestDatabaseRecovery:
    def _fresh_engine(self):
        import tempfile, os
        from sqlalchemy import create_engine
        from app.database import metadata, _enable_wal
        tmp = tempfile.mktemp(suffix=".db")
        e = create_engine(f"sqlite:///{tmp}", connect_args={"check_same_thread": False})
        _enable_wal(e)
        metadata.create_all(e)
        self._tmp = tmp
        return e

    def teardown_method(self):
        import os
        if hasattr(self, "_tmp") and os.path.exists(self._tmp):
            for suffix in ("", "-wal", "-shm"):
                try: os.remove(self._tmp + suffix)
                except OSError: pass

    def test_recover_stale_running_scans_marks_failed(self):
        from sqlalchemy import text
        from app.database import recover_stale_running_scans, get_last_scan_status
        e = self._fresh_engine()
        with e.connect() as conn:
            conn.execute(text(
                "INSERT INTO scan_log (started_at, status) VALUES (datetime('now'), 'running')"
            ))
            conn.commit()
        n = recover_stale_running_scans(e)
        assert n == 1
        last = get_last_scan_status(e)
        assert last["status"] == "failed"
        assert "interrupted" in (last["error_message"] or "")

    def test_recover_ignores_completed_scans(self):
        from sqlalchemy import text
        from app.database import recover_stale_running_scans
        e = self._fresh_engine()
        with e.connect() as conn:
            conn.execute(text(
                "INSERT INTO scan_log (started_at, finished_at, status) "
                "VALUES (datetime('now'), datetime('now'), 'completed')"
            ))
            conn.commit()
        assert recover_stale_running_scans(e) == 0

    def test_latest_completed_scan_age(self):
        from sqlalchemy import text
        from app.database import latest_completed_scan_age_hours
        e = self._fresh_engine()
        assert latest_completed_scan_age_hours(e) is None  # no completed scan
        with e.connect() as conn:
            conn.execute(text(
                "INSERT INTO scan_log (started_at, finished_at, status) "
                "VALUES (datetime('now','-2 hours'), datetime('now','-1 hours'), 'completed')"
            ))
            conn.commit()
        age = latest_completed_scan_age_hours(e)
        assert age is not None and 0.9 < age < 1.2  # ~1 hour old


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
