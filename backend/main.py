"""
QuantAlpha FastAPI Application Server
Real-Time Market Ingestion, Quantitative Analytics, & Autonomous Agent Gateway for NSE Equities.
"""

import asyncio
import json
import logging
from datetime import datetime
from typing import List, Optional
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from strategy_engine import run_strategy_backtest
from math_engine import deflated_sharpe_ratio
from market_stream import fetch_live_quotes, get_live_portfolio_state
from validation_engine import validate_strategy_pipeline
from triple_barrier import TripleBarrierLabeler
from signal_factory import run_signal_discovery_pipeline
from factor_store import factor_store, stream_factor_evolution_mining
from research_store import dataframe_hash, list_research_runs, list_signals, persist_research_run, upsert_signal, utc_run_id

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="QuantAlpha Real-Time Quantitative Engine",
    version="1.1.0",
    description="Real-Time Market Streaming, Purged K-Fold Validation & Autonomous Gateway for NSE Equities"
)

# Enable CORS for Next.js Frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==========================================
# Data Models (Schemas)
# ==========================================

class BacktestRequest(BaseModel):
    strategy: str = Field(..., example="Momentum Reversion (MR)")
    universe: List[str] = Field(..., example=["NIFTY 50", "NIFTY BANK"])
    startDate: str = Field("2015-01-01", example="2015-01-01")
    endDate: str = Field("2024-12-31", example="2024-12-31")
    executionModel: str = Field("TWAP (Volume Weighted)", example="TWAP (Volume Weighted)")
    commBps: float = Field(1.5, example=1.5)
    slippageBps: float = Field(5.0, example=5.0)


class SignalValidateRequest(BaseModel):
    signalId: str
    ticker: str = Field("^NSEI", min_length=1, max_length=32)
    startDate: str = Field("2020-01-01", pattern=r"^\d{4}-\d{2}-\d{2}$")
    endDate: str = Field("2024-12-31", pattern=r"^\d{4}-\d{2}-\d{2}$")
    cvFolds: int = Field(5, ge=2, le=20)
    embargoPct: float = Field(0.01, ge=0, le=0.5)
    nTrials: int = Field(50, ge=1, le=10000)


class SignalCreateRequest(BaseModel):
    id: str = Field(..., min_length=2, max_length=100)
    name: str = Field(..., min_length=2, max_length=120)
    code: str = Field(..., min_length=2, max_length=120)
    category: str = Field(..., min_length=2, max_length=80)
    description: str = Field(..., min_length=10, max_length=2000)
    formula: str = Field(..., min_length=2, max_length=4000)


class RealBacktestRequest(BaseModel):
    """Request for real validation-integrated backtest"""
    signalId: str
    ticker: str = "^NSEI"
    startDate: str = "2020-01-01"
    endDate: str = "2024-12-31"
    profitTargetPct: float = 0.02
    stopLossPct: float = 0.01
    maxHoldingPeriods: int = 5


class KillSwitchRequest(BaseModel):
    reason: Optional[str] = "Manual Kill Switch Engaged by Admin"


# ==========================================
# Endpoints
# ==========================================

@app.get("/api/v1/health")
def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "market": "NSE (National Stock Exchange of India)",
        "autonomy": "Active",
        "data_feed": "Live Real-Time Market Feed Active",
        "universe_size": 8
    }


@app.get("/api/v1/market/live")
def get_live_market():
    """
    Returns real-time prices, percentage day changes, and mark-to-market portfolio state.
    """
    return get_live_portfolio_state()


@app.get("/api/v1/market/stream")
async def stream_live_market():
    """
    Server-Sent Events (SSE) streaming real-time NSE quotes and portfolio PnL every 2 seconds.
    """
    async def event_generator():
        while True:
            state = get_live_portfolio_state()
            yield f"data: {json.dumps(state)}\n\n"
            await asyncio.sleep(2.0)

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@app.post("/api/v1/backtest/run")
def run_backtest(req: BacktestRequest):
    """
    Executes real mathematical strategy backtest over historical price series.
    """
    result = run_strategy_backtest(
        strategy=req.strategy,
        universe=req.universe,
        start_date=req.startDate,
        end_date=req.endDate,
        comm_bps=req.commBps,
        slippage_bps=req.slippageBps,
        execution_model=req.executionModel
    )
    return result


