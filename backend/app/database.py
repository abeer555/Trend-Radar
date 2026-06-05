"""
SQLite database — schema definition, session management, and helpers.

All access goes through the SQLAlchemy engine returned by get_engine().
Raw table objects are used directly (no ORM models) to keep things simple and
allow easy inspection from sqlite3 CLI.
"""

from __future__ import annotations

import json
import os
from datetime import date, datetime
from pathlib import Path
from typing import Any

import pandas as pd
from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Float,
    Integer,
    MetaData,
    String,
    Table,
    Text,
    create_engine,
    inspect,
    text,
)
from sqlalchemy.engine import Engine

_engine: Engine | None = None


def get_engine() -> Engine:
    global _engine
    if _engine is None:
        from app.config import SQLITE_DB_PATH
        db_path = Path(SQLITE_DB_PATH)
        db_path.parent.mkdir(parents=True, exist_ok=True)
        _engine = create_engine(
            f"sqlite:///{db_path}",
            # 30s busy-timeout so concurrent writers wait instead of erroring;
            # check_same_thread=False lets the background scan thread share it.
            connect_args={"check_same_thread": False, "timeout": 30},
        )
        _enable_wal(_engine)
        _ensure_schema(_engine)
    return _engine


# ---------------------------------------------------------------------------
# Schema
# ---------------------------------------------------------------------------

metadata = MetaData()

daily_prices = Table(
    "daily_prices",
    metadata,
    Column("ticker",  String, primary_key=True),
    Column("date",    Date,   primary_key=True),
    Column("open",    Float),
    Column("high",    Float),
    Column("low",     Float),
    Column("close",   Float),
    Column("volume",  Float),
)

scan_results = Table(
    "scan_results",
    metadata,
    Column("id",              Integer, primary_key=True, autoincrement=True),
    Column("ticker",          String,  nullable=False),
    Column("scan_date",       Date,    nullable=False),
    Column("name",            String),
    Column("sector",          String),
    Column("industry",        String),
    # Price info
    Column("last_price",      Float),
    Column("pct_change_1d",   Float),
    Column("week52_high",     Float),
    Column("week52_low",      Float),
    # Scores  (0-100 normalised)
    Column("composite_score",         Float),
    Column("rs_rank",                 Float),   # 1-99
    Column("rs_score",                Float),   # normalised 0-100
    Column("momentum_12_1",           Float),   # raw return
    Column("momentum_12_1_score",     Float),
    Column("trend_template_score",    Float),
    Column("trend_template_pass",     Boolean),
    Column("vcp_detected",            Boolean),
    Column("vcp_contractions",        Integer),
    Column("vcp_pivot",               Float),
    Column("vcp_score",               Float),
    Column("mansfield_stage2",        Boolean),
    Column("mansfield_rs",            Float),
    Column("mansfield_score",         Float),
    Column("high_proximity",          Float),   # 0-1
    Column("high_proximity_score",    Float),
    Column("frog_in_pan",             Float),   # ID metric
    Column("frog_in_pan_score",       Float),
    Column("risk_adj_momentum",       Float),   # Sharpe-like
    Column("risk_adj_score",          Float),
    Column("volume_surge",            Boolean),
    Column("pocket_pivot",            Boolean),
    Column("volume_score",            Float),
    Column("adx",                     Float),
    Column("adx_score",               Float),
    # Technicals
    Column("rsi",             Float),
    Column("macd",            Float),
    Column("macd_signal",     Float),
    Column("stoch_k",         Float),
    Column("stoch_d",         Float),
    Column("atr",             Float),
    Column("bb_upper",        Float),
    Column("bb_lower",        Float),
    Column("ma50",            Float),
    Column("ma150",           Float),
    Column("ma200",           Float),
    # Fundamentals
    Column("pe_ratio",        Float),
    Column("pb_ratio",        Float),
    Column("ev_ebitda",       Float),
    Column("revenue_growth",  Float),
    Column("earnings_growth", Float),
    Column("debt_equity",     Float),
    Column("roe",             Float),
    Column("gross_margin",    Float),
    Column("market_cap",      Float),
    # Risk
    Column("beta",            Float),
    Column("volatility",      Float),
    Column("max_drawdown",    Float),
    Column("sharpe",          Float),
    Column("suggested_stop",  Float),
    Column("risk_label",      String),   # Low / Medium / High
    # Sparkline — JSON array of 30 closing prices
    Column("sparkline_json",  Text),
    # Top contributing factors — JSON list of {factor, score, weight}
    Column("top_factors_json", Text),
)

