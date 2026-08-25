import Link from "next/link";

export default function SupportPage() {
  return (
    <main className="min-h-screen bg-[#f5f5f2] text-stone-900 p-8">
      <div className="max-w-6xl mx-auto flex flex-col gap-8">
        <header>
          <Link href="/" className="text-sm text-orange-700 font-semibold">Back to Overview</Link>
          <h1 className="text-3xl font-bold tracking-tight mt-3">Support</h1>
          <p className="text-stone-600 mt-2 max-w-2xl leading-relaxed">Operational guidance and research diagnostics for QuantAlpha.</p>
        </header>
        <section className="bg-white border border-stone-200 rounded-xl p-8">
          <h2 className="font-bold">Support workspace is not configured</h2>
          <p className="text-sm text-stone-500 mt-2 leading-relaxed">Use the research run history and backend error details to diagnose real-data failures. No fake incidents or status messages are shown.</p>
        </section>
      </div>
    </main>
  );
}
