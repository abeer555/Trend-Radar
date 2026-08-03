"""
Static snapshot exporter.

After a full scan completes this writes the entire dataset as plain JSON into
``STATIC_EXPORT_DIR`` (default ``frontend/public/data/``):

    leaderboard.json        full unfiltered ranking (same shape as GET /api/leaderboard)
    sectors.json            same shape as GET /api/sectors
    status.json             scan status minus server_time (shape of GET /api/scan/status)
    stocks/index.json       list of tickers that have a per-stock payload
    stocks/<TICKER>.json    {"stock": <GET /api/stock/t>, "chart": <GET /api/stock/t/chart>}

The frontend serves these files same-origin (``/data/...``) and falls back to
them when the backend API is unreachable — so the site keeps working after the
backend has been run even once.  Chart payloads dominate the size (~50-70 MB
total for a Nifty 500 universe); the export happens once per scan.

Best-effort by contract: the caller (scanner) wraps this in try/except, so a
failed export can never fail an otherwise good scan.
"""

from __future__ import annotations

import json
import logging
import os
from datetime import date, datetime
from pathlib import Path
from typing import Any

from app.config import STATIC_EXPORT_DIR
from app.database import get_sectors

log = logging.getLogger(__name__)

_REPO_ROOT = Path(__file__).resolve().parents[2]


class _SafeEncoder(json.JSONEncoder):
    """Scan rows contain date/datetime objects and the occasional NaN/inf."""

    def default(self, o: Any):  # noqa: D102
        if isinstance(o, (datetime, date)):
            return o.isoformat()
        try:
            import numpy as np
            if isinstance(o, np.generic):
                return o.item()
        except ImportError:
            pass
        return super().default(o)


def sanitize_ticker(ticker: str) -> str:
    """Filesystem-safe ticker → filename stem ('RELIANCE.NS' → 'RELIANCE_NS')."""
    return ticker.replace(".", "_").replace("/", "_").replace("^", "_")


def _write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, cls=_SafeEncoder, allow_nan=False,
                  separators=(",", ":"))
    os.replace(tmp, path)


def _clear_dir(dirpath: Path) -> None:
    if not dirpath.exists():
        return
    for f in dirpath.iterdir():
        if f.is_file():
            try:
                f.unlink()
            except OSError:
                pass


def export_static_snapshot(engine) -> None:
    """
    Write the static snapshot described above.  No-op when STATIC_EXPORT_DIR
    is empty.  Raises on unrecoverable errors — the caller swallows them.
    """
    if not STATIC_EXPORT_DIR:
        log.info("Static export disabled (STATIC_EXPORT_DIR is empty).")
        return

    out_dir = Path(STATIC_EXPORT_DIR)
    if not out_dir.is_absolute():
        out_dir = _REPO_ROOT / out_dir

    # Imported here (not at module top) to avoid a circular import:
    # api.routes -> (nothing at import time) ; exporter -> api.routes builders.
    from app.api.routes import (
        build_chart_payload,
        build_leaderboard_payload,
        build_status_payload,
        build_stock_payload,
    )
    from app.database import get_last_completed_scan

    # Only export from completed scans — never from a failed state.
    if get_last_completed_scan(engine) is None:
        log.info("No completed scan in scan_log; skipping static export.")
        return

    log.info("Exporting static snapshot to %s", out_dir)

    # Leaderboard: full unfiltered list so the frontend can filter/sort offline.
    leaderboard = build_leaderboard_payload(engine, limit=500)
    _write_json(out_dir / "leaderboard.json", leaderboard)

    _write_json(out_dir / "sectors.json", get_sectors(engine))

    # Static status: no server_time; the frontend recomputes data_age_hours and
    # is_stale from last_completed_at at read time.
    status = build_status_payload(engine, is_running=False)
    status["exported_at"] = datetime.utcnow().isoformat() + "Z"
    _write_json(out_dir / "status.json", status)

    # Per-stock payloads (detail + chart) — the bulk of the export.
    stocks_dir = out_dir / "stocks"
    _clear_dir(stocks_dir)

    exported: list[str] = []
    for row in leaderboard:
        ticker = row.get("ticker")
        if not ticker:
            continue
        try:
            stock = build_stock_payload(ticker, engine)
            if stock is None:
                continue
            try:
                chart = build_chart_payload(ticker, days=365)
            except Exception:
                log.warning("Chart export failed for %s", ticker, exc_info=True)
                chart = None
            _write_json(stocks_dir / f"{sanitize_ticker(ticker)}.json",
                        {"stock": stock, "chart": chart})
            exported.append(ticker)
        except Exception:
            log.warning("Stock export failed for %s", ticker, exc_info=True)

    _write_json(stocks_dir / "index.json", sorted(exported))

    log.info("Static snapshot exported: %d leaderboard rows, %d stock files.",
             len(leaderboard), len(exported))
