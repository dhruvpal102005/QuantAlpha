"""Persistent Neon storage for QuantAlpha research provenance and results."""

import json
import os
from datetime import datetime, timezone
from typing import Any, Optional



async def _insert_research_run(
    run_id: str,
    signal_id: str,
    run_type: str,
    status: str,
    parameters: dict[str, Any],
    result: Optional[dict[str, Any]],
    data_source: str,
    data_hash: Optional[str] = None,
    error: Optional[str] = None,
) -> None:
    import asyncpg

    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL is required for persistent research runs")

    conn = await asyncpg.connect(database_url)
    try:
        await conn.execute(
            """
            INSERT INTO quant_research_runs
              (id, signal_id, run_type, status, parameters, result, data_source, data_hash, error, completed_at)
            VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8, $9, CASE WHEN $4 IN ('completed', 'failed') THEN NOW() ELSE NULL END)
            ON CONFLICT (id) DO UPDATE SET
              status = EXCLUDED.status,
              result = EXCLUDED.result,
              data_source = EXCLUDED.data_source,
              data_hash = EXCLUDED.data_hash,
              error = EXCLUDED.error,
              completed_at = EXCLUDED.completed_at
            """,
            run_id,
            signal_id,
            run_type,
            status,
            json.dumps(parameters, default=str),
            json.dumps(result, default=str) if result is not None else None,
            data_source,
            data_hash,
            error,
        )
    finally:
        await conn.close()


def persist_research_run(
    run_id: str,
    signal_id: str,
    run_type: str,
    status: str,
    parameters: dict[str, Any],
    result: Optional[dict[str, Any]],
    data_source: str,
    data_hash: Optional[str] = None,
    error: Optional[str] = None,
) -> None:
    """Persist a run from a synchronous FastAPI endpoint."""
    import asyncio

    asyncio.run(_insert_research_run(run_id, signal_id, run_type, status, parameters, result, data_source, data_hash, error))


def utc_run_id(prefix: str) -> str:
    return f"{prefix}-{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')}"


def dataframe_hash(data: Any) -> str:
    """Return a stable hash for a pandas DataFrame without storing raw prices."""
    import hashlib

    return hashlib.sha256(data.to_csv().encode("utf-8")).hexdigest()


async def _list_signals() -> list[dict[str, Any]]:
    import asyncpg

    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL is required for persistent signals")
    conn = await asyncpg.connect(database_url)
    try:
        rows = await conn.fetch(
            "SELECT id, name, code, category, description, formula, status, created_at, updated_at FROM quant_signals WHERE user_id = $1 ORDER BY created_at DESC",
            "default",
        )
        return [dict(row) for row in rows]
    finally:
        await conn.close()


def list_signals() -> list[dict[str, Any]]:
    import asyncio

    return asyncio.run(_list_signals())


async def _upsert_signal(signal: dict[str, Any]) -> None:
    import asyncpg

    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL is required for persistent signals")
    conn = await asyncpg.connect(database_url)
    try:
        await conn.execute(
            """
            INSERT INTO quant_signals (id, name, code, category, description, formula, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, updated_at = NOW()
            """,
            signal["id"], signal["name"], signal["code"], signal["category"], signal["description"], signal["formula"], signal["status"],
        )
    finally:
        await conn.close()


def upsert_signal(signal: dict[str, Any]) -> None:
    import asyncio

    asyncio.run(_upsert_signal(signal))