fundamentals_cache = Table(
    "fundamentals_cache",
    metadata,
    Column("ticker",         String, primary_key=True),
    Column("last_updated",   DateTime),
    Column("name",           String),
    Column("sector",         String),
    Column("industry",       String),
    Column("pe_ratio",       Float),
    Column("pb_ratio",       Float),
    Column("ev_ebitda",      Float),
    Column("revenue_growth", Float),
    Column("earnings_growth",Float),
    Column("debt_equity",    Float),
    Column("roe",            Float),
    Column("gross_margin",   Float),
    Column("market_cap",     Float),
    Column("beta",           Float),
)

scan_log = Table(
    "scan_log",
    metadata,
    Column("id",            Integer, primary_key=True, autoincrement=True),
    Column("started_at",    DateTime),
    Column("finished_at",   DateTime),
    Column("tickers_scanned", Integer),
    Column("status",        String),   # running / completed / failed
    Column("error_message", Text),
)


def _enable_wal(engine: Engine) -> None:
    """WAL mode lets readers and a writer coexist without locking the whole DB."""
    with engine.connect() as conn:
        conn.execute(text("PRAGMA journal_mode=WAL"))
        conn.execute(text("PRAGMA busy_timeout=30000"))
        conn.commit()


def _ensure_schema(engine: Engine) -> None:
    metadata.create_all(engine)
    # Add a unique constraint on (ticker, scan_date) via index if missing
    with engine.connect() as conn:
        conn.execute(text(
            "CREATE UNIQUE INDEX IF NOT EXISTS uq_scan_ticker_date "
            "ON scan_results (ticker, scan_date)"
        ))
        conn.commit()


# ---------------------------------------------------------------------------
# Price helpers
# ---------------------------------------------------------------------------

def upsert_prices(ticker: str, df: pd.DataFrame, engine: Engine) -> None:
    """Insert or replace OHLCV rows for a given ticker."""
    if df.empty:
        return
    records = []
    for dt, row in df.iterrows():
        records.append({
            "ticker": ticker,
            "date":   dt.date() if hasattr(dt, "date") else dt,
            "open":   float(row.get("Open", 0) or 0),
            "high":   float(row.get("High", 0) or 0),
            "low":    float(row.get("Low", 0) or 0),
            "close":  float(row.get("Close", 0) or 0),
            "volume": float(row.get("Volume", 0) or 0),
        })
    with engine.connect() as conn:
        # SQLite REPLACE INTO handles upsert
        conn.execute(
            text(
                "INSERT OR REPLACE INTO daily_prices "
                "(ticker, date, open, high, low, close, volume) "
                "VALUES (:ticker, :date, :open, :high, :low, :close, :volume)"
            ),
            records,
        )
        conn.commit()


def load_prices(ticker: str, engine: Engine, days: int = 380) -> pd.DataFrame:
    """Load the most recent `days` rows for a ticker as a DataFrame."""
    with engine.connect() as conn:
        result = conn.execute(
            text(
                "SELECT date, open, high, low, close, volume "
                "FROM daily_prices "
                "WHERE ticker = :t "
                "ORDER BY date DESC LIMIT :n"
            ),
            {"t": ticker, "n": days},
        )
        rows = result.fetchall()
    if not rows:
        return pd.DataFrame()
    df = pd.DataFrame(rows, columns=["date", "Open", "High", "Low", "Close", "Volume"])
    df["date"] = pd.to_datetime(df["date"])
    df = df.set_index("date").sort_index()
    return df


def latest_price_date(ticker: str, engine: Engine) -> date | None:
    with engine.connect() as conn:
        row = conn.execute(
            text("SELECT MAX(date) FROM daily_prices WHERE ticker = :t"),
            {"t": ticker},
        ).fetchone()
    val = row[0] if row else None
    if val is None:
        return None
    return date.fromisoformat(val) if isinstance(val, str) else val


