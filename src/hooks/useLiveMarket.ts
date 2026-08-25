"use client";

import { useState, useEffect, useRef } from "react";

export interface LiveQuote {
  symbol: string;
  ticker: string;
  price: number;
  prevClose: number;
  change: number;
  changePct: number;
  dayHigh: number;
  dayLow: number;
  volume: number;
  timestamp: string;
}

export interface LivePosition {
  symbol: string;
  qty: number;
  entryPrice: number;
  currentPrice: number;
  dayChange: number;
  dayChangePct: number;
  marketValue: number;
  unrealizedPnL: number;
  pnlPct: number;
  weightPct: number;
}

export interface LiveMarketState {
  isConnected: boolean;
  isLiveFeed: boolean;
  nav: number;
  cashBalance: number;
  investedCapital: number;
  dailyPnL: number;
  dailyPnLPct: number;
  openPositionsCount: number;
  positions: LivePosition[];
  quotes: Record<string, LiveQuote>;
  lastUpdate: string;
}

const DEFAULT_STATE: LiveMarketState = {
  isConnected: true,
  isLiveFeed: false,
  nav: 2486500.0,
  cashBalance: 524000.0,
  investedCapital: 1962500.0,
  dailyPnL: 18450.0,
  dailyPnLPct: 0.94,
  openPositionsCount: 4,
  lastUpdate: "15:30:00",
  quotes: {
    "NIFTY 50": {
      symbol: "NIFTY 50",
      ticker: "^NSEI",
      price: 24835.40,
      prevClose: 24710.20,
      change: 125.20,
      changePct: 0.51,
      dayHigh: 24890.0,
      dayLow: 24680.0,
      volume: 4820000,
      timestamp: "15:30:00",
    },
    "NIFTY BANK": {
      symbol: "NIFTY BANK",
      ticker: "^NSEBANK",
      price: 51240.80,
      prevClose: 50890.00,
      change: 350.80,
      changePct: 0.69,
      dayHigh: 51420.0,
      dayLow: 50820.0,
      volume: 3200000,
      timestamp: "15:30:00",
    },
    RELIANCE: {
      symbol: "RELIANCE",
      ticker: "RELIANCE.NS",
      price: 3012.40,
      prevClose: 2980.50,
      change: 31.90,
      changePct: 1.07,
      dayHigh: 3025.0,
      dayLow: 2975.0,
      volume: 1820000,
      timestamp: "15:30:00",
    },
    HDFCBANK: {
      symbol: "HDFCBANK",
      ticker: "HDFCBANK.NS",
      price: 1658.20,
      prevClose: 1640.20,
      change: 18.00,
      changePct: 1.10,
      dayHigh: 1665.0,
      dayLow: 1638.0,
      volume: 2450000,
      timestamp: "15:30:00",
    },
    TCS: {
      symbol: "TCS",
      ticker: "TCS.NS",
      price: 3985.00,
      prevClose: 3950.00,
      change: 35.00,
      changePct: 0.89,
      dayHigh: 4010.0,
      dayLow: 3940.0,
      volume: 980000,
      timestamp: "15:30:00",
    },
    ICICIBANK: {
      symbol: "ICICIBANK",
      ticker: "ICICIBANK.NS",
      price: 1228.60,
      prevClose: 1210.40,
      change: 18.20,
      changePct: 1.50,
      dayHigh: 1235.0,
      dayLow: 1205.0,
      volume: 1750000,
      timestamp: "15:30:00",
    },
  },
  positions: [
    {
      symbol: "RELIANCE",
      qty: 450,
      entryPrice: 2980.50,
      currentPrice: 3012.40,
      dayChange: 31.90,
      dayChangePct: 1.07,
      marketValue: 1355580.0,
      unrealizedPnL: 14355.0,
      pnlPct: 1.07,
      weightPct: 26.5,
    },
    {
      symbol: "HDFCBANK",
      qty: 800,
      entryPrice: 1640.20,
      currentPrice: 1658.20,
      dayChange: 18.00,
      dayChangePct: 1.10,
      marketValue: 1326560.0,
      unrealizedPnL: 14400.0,
      pnlPct: 1.10,
      weightPct: 24.2,
    },
    {
      symbol: "TCS",
      qty: 300,
      entryPrice: 3950.00,
      currentPrice: 3985.00,
      dayChange: 35.00,
      dayChangePct: 0.89,
      marketValue: 1195500.0,
      unrealizedPnL: 10500.0,
      pnlPct: 0.89,
      weightPct: 22.8,
    },
    {
      symbol: "ICICIBANK",
      qty: 650,
      entryPrice: 1210.40,
      currentPrice: 1228.60,
      dayChange: 18.20,
      dayChangePct: 1.50,
      marketValue: 798590.0,
      unrealizedPnL: 11830.0,
      pnlPct: 1.50,
      weightPct: 16.5,
    },
  ],
};

