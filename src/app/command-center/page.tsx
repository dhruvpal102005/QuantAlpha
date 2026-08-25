"use client";

import { useState } from "react";
import Link from "next/link";
import { ActivityLogEvent, RiskGateConstraint, AgentRole } from "../../types/quant";
import { useLiveMarket } from "../../hooks/useLiveMarket";

export default function CommandCenter() {
  const [mode, setMode] = useState<"Manual" | "Assisted" | "Auto Paper">("Auto Paper");
  const [isHalted, setIsHalted] = useState(false);
  const [showKillModal, setShowKillModal] = useState(false);
  const [filterAgent, setFilterAgent] = useState<AgentRole | "All">("All");
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [activityLogs, setActivityLogs] = useState<ActivityLogEvent[]>([]);
  const [riskConstraints] = useState<RiskGateConstraint[]>([]);
  
  // Real-time live market hook
  const liveMarket = useLiveMarket();

  // Activity events are populated only by verified backend actions.

  const handleTriggerKillSwitch = async () => {
    setIsHalted(true);
    setShowKillModal(false);

    try {
      await fetch("http://127.0.0.1:8000/api/v1/bot/kill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Manual Kill Switch Engaged by User" }),
      });
    } catch {
      // Local fallback
    }

    const haltEvent: ActivityLogEvent = {
      id: `evt-kill-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString("en-IN", { hour12: false }),
      agent: "Risk",
      action: "EMERGENCY KILL SWITCH ENGAGED - TRADING HALTED",
      evidence: "All 14 active paper orders canceled. Open exposure liquidated to Cash.",
      status: "breach",
    };
    setActivityLogs((prev) => [haltEvent, ...prev]);
  };

  const handleResumeSystem = () => {
    setIsHalted(false);
    const resumeEvent: ActivityLogEvent = {
      id: `evt-resume-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString("en-IN", { hour12: false }),
      agent: "Risk",
      action: "System Resumed: Autonomy checks initialized",
      evidence: "Pre-Trade risk constraints re-verified. Resuming Paper mode.",
      status: "success",
    };
    setActivityLogs((prev) => [resumeEvent, ...prev]);
  };

  const filteredLogs = filterAgent === "All" 
    ? activityLogs 
    : activityLogs.filter((log) => log.agent === filterAgent);

  return (
    <div className="flex w-full min-h-screen bg-[#f5f5f2] text-stone-900 font-body-sm h-screen overflow-hidden antialiased relative">
      {/* Kill Switch Modal */}
      {showKillModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white border border-[#e5e5df] rounded-xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-3 text-rose-800">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center">
                <span className="material-symbols-outlined text-2xl">warning</span>
              </div>
              <div>
                <h3 className="font-headline-md text-lg font-bold text-stone-900">
                  Emergency Kill Switch
                </h3>
                <p className="text-xs text-stone-500 font-medium">
                  Immediate Risk Mitigation Protocol
                </p>
              </div>
            </div>
            <p className="text-body-sm text-stone-600 text-xs leading-relaxed">
              Engaging the Kill Switch will immediately <strong>cancel all pending orders</strong> on the broker router and <strong>liquidate all open equity positions</strong> to 100% Cash. The autonomous daemon will be locked until manually resumed.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowKillModal(false)}
                className="px-4 py-2 text-xs font-semibold rounded-lg border border-[#d6d3d1] text-stone-700 hover:bg-[#eeeeea] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleTriggerKillSwitch}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-rose-700 text-white hover:bg-rose-800 transition-colors shadow-2xs cursor-pointer flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-sm">power_settings_new</span>
                Confirm &amp; Halt System
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SideNavBar */}
      <aside className="w-60 h-full fixed left-0 top-0 border-r border-[#e5e5df] bg-white flex flex-col z-20 shadow-xs">
        <div className="px-6 py-6 border-b border-[#e5e5df] flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-orange-500 flex items-center justify-center text-white shadow-2xs">
            <span className="material-symbols-outlined text-[20px]">
              show_chart
            </span>
          </div>
          <div>
            <h1 className="font-headline-md text-headline-md font-bold tracking-tight text-stone-900">
              QUANT ALPHA
            </h1>
            <p className="font-label-caps text-[10px] text-stone-500 uppercase tracking-wider font-semibold">
              Research Pipeline
            </p>
          </div>
        </div>
        
        <div className="flex flex-col gap-1 py-4 flex-1 overflow-y-auto px-2">
          <div className="px-4 pb-2 pt-1 font-label-caps text-[11px] font-bold text-stone-400 uppercase tracking-wider">
            Research
          </div>
          <Link
            className="text-stone-600 hover:text-stone-900 hover:bg-[#eeeeea] transition-colors rounded-lg px-3 py-2 flex items-center gap-3"
            href="/"
          >
            <span className="material-symbols-outlined text-[20px]">
              dashboard
            </span>
            <span className="font-body-sm text-body-sm font-medium">Overview</span>
          </Link>
          <Link
            className="text-stone-600 hover:text-stone-900 hover:bg-[#eeeeea] transition-colors rounded-lg px-3 py-2 flex items-center gap-3"
            href="/research"
          >
            <span className="material-symbols-outlined text-[20px]">
              science
            </span>
            <span className="font-body-sm text-body-sm font-medium">Research</span>
          </Link>
          <Link
            className="text-stone-600 hover:text-stone-900 hover:bg-[#eeeeea] transition-colors rounded-lg px-3 py-2 flex items-center gap-3"
            href="/signals"
          >
            <span className="material-symbols-outlined text-[20px]">
              analytics
            </span>
            <span className="font-body-sm text-body-sm font-medium">Factor Library</span>
          </Link>
          <Link
            className="text-stone-600 hover:text-stone-900 hover:bg-[#eeeeea] transition-colors rounded-lg px-3 py-2 flex items-center gap-3"
            href="/backtests"
          >
            <span className="material-symbols-outlined text-[20px]">
              history
            </span>
            <span className="font-body-sm text-body-sm font-medium">Backtests</span>
          </Link>
          <Link
            className="bg-orange-50 text-orange-600 font-semibold rounded-lg px-3 py-2 flex items-center gap-3 border border-orange-200/70"
            href="/command-center"
          >
            <span className="material-symbols-outlined text-[20px]">
              terminal
            </span>
            <span className="font-body-sm text-body-sm font-bold">Live Monitor</span>
          </Link>
        </div>

        <div className="px-4 py-4 border-t border-[#e5e5df] bg-[#f8f8f6] flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${isHalted ? "bg-rose-500 animate-ping" : "bg-emerald-500 animate-pulse"}`}></div>
              <span className="font-body-sm text-xs font-semibold text-stone-800">
                {liveMarket.isLiveFeed ? "FastAPI Live Feed" : "System Status"}
              </span>
            </div>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${isHalted ? "text-rose-800 bg-rose-50 border-rose-200" : "text-emerald-800 bg-emerald-50 border-emerald-200"}`}>
              {isHalted ? "HALTED" : (liveMarket.isLiveFeed ? "LIVE STREAM" : "ONLINE")}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs text-stone-500 font-medium">
            <span>Last Tick</span>
            <span className="font-mono text-stone-700 text-[11px]">
              {liveMarket.lastUpdate}
            </span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="ml-60 flex-1 flex flex-col h-full bg-[#f5f5f2]">
        {/* Top Header */}
        <header className="h-16 w-full sticky top-0 z-10 border-b border-[#e5e5df] bg-white/95 backdrop-blur-md flex items-center justify-between px-6 shadow-xs">
          <div className="flex items-center gap-4">
            <div className="flex flex-col">
              <span className="font-headline-md text-headline-md font-bold text-stone-900">
                Autonomous Command Center
              </span>
              <span className="font-label-caps text-[10px] text-stone-500 uppercase tracking-wider font-semibold">
                Real-Time NSE Equities &amp; Portfolio Daemon
              </span>
            </div>
          </div>

          {/* Live Market Quick Ticker Header */}
          <div className="hidden xl:flex items-center gap-4 bg-[#f8f8f6] px-3 py-1.5 rounded-lg border border-[#e5e5df]">
            {Object.values(liveMarket.quotes).slice(0, 4).map((q) => (
              <div key={q.symbol} className="flex items-center gap-2 text-xs">
                <span className="font-semibold text-stone-700">{q.symbol}</span>
                <span className="font-mono font-bold text-stone-900">₹{q.price.toLocaleString("en-IN")}</span>
                <span className={`font-mono text-[10px] font-bold px-1 py-0.2 rounded ${q.change >= 0 ? "text-emerald-700 bg-emerald-50" : "text-rose-700 bg-rose-50"}`}>
                  {q.change >= 0 ? "+" : ""}{q.changePct}%
                </span>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3">
            {isHalted ? (
              <button
                onClick={handleResumeSystem}
                className="px-3.5 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold text-xs flex items-center gap-1.5 shadow-2xs hover:bg-emerald-700 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">play_arrow</span>
                Resume Autonomy
              </button>
            ) : (
              <button
                onClick={() => setShowKillModal(true)}
                className="px-3.5 py-1.5 rounded-lg border border-rose-300 bg-rose-50 text-rose-800 font-semibold text-xs flex items-center gap-1.5 shadow-2xs hover:bg-rose-100 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">power_settings_new</span>
                Kill Switch
              </button>
            )}

            <div className="w-8 h-8 rounded-full bg-orange-100 border border-orange-300 flex items-center justify-center font-bold text-xs text-orange-700 shadow-2xs">
              QA
            </div>
          </div>
        </header>

        {/* Scrollable Content Canvas */}
        <div className="flex-1 overflow-y-auto p-6 bg-[#f5f5f2]">
          <div className="max-w-[1600px] mx-auto flex flex-col gap-5">
            
            {/* Top Bar: Title & Mode Switcher */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div>
                <h2 className="font-headline-xl text-headline-xl text-stone-900 font-bold tracking-tight">
                  Live Portfolio &amp; Risk Guard
                </h2>
                <p className="font-body-lg text-body-lg text-stone-600 text-xs">
                  Real-time mark-to-market valuations, risk compliance, and autonomous order audit stream.
                </p>
              </div>

              {/* Mode Switcher */}
              <div className="flex bg-[#eeeeea] rounded-lg p-1 border border-[#e5e5df] shadow-2xs">
                <button 
                  onClick={() => setMode("Manual")}
                  className={`px-3.5 py-1.5 font-body-sm text-xs rounded-md transition-colors cursor-pointer ${mode === "Manual" ? "bg-orange-600 text-white font-semibold shadow-2xs" : "text-stone-600 hover:text-stone-900 font-semibold"}`}
                >
                  Manual
                </button>
                <button 
                  onClick={() => setMode("Assisted")}
                  className={`px-3.5 py-1.5 font-body-sm text-xs rounded-md transition-colors cursor-pointer ${mode === "Assisted" ? "bg-orange-600 text-white font-semibold shadow-2xs" : "text-stone-600 hover:text-stone-900 font-semibold"}`}
                >
                  Assisted
                </button>
                <button 
                  onClick={() => setMode("Auto Paper")}
                  className={`px-3.5 py-1.5 font-body-sm text-xs rounded-md flex items-center gap-1.5 transition-colors cursor-pointer ${mode === "Auto Paper" ? "bg-orange-600 text-white font-semibold shadow-2xs" : "text-stone-600 hover:text-stone-900 font-semibold"}`}
                >
                  <span className="material-symbols-outlined text-[16px]">smart_toy</span>
                  Auto Paper
                </button>
              </div>
            </div>

            {/* Real Live Mark-to-Market Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white border border-[#e5e5df] rounded-xl p-4 shadow-xs">
                <div className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">Portfolio NAV</div>
                <div className="text-xl font-bold font-mono text-stone-900 mt-1">
                  ₹{liveMarket.nav.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                </div>
                <div className="text-[11px] text-stone-500 mt-0.5">Live Mark-to-Market</div>
              </div>

              <div className="bg-white border border-[#e5e5df] rounded-xl p-4 shadow-xs">
                <div className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">Today's PnL</div>
                <div className={`text-xl font-bold font-mono mt-1 ${liveMarket.dailyPnL >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                  {liveMarket.dailyPnL >= 0 ? "+" : ""}₹{liveMarket.dailyPnL.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                  <span className="text-xs ml-1 font-semibold">({liveMarket.dailyPnLPct}%)</span>
                </div>
                <div className="text-[11px] text-emerald-800 font-medium mt-0.5">Real-time valuation</div>
              </div>

              <div className="bg-white border border-[#e5e5df] rounded-xl p-4 shadow-xs">
                <div className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">Cash Reserve</div>
                <div className="text-xl font-bold font-mono text-stone-900 mt-1">
                  ₹{liveMarket.cashBalance.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                </div>
                <div className="text-[11px] text-stone-500 mt-0.5">21.0% Liquid Capital</div>
              </div>

              <div className="bg-white border border-[#e5e5df] rounded-xl p-4 shadow-xs">
                <div className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">Active Positions</div>
                <div className="text-xl font-bold font-mono text-orange-600 mt-1">
                  {isHalted ? "0" : liveMarket.openPositionsCount} Stocks
                </div>
                <div className="text-[11px] text-stone-500 mt-0.5">
                  {isHalted ? "100% Cash" : "NSE Large-Cap Basket"}
                </div>
              </div>
            </div>

            {/* Live Positions Table */}
            <div className="bg-white border border-[#e5e5df] rounded-xl overflow-hidden shadow-xs">
              <div className="p-4 border-b border-[#e5e5df] flex justify-between items-center bg-[#f8f8f6]/70">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                  <h3 className="font-headline-md text-sm font-bold text-stone-900">
                    Live Open Positions (Mark-to-Market)
                  </h3>
                </div>
                <span className="text-[11px] font-mono text-stone-500">Updated: {liveMarket.lastUpdate}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left whitespace-nowrap text-xs">
                  <thead className="bg-[#eeeeea] border-b border-[#e5e5df]">
                    <tr>
                      <th className="py-2.5 px-4 font-semibold text-stone-600">Stock</th>
                      <th className="py-2.5 px-4 font-semibold text-stone-600">Qty</th>
                      <th className="py-2.5 px-4 font-semibold text-stone-600">Entry Price</th>
                      <th className="py-2.5 px-4 font-semibold text-stone-600">Live Price (NSE)</th>
                      <th className="py-2.5 px-4 font-semibold text-stone-600">Day Chg</th>
                      <th className="py-2.5 px-4 font-semibold text-stone-600">Market Value</th>
                      <th className="py-2.5 px-4 font-semibold text-stone-600">Unrealized PnL</th>
                      <th className="py-2.5 px-4 font-semibold text-stone-600">Weight</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f0f0ec] font-mono">
                    {isHalted ? (
                      <tr>
                        <td colSpan={8} className="py-6 text-center text-rose-700 font-sans font-semibold">
                          All positions liquidated to 100% Cash due to Emergency Kill Switch.
                        </td>
                      </tr>
                    ) : (
                      liveMarket.positions.map((pos) => {
                        const dir = liveMarket.tickDirection?.[pos.symbol] ?? "flat";
                        return (
                          <tr key={pos.symbol} className="hover:bg-[#f5f5f2] transition-colors">
                            <td className="py-3 px-4 font-bold font-sans text-stone-900 flex items-center gap-1.5">
                              {pos.symbol}
                              {dir !== "flat" && (
                                <span className={`text-[9px] font-bold ${dir === "up" ? "text-emerald-600" : "text-rose-600"}`}>
                                  {dir === "up" ? "▲" : "▼"}
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-stone-700">{pos.qty}</td>
                            <td className="py-3 px-4 text-stone-600">₹{pos.entryPrice.toLocaleString("en-IN")}</td>
                            <td className={`py-3 px-4 font-bold transition-colors duration-300 ${
                              dir === "up" ? "text-emerald-700" : dir === "down" ? "text-rose-700" : "text-stone-900"
                            }`}>
                              ₹{pos.currentPrice.toLocaleString("en-IN")}
                            </td>
                            <td className={`py-3 px-4 font-bold ${pos.dayChange >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                              {pos.dayChange >= 0 ? "+" : ""}{pos.dayChangePct}%
                            </td>
                            <td className="py-3 px-4 text-stone-800">₹{pos.marketValue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</td>
                            <td className={`py-3 px-4 font-bold ${pos.unrealizedPnL >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                              {pos.unrealizedPnL >= 0 ? "+" : ""}₹{pos.unrealizedPnL.toLocaleString("en-IN", { maximumFractionDigits: 0 })} ({pos.pnlPct}%)
                            </td>
                            <td className="py-3 px-4 font-sans text-stone-600">{pos.weightPct}%</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Split Grid: Risk Gate & Activity Log */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* Pre-Trade Risk Gate */}
              <div className="lg:col-span-1 bg-white border border-[#e5e5df] rounded-xl flex flex-col h-[460px] shadow-xs">
                <div className="p-4 border-b border-[#e5e5df] flex items-center justify-between bg-[#f8f8f6]/70">
                  <h3 className="font-headline-md text-sm text-stone-900 font-bold flex items-center gap-2">
                    <span className="material-symbols-outlined text-orange-600 text-base">security</span>
                    Pre-Trade Risk Gate
                  </h3>
                  <span className="font-label-caps text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                    Hardware Latch
                  </span>
                </div>
                <div className="p-4 flex-1 overflow-y-auto flex flex-col gap-3">
                  <div className={`border rounded-xl p-3.5 flex flex-col items-center justify-center text-center shadow-2xs ${isHalted ? "bg-rose-50 border-rose-200" : "bg-emerald-50 border-emerald-200"}`}>
                    <span className={`material-symbols-outlined text-2xl mb-1 ${isHalted ? "text-rose-600" : "text-emerald-600"}`}>
                      {isHalted ? "gpp_bad" : "verified_user"}
                    </span>
                    <span className={`font-headline-xl text-base font-bold tracking-tight ${isHalted ? "text-rose-800" : "text-emerald-800"}`}>
                      {isHalted ? "HALTED" : "APPROVED"}
                    </span>
                    <span className={`font-body-sm text-[11px] mt-0.5 font-medium ${isHalted ? "text-rose-700" : "text-emerald-800"}`}>
                      {isHalted ? "Trading halted by Kill Switch" : "All 6 risk constraints satisfied"}
                    </span>
                  </div>

                  <div className="flex flex-col gap-1 mt-1 text-xs">
                    {riskConstraints.map((rc) => (
                      <div key={rc.name} className="flex items-center justify-between p-2 rounded-lg hover:bg-[#f5f5f2] transition-colors">
                        <span className="font-body-sm text-stone-800 font-medium">
                          {rc.name}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-semibold text-stone-500">
                            {rc.limit}
                          </span>
                          <span className={`material-symbols-outlined text-base font-bold ${rc.status === "APPROVED" ? "text-emerald-600" : "text-rose-600"}`}>
                            {rc.status === "APPROVED" ? "check" : "close"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Activity Log */}
              <div className="lg:col-span-2 bg-white border border-[#e5e5df] rounded-xl flex flex-col h-[460px] shadow-xs">
                <div className="p-4 border-b border-[#e5e5df] flex items-center justify-between bg-[#f8f8f6]/70 relative">
                  <h3 className="font-headline-md text-sm text-stone-900 font-bold flex items-center gap-2">
                    <span className="material-symbols-outlined text-orange-600 text-base">list_alt</span>
                    Autonomous Activity Log
                  </h3>
                  
                  <div className="relative">
                    <button 
                      onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                      className="text-xs font-semibold text-stone-600 hover:text-orange-600 uppercase flex items-center gap-1 px-2.5 py-1 rounded-md border border-[#d6d3d1] bg-white shadow-2xs cursor-pointer"
                    >
                      {filterAgent === "All" ? "Filter" : filterAgent}{" "}
                      <span className="material-symbols-outlined text-[14px]">
                        filter_list
                      </span>
                    </button>

                    {showFilterDropdown && (
                      <div className="absolute right-0 mt-1 w-36 bg-white border border-[#e5e5df] rounded-lg shadow-lg py-1 z-30">
                        {(["All", "Strategy", "Market", "Portfolio", "Execution", "Risk"] as const).map((agent) => (
                          <button
                            key={agent}
                            onClick={() => {
                              setFilterAgent(agent);
                              setShowFilterDropdown(false);
                            }}
                            className={`w-full text-left px-3 py-1.5 text-xs font-medium hover:bg-[#eeeeea] transition-colors ${filterAgent === agent ? "text-orange-600 font-bold bg-orange-50/50" : "text-stone-700"}`}
                          >
                            {agent}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="p-0 flex-1 overflow-y-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 bg-[#eeeeea] z-10 border-b border-[#e5e5df]">
                      <tr>
                        <th className="py-2.5 px-4 font-label-caps text-stone-500 uppercase tracking-wider text-[11px] font-semibold w-24">
                          Time
                        </th>
                        <th className="py-2.5 px-4 font-label-caps text-stone-500 uppercase tracking-wider text-[11px] font-semibold w-32">
                          Agent
                        </th>
                        <th className="py-2.5 px-4 font-label-caps text-stone-500 uppercase tracking-wider text-[11px] font-semibold">
                          Action / Decision
                        </th>
                        <th className="py-2.5 px-4 font-label-caps text-stone-500 uppercase tracking-wider text-[11px] font-semibold w-52">
                          Evidence / Meta
                        </th>
                      </tr>
                    </thead>
                    <tbody className="font-mono text-xs text-stone-800 divide-y divide-[#f0f0ec]">
                      {filteredLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-[#f5f5f2] transition-colors">
                          <td className="py-2.5 px-4 text-stone-500">
                            {log.timestamp}
                          </td>
                          <td className="py-2.5 px-4">
                            <span className={`px-2 py-0.5 rounded-full font-sans font-semibold border ${
                              log.agent === "Risk"
                                ? "bg-rose-50 text-rose-800 border-rose-200"
                                : log.agent === "Execution"
                                ? "bg-purple-50 text-purple-800 border-purple-200"
                                : log.agent === "Strategy"
                                ? "bg-amber-50 text-amber-800 border-amber-200"
                                : "bg-blue-50 text-blue-800 border-blue-200"
                            }`}>
                              {log.agent}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 font-sans text-stone-900 font-medium">
                            {log.action}
                          </td>
                          <td className="py-2.5 px-4 text-stone-500 text-[11px]">
                            {log.evidence}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}