# ---------------------------------------------------------------------------
# Scan-result helpers
# ---------------------------------------------------------------------------

def upsert_scan_result(record: dict[str, Any], engine: Engine) -> None:
    cols = ", ".join(record.keys())
    placeholders = ", ".join(f":{k}" for k in record.keys())
    with engine.connect() as conn:
        conn.execute(
            text(
                f"INSERT OR REPLACE INTO scan_results ({cols}) "
                f"VALUES ({placeholders})"
            ),
            record,
        )
        conn.commit()


def load_leaderboard(
    engine: Engine,
    scan_date: date | None = None,
    sector: str | None = None,
    min_price: float | None = None,
    min_rs: float | None = None,
    trend_template: bool | None = None,
    vcp: bool | None = None,
    sort_by: str = "composite_score",
    descending: bool = True,
    limit: int = 100,
) -> list[dict]:
    allowed_sort = {
        "composite_score", "rs_rank", "momentum_12_1", "last_price",
        "pct_change_1d", "adx", "atr", "volatility", "trend_template_score",
    }
    if sort_by not in allowed_sort:
        sort_by = "composite_score"

    where_clauses = ["scan_date = :scan_date"]
    params: dict[str, Any] = {}

    if scan_date is None:
        with engine.connect() as conn:
            row = conn.execute(text("SELECT MAX(scan_date) FROM scan_results")).fetchone()
        scan_date = row[0] if row and row[0] else date.today()
    params["scan_date"] = scan_date

    if sector:
        where_clauses.append("sector = :sector")
        params["sector"] = sector
    if min_price is not None:
        where_clauses.append("last_price >= :min_price")
        params["min_price"] = min_price
    if min_rs is not None:
        where_clauses.append("rs_rank >= :min_rs")
        params["min_rs"] = min_rs
    if trend_template is True:
        where_clauses.append("trend_template_pass = 1")
    if vcp is True:
        where_clauses.append("vcp_detected = 1")

    order = "DESC" if descending else "ASC"
    sql = (
        f"SELECT * FROM scan_results "
        f"WHERE {' AND '.join(where_clauses)} "
        f"ORDER BY {sort_by} {order} "
        f"LIMIT {int(limit)}"
    )
    with engine.connect() as conn:
        rows = conn.execute(text(sql), params).mappings().fetchall()
    return [dict(r) for r in rows]


def load_scan_result(ticker: str, engine: Engine, scan_date: date | None = None) -> dict | None:
    if scan_date is None:
        with engine.connect() as conn:
            row = conn.execute(text("SELECT MAX(scan_date) FROM scan_results")).fetchone()
        scan_date = row[0] if row and row[0] else date.today()
    with engine.connect() as conn:
        row = conn.execute(
            text("SELECT * FROM scan_results WHERE ticker = :t AND scan_date = :d"),
            {"t": ticker, "d": scan_date},
        ).mappings().fetchone()
    return dict(row) if row else None


def get_sectors(engine: Engine) -> list[str]:
    with engine.connect() as conn:
        rows = conn.execute(
            text("SELECT DISTINCT sector FROM scan_results WHERE sector IS NOT NULL ORDER BY sector")
        ).fetchall()
    return [r[0] for r in rows if r[0]]


def log_scan_start(engine: Engine) -> int:
    with engine.connect() as conn:
        result = conn.execute(
            text(
                "INSERT INTO scan_log (started_at, status) "
                "VALUES (:ts, 'running')"
            ),
            {"ts": datetime.utcnow()},
        )
        conn.commit()
        return result.lastrowid


def log_scan_end(log_id: int, tickers: int, status: str, error: str | None, engine: Engine) -> None:
    with engine.connect() as conn:
        conn.execute(
            text(
                "UPDATE scan_log SET finished_at=:ts, tickers_scanned=:n, "
                "status=:s, error_message=:e WHERE id=:id"
            ),
            {"ts": datetime.utcnow(), "n": tickers, "s": status, "e": error, "id": log_id},
        )
        conn.commit()


def get_last_scan_status(engine: Engine) -> dict | None:
    with engine.connect() as conn:
        row = conn.execute(
            text("SELECT * FROM scan_log ORDER BY id DESC LIMIT 1")
        ).mappings().fetchone()
    return dict(row) if row else None
