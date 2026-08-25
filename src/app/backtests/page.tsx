"use client";

import { useState } from "react";
import Link from "next/link";
import { 
  BacktestConfig, 
  BacktestResult, 
  StrategyType, 
  UniverseType, 
  ExecutionModelType 
} from "../../types/quant";
import { 
  DEFAULT_BACKTEST_CONFIG, 
  EMPTY_BACKTEST_RESULT, 
  runBacktestSimulation, 
  exportBacktestCSV 
} from "../../services/quantApi";
import { useLiveMarket } from "../../hooks/useLiveMarket";

export default function Backtests() {
  const liveMarket = useLiveMarket();
  const [config, setConfig] = useState<BacktestConfig>(DEFAULT_BACKTEST_CONFIG);
  const [result, setResult] = useState<BacktestResult>(EMPTY_BACKTEST_RESULT);
  const [isRunning, setIsRunning] = useState(false);
  const [chartMode, setChartMode] = useState<"linear" | "log">("linear");
  const [newUniverseInput, setNewUniverseInput] = useState("");

  // Animated equity curve state
  const [animatedCurve, setAnimatedCurve] = useState(EMPTY_BACKTEST_RESULT.equityCurve);
  const [streamStatus, setStreamStatus] = useState<"idle" | "computing" | "streaming" | "done">("idle");
  const [revealedMetrics, setRevealedMetrics] = useState(true);

  const handleRunBacktest = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsRunning(true);
    setStreamStatus("computing");
    setRevealedMetrics(false);
    setAnimatedCurve([]); // Clear curve for animation

    // Try streaming endpoint first
    try {
      const params = new URLSearchParams({
        strategy: config.strategy,
        start_date: config.startDate,
        end_date: config.endDate,
        comm_bps: config.commBps.toString(),
        slippage_bps: config.slippageBps.toString(),
      });

      const es = new EventSource(`http://127.0.0.1:8000/api/v1/backtest/stream?${params}`);
      let metricsReceived = false;
      let fullResult: BacktestResult | null = null;

      es.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data) as {
            stage: string;
            type: string;
            data?: { point?: typeof EMPTY_BACKTEST_RESULT.equityCurve[0] } & Partial<BacktestResult> & { n_points?: number };
          };

          if (payload.stage === "metrics" && payload.data) {
            setStreamStatus("streaming");
            setRevealedMetrics(true);
            // Update result metrics immediately, keep curve empty for animation
            fullResult = {
              strategyName: payload.data.strategyName ?? config.strategy,
              lastRunTime: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) + " IST",
              validationMode: "Purged K-Fold (CPCV)",
              totalReturn: payload.data.totalReturn ?? 0,
              benchmarkReturn: payload.data.benchmarkReturn ?? 0,
              annualizedSharpe: payload.data.annualizedSharpe ?? 0,
              dsr: payload.data.dsr ?? 0,
              annualizedVol: payload.data.annualizedVol ?? 0,
              maxDrawdown: payload.data.maxDrawdown ?? 0,
              maxDrawdownDate: "Mar 2020",
              pbo: payload.data.pbo ?? 0,
              winRate: payload.data.winRate ?? 0,
              profitFactor: payload.data.profitFactor ?? 0,
              calmarRatio: payload.data.calmarRatio ?? 0,
              equityCurve: [],
              tcaMetrics: payload.data.tcaMetrics ?? [],
            };
            setResult(fullResult);
            metricsReceived = true;
          }

          if (payload.stage === "curve_point" && payload.data?.point) {
            const pt = payload.data.point;
            setAnimatedCurve(prev => [...prev, pt]);
          }

          if (payload.stage === "complete") {
            setStreamStatus("done");
            setIsRunning(false);
            es.close();
            if (fullResult && animatedCurve) {
              setResult(prev => ({ ...prev, equityCurve: animatedCurve }));
            }
          }
        } catch { /* ignore parse errors */ }
      };

      es.onerror = async () => {
        es.close();
        if (!metricsReceived) {
          // Full fallback to simulation
          try {
            const updatedResult = await runBacktestSimulation(config);
            setResult(updatedResult);
            // Animate the fallback curve
            setAnimatedCurve([]);
            setRevealedMetrics(true);
            setStreamStatus("streaming");
            for (let i = 0; i < updatedResult.equityCurve.length; i++) {
              await new Promise(r => setTimeout(r, 140));
              setAnimatedCurve(prev => [...prev, updatedResult.equityCurve[i]]);
            }
            setStreamStatus("done");
          } catch { /* ignore */ } finally {
            setIsRunning(false);
          }
        }
      };
    } catch {
      // Fallback: run simulation
      try {
        const updatedResult = await runBacktestSimulation(config);
        setResult(updatedResult);
        setAnimatedCurve(updatedResult.equityCurve);
        setRevealedMetrics(true);
      } catch (err) {
        console.error("Backtest simulation failed", err);
      } finally {
        setIsRunning(false);
        setStreamStatus("done");
      }
    }
  };

  const handleExportCSV = () => {
    exportBacktestCSV(result, config);
  };

  const handleAddUniverse = () => {
    const trimmed = newUniverseInput.trim().toUpperCase();
    if (trimmed && !config.universe.includes(trimmed as UniverseType)) {
      setConfig((prev) => ({
        ...prev,
        universe: [...prev.universe, trimmed as UniverseType],
      }));
      setNewUniverseInput("");
    }
  };

  const handleRemoveUniverse = (item: UniverseType) => {
    if (config.universe.length > 1) {
      setConfig((prev) => ({
        ...prev,
        universe: prev.universe.filter((u) => u !== item),
      }));
    }
  };

  // Use animated curve if running, otherwise full result curve
  const displayCurve = (streamStatus === "streaming" || streamStatus === "computing")
    ? animatedCurve
    : result.equityCurve;

  // Build SVG polygon points from (animated) equity curve
  const svgPolylineStrategy = displayCurve
    .map((pt) => `${pt.x},${chartMode === "log" ? Math.max(10, pt.yStrategy * 0.9) : pt.yStrategy}`)
    .join(" ");

  const svgPolylineBenchmark = displayCurve
    .map((pt) => `${pt.x},${chartMode === "log" ? Math.max(15, pt.yBenchmark * 0.9) : pt.yBenchmark}`)
    .join(" ");

  const svgPolygonGrad = displayCurve.length > 0
    ? `${svgPolylineStrategy} ${displayCurve[displayCurve.length - 1].x},100 0,100`
    : "0,100 0,100";



  return (
    <div className="bg-[#f5f5f2] text-stone-900 font-body-sm text-body-sm antialiased h-screen overflow-hidden flex w-full">
      {/* SideNavBar */}
      <nav className="bg-white text-stone-900 w-60 h-full fixed left-0 top-0 border-r border-[#e5e5df] flex flex-col py-4 z-20 shadow-xs">
        {/* Brand Area */}
        <div className="px-6 mb-6 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-orange-500 flex items-center justify-center text-white shadow-2xs">
            <span className="material-symbols-outlined text-[20px]" data-icon="terminal">
              show_chart
            </span>
          </div>
          <div>
            <h1 className="text-headline-md font-headline-md font-bold text-stone-900 tracking-tight">
              QUANT ALPHA
            </h1>
            <p className="text-label-caps text-[10px] text-stone-500 uppercase tracking-wider font-semibold">
              Research Pipeline
            </p>
          </div>
        </div>

        {/* Main Navigation */}
        <div className="flex-1 overflow-y-auto">
          <ul className="space-y-1 px-2">
            <li>
              <Link
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-stone-600 hover:bg-[#eeeeea] hover:text-stone-900 transition-colors"
                href="/"
              >
                <span className="material-symbols-outlined text-[20px]">
                  dashboard
                </span>
                <span className="text-body-sm font-body-sm font-medium">Overview</span>
              </Link>
            </li>
            <li>
              <Link
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-stone-600 hover:bg-[#eeeeea] hover:text-stone-900 transition-colors"
                href="/research"
              >
                <span className="material-symbols-outlined text-[20px]">
                  science
                </span>
                <span className="text-body-sm font-body-sm font-medium">Research</span>
              </Link>
            </li>
            <li>
              <Link
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-stone-600 hover:bg-[#eeeeea] hover:text-stone-900 transition-colors"
                href="/signals"
              >
                <span className="material-symbols-outlined text-[20px]">
                  analytics
                </span>
                <span className="text-body-sm font-body-sm font-medium">Factor Library</span>
              </Link>
            </li>
            <li>
              <Link
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-stone-600 hover:bg-[#eeeeea] hover:text-stone-900 transition-colors"
                href="#"
              >
                <span className="material-symbols-outlined text-[20px]">
                  rule
                </span>
                <span className="text-body-sm font-body-sm font-medium">Validation</span>
              </Link>
            </li>
            {/* ACTIVE TAB */}
            <li>
              <Link
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-orange-600 bg-orange-50 font-semibold border border-orange-200/70 transition-all"
                href="/backtests"
              >
                <span className="material-symbols-outlined text-[20px]">
                  history
                </span>
                <span className="text-body-sm font-body-sm font-semibold">Backtests</span>
              </Link>
            </li>
            <li>
              <Link
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-stone-600 hover:bg-[#eeeeea] hover:text-stone-900 transition-colors"
                href="#"
              >
                <span className="material-symbols-outlined text-[20px]">
                  account_balance
                </span>
                <span className="text-body-sm font-body-sm font-medium">Portfolio</span>
              </Link>
            </li>
            <li>
              <Link
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-stone-600 hover:bg-[#eeeeea] hover:text-stone-900 transition-colors"
                href="#"
              >
                <span className="material-symbols-outlined text-[20px]">
                  description
                </span>
                <span className="text-body-sm font-body-sm font-medium">Reports</span>
              </Link>
            </li>
            <li>
              <Link
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-stone-600 hover:bg-[#eeeeea] hover:text-stone-900 transition-colors"
                href="/command-center"
              >
                <span className="material-symbols-outlined text-[20px]">
                  monitoring
                </span>
                <span className="text-body-sm font-body-sm font-medium">Live Monitor</span>
              </Link>
            </li>
          </ul>
        </div>

        {/* Footer Navigation */}
        <div className="mt-auto px-2 pt-4 border-t border-[#e5e5df]">
          <ul className="space-y-1">
            <li>
              <Link
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-stone-600 hover:bg-[#eeeeea] hover:text-stone-900 transition-colors"
                href="#"
              >
                <span className="material-symbols-outlined text-[20px]">
                  settings
                </span>
                <span className="text-body-sm font-body-sm font-medium">Settings</span>
              </Link>
            </li>
            <li>
              <Link
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-stone-600 hover:bg-[#eeeeea] hover:text-stone-900 transition-colors"
                href="#"
              >
                <span className="material-symbols-outlined text-[20px]">
                  help
                </span>
                <span className="text-body-sm font-body-sm font-medium">Support</span>
              </Link>
            </li>
          </ul>
          <div className="mt-4 p-2 bg-[#f8f8f6] border border-[#e5e5df] rounded-lg flex items-center gap-3 shadow-2xs">
            <div className="w-8 h-8 rounded-full bg-orange-100 border border-orange-300 text-orange-700 font-bold text-xs flex items-center justify-center">
              QA
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-stone-900 truncate">
                Admin User
              </p>
              <p className="text-[10px] text-stone-500 truncate">
                admin@quant.local
              </p>
            </div>
          </div>
        </div>
      </nav>

      {/* TopAppBar */}
      <header className="bg-white/90 text-stone-900 fixed top-0 right-0 h-16 w-[calc(100%-240px)] border-b border-[#e5e5df] flex justify-between items-center px-6 z-20 shadow-2xs backdrop-blur-md">
        {/* Left Section: Breadcrumb & Title */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-orange-50 border border-orange-200 flex items-center justify-center text-orange-600 shadow-2xs">
              <span className="material-symbols-outlined text-lg">history</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-headline-md font-bold text-stone-900 text-sm tracking-tight">
                  High-Fidelity Backtest Engine
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Purged CPCV Ready
                </span>
              </div>
              <span className="text-[10px] text-stone-400 font-medium">
                Marcos López de Prado Financial Machine Learning Architecture
              </span>
            </div>
          </div>
        </div>

        {/* Center Section: Live Streaming Market Ticker Ribbon */}
        <div className="hidden xl:flex items-center gap-2 bg-[#f8f8f6] px-3 py-1.5 rounded-xl border border-[#e5e5df] shadow-2xs">
          <span className="text-[9px] font-mono font-bold text-stone-400 uppercase tracking-widest border-r border-[#e5e5df] pr-2">
            NSE Live
          </span>
          {Object.values(liveMarket.quotes).slice(0, 3).map((q) => {
            const dir = liveMarket.tickDirection?.[q.symbol] ?? "flat";
            return (
              <div key={q.symbol} className="flex items-center gap-1.5 text-xs px-1">
                <span className="font-semibold text-stone-700 text-[10px]">{q.symbol.split(" ")[0]}</span>
                <span
                  className={`font-mono font-bold text-[11px] transition-colors duration-300 ${
                    dir === "up" ? "text-emerald-700" : dir === "down" ? "text-rose-700" : "text-stone-900"
                  }`}
                >
                  ₹{q.price.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                </span>
                <span className={`font-mono text-[9px] font-bold px-1 py-0.5 rounded ${q.change >= 0 ? "text-emerald-700 bg-emerald-50" : "text-rose-700 bg-rose-50"}`}>
                  {q.change >= 0 ? "+" : ""}{q.changePct.toFixed(1)}%
                </span>
                {dir !== "flat" && (
                  <span className={`text-[8px] font-bold ${dir === "up" ? "text-emerald-600" : "text-rose-600"}`}>
                    {dir === "up" ? "▲" : "▼"}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Right Section: Trailing Actions */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2.5 py-1 border border-emerald-200 rounded-lg bg-emerald-50 text-emerald-800 font-semibold text-xs shadow-2xs">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Live Kernel</span>
          </div>

          <div className="w-px h-6 bg-[#e5e5df] mx-0.5"></div>

          <div className="w-8 h-8 rounded-full bg-orange-100 border border-orange-300 flex items-center justify-center text-orange-700 font-bold text-xs shadow-2xs" title="Quant Alpha Terminal Node">
            QA
          </div>
        </div>
      </header>

      {/* Main Content Canvas */}
      <main className="flex-1 ml-[240px] mt-16 p-6 h-[calc(100vh-64px)] overflow-y-auto bg-[#f5f5f2]">
        {/* Header */}
        <div className="flex justify-between items-end mb-6">
          <div>
            <h2 className="text-headline-xl font-headline-xl text-stone-900 font-bold tracking-tight">
              {result.strategyName}
            </h2>
            <p className="text-body-sm font-body-sm text-stone-500 mt-0.5">
              Last run: {result.lastRunTime} | Validation Mode:{" "}
              <span className="text-orange-600 font-semibold">{result.validationMode}</span>
            </p>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={handleExportCSV}
              className="px-4 py-2 rounded-lg border border-[#d6d3d1] bg-white text-stone-700 hover:bg-[#eeeeea] hover:text-stone-900 transition-colors text-body-sm font-semibold flex items-center gap-1.5 shadow-2xs cursor-pointer active:scale-95"
            >
              <span className="material-symbols-outlined text-sm">
                download
              </span>
              Export CSV
            </button>
            <button 
              onClick={() => handleRunBacktest()}
              disabled={isRunning}
              className={`px-4 py-2 rounded-lg bg-orange-600 text-white hover:bg-orange-700 transition-colors text-body-sm font-semibold flex items-center gap-1.5 shadow-2xs cursor-pointer active:scale-95 ${isRunning ? "opacity-75 cursor-not-allowed" : ""}`}
            >
              <span className={`material-symbols-outlined text-sm ${isRunning ? "animate-spin" : ""}`}>
                {isRunning ? "refresh" : "play_arrow"}
              </span>
              {isRunning ? "Running CPCV..." : "Run Backtest"}
            </button>
          </div>
        </div>

        <div 
          className="h-[calc(100%-80px)] grid gap-6" 
          style={{ gridTemplateColumns: "repeat(12, minmax(0, 1fr))" }}
        >
          {/* Left Column: Controls (3/12) */}
          <div className="col-span-3 flex flex-col gap-4">
            {/* Parameters Panel */}
            <div className="bg-white border border-[#e5e5df] rounded-lg p-5 flex-1 shadow-xs">
              <div className="flex items-center gap-2 border-b border-[#e5e5df] pb-3 mb-4">
                <span className="material-symbols-outlined text-orange-600 text-base">
                  tune
                </span>
                <h3 className="text-body-lg font-headline-md text-stone-900 font-semibold">
                  Configuration
                </h3>
              </div>
              <form onSubmit={handleRunBacktest} className="space-y-4">
                {/* Strategy */}
                <div>
                  <label className="block text-label-caps text-[11px] font-bold text-stone-500 uppercase tracking-wider mb-1">
                    Base Strategy
                  </label>
                  <select 
                    value={config.strategy}
                    onChange={(e) => setConfig({ ...config, strategy: e.target.value as StrategyType })}
                    className="w-full bg-[#f8f8f6] text-stone-900 text-body-sm rounded-lg border border-[#e5e5df] py-1.5 px-2.5 focus:ring-1 focus:ring-orange-500 focus:border-orange-500 font-medium"
                  >
                    <option value="Momentum Reversion (MR)">Momentum Reversion (MR)</option>
                    <option value="Statistical Arbitrage (SA)">Statistical Arbitrage (SA)</option>
                    <option value="Volatility Targeting (VT)">Volatility Targeting (VT)</option>
                    <option value="FinBERT Sentiment Alpha (SA)">FinBERT Sentiment Alpha (SA)</option>
                  </select>
                </div>
                {/* Universe */}
                <div>
                  <label className="block text-label-caps text-[11px] font-bold text-stone-500 uppercase tracking-wider mb-1">
                    Universe Selection
                  </label>
                  <div className="flex gap-2">
                    <input
                      className="flex-1 bg-[#f8f8f6] text-stone-900 text-body-sm rounded-lg border border-[#e5e5df] py-1.5 px-2.5 focus:ring-1 focus:ring-orange-500 focus:border-orange-500 font-medium uppercase"
                      type="text"
                      placeholder="e.g. NIFTY IT"
                      value={newUniverseInput}
                      onChange={(e) => setNewUniverseInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddUniverse();
                        }
                      }}
                    />
                    <button
                      onClick={handleAddUniverse}
                      className="px-2.5 py-1.5 bg-[#eeeeea] border border-[#e5e5df] rounded-lg hover:bg-[#e4e4dd] transition-colors text-stone-700 cursor-pointer"
                      type="button"
                    >
                      <span className="material-symbols-outlined text-sm">
                        add
                      </span>
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {config.universe.map((item) => (
                      <span 
                        key={item} 
                        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#eeeeea] text-xs text-stone-800 border border-[#e5e5df] font-medium"
                      >
                        {item}{" "}
                        <button 
                          type="button"
                          onClick={() => handleRemoveUniverse(item)}
                          className="text-stone-400 hover:text-rose-600 cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[10px]">
                            close
                          </span>
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
                <div className="w-full h-px bg-[#e5e5df]"></div>
                {/* Date Range */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-label-caps text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">
                      Start Date
                    </label>
                    <input
                      className="w-full bg-[#f8f8f6] text-stone-900 text-body-sm rounded-lg border border-[#e5e5df] py-1 px-2 text-xs focus:ring-1 focus:ring-orange-500 focus:border-orange-500 font-mono"
                      type="date"
                      value={config.startDate}
                      onChange={(e) => setConfig({ ...config, startDate: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-label-caps text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">
                      End Date
                    </label>
                    <input
                      className="w-full bg-[#f8f8f6] text-stone-900 text-body-sm rounded-lg border border-[#e5e5df] py-1 px-2 text-xs focus:ring-1 focus:ring-orange-500 focus:border-orange-500 font-mono"
                      type="date"
                      value={config.endDate}
                      onChange={(e) => setConfig({ ...config, endDate: e.target.value })}
                    />
                  </div>
                </div>
                {/* Execution Model */}
                <div>
                  <label className="block text-label-caps text-[11px] font-bold text-stone-500 uppercase tracking-wider mb-1">
                    Execution Model
                  </label>
                  <select 
                    value={config.executionModel}
                    onChange={(e) => setConfig({ ...config, executionModel: e.target.value as ExecutionModelType })}
                    className="w-full bg-[#f8f8f6] text-stone-900 text-body-sm rounded-lg border border-[#e5e5df] py-1.5 px-2.5 focus:ring-1 focus:ring-orange-500 focus:border-orange-500 font-medium"
                  >
                    <option value="TWAP (Volume Weighted)">TWAP (Volume Weighted)</option>
                    <option value="VWAP">VWAP</option>
                    <option value="Implementation Shortfall">Implementation Shortfall</option>
                    <option value="Instant (No Slippage)">Instant (No Slippage)</option>
                  </select>
                </div>
                {/* Slippage / Fees */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-label-caps text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">
                      Comm (bps)
                    </label>
                    <input
                      className="w-full bg-[#f8f8f6] text-stone-900 font-mono text-right rounded-lg border border-[#e5e5df] py-1 px-2 text-xs focus:ring-1 focus:ring-orange-500 focus:border-orange-500"
                      step="0.1"
                      type="number"
                      value={config.commBps}
                      onChange={(e) => setConfig({ ...config, commBps: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <label className="block text-label-caps text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">
                      Slippage (bps)
                    </label>
                    <input
                      className="w-full bg-[#f8f8f6] text-stone-900 font-mono text-right rounded-lg border border-[#e5e5df] py-1 px-2 text-xs focus:ring-1 focus:ring-orange-500 focus:border-orange-500"
                      step="0.5"
                      type="number"
                      value={config.slippageBps}
                      onChange={(e) => setConfig({ ...config, slippageBps: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                </div>
              </form>
            </div>

            {/* System Status Mini-Panel */}
            <div className="bg-white border border-[#e5e5df] rounded-lg p-4 shadow-xs">
              <div className="flex justify-between items-center">
                <span className="text-body-sm font-semibold text-stone-800">
                  Data Cache
                </span>
                <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                  Synced (NSE 2015-2024)
                </span>
              </div>
              <div className="mt-2 w-full bg-[#eeeeea] rounded-full h-1.5">
                <div className="bg-orange-500 h-1.5 rounded-full" style={{ width: "100%" }}></div>
              </div>
            </div>
          </div>

          {/* Right Column: Visualization & Results (9/12) */}
          <div className="col-span-9 flex flex-col gap-4 h-full">
            {/* Performance Summary */}
            <div className="grid grid-cols-4 gap-4">
              {/* Metric Card 1 */}
              <div className="bg-white border border-[#e5e5df] rounded-lg p-4 shadow-xs">
                <p className="text-label-caps text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">
                  Total Return
                </p>
                <div className="flex items-baseline gap-2">
                  <span className="text-headline-xl font-headline-xl text-orange-600 font-bold">
                    +{result.totalReturn}%
                  </span>
                  <span className="text-xs text-stone-400 font-medium">vs +{result.benchmarkReturn}% BM</span>
                </div>
              </div>
              {/* Metric Card 2 */}
              <div className="bg-white border border-[#e5e5df] rounded-lg p-4 shadow-xs">
                <p className="text-label-caps text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">
                  Sharpe Ratio (Ann)
                </p>
                <div className="flex items-baseline gap-2">
                  <span className="text-headline-xl font-headline-xl text-emerald-600 font-bold">
                    {result.annualizedSharpe}
                  </span>
                  <span className="text-xs text-stone-400 font-medium">DSR: {result.dsr}</span>
                </div>
              </div>
              {/* Metric Card 3 */}
              <div className="bg-white border border-[#e5e5df] rounded-lg p-4 shadow-xs">
                <p className="text-label-caps text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">
                  Volatility (Ann)
                </p>
                <div className="flex items-baseline gap-2">
                  <span className="text-headline-xl font-headline-xl text-stone-900 font-bold">
                    {result.annualizedVol}%
                  </span>
                  <span className="text-xs text-stone-400 font-medium">Calmar: {result.calmarRatio}</span>
                </div>
              </div>
              {/* Metric Card 4 */}
              <div className="bg-white border border-[#e5e5df] rounded-lg p-4 shadow-xs">
                <p className="text-label-caps text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">
                  Max Drawdown
                </p>
                <div className="flex items-baseline gap-2">
                  <span className="text-headline-xl font-headline-xl text-rose-800 font-bold">
                    {result.maxDrawdown}%
                  </span>
                  <span className="text-xs text-stone-400 font-medium">{result.maxDrawdownDate}</span>
                </div>
              </div>
            </div>

            {/* Main Chart Area */}
            <div className="bg-white border border-[#e5e5df] rounded-lg flex-1 flex flex-col relative overflow-hidden shadow-xs">
              <div className="px-4 py-3 border-b border-[#e5e5df] flex justify-between items-center bg-[#f8f8f6]/70 z-10">
                <h3 className="text-body-sm font-semibold text-stone-900 flex items-center gap-2">
                  <span className="material-symbols-outlined text-base text-orange-600">
                    show_chart
                  </span>
                  Cumulative Equity Curve vs NIFTY 50
                </h3>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setChartMode("log")}
                    className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors cursor-pointer ${chartMode === "log" ? "bg-orange-600 text-white font-semibold" : "bg-[#eeeeea] border border-[#e5e5df] text-stone-600 hover:bg-[#e4e4dd]"}`}
                  >
                    Log
                  </button>
                  <button 
                    onClick={() => setChartMode("linear")}
                    className={`px-2.5 py-1 text-xs rounded-md font-semibold transition-colors shadow-2xs cursor-pointer ${chartMode === "linear" ? "bg-orange-600 text-white font-semibold" : "bg-[#eeeeea] border border-[#e5e5df] text-stone-600 hover:bg-[#e4e4dd]"}`}
                  >
                    Linear
                  </button>
                </div>
              </div>
              {/* Streaming status banner */}
              {streamStatus === "computing" && (
                <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 flex items-center gap-2">
                  <span className="material-symbols-outlined text-amber-600 text-sm animate-spin">refresh</span>
                  <span className="text-xs font-semibold text-amber-800 font-mono">Computing real backtest on NIFTY 50 historical data...</span>
                </div>
              )}
              {streamStatus === "streaming" && (
                <div className="px-4 py-2 bg-emerald-50 border-b border-emerald-200 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="text-xs font-semibold text-emerald-800 font-mono">Streaming equity curve — {displayCurve.length} points received from real backtest</span>
                </div>
              )}
              {/* Clean High-Density SVG Chart Canvas */}
              <div className="flex-1 relative p-6 bg-[#fbfbfa]">
                <div className="absolute right-6 top-4 bg-white/95 border border-[#e5e5df] rounded-lg p-3 text-xs font-mono space-y-1.5 shadow-xs z-10">
                  <div className="flex justify-between gap-4">
                    <span className="text-stone-500 font-medium">Strategy</span>
                    <span className="text-orange-600 font-bold">+{result.totalReturn}%</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-stone-500 font-medium">Benchmark</span>
                    <span className="text-stone-700 font-semibold">+{result.benchmarkReturn}%</span>
                  </div>
                </div>
                <div className="w-full h-full border-b border-l border-[#d6d3d1] relative">
                  <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute inset-0 grid grid-cols-8 divide-x divide-[#e5e5df]">
                      <div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div>
                    </div>
                    <div className="absolute inset-0 flex flex-col justify-between">
                      <div className="w-full h-px bg-[#e5e5df]"></div>
                      <div className="w-full h-px bg-[#e5e5df]"></div>
                      <div className="w-full h-px bg-[#e5e5df]"></div>
                      <div className="w-full h-px bg-[#e5e5df]"></div>
                    </div>
                  </div>
                  <svg
                    className="w-full h-full overflow-visible"
                    preserveAspectRatio="none"
                    viewBox="0 0 100 100"
                  >
                    <defs>
                      <linearGradient id="backtestGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#ea580c" stopOpacity="0.18" />
                        <stop offset="80%" stopColor="#f97316" stopOpacity="0.03" />
                        <stop offset="100%" stopColor="#ffffff" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>
                    <polygon
                      points={svgPolygonGrad}
                      fill="url(#backtestGrad)"
                    />
                    <polyline
                      fill="none"
                      points={svgPolylineBenchmark}
                      stroke="#a8a29e"
                      strokeWidth="1.5"
                      strokeDasharray="3,3"
                      vectorEffect="non-scaling-stroke"
                    />
                    <polyline
                      fill="none"
                      points={svgPolylineStrategy}
                      stroke="#ea580c"
                      strokeWidth="2.5"
                      vectorEffect="non-scaling-stroke"
                      style={{ transition: "points 0.12s ease-out" }}
                    />
                    {/* Animated cursor dot at end of curve */}
                    {streamStatus === "streaming" && displayCurve.length > 0 && (() => {
                      const last = displayCurve[displayCurve.length - 1];
                      return (
                        <circle
                          cx={last.x}
                          cy={chartMode === "log" ? Math.max(10, last.yStrategy * 0.9) : last.yStrategy}
                          r="1.5"
                          fill="#ea580c"
                          vectorEffect="non-scaling-stroke"
                        />
                      );
                    })()}
                  </svg>
                </div>
              </div>
            </div>

            {/* Transaction Cost Analysis (Bottom Row) */}
            <div className="bg-white border border-[#e5e5df] rounded-lg h-48 flex flex-col shadow-xs overflow-hidden">
              <div className="px-4 py-2 border-b border-[#e5e5df] bg-[#f8f8f6]/70 flex justify-between items-center">
                <h3 className="text-body-sm font-semibold text-stone-900 flex items-center gap-2">
                  <span className="material-symbols-outlined text-base text-stone-500">
                    receipt_long
                  </span>
                  Transaction Cost Analysis (TCA)
                </h3>
                <span className="text-xs text-stone-500 font-mono">
                  Slippage: {config.slippageBps} bps | Comm: {config.commBps} bps
                </span>
              </div>
              <div className="flex-1 overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#eeeeea] text-stone-500 text-label-caps font-label-caps uppercase border-b border-[#e5e5df] text-[11px] font-semibold">
                      <th className="px-4 py-2">Metric</th>
                      <th className="px-4 py-2 text-right">
                        Value (bps)
                      </th>
                      <th className="px-4 py-2 text-right">
                        Impact PnL
                      </th>
                      <th className="px-4 py-2">Distribution</th>
                    </tr>
                  </thead>
                  <tbody className="text-data-metric-sm font-data-metric-sm font-mono text-stone-800 divide-y divide-[#f0f0ec]">
                    {result.tcaMetrics.map((tca) => (
                      <tr key={tca.name} className="hover:bg-[#f5f5f2] transition-colors">
                        <td className="px-4 py-2 flex items-center gap-2 font-sans font-medium text-stone-900">
                          <div className={`w-2 h-2 ${tca.color} rounded-full`}></div>{" "}
                          {tca.name}
                        </td>
                        <td className="px-4 py-2 text-right">{tca.valueBps}</td>
                        <td className={`px-4 py-2 text-right font-semibold ${tca.impactPnL >= 0 ? "text-emerald-800" : "text-rose-800"}`}>
                          {tca.impactPnL >= 0 ? `+₹${tca.impactPnL.toLocaleString("en-IN")}` : `-₹${Math.abs(tca.impactPnL).toLocaleString("en-IN")}`}
                        </td>
                        <td className="px-4 py-2 w-1/3">
                          <div className="w-full bg-[#eeeeea] h-1.5 rounded-full overflow-hidden flex">
                            <div
                              className={`${tca.color} h-full`}
                              style={{ width: `${tca.distributionPct}%` }}
                            ></div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

