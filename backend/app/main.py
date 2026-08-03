"""
FastAPI application entry point.

Startup behaviour
-----------------
1. Create the SQLite schema if missing.
2. Recover any orphaned `running` scan_log rows (they belong to a previous
   process that closed mid-scan — e.g. when the laptop lid was shut).
3. Start the daily market-close scheduler (unless DISABLE_SCHEDULER=1).
4. If AUTO_SCAN_ON_STARTUP is enabled (default) and data is missing or stale
   (older than STALE_SCAN_MAX_AGE_HOURS), kick off a full scan in the
   background so the dashboard has fresh data by the time you open it.
"""

from __future__ import annotations

import logging
import threading
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import (
    AUTO_SCAN_ON_STARTUP,
    CORS_ORIGINS,
    STALE_SCAN_MAX_AGE_HOURS,
)
from app.api.routes import router
from app.database import (
    get_engine,
    latest_completed_scan_age_hours,
    recover_stale_running_scans,
)
from app.scheduler import start_scheduler, stop_scheduler

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
log = logging.getLogger(__name__)


def _auto_scan_if_stale() -> None:
    """
    Runs in a background thread at startup.

    This is what powers the "run the backend on my laptop for 5 minutes"
    workflow: the moment the server boots, if the data in SQLite is missing or
    older than the staleness threshold, we start a full scan automatically —
    no manual `curl -X POST /api/scan` required.
    """
    if not AUTO_SCAN_ON_STARTUP:
        log.info("AUTO_SCAN_ON_STARTUP disabled — not scanning automatically.")
        return

    age = latest_completed_scan_age_hours(get_engine())
    if age is None:
        log.info("No completed scan found — starting initial scan in background.")
    elif age > STALE_SCAN_MAX_AGE_HOURS:
        log.info(
            "Data is %.1f h old (threshold %d h) — starting fresh scan in background.",
            age, STALE_SCAN_MAX_AGE_HOURS,
        )
    else:
        log.info("Data is fresh (%.1f h old) — skipping auto-scan.", age)
        return

    try:
        # Import here so module load doesn't pull the whole scanner chain in.
        from app.scanner import run_full_scan
        run_full_scan()
    except Exception:
        log.exception("Auto-scan failed")


@asynccontextmanager
async def lifespan(app: FastAPI):
    engine = get_engine()

    # Any `running` row still in the DB must belong to a dead process.
    recovered = recover_stale_running_scans(engine)
    if recovered:
        log.warning("Marked %d orphaned scan_log row(s) as failed.", recovered)

    start_scheduler()

    if AUTO_SCAN_ON_STARTUP:
        # Thread (not asyncio task): run_full_scan is blocking (yfinance, pandas).
        threading.Thread(target=_auto_scan_if_stale, name="auto-scan", daemon=True).start()

    yield

    stop_scheduler()


app = FastAPI(
    title="TrendRadar — Momentum Dashboard",
    description=(
        "Rule-based swing-trading momentum screener. "
        "Educational tool only — NOT investment advice. "
        "Past performance does not predict future results."
    ),
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}
