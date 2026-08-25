"use client";

import Link from "next/link";
import { useLiveMarket } from "../../hooks/useLiveMarket";

export default function PortfolioPage() {
  const market = useLiveMarket();

  return (
    <main className="min-h-screen bg-[#f5f5f2] text-stone-900 p-8">
      <div className="max-w-6xl mx-auto flex flex-col gap-8">
        <header className="flex items-start justify-between gap-4">
          <div>
            <Link href="/" className="text-sm text-orange-700 font-semibold">Back to Overview</Link>
            <h1 className="text-3xl font-bold tracking-tight mt-3">Portfolio</h1>
            <p className="text-stone-600 mt-2 max-w-2xl leading-relaxed">Verified positions and balances will appear here once a persisted paper portfolio is configured.</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${market.isConnected ? "bg-emerald-100 text-emerald-800" : "bg-stone-200 text-stone-600"}`}>
            {market.isConnected ? "Connected" : "No verified portfolio"}
          </span>
        </header>
        <section className="bg-white border border-stone-200 rounded-xl p-8">
          <h2 className="font-bold">Portfolio data unavailable</h2>
          <p className="text-sm text-stone-500 mt-2 leading-relaxed">No cash balance, holdings, fills, or PnL are fabricated. Connect a persisted paper-trading account before this surface displays portfolio values.</p>
        </section>
      </div>
    </main>
  );
}
