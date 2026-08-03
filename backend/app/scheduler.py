"""
APScheduler-based daily scan scheduler.

The scan runs once per day after market close:
  - Nifty 500: ~15:30 IST = 10:00 UTC
  - S&P 500:   ~16:00 ET  = 21:00 UTC
Adjust SCHEDULER_HOUR_UTC / SCHEDULER_MINUTE_UTC in config.py.
"""

from __future__ import annotations

import logging

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

log = logging.getLogger(__name__)
_scheduler: BackgroundScheduler | None = None


def start_scheduler() -> None:
    global _scheduler
    if _scheduler is not None and _scheduler.running:
        return

    from app.config import (
        DISABLE_SCHEDULER,
        SCHEDULER_HOUR_UTC,
        SCHEDULER_MINUTE_UTC,
        SCHEDULER_TIMEZONE,
    )

    if DISABLE_SCHEDULER:
        log.info("Scheduler disabled via DISABLE_SCHEDULER env var.")
        return

    try:
        _scheduler = BackgroundScheduler(timezone=SCHEDULER_TIMEZONE)
        _scheduler.add_job(
            _run_scan_job,
            trigger=CronTrigger(
                hour=SCHEDULER_HOUR_UTC,
                minute=SCHEDULER_MINUTE_UTC,
                timezone=SCHEDULER_TIMEZONE,
            ),
            id="daily_scan",
            replace_existing=True,
            misfire_grace_time=3600,  # run even if server was down for up to 1 hour
        )
        _scheduler.start()
        log.info(
            "Scheduler started — daily scan at %02d:%02d UTC",
            SCHEDULER_HOUR_UTC,
            SCHEDULER_MINUTE_UTC,
        )
    except Exception as exc:
        # Never let a scheduler failure prevent the API from booting.
        log.exception("Failed to start scheduler: %s", exc)
        _scheduler = None


def stop_scheduler() -> None:
    global _scheduler
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
        log.info("Scheduler stopped.")


def _run_scan_job() -> None:
    """Wrapper that catches all exceptions so the scheduler doesn't die."""
    from app.scanner import run_full_scan
    try:
        log.info("Daily scan triggered by scheduler.")
        result = run_full_scan()
        log.info("Daily scan done: %s", result)
    except Exception as exc:
        log.exception("Daily scan failed: %s", exc)
