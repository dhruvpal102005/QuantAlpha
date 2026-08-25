"""
QuantAlpha Market Data Ingestion Engine
Fetches, cleans, and caches real historical market data for Indian Equities (NSE).

REAL DATA ONLY: Raises ResearchDataUnavailable whenever a verified market data source is unavailable.
"""

import os
import warnings
import yfinance as yf
import pandas as pd
from datetime import datetime
from typing import Dict, List, Optional

from research_mode import ResearchDataUnavailable

CACHE_DIR = os.path.join(os.path.dirname(__file__), "cache")
os.makedirs(CACHE_DIR, exist_ok=True)

UNIVERSE_TICKERS = {
    "NIFTY 50": "^NSEI",
    "NIFTY BANK": "^NSEBANK",
    "NIFTY IT": "^CNXIT",
    "NIFTY AUTO": "^CNXAUTO",
    "RELIANCE": "RELIANCE.NS",
    "HDFCBANK": "HDFCBANK.NS",
    "TCS": "TCS.NS",
    "INFY": "INFY.NS",
    "ICICIBANK": "ICICIBANK.NS",
    "LT": "LT.NS",
}

# Multi-stock universe for cross-sectional IC computation
NIFTY50_CROSS_SECTION = [
    "RELIANCE.NS", "TCS.NS", "HDFCBANK.NS", "INFY.NS", "ICICIBANK.NS",
    "LT.NS", "KOTAKBANK.NS", "HINDUNILVR.NS", "SBIN.NS", "BHARTIARTL.NS",
    "ASIANPAINT.NS", "AXISBANK.NS", "MARUTI.NS", "SUNPHARMA.NS", "TITAN.NS",
]


def fetch_historical_ohlcv(
    ticker: str,
    start_date: str = "2015-01-01",
    end_date: Optional[str] = None,
) -> pd.DataFrame:
    """
    Fetches real OHLCV data from Yahoo Finance with local caching.

    Raises ResearchDataUnavailable when a real market data source cannot provide data.

    Returns
    -------
    pd.DataFrame with columns [Open, High, Low, Close, Volume].
    Frame attribute '_synthetic' is True only if synthetic data was returned.
    """
    if end_date is None:
        end_date = datetime.now().strftime("%Y-%m-%d")

    clean_symbol = ticker.replace("^", "").replace(".", "_")
    cache_path = os.path.join(CACHE_DIR, f"{clean_symbol}_{start_date}_{end_date}.csv")

    # Try cache first
    if os.path.exists(cache_path):
        try:
            df = pd.read_csv(cache_path, index_col=0, parse_dates=True)
            if not df.empty:
                df.attrs["_synthetic"] = False
                return df
        except Exception:
            pass

    # Try yfinance
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            data = yf.download(
                ticker,
                start=start_date,
                end=end_date,
                progress=False,
                auto_adjust=True,
            )
        if not data.empty:
            if isinstance(data.columns, pd.MultiIndex):
                data.columns = data.columns.get_level_values(0)
            data.to_csv(cache_path)
            data.attrs["_synthetic"] = False
            return data
    except Exception as e:
        raise ResearchDataUnavailable(
            f"Real market data unavailable for '{ticker}': {e}"
        ) from e

    raise ResearchDataUnavailable(
        f"Real market data unavailable for '{ticker}' for {start_date} to {end_date}"
    )


def fetch_cross_section(
    tickers: List[str],
    start_date: str = "2019-01-01",
    end_date: Optional[str] = None,
    min_stocks: int = 5,
) -> pd.DataFrame:
    """
    Fetch Close prices for multiple stocks into a date × stock DataFrame.
    Used for cross-sectional IC computation.

    RESEARCH MODE: Raises if fewer than min_stocks have real data.

    Returns
    -------
    pd.DataFrame indexed by date, columns = tickers. Cells are Close prices.
    """
    if end_date is None:
        end_date = datetime.now().strftime("%Y-%m-%d")

    price_dict: Dict[str, pd.Series] = {}
    failed: List[str] = []

    for ticker in tickers:
        try:
            df = fetch_historical_ohlcv(ticker, start_date, end_date)
            if df.attrs.get("_synthetic"):
                failed.append(ticker)
            else:
                price_dict[ticker] = df["Close"]
        except ResearchDataUnavailable:
            failed.append(ticker)
        except Exception:
            failed.append(ticker)

    if is_research_mode() and len(price_dict) < min_stocks:
        raise ResearchDataUnavailable(
            f"RESEARCH MODE: Only {len(price_dict)} of {len(tickers)} tickers had real "
            f"data (need >= {min_stocks}). Failed: {failed[:5]}"
        )

    combined = pd.DataFrame(price_dict)
    combined = combined.dropna(how="all")
    return combined


def get_universe_returns(
    universe: List[str],
    start_date: str = "2015-01-01",
    end_date: Optional[str] = None,
) -> pd.DataFrame:
    """
    Returns a DataFrame of daily closing prices for selected universe tickers.
    """
    price_dict: Dict[str, pd.Series] = {}
    for name in universe:
        ticker = UNIVERSE_TICKERS.get(name, f"{name}.NS")
        df = fetch_historical_ohlcv(ticker, start_date, end_date)
        if "Close" in df.columns:
            price_dict[name] = df["Close"]

    combined = pd.DataFrame(price_dict).dropna()
    return combined
