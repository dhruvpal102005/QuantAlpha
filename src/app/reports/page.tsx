import Link from "next/link";

export default function ReportsPage() {
  return (
    <main className="min-h-screen bg-[#f5f5f2] text-stone-900 p-8">
      <div className="max-w-6xl mx-auto flex flex-col gap-8">
        <header>
          <Link href="/" className="text-sm text-orange-700 font-semibold">Back to Overview</Link>
          <h1 className="text-3xl font-bold tracking-tight mt-3">Research Reports</h1>
          <p className="text-stone-600 mt-2 max-w-2xl leading-relaxed">Reproducibility packages will be generated from persisted validation and backtest runs.</p>
        </header>
        <section className="bg-white border border-stone-200 rounded-xl p-8">
          <h2 className="font-bold">No reports available</h2>
          <p className="text-sm text-stone-500 mt-2 leading-relaxed">Run a real validation or backtest with verified market data to generate an auditable report. No placeholder report is shown.</p>
        </section>
      </div>
    </main>
  );
}
