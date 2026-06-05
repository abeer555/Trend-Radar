"""
Composite Momentum Score — weighted combination of all signal scores.

Each sub-score must already be normalised to 0-100 before calling here.
The weights come from config.SIGNAL_WEIGHTS.

Returns:
  - composite_score : float 0-100
  - top_factors     : list of top-3 contributing factors with their
                      weighted contribution (for the detail view)
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class CompositeResult:
    composite_score: float
    top_factors: list[dict]   # [{factor, raw_score, weight, contribution}]
    breakdown: dict[str, float]  # all factor contributions


def compute_composite(
    rs_score:          float,
    momentum_12_1_score: float,
    trend_template_score: float,
    vcp_score:         float,
    mansfield_score:   float,
    high_proximity_score: float,
    fip_score:         float,
    risk_adj_score:    float,
    volume_score:      float,
    adx_score:         float,
) -> CompositeResult:
    """
    All input scores must be in [0, 100].
    Returns the weighted composite score and attribution breakdown.
    """
    from app.config import SIGNAL_WEIGHTS

    scores = {
        "rs_rank":                rs_score,
        "momentum_12_1":          momentum_12_1_score,
        "trend_template":         trend_template_score,
        "vcp":                    vcp_score,
        "mansfield_stage2":       mansfield_score,
        "high_proximity":         high_proximity_score,
        "frog_in_pan":            fip_score,
        "risk_adjusted_momentum": risk_adj_score,
        "volume_surge":           volume_score,
        "adx":                    adx_score,
    }

    FACTOR_LABELS = {
        "rs_rank":                "Relative Strength Rank",
        "momentum_12_1":          "12-1 Momentum",
        "trend_template":         "Minervini Trend Template",
        "vcp":                    "Volatility Contraction Pattern",
        "mansfield_stage2":       "Mansfield Stage 2",
        "high_proximity":         "52-week High Proximity",
        "frog_in_pan":            "Frog-in-Pan (Path Smoothness)",
        "risk_adjusted_momentum": "Risk-Adjusted Momentum",
        "volume_surge":           "Volume Surge / Pocket Pivot",
        "adx":                    "ADX Trend Strength",
    }

    breakdown = {}
    total = 0.0
    for key, weight in SIGNAL_WEIGHTS.items():
        raw   = float(scores.get(key, 0.0))
        contrib = weight * raw
        breakdown[key] = round(contrib, 4)
        total += contrib

    composite = round(min(max(total, 0.0), 100.0), 2)

    # Top-3 contributors (by weighted contribution)
    sorted_factors = sorted(breakdown.items(), key=lambda x: x[1], reverse=True)
    top_factors = [
        {
            "factor":       FACTOR_LABELS.get(k, k),
            "key":          k,
            "raw_score":    round(float(scores.get(k, 0.0)), 2),
            "weight":       round(SIGNAL_WEIGHTS.get(k, 0.0), 4),
            "contribution": round(v, 4),
        }
        for k, v in sorted_factors[:3]
    ]

    return CompositeResult(
        composite_score = composite,
        top_factors     = top_factors,
        breakdown       = {FACTOR_LABELS.get(k, k): round(v, 4) for k, v in breakdown.items()},
    )