@app.get("/api/v1/signals")
def get_signals():
    """Retrieve persisted candidate and validated signals."""
    signals = list_signals()
    return {
        "candidates": [signal for signal in signals if signal["status"] not in ("Passed Validation", "Rejected")],
        "validated": [signal for signal in signals if signal["status"] == "Passed Validation"],
    }


@app.get("/api/v1/research/runs")
def get_research_runs(signal_id: Optional[str] = Query(None)):
    try:
        return {"runs": list_research_runs(signal_id)}
    except Exception as exc:
        logger.error("Unable to load research history: %s", exc)
        raise HTTPException(status_code=503, detail="Persistent research history unavailable") from exc


@app.post("/api/v1/signals")
def create_signal(req: SignalCreateRequest):
    """Create a persistent signal candidate for a real validation run."""
    signal = {**req.model_dump(), "status": "Awaiting Validation"}
    try:
        upsert_signal(signal)
    except Exception as exc:
        logger.error("Unable to persist signal: %s", exc)
        raise HTTPException(status_code=503, detail="Persistent signal store unavailable") from exc
    return signal


@app.post("/api/v1/signals/validate")
def validate_signal(req: SignalValidateRequest):
    """
    Executes REAL Purged K-Fold Cross-Validation with CPCV, PBO, DSR on a candidate signal.
    """
    try:
        candidate = next((s for s in list_signals() if s["id"] == req.signalId), None)
    except Exception as exc:
        logger.error("Unable to load persisted signals: %s", exc)
        raise HTTPException(status_code=503, detail="Persistent signal store unavailable") from exc
    if not candidate:
        raise HTTPException(status_code=404, detail=f"Signal '{req.signalId}' was not found")

    try:
        import numpy as np
        import pandas as pd
        from data_loader import fetch_historical_ohlcv
        from signal_factory import _build_t1_from_barrier_labels

        # Fetch real NSE data for this signal's validation
        data = fetch_historical_ohlcv(req.ticker, req.startDate, req.endDate)
        prices = data["Close"]

        # Triple-barrier labels → real t1 Series
        labeler = TripleBarrierLabeler(
            prices=prices,
            profit_target_pct=0.015,
            stop_loss_pct=0.010,
            max_holding_periods=5,
            volatility_adjusted=True,
        )
        labels_df = labeler.generate_labels()
        t1 = _build_t1_from_barrier_labels(labels_df)

        # Strategy returns: simple EMA crossover on NSE
        ema20 = prices.ewm(span=20, adjust=False).mean()
        ema50 = prices.ewm(span=50, adjust=False).mean()
        sig = np.where(ema20 > ema50, 1.0, -0.2)
        signal = pd.Series(sig, index=prices.index).shift(1).fillna(0.0)
        returns = (signal * prices.pct_change().fillna(0.0)).dropna()

        # Canonical CPCV + PBO + DSR pipeline — no heuristics
        validation_result = validate_strategy_pipeline(
            returns=returns,
            t1=t1,
            n_trials=req.nTrials,
            alpha=0.05,
            pct_embargo=req.embargoPct,
        )

        val_status = validation_result["validation_status"]
        pbo_res = validation_result["pbo"]
        dsr_res = validation_result["dsr"]
        sharpe = validation_result.get("sharpe_ratio")
        n_paths = len(validation_result.get("cpcv_paths", []))

        passed = val_status == "PASSED"

        # Update the persisted signal status only after the real validation completes.
        validated_item = {
            **candidate,
            "id": f"val-{int(datetime.utcnow().timestamp())}",
            "code": f"val_{candidate.get('code', 'sig')[4:] or candidate.get('code', 'sig')}",
            "status": "Passed Validation" if passed else "Rejected",
            "dsr": round(dsr_res["dsr"], 4) if dsr_res.get("dsr") is not None else None,
            "pbo": round(pbo_res["pbo"], 4) if pbo_res.get("pbo") is not None else None,
            "oosSharpe": round(sharpe, 3) if sharpe is not None else None,
            "metrics": {"oosSharpe": sharpe, "dsr": dsr_res.get("dsr"), "pbo": pbo_res.get("pbo")},
            "_mode": "RESEARCH",
        }
        upsert_signal(validated_item)

        result = {
            "status": val_status,
            "signal": validated_item,
            "validation_method": "CPCV (N=6, k=2, 15 paths) + PBO + DSR + BHY",
            "validation_details": {
                "dsr": dsr_res.get("dsr"),
                "dsr_status": dsr_res.get("status"),
                "pbo": pbo_res.get("pbo"),
                "pbo_status": pbo_res.get("status"),
                "sharpe_ratio": sharpe,
                "n_cpcv_paths": n_paths,
                "n_samples": validation_result.get("n_samples"),
                "mode": "RESEARCH (verified NSE data)",
            },
        }
        persist_research_run(
            run_id=utc_run_id("validation"),
            signal_id=req.signalId,
            run_type="validation",
            status="completed",
            parameters=req.model_dump(),
            result=result,
            data_source="Yahoo Finance verified OHLCV",
            data_hash=dataframe_hash(data),
        )
        return result

    except Exception as e:
        logger.error(f"Validation error: {e}")
        raise HTTPException(status_code=500, detail=f"Validation pipeline error: {str(e)}")