export interface TickDirection {
  [symbol: string]: "up" | "down" | "flat";
}

const EMPTY_STATE: LiveMarketState = {
  isConnected: false,
  isLiveFeed: false,
  nav: 0,
  cashBalance: 0,
  investedCapital: 0,
  dailyPnL: 0,
  dailyPnLPct: 0,
  openPositionsCount: 0,
  positions: [],
  quotes: {},
  lastUpdate: "Unavailable",
};

export function useLiveMarket() {
  const [state, setState] = useState<LiveMarketState>(EMPTY_STATE);
  const [tickDirection, setTickDirection] = useState<TickDirection>({});
  const [isClient, setIsClient] = useState(false);
  const prevPricesRef = useRef<Record<string, number>>({});

  // Prevent hydration mismatch by only showing live data after client mount
  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    let isMounted = true;
    let eventSource: EventSource | null = null;

    function applyUpdate(data: {
      nav: number; cashBalance: number; investedCapital: number;
      dailyPnL: number; dailyPnLPct: number; openPositionsCount: number;
      positions: LivePosition[]; quotes: Record<string, LiveQuote>; timestamp: string;
    }) {
      if (!isMounted) return;

      // Compute tick directions
      const newDirections: TickDirection = {};
      for (const [sym, q] of Object.entries(data.quotes)) {
        const prev = (prevPricesRef.current as Record<string, number>)[sym];
        if (prev !== undefined) {
          newDirections[sym] = q.price > prev ? "up" : q.price < prev ? "down" : "flat";
        } else {
          newDirections[sym] = "flat";
        }
        (prevPricesRef.current as Record<string, number>)[sym] = q.price;
      }
      setTickDirection(newDirections);

      setState({
        isConnected: true,
        isLiveFeed: true,
        nav: data.nav,
        cashBalance: data.cashBalance,
        investedCapital: data.investedCapital,
        dailyPnL: data.dailyPnL,
        dailyPnLPct: data.dailyPnLPct,
        openPositionsCount: data.openPositionsCount,
        positions: data.positions,
        quotes: data.quotes,
        lastUpdate: data.timestamp || new Date().toLocaleTimeString("en-IN"),
      });
    }

    // Try SSE first
    try {
      eventSource = new EventSource("http://127.0.0.1:8000/api/v1/market/stream");

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          applyUpdate(data);
        } catch { /* ignore parse errors */ }
      };

      eventSource.onerror = () => {
        eventSource?.close();
        eventSource = null;
        if (isMounted) setState((prev) => ({ ...prev, isConnected: false, isLiveFeed: false, lastUpdate: "Feed unavailable" }));
      };
    } catch {
      if (isMounted) setState((prev) => ({ ...prev, isConnected: false, isLiveFeed: false, lastUpdate: "Feed unavailable" }));
    }

    return () => {
      isMounted = false;
      eventSource?.close();
    };
  }, []);

  // Return static state during SSR to prevent hydration mismatch
  if (!isClient) {
    return {
      ...EMPTY_STATE,
      tickDirection: {} as TickDirection,
      lastUpdate: "Loading...",
    };
  }

  return { ...state, tickDirection };
}
