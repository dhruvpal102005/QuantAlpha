"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { SignalItem, SignalCategory } from "../../types/quant";
import { fetchSignals } from "../../services/quantApi";
import { useLiveMarket } from "../../hooks/useLiveMarket";

interface DiscoveryLogLine {
  id: number;
  type: "info" | "success" | "rejected" | "error" | "complete";
  message: string;
  timestamp: string;
}

export default function Research() {
  const liveMarket = useLiveMarket();
  const [candidates, setCandidates] = useState<SignalItem[]>([]);
  const [validated, setValidated] = useState<SignalItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<SignalCategory | "All">("All");
  const [isValidating, setIsValidating] = useState(false);
  const [validationStep, setValidationStep] = useState<string | null>(null);
  const [showMethodologyModal, setShowMethodologyModal] = useState(false);
  const [inspectingSignal, setInspectingSignal] = useState<SignalItem | null>(null);

  // Signal Discovery Terminal state
  const [showDiscoveryTerminal, setShowDiscoveryTerminal] = useState(false);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [discoveryLog, setDiscoveryLog] = useState<DiscoveryLogLine[]>([]);
  const [discoveryComplete, setDiscoveryComplete] = useState(false);
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const logIdRef = useRef(0);

  // Auto-scroll terminal to bottom
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [discoveryLog]);

  const handleRunDiscovery = async () => {
    if (isDiscovering) return;
    setShowDiscoveryTerminal(true);
    setIsDiscovering(true);
    setDiscoveryComplete(false);
    setDiscoveryLog([]);

    const addLine = (type: DiscoveryLogLine["type"], message: string) => {
      const id = ++logIdRef.current;
      const timestamp = new Date().toLocaleTimeString("en-IN", { hour12: false });
      setDiscoveryLog(prev => [...prev, { id, type, message, timestamp }]);
    };

    addLine("info", "Loading persisted signals and connecting to Discovery Engine...");

    try {
      const catalog = await fetchSignals();
      setCandidates(catalog.candidates);
      setValidated(catalog.validated);
      const es = new EventSource(
        "http://127.0.0.1:8000/api/v1/signals/discover/stream?start_date=2021-01-01&end_date=2024-12-31"
      );

      es.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data) as {
            stage: string;
            type: string;
            message: string;
            data?: {
              signals?: SignalItem[];
              approved_count?: number;
              total_count?: number;
            };
          };
          const lineType = (payload.type === "success" ? "success"
            : payload.type === "rejected" ? "rejected"
            : payload.type === "error" ? "error"
            : payload.type === "complete" ? "complete"
            : "info") as DiscoveryLogLine["type"];

          addLine(lineType, payload.message);

          if (payload.stage === "complete" && payload.data?.signals) {
            // Promote approved signals to candidates board
            const newSignals = payload.data.signals as SignalItem[];
            setCandidates(prev => {
              const existingIds = new Set(prev.map(s => s.name));
              const fresh = newSignals.filter(s => !existingIds.has(s.name));
              return [...fresh, ...prev];
            });
            setDiscoveryComplete(true);
            setIsDiscovering(false);
            es.close();
          }
        } catch { /* ignore */ }
      };

      es.onerror = () => {
        addLine("error", "Discovery unavailable. No synthetic signals were generated.");
        setIsDiscovering(false);
        es.close();
      };
    } catch (e) {
      addLine("error", `Failed to start discovery: ${e}`);
      setIsDiscovering(false);
    }
  };

  const handleRunValidation = async () => {
    if (isValidating || candidates.length === 0) return;
    setIsValidating(true);

    const steps = [
      "1/5: Preparing price history and market data...",
      "2/5: Removing data overlap to prevent cheating...",
      "3/5: Adding safety buffer between test periods...",
      "4/5: Testing strategy through multiple scenarios...",
      "5/5: Calculating reliability and overfitting risk...",
    ];

    for (let i = 0; i < steps.length; i++) {
      setValidationStep(steps[i]);
      await new Promise((res) => setTimeout(res, 800));
    }

    // Call REAL validation API
    try {
      const topCandidate = candidates[0];
      if (!topCandidate) {
        setIsValidating(false);
        setValidationStep(null);
        return;
      }

      setValidationStep("Testing strategy reliability...");
      
      const { runRealValidation } = await import("../../services/quantApi");
      const result = await runRealValidation(topCandidate.id, "^NSEI", "2020-01-01", "2024-12-31", 5, 0.01, 50);

      if (result.status === "APPROVED") {
        // Graduate to validated
        const graduatedSignal: SignalItem = result.signal;
        setValidated((prev) => [graduatedSignal, ...prev]);
        setCandidates((prev) => prev.filter(s => s.id !== topCandidate.id));
        
        setValidationStep(`✓ APPROVED: Reliability=${result.validation_details.dsr.toFixed(2)}, Overfit Risk=${result.validation_details.pbo.toFixed(2)}`);
      } else {
        // Validation failed
        setValidationStep(`✗ REJECTED: ${result.rejection_reasons.pbo_failed ? 'High overfit risk' : ''} ${result.rejection_reasons.dsr_failed ? 'Low reliability' : ''}`);
        setCandidates((prev) => prev.map(s => 
          s.id === topCandidate.id ? { ...s, status: "Failed Quality Check" as const } : s
        ));
      }

      await new Promise((res) => setTimeout(res, 3000));
    } catch (error) {
      console.error("Validation failed:", error);
      setValidationStep("✗ Validation engine error - check backend connection");
      await new Promise((res) => setTimeout(res, 3000));
    }

    setValidationStep(null);
    setIsValidating(false);
  };

  const filterSignals = (list: SignalItem[]) => {
    return list.filter((sig) => {
      const matchesSearch = 
        sig.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        sig.code.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCat = selectedCategory === "All" || sig.category === selectedCategory;
      return matchesSearch && matchesCat;
    });
  };

  const filteredCandidates = filterSignals(candidates);
  const filteredValidated = filterSignals(validated);

  return (
    <div className="bg-[#f5f5f2] text-stone-900 font-body-sm text-body-sm min-h-screen flex antialiased w-full relative">
      {/* Methodology Modal */}
      {showMethodologyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white border border-[#e5e5df] rounded-xl max-w-2xl w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#e5e5df] pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-orange-600 text-2xl">menu_book</span>
                <h3 className="font-headline-md text-lg font-bold text-stone-900">
                  How We Test Strategies
                </h3>
              </div>
              <button 
                onClick={() => setShowMethodologyModal(false)}
                className="text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            <div className="space-y-4 text-xs text-stone-700 leading-relaxed">
              {/* Section 1 */}
              <div className="bg-[#f8f8f6] border border-[#e5e5df] p-3.5 rounded-lg space-y-1.5">
                <h4 className="font-bold text-stone-900 text-sm flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                  1. Smart Testing (No Cheating)
                </h4>
                <p className="text-stone-600">
                  Standard backtests "cheat" by accidentally using future information. We test strategies on separate time periods and add safety buffers to ensure fair testing. This means the results you see are realistic.
                </p>
                <code className="block font-mono bg-white p-2 border border-[#e5e5df] rounded text-[11px] text-stone-800">
                  Safety Buffer: We skip 5 trading days between test periods
                </code>
              </div>

              {/* Section 2 */}
              <div className="bg-[#f8f8f6] border border-[#e5e5df] p-3.5 rounded-lg space-y-1.5">
                <h4 className="font-bold text-stone-900 text-sm flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  2. Reliability Score & Overfitting Risk
                </h4>
                <p className="text-stone-600">
                  We calculate how confident we are that a strategy will work in real trading (Reliability Score) and the risk that it only worked by luck on past data (Overfitting Risk). Both are adjusted for the fact we tested many strategies.
                </p>
                <code className="block font-mono bg-white p-2 border border-[#e5e5df] rounded text-[11px] text-stone-800">
                  Good Strategy: Reliability &gt; 95% AND Overfit Risk &lt; 50%
                </code>
                <p className="text-stone-500 text-[11px]">
                  Only strategies that pass <strong>both</strong> criteria get approved for real trading.
                </p>
              </div>

              {/* Section 3 */}
              <div className="bg-[#f8f8f6] border border-[#e5e5df] p-3.5 rounded-lg space-y-1.5">
                <h4 className="font-bold text-stone-900 text-sm flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                  3. News Mood Analysis
                </h4>
                <p className="text-stone-600">
                  We use AI to read financial news headlines and company announcements, measuring whether the overall mood is positive or negative. Recent news gets more weight than old news.
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-[#e5e5df]">
              <button
                onClick={() => setShowMethodologyModal(false)}
                className="px-4 py-1.5 bg-orange-600 text-white font-semibold text-xs rounded-lg hover:bg-orange-700 transition-colors cursor-pointer shadow-2xs"
              >
                Got it!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Signal Details Modal */}
      {inspectingSignal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white border border-[#e5e5df] rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-white border-b border-[#e5e5df] p-6 z-10">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="material-symbols-outlined text-orange-600 text-2xl">
                      {inspectingSignal.category === "Sentiment" ? "forum" : 
                       inspectingSignal.category === "Statistical Arbitrage" ? "tune" : "timeline"}
                    </span>
                    <div>
                      <h3 className="font-headline-md text-xl font-bold text-stone-900">
                        {inspectingSignal.name}
                      </h3>
                      <span className="text-xs font-mono text-stone-500">{inspectingSignal.code}</span>
                    </div>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${
                    inspectingSignal.category === "Sentiment" ? "bg-purple-50 border-purple-200 text-purple-700" :
                    inspectingSignal.category === "Statistical Arbitrage" ? "bg-amber-50 border-amber-200 text-amber-800" :
                    inspectingSignal.category === "Macro" ? "bg-blue-50 border-blue-200 text-blue-700" :
                    "bg-emerald-50 border-emerald-200 text-emerald-700"
                  }`}>
                    {inspectingSignal.category}
                  </span>
                </div>
                <button 
                  onClick={() => setInspectingSignal(null)}
                  className="text-stone-400 hover:text-stone-700 cursor-pointer ml-4 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-stone-100"
                >
                  <span className="material-symbols-outlined text-xl">close</span>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Description */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="material-symbols-outlined text-stone-600 text-sm">description</span>
                  <span className="text-stone-600 font-bold uppercase tracking-wider text-xs">
                    Signal Description
                  </span>
                </div>
                <p className="text-stone-700 bg-[#f8f8f6] p-4 rounded-lg border border-[#e5e5df] leading-relaxed">
                  {inspectingSignal.description}
                </p>
              </div>

              {/* Formula */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="material-symbols-outlined text-stone-600 text-sm">functions</span>
                  <span className="text-stone-600 font-bold uppercase tracking-wider text-xs">
                    Mathematical Formula
                  </span>
                </div>
                <div className="bg-stone-900 p-4 rounded-lg border border-stone-700 overflow-x-auto">
                  <code className="text-emerald-400 font-mono text-sm whitespace-pre-wrap break-all">
                    {inspectingSignal.formula}
                  </code>
                </div>
              </div>

              {/* Performance Metrics - Simplified */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="material-symbols-outlined text-stone-600 text-sm">analytics</span>
                  <span className="text-stone-600 font-bold uppercase tracking-wider text-xs">
                    Performance Scores
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-orange-50 border border-orange-200 p-4 rounded-lg text-center">
                    <span className="text-[10px] text-orange-700 font-bold uppercase block mb-1" title="Profit consistency (reward/risk)">Profit Score</span>
                    <span className="font-mono text-2xl font-bold text-orange-600">+{inspectingSignal.oosSharpe}</span>
                  </div>
                  <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-lg text-center">
                    <span className="text-[10px] text-emerald-700 font-bold uppercase block mb-1" title="Confidence it will work (0-1)">Reliability</span>
                    <span className="font-mono text-2xl font-bold text-emerald-700">{inspectingSignal.dsr}</span>
                  </div>
                  <div className="bg-rose-50 border border-rose-200 p-4 rounded-lg text-center">
                    <span className="text-[10px] text-rose-700 font-bold uppercase block mb-1" title="Worst peak-to-valley drop">Worst Loss</span>
                    <span className="font-mono text-2xl font-bold text-rose-700">{inspectingSignal.maxDrawdown}%</span>
                  </div>
                </div>
              </div>

              {/* Validation Details - Simplified */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="material-symbols-outlined text-stone-600 text-sm">verified</span>
                  <span className="text-stone-600 font-bold uppercase tracking-wider text-xs">
                    Testing Status
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-[#f8f8f6] border border-[#e5e5df] p-3 rounded-lg">
                    <span className="text-xs text-stone-500 font-semibold block mb-1" title="Probability strategy is overfit to past data">Overfitting Risk</span>
                    <span className="font-mono text-lg font-bold text-stone-900">
                      {inspectingSignal.pbo === null ? "Unavailable" : `${(inspectingSignal.pbo * 100).toFixed(0)}%`}
                    </span>
                    {inspectingSignal.pbo !== null && (
                      <span className={`ml-2 text-xs font-semibold ${inspectingSignal.pbo <= 0.5 ? "text-emerald-600" : "text-rose-600"}`}>
                        {inspectingSignal.pbo <= 0.5 ? "✓ SAFE" : "✗ RISKY"}
                      </span>
                    )}
                  </div>
                  <div className="bg-[#f8f8f6] border border-[#e5e5df] p-3 rounded-lg">
                    <span className="text-xs text-stone-500 font-semibold block mb-1">Current Status</span>
                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                      inspectingSignal.status === "Passed Validation" ? "text-emerald-800 bg-emerald-50 border-emerald-200" :
                      inspectingSignal.status === "Backtest Running" ? "text-amber-800 bg-amber-50 border-amber-200" :
                      inspectingSignal.status === "FDR Rejected" ? "text-rose-800 bg-rose-50 border-rose-200" :
                      "text-stone-600 bg-stone-50 border-stone-200"
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        inspectingSignal.status === "Passed Validation" ? "bg-emerald-500" :
                        inspectingSignal.status === "Backtest Running" ? "bg-amber-500 animate-pulse" :
                        inspectingSignal.status === "FDR Rejected" ? "bg-rose-500" :
                        "bg-stone-400"
                      }`}></span>
                      {inspectingSignal.status === "Passed Validation" ? "Ready to Trade" :
                       inspectingSignal.status === "Backtest Running" ? "Testing..." :
                       inspectingSignal.status === "FDR Rejected" ? "Failed Test" :
                       inspectingSignal.status}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 bg-stone-50 border-t border-[#e5e5df] p-4 flex justify-end gap-3">
              <button
                onClick={() => setInspectingSignal(null)}
                className="px-4 py-2 bg-white hover:bg-stone-100 text-stone-700 font-semibold text-sm rounded-lg transition-colors cursor-pointer border border-stone-300"
              >
                Close
              </button>
              {inspectingSignal.status !== "Passed Validation" && (
                <button
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white font-semibold text-sm rounded-lg transition-colors cursor-pointer shadow-sm"
                  onClick={() => {
                    setInspectingSignal(null);
                    // Trigger validation for this signal
                  }}
                >
                  Run Validation
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SideNavBar */}
      <nav className="w-60 h-full fixed left-0 top-0 bg-white border-r border-[#e5e5df] flex flex-col py-4 z-20 shadow-xs">
        {/* Brand / Header */}
        <div className="px-6 mb-6 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-orange-500 flex items-center justify-center text-white shadow-2xs">
            <span
              className="material-symbols-outlined text-[20px]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
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

        {/* Main Navigation Tabs */}
        <div className="flex-1 flex flex-col gap-1 px-2">
          <Link
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-stone-600 hover:bg-[#eeeeea] hover:text-stone-900 transition-colors"
            href="/"
          >
            <span className="material-symbols-outlined text-[20px]">
              dashboard
            </span>
            <span className="font-body-sm text-body-sm font-medium">Overview</span>
          </Link>

          <Link
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-orange-600 bg-orange-50 font-semibold border border-orange-200/70 transition-all"
            href="/research"
          >
            <span
              className="material-symbols-outlined text-[20px]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              science
            </span>
            <span className="font-body-sm text-body-sm font-semibold">
              Research
            </span>
          </Link>

          <Link
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-stone-600 hover:bg-[#eeeeea] hover:text-stone-900 transition-colors"
            href="/signals"
          >
            <span className="material-symbols-outlined text-[20px]">
              analytics
            </span>
            <span className="font-body-sm text-body-sm font-medium">Factor Library</span>
          </Link>

          <Link
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-stone-600 hover:bg-[#eeeeea] hover:text-stone-900 transition-colors"
            href="/validation"
          >
            <span className="material-symbols-outlined text-[20px]">
              rule
            </span>
            <span className="font-body-sm text-body-sm font-medium">Validation</span>
          </Link>

          <Link
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-stone-600 hover:bg-[#eeeeea] hover:text-stone-900 transition-colors"
            href="/backtests"
          >
            <span className="material-symbols-outlined text-[20px]">
              history
            </span>
            <span className="font-body-sm text-body-sm font-medium">Backtests</span>
          </Link>

          <Link
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-stone-600 hover:bg-[#eeeeea] hover:text-stone-900 transition-colors"
            href="/portfolio"
          >
            <span className="material-symbols-outlined text-[20px]">
              account_balance
            </span>
            <span className="font-body-sm text-body-sm font-medium">Portfolio</span>
          </Link>

          <Link
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-stone-600 hover:bg-[#eeeeea] hover:text-stone-900 transition-colors"
            href="/reports"
          >
            <span className="material-symbols-outlined text-[20px]">
              description
            </span>
            <span className="font-body-sm text-body-sm font-medium">Reports</span>
          </Link>

          <Link
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-stone-600 hover:bg-[#eeeeea] hover:text-stone-900 transition-colors"
            href="/command-center"
          >
            <span className="material-symbols-outlined text-[20px]">
              monitoring
            </span>
            <span className="font-body-sm text-body-sm font-medium">Live Monitor</span>
          </Link>
        </div>

        {/* Footer Tabs */}
        <div className="flex flex-col gap-1 px-2 mt-auto pt-4 border-t border-[#e5e5df]">
          <Link
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-stone-600 hover:bg-[#eeeeea] hover:text-stone-900 transition-colors"
            href="/settings"
          >
            <span className="material-symbols-outlined text-[20px]">
              settings
            </span>
            <span className="font-body-sm text-body-sm font-medium">Settings</span>
          </Link>
          <Link
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-stone-600 hover:bg-[#eeeeea] hover:text-stone-900 transition-colors"
            href="/support"
          >
            <span className="material-symbols-outlined text-[20px]">
              help
            </span>
            <span className="font-body-sm text-body-sm font-medium">Support</span>
          </Link>
        </div>
      </nav>

      {/* TopAppBar */}
      <header className="fixed top-0 right-0 h-16 w-[calc(100%-240px)] bg-white/90 border-b border-[#e5e5df] flex justify-between items-center px-6 z-20 backdrop-blur-md shadow-2xs">
        {/* Left Section: Breadcrumb & Title */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-orange-50 border border-orange-200 flex items-center justify-center text-orange-600 shadow-2xs">
              <span className="material-symbols-outlined text-lg">science</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-headline-md font-bold text-stone-900 text-sm tracking-tight">
                  Alpha Research & Validation Lab
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Purged CPCV Active
                </span>
              </div>
              <span className="text-[10px] text-stone-400 font-medium">
                Deflated Sharpe Ratio (DSR) & PBO Statistical Guardrails
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

        {/* Right Section: Action Controls */}
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowMethodologyModal(true)}
            className="px-3 py-1.5 border border-[#d6d3d1] bg-white text-stone-700 hover:bg-[#eeeeea] text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs hover:border-stone-400"
          >
            <span className="material-symbols-outlined text-sm text-stone-500">menu_book</span>
            <span>Methodology</span>
          </button>

          <div className="w-px h-6 bg-[#e5e5df] mx-0.5"></div>

          <div className="w-8 h-8 rounded-full bg-orange-100 border border-orange-300 flex items-center justify-center text-orange-700 font-bold text-xs shadow-2xs" title="Quant Alpha Terminal Node">
            QA
          </div>
        </div>
      </header>

      {/* Main Content Canvas */}
      <main className="ml-60 mt-16 p-6 w-full max-w-[1600px] flex flex-col gap-6">
        {/* Header & Global Actions */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#e5e5df] pb-4">
          <div>
            <h2 className="text-headline-xl font-headline-xl text-stone-900 mb-1 font-bold tracking-tight">
              Alpha Generation Pipeline
            </h2>
            <p className="text-body-sm font-body-sm text-stone-500 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-stone-400">
                folder_open
              </span>
              Workspace: <code className="text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded border border-orange-200/50 font-mono text-xs">/research/active_candidate_pool/</code>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={() => setShowMethodologyModal(true)}
              className="border border-[#d6d3d1] bg-white text-stone-700 hover:bg-[#eeeeea] transition-colors px-3.5 py-2 rounded-lg flex items-center gap-1.5 shadow-2xs font-body-sm text-xs font-semibold cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">menu_book</span>
              Methodology
            </button>
            <button 
              onClick={handleRunDiscovery}
              disabled={isDiscovering}
              className={`border border-blue-300 bg-blue-50 text-blue-800 hover:bg-blue-100 transition-colors px-3.5 py-2 rounded-lg flex items-center gap-1.5 shadow-2xs font-body-sm text-xs font-semibold cursor-pointer active:scale-95 ${isDiscovering ? "opacity-75 cursor-not-allowed" : ""}`}
            >
              <span className={`material-symbols-outlined text-[16px] ${isDiscovering ? "animate-spin" : ""}`}>
                {isDiscovering ? "refresh" : "rocket_launch"}
              </span>
              {isDiscovering ? "Discovering Signals..." : "Run Signal Discovery"}
            </button>
            <button 
              onClick={handleRunValidation}
              disabled={isValidating || candidates.length === 0}
              className={`bg-orange-600 text-white hover:bg-orange-700 transition-colors px-4 py-2 rounded-lg flex items-center gap-1.5 shadow-2xs font-body-sm text-xs font-semibold cursor-pointer active:scale-95 ${isValidating ? "opacity-75 cursor-not-allowed" : ""}`}
            >
              <span className={`material-symbols-outlined text-[16px] ${isValidating ? "animate-spin" : ""}`}>
                {isValidating ? "refresh" : "verified"}
              </span>
              {isValidating ? "Validating CPCV..." : "Run Purged K-Fold Validation"}
            </button>
          </div>
        </div>

        {/* Validation Progress Banner */}
        {validationStep && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 flex items-center gap-3 shadow-2xs">
            <span className="material-symbols-outlined text-orange-600 animate-spin">refresh</span>
            <div className="flex-1">
              <p className="text-xs font-semibold text-orange-900">{validationStep}</p>
              <div className="w-full bg-orange-200/60 rounded-full h-1 mt-1.5 overflow-hidden">
                <div className="bg-orange-600 h-1 rounded-full animate-pulse" style={{ width: "80%" }}></div>
              </div>
            </div>
          </div>
        )}

        {/* Filter & Search Toolbar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-lg border border-[#e5e5df] shadow-xs">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs text-stone-500 font-bold uppercase tracking-wider">Filter:</span>
            {(["All", "Technical", "Sentiment", "Macro", "Statistical Arbitrage"] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors cursor-pointer ${
                  selectedCategory === cat
                    ? "bg-orange-600 text-white font-semibold shadow-2xs"
                    : "bg-[#eeeeea] text-stone-600 hover:bg-[#e4e4dd]"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400 text-sm">
              search
            </span>
            <input
              type="text"
              placeholder="Search signals..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#f8f8f6] text-stone-900 text-xs rounded-lg border border-[#e5e5df] pl-8 pr-3 py-1.5 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
            />
          </div>
        </div>

        {/* Candidate Signals Section */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <h3 className="text-headline-md font-headline-md text-stone-900 font-semibold">
              Candidate Signals
            </h3>
            <span className="px-2.5 py-0.5 bg-[#eeeeea] border border-[#e5e5df] text-stone-600 text-[11px] font-semibold rounded-full">
              {filteredCandidates.length} Queued for review
            </span>
          </div>

          {/* Data Table Container */}
          <div className="bg-white border border-[#e5e5df] rounded-lg overflow-x-auto shadow-xs">
            <table className="w-full text-left border-collapse">
              <thead className="bg-[#eeeeea] border-b border-[#e5e5df]">
                <tr>
                  <th className="px-4 py-3 text-stone-600 font-label-caps uppercase tracking-wider font-semibold text-[11px]">
                    Signal Name / ID
                  </th>
                  <th className="px-4 py-3 text-stone-600 font-label-caps uppercase tracking-wider font-semibold text-[11px]">
                    Category
                  </th>
                  <th className="px-4 py-3 text-stone-600 font-label-caps uppercase tracking-wider font-semibold text-[11px] text-right">
                    OOS Sharpe (Ann.)
                  </th>
                  <th className="px-4 py-3 text-stone-600 font-label-caps uppercase tracking-wider font-semibold text-[11px] text-right">
                    Max Drawdown
                  </th>
                  <th className="px-4 py-3 text-stone-600 font-label-caps uppercase tracking-wider font-semibold text-[11px]">
                    Validation Status
                  </th>
                  <th className="px-4 py-3 text-stone-600 font-label-caps uppercase tracking-wider font-semibold text-[11px] text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0f0ec]">
                {filteredCandidates.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-6 text-xs text-stone-400">
                      No candidate signals match the filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredCandidates.map((sig) => (
                    <tr key={sig.id} className="hover:bg-[#f5f5f2] transition-colors group">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <span className="material-symbols-outlined text-orange-600 text-[18px]">
                            {sig.category === "Sentiment" ? "forum" : sig.category === "Statistical Arbitrage" ? "tune" : "timeline"}
                          </span>
                          <div>
                            <div className="text-body-sm font-body-sm text-stone-900 font-semibold">
                              {sig.name}
                            </div>
                            <div className="text-data-metric-sm font-data-metric-sm text-stone-400 font-mono text-xs">
                              {sig.code}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                          sig.category === "Sentiment" ? "bg-purple-50 border-purple-200 text-purple-700" :
                          sig.category === "Statistical Arbitrage" ? "bg-amber-50 border-amber-200 text-amber-800" :
                          "bg-blue-50 border-blue-200 text-blue-700"
                        }`}>
                          {sig.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right text-data-metric-sm font-data-metric-sm font-mono text-orange-600 font-bold">
                        +{sig.oosSharpe}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right text-data-metric-sm font-data-metric-sm font-mono text-rose-800 font-semibold">
                        {sig.maxDrawdown}%
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold w-fit border ${
                          sig.status === "Backtest Running" ? "text-amber-800 bg-amber-50 border-amber-200" : "text-stone-600 bg-[#eeeeea] border-[#e5e5df]"
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${sig.status === "Backtest Running" ? "bg-amber-500 animate-pulse" : "bg-stone-400"}`}></span>
                          <span>{sig.status}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <button 
                          onClick={() => setInspectingSignal(sig)}
                          className="h-7 px-3 bg-white border border-[#d6d3d1] text-stone-700 hover:text-orange-600 hover:border-orange-300 rounded-md transition-colors text-xs font-semibold shadow-2xs cursor-pointer"
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Validated Signals Section */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <h3 className="text-headline-md font-headline-md text-stone-900 font-semibold">
              Validated Signals
            </h3>
            <span className="px-2.5 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-semibold rounded-full">
              {filteredValidated.length} Passed Purged K-Fold &amp; DSR
            </span>
          </div>

          {/* Data Table Container */}
          <div className="bg-white border border-[#e5e5df] rounded-lg overflow-x-auto shadow-xs">
            <table className="w-full text-left border-collapse">
              <thead className="bg-[#eeeeea] border-b border-[#e5e5df]">
                <tr>
                  <th className="px-4 py-3 text-stone-600 font-label-caps uppercase tracking-wider font-semibold text-[11px]">
                    Signal Name / ID
                  </th>
                  <th className="px-4 py-3 text-stone-600 font-label-caps uppercase tracking-wider font-semibold text-[11px]">
                    Category
                  </th>
                  <th className="px-4 py-3 text-stone-600 font-label-caps uppercase tracking-wider font-semibold text-[11px] text-right">
                    OOS Sharpe (Ann.)
                  </th>
                  <th className="px-4 py-3 text-stone-600 font-label-caps uppercase tracking-wider font-semibold text-[11px] text-right">
                    DSR Score
                  </th>
                  <th className="px-4 py-3 text-stone-600 font-label-caps uppercase tracking-wider font-semibold text-[11px]">
                    Validation Status
                  </th>
                  <th className="px-4 py-3 text-stone-600 font-label-caps uppercase tracking-wider font-semibold text-[11px] text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0f0ec]">
                {filteredValidated.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-6 text-xs text-stone-400">
                      No validated signals match the filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredValidated.map((sig) => (
                    <tr key={sig.id} className="hover:bg-[#f5f5f2] transition-colors group">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <span className="material-symbols-outlined text-orange-600 text-[18px]">
                            {sig.category === "Macro" ? "account_balance" : "auto_graph"}
                          </span>
                          <div>
                            <div className="text-body-sm font-body-sm text-stone-900 font-semibold">
                              {sig.name}
                            </div>
                            <div className="text-data-metric-sm font-data-metric-sm text-stone-400 font-mono text-xs">
                              {sig.code}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#eeeeea] border border-[#e5e5df] text-stone-700 text-xs font-medium">
                          {sig.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right text-data-metric-sm font-data-metric-sm font-mono text-orange-600 font-bold">
                        +{sig.oosSharpe}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right text-data-metric-sm font-data-metric-sm font-mono text-emerald-800 font-bold">
                        {sig.dsr}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full text-xs font-semibold w-fit">
                          <span className="material-symbols-outlined text-[14px] text-emerald-600">
                            check_circle
                          </span>
                          <span>Passed Validation</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <button
                          onClick={() => setInspectingSignal(sig)}
                          className="h-7 px-3 bg-white border border-[#d6d3d1] text-stone-600 hover:text-orange-600 hover:border-orange-300 rounded-md transition-colors text-xs font-semibold shadow-2xs cursor-pointer ml-auto"
                        >
                          Details
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
      {/* Signal Discovery Terminal Drawer */}
      {showDiscoveryTerminal && (
        <div className="fixed bottom-0 left-60 right-0 z-30 transition-all duration-300">
          {/* Terminal Header */}
          <div className="bg-stone-900 border-t border-stone-700 px-4 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-rose-500" />
                <div className="w-3 h-3 rounded-full bg-amber-500" />
                <div className="w-3 h-3 rounded-full bg-emerald-500" />
              </div>
              <span className="font-mono text-xs text-stone-300 font-semibold tracking-wider">
                SIGNAL DISCOVERY ENGINE — CPCV + PBO + DSR PIPELINE
              </span>
              {isDiscovering && (
                <span className="flex items-center gap-1.5 text-[10px] text-amber-400 font-mono font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  RUNNING
                </span>
              )}
              {discoveryComplete && (
                <span className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-mono font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  COMPLETE
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {!isDiscovering && (
                <button
                  onClick={handleRunDiscovery}
                  className="text-[10px] font-mono text-stone-400 hover:text-white px-2 py-1 border border-stone-700 rounded transition-colors cursor-pointer"
                >
                  Re-run
                </button>
              )}
              <button
                onClick={() => setShowDiscoveryTerminal(false)}
                className="text-stone-400 hover:text-white transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
          </div>

          {/* Terminal Body */}
          <div className="bg-[#0d1117] h-52 overflow-y-auto px-4 py-3 font-mono text-xs border-t border-stone-800">
            {discoveryLog.length === 0 && (
              <div className="text-stone-600 animate-pulse">Initializing pipeline...</div>
            )}
            {discoveryLog.map((line) => (
              <div key={line.id} className="flex gap-3 mb-1 leading-relaxed">
                <span className="text-stone-600 shrink-0 select-none">{line.timestamp}</span>
                <span className="text-stone-500 shrink-0 select-none">›</span>
                <span className={
                  line.type === "success" ? "text-emerald-400" :
                  line.type === "rejected" ? "text-rose-400" :
                  line.type === "error" ? "text-red-400" :
                  line.type === "complete" ? "text-cyan-400 font-semibold" :
                  "text-stone-300"
                }>
                  {line.message}
                </span>
              </div>
            ))}
            <div ref={terminalEndRef} />
          </div>
        </div>
      )}
    </div>
  );
}