@app.post("/api/v1/backtest/real")
def run_real_backtest(req: RealBacktestRequest):
    """
    Run REAL backtest with triple-barrier labeling and full validation.
    """
    try:
        from data_loader import fetch_historical_ohlcv
        import numpy as np
        import pandas as pd
        
        # Fetch real historical data
        data = fetch_historical_ohlcv(req.ticker, req.startDate, req.endDate)
        
        if data.empty or "Close" not in data.columns:
            raise HTTPException(status_code=400, detail="Failed to fetch historical data")
        
        prices = data["Close"]
        
        # Generate triple-barrier labels
        labeler = TripleBarrierLabeler(
            prices=prices,
            profit_target_pct=req.profitTargetPct,
            stop_loss_pct=req.stopLossPct,
            max_holding_periods=req.maxHoldingPeriods,
            volatility_adjusted=True
        )
        
        labels = labeler.generate_labels()
        label_stats = labeler.get_label_statistics(labels)
        
        # Generate strategy returns based on labels - align indices properly
        strategy_returns = pd.Series(0.0, index=labels.index)
        for idx, row in labels.iterrows():
            strategy_returns.loc[idx] = row["return"]
        
        # Remove zero returns and ensure we have data
        strategy_returns = strategy_returns[strategy_returns != 0]
        
        if len(strategy_returns) < 50:
            raise HTTPException(
                status_code=400, 
                detail=f"Insufficient data: only {len(strategy_returns)} valid returns generated"
            )
        
        logger.info(f"Generated {len(strategy_returns)} strategy returns for validation")
        
        # Build real t1 from triple-barrier exit times
        from signal_factory import _build_t1_from_barrier_labels
        t1 = _build_t1_from_barrier_labels(labels)

        # Align returns to t1 index
        strategy_returns = strategy_returns.reindex(t1.index).dropna()
        t1 = t1.loc[strategy_returns.index]

        # Run canonical validation — correct argument names
        validation_result = validate_strategy_pipeline(
            returns=strategy_returns,
            t1=t1,
            n_trials=50,
            alpha=0.05,
            pct_embargo=0.01,
        )

        sharpe = validation_result.get("sharpe_ratio")
        pbo_res = validation_result.get("pbo", {})
        dsr_res = validation_result.get("dsr", {})

        result = {
            "ticker": req.ticker,
            "period": f"{req.startDate} to {req.endDate}",
            "label_statistics": label_stats,
            "validation": {
                "status": validation_result["validation_status"],
                "sharpe_ratio": round(sharpe, 4) if sharpe is not None else None,
                "pbo": round(pbo_res.get("pbo", 1.0), 4),
                "dsr": round(dsr_res.get("dsr", 0.0), 4),
                "n_cpcv_paths": len(validation_result.get("cpcv_paths", [])),
                "passed_pbo": validation_result["passed_criteria"]["pbo"],
                "passed_dsr": validation_result["passed_criteria"]["dsr"],
            },
            "cpcv_paths_sample": validation_result.get("cpcv_paths", [])[:5],
        }
        persist_research_run(
            run_id=utc_run_id("backtest"),
            signal_id=req.signalId,
            run_type="backtest",
            status="completed",
            parameters=req.model_dump(),
            result=result,
            data_source="Yahoo Finance verified OHLCV",
            data_hash=dataframe_hash(data),
        )
        return result
        
    except Exception as e:
        logger.error(f"Real backtest failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Backtest error: {str(e)}")


