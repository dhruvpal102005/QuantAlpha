import Link from "next/link";

export default function SettingsPage() {
  return (
    <main className="min-h-screen bg-[#f5f5f2] text-stone-900 p-8">
      <div className="max-w-6xl mx-auto flex flex-col gap-8">
        <header>
          <Link href="/" className="text-sm text-orange-700 font-semibold">Back to Overview</Link>
          <h1 className="text-3xl font-bold tracking-tight mt-3">Settings</h1>
          <p className="text-stone-600 mt-2 max-w-2xl leading-relaxed">Configure verified data providers, research defaults, and execution safety controls.</p>
        </header>
        <section className="bg-white border border-stone-200 rounded-xl p-8">
          <h2 className="font-bold">Configuration is not available yet</h2>
          <p className="text-sm text-stone-500 mt-2 leading-relaxed">No provider credentials, risk limits, or execution settings are fabricated. These controls will be enabled when their persisted configuration and audit flow are implemented.</p>
        </section>
      </div>
    </main>
  );
}
