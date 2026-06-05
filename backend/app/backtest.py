"""
Backtest stub — skeleton for honest future backtesting.

IMPORTANT WARNINGS — read before extending:

1. LOOKAHEAD BIAS: Every signal here must use only data available *before*
   the entry date.  Using today's close to decide whether to buy at today's
   open is a classic lookahead bug.  Always shift by at least 1 bar.

2. SURVIVORSHIP BIAS: The Nifty 500 / S&P 500 constituents *today* are NOT
   the same as the constituents *in the past*.  If you only test on current
   members you will exclude the companies that failed / were delisted, making
   results look far better than they were.  Maintain a point-in-time universe.

3. OVERFITTING: Every parameter (weights, thresholds, look-back windows) that
   you optimise on historical data loses out-of-sample validity.  Walk-forward
   validation and out-of-sample hold-out sets are mandatory.

4. TRANSACTION COSTS: Brokerage, STT (India), exchange fees, impact cost for
   less-liquid names, and slippage on entry/exit can erode 2-4 % per year in
   a high-turnover momentum strategy.  Always include realistic costs.

5. REGIME DEPENDENCY: Momentum works in trending markets and fails badly in
   mean-reverting / choppy regimes.  Test across multiple market cycles
   including bear markets (2008, 2020, 2022).

The endpoint currently returns a 501 Not Implemented response with the
metadata above so consumers are aware of the caveats before any real
backtest logic is added.
"""

from __future__ import annotations

from datetime import date
from typing import Any


BACKTEST_WARNINGS = [
    "Lookahead bias: all signals must use only data known before the entry bar.",
    "Survivorship bias: current index members ≠ historical members; use a point-in-time universe.",
    "Overfitting: parameters optimised in-sample are likely to underperform out-of-sample.",
    "Transaction costs: include realistic brokerage, taxes (STT for India), and slippage.",
    "Regime dependency: momentum strategies can experience severe drawdowns in choppy / bear markets.",
]


def backtest_stub(
    ticker: str,
    start_date: date,
    end_date: date,
    signal_config: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """
    Placeholder — returns metadata only.

    To implement real backtesting:
    1. Load historical price data for the *point-in-time* universe.
    2. For each rebalance date:
       a. Compute all signals using ONLY data up to (not including) that date.
       b. Rank and select top-N stocks.
       c. Simulate buy at next-bar open (not same-bar close).
    3. Track equity curve, drawdowns, turnover, and per-trade statistics.
    4. Validate on a hold-out period never seen during parameter selection.
    """
    return {
        "status":      "not_implemented",
        "message":     "Backtest endpoint is a stub. See backtest.py for implementation guidance.",
        "ticker":      ticker,
        "start_date":  str(start_date),
        "end_date":    str(end_date),
        "warnings":    BACKTEST_WARNINGS,
        "results":     None,
    }