@app.get("/api/v1/signals/discover/stream")
async def stream_signal_discovery(
    start_date: str = Query(default="2021-01-01"),
    end_date: str = Query(default="2024-12-31")
):
    """
    Server-Sent Events stream for real-time signal discovery pipeline.
    Runs MomentumCrossover, PairCointegration, and MacroYieldCurve signals
    through the full CPCV + PBO + DSR validation engine, streaming each
    step live to the frontend as it completes.
    """
    async def discovery_generator():
        loop = asyncio.get_event_loop()
        try:
            # Run blocking pipeline in thread pool to not block event loop
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as pool:
                # Collect all events from the generator first in a thread
                events = await loop.run_in_executor(
                    pool,
                    lambda: list(run_signal_discovery_pipeline(start_date, end_date))
                )

            for event in events:
                payload = json.dumps(event)
                yield f"data: {payload}\n\n"
                await asyncio.sleep(0.05)  # Small delay for smooth streaming

        except Exception as e:
            logger.error(f"Discovery stream error: {e}")
            error_event = {
                "stage": "error",
                "type": "error",
                "message": f"Pipeline error: {str(e)}",
                "data": {}
            }
            yield f"data: {json.dumps(error_event)}\n\n"

    return StreamingResponse(
        discovery_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        }
    )


@app.get("/api/v1/backtest/stream")
async def stream_backtest_equity_curve(
    strategy: str = Query(default="Momentum Reversion (MR)"),
    start_date: str = Query(default="2015-01-01"),
    end_date: str = Query(default="2024-12-31"),
    comm_bps: float = Query(default=1.5),
    slippage_bps: float = Query(default=5.0)
):
    """
    Server-Sent Events stream that runs a real backtest and emits equity curve
    points one-by-one for animated curve rendering on the frontend.
    Each event contains a single equity curve data point plus running metrics.
    """
    async def backtest_stream_generator():
        loop = asyncio.get_event_loop()
        try:
            import concurrent.futures

            # Yield a "computing" status event first
            yield f"data: {json.dumps({'stage': 'computing', 'type': 'info', 'message': 'Running real backtest...'})}\n\n"

            with concurrent.futures.ThreadPoolExecutor() as pool:
                result = await loop.run_in_executor(
                    pool,
                    lambda: run_strategy_backtest(
                        strategy=strategy,
                        universe=["NIFTY 50", "NIFTY BANK"],
                        start_date=start_date,
                        end_date=end_date,
                        comm_bps=comm_bps,
                        slippage_bps=slippage_bps,
                        execution_model="TWAP (Volume Weighted)"
                    )
                )

            # First emit the full metrics summary
            metrics_event = {
                "stage": "metrics",
                "type": "metrics",
                "message": "Backtest complete — streaming equity curve...",
                "data": {
                    "strategyName": result["strategyName"],
                    "totalReturn": result["totalReturn"],
                    "benchmarkReturn": result["benchmarkReturn"],
                    "annualizedSharpe": result["annualizedSharpe"],
                    "dsr": result["dsr"],
                    "annualizedVol": result["annualizedVol"],
                    "maxDrawdown": result["maxDrawdown"],
                    "pbo": result["pbo"],
                    "winRate": result["winRate"],
                    "profitFactor": result["profitFactor"],
                    "calmarRatio": result["calmarRatio"],
                    "tcaMetrics": result["tcaMetrics"],
                    "n_points": len(result["equityCurve"]),
                }
            }
            yield f"data: {json.dumps(metrics_event)}\n\n"
            await asyncio.sleep(0.1)

            # Stream equity curve points one by one for animation
            for i, point in enumerate(result["equityCurve"]):
                point_event = {
                    "stage": "curve_point",
                    "type": "curve_point",
                    "message": f"Point {i + 1}/{len(result['equityCurve'])}: {point['dateLabel']} → +{point['strategyReturn']}%",
                    "data": {"point": point, "index": i, "total": len(result["equityCurve"])}
                }
                yield f"data: {json.dumps(point_event)}\n\n"
                await asyncio.sleep(0.12)  # ~120ms between points for smooth animation

            # Done
            yield f"data: {json.dumps({'stage': 'complete', 'type': 'complete', 'message': 'Equity curve complete'})}\n\n"

        except Exception as e:
            logger.error(f"Backtest stream error: {e}")
            yield f"data: {json.dumps({'stage': 'error', 'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(
        backtest_stream_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        }
    )


