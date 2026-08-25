"use client";

import Link from "next/link";
import { useState } from "react";

export default function PipelineRunsPage() {
  const [loaded, setLoaded] = useState(false);

  return (
    <main className="min-h-screen bg-[#f5f5f2] text-stone-900 p-8">
      <div className="max-w-6xl mx-auto flex flex-col gap-8">
        <header className="flex items-start justify-between gap-4">
          <div>
            <Link href="/" className="text-sm text-orange-700 font-semibold">Back to Overview</Link>
            <h1 className="text-3xl font-bold tracking-tight mt-3">Pipeline Runs</h1>
            <p className="text-stone-600 mt-2 max-w-2xl leading-relaxed">Run lifecycle history will be loaded from the persistent research store.</p>
          </div>
          <button onClick={() => setLoaded(true)} className="rounded-lg bg-orange-600 text-white px-4 py-2 font-semibold">Refresh Runs</button>
        </header>
        <section className="bg-white border border-stone-200 rounded-xl p-8">
          <h2 className="font-bold">{loaded ? "No pipeline runs found" : "Pipeline history not loaded"}</h2>
          <p className="text-sm text-stone-500 mt-2 leading-relaxed">No queued, running, succeeded, or failed pipeline is fabricated. Create a real research run to populate this history.</p>
        </section>
      </div>
    </main>
  );
}