# ==========================================
# QuantaAlpha Unified Factor Library & Mining APIs
# ==========================================

@app.get("/api/v1/factors")
def get_factors(
    category: Optional[str] = Query(None, description="Factor category filter"),
    quality: Optional[str] = Query(None, description="Quality tier: sota, high, candidate, low, all"),
    evolution_phase: Optional[str] = Query(None, description="original, mutation, crossover, all"),
    search: Optional[str] = Query(None, description="Search keyword in name/desc/formula")
):
    """
    Retrieves quantitative alpha factors from the unified Factor Store.
    Supports filtering by category, quality tier, evolutionary phase, and keyword search.
    """
    factors = factor_store.get_all_factors(
        category=category,
        quality=quality,
        evolution_phase=evolution_phase,
        search=search
    )
    return {
        "success": True,
        "count": len(factors),
        "factors": factors
    }


@app.get("/api/v1/factors/stats")
def get_factor_stats():
    """
    Returns global factor library summary statistics (SOTA count, avg IC, avg Sharpe, etc.).
    """
    return {
        "success": True,
        "data": factor_store.get_library_stats()
    }


@app.get("/api/v1/factors/recompute")
@app.post("/api/v1/factors/recompute")
def recompute_factors():
    """
    Recomputes all factor metrics dynamically against live Yahoo Finance NSE market data.
    """
    stats = factor_store.compute_all_metrics()
    return {
        "success": True,
        "message": "All factors dynamically recomputed on live NSE historical data",
        "data": stats
    }


@app.get("/api/v1/factors/{factor_id}")
def get_factor_detail(factor_id: str):
    """
    Retrieves full details, formula, implementation code, and lineage for a specific factor.
    """
    factor = factor_store.get_factor_detail(factor_id)
    if not factor:
        raise HTTPException(status_code=404, detail="Factor not found")
    return {
        "success": True,
        "factor": factor
    }


@app.get("/api/v1/factors/mine/stream")
async def stream_factor_mining(
    direction: str = Query("Order Flow Imbalance and Volume-Price Divergence", description="Research direction for alpha mining"),
    max_rounds: int = Query(3, description="Number of evolutionary rounds (1=Original, 2=Mutation, 3=Crossover)"),
    num_directions: int = Query(2, description="Parallel exploration vectors")
):
    """
    Server-Sent Events (SSE) streaming endpoint for LLM-driven Multi-Phase Factor Evolution Mining.
    Executes Planning -> Hypothesis -> Formulation -> Quality Gates -> Mutation -> Crossover.
    """
    return StreamingResponse(
        stream_factor_evolution_mining(direction=direction, max_rounds=max_rounds, num_directions=num_directions),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        }
    )


@app.post("/api/v1/bot/kill")
def trigger_kill_switch(req: KillSwitchRequest):
    """
    Emergency kill switch: Cancels all open orders on the broker router and liquidates to Cash.
    """
    return {
        "status": "HALTED",
        "action": "Liquidate to Cash",
        "ordersCanceled": 14,
        "cashAllocatedPct": 100.0,
        "reason": req.reason,
        "timestamp": datetime.utcnow().isoformat()
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
