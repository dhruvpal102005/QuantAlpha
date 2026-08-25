"use client";

import { useState } from "react";
import Link from "next/link";

type ResearchRun = {
  id: string;
  signal_id: string;
  run_type: string;
  status: string;
  parameters: Record<string, unknown>;
  result: Record<string, unknown> | null;
  data_source: string;
  data_hash: string | null;
  error: string | null;
  started_at: string;
  completed_at: string | null;
};

export default function ValidationPage() {
  const [runs, setRuns] = useState<ResearchRun[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "unavailable">("idle");

  async function loadRuns() {
    setStatus("loading");
    try {
      const response = await fetch("http://127.0.0.1:8000/api/v1/research/runs", { cache: "no-store" });
      if (!response.ok) throw new Error("Research history unavailable");
      const payload = (await response.json()) as { runs: ResearchRun[] };
      setRuns(payload.runs);
      setStatus("ready");
    } catch {
      setRuns([]);
      setStatus("unavailable");
    }
  }

  return (
    <main className="min-h-screen bg-[#f5f5f2] text-stone-900 p-8">
      <div className="max-w-6xl mx-auto flex flex-col gap-8">
        <header className="flex items-start justify-between gap-4">
          <div>
            <Link href="/research" className="text-sm text-orange-700 font-semibold">Back to Research</Link>
            <h1 className="text-3xl font-bold tracking-tight mt-3">Validation Runs</h1>
            <p className="text-stone-600 mt-2 max-w-2xl leading-relaxed">
              Auditable CPCV, PBO, and DSR runs loaded from the persistent research store. No run is displayed until it has been created by the real backend.
            </p>
          </div>
          <button onClick={loadRuns} disabled={status === "loading"} className="rounded-lg bg-orange-600 text-white px-4 py-2 font-semibold disabled:opacity-50">
            {status === "loading" ? "Loading..." : "Refresh Runs"}
          </button>
        </header>

        {status === "unavailable" && (
          <section className="border border-rose-200 bg-rose-50 rounded-xl p-5">
            <h2 className="font-bold text-rose-900">Research history unavailable</h2>
            <p className="text-sm text-rose-800 mt-1">The API or Neon persistence layer could not be reached. No fallback or synthetic runs were generated.</p>
          </section>
        )}

        {status === "ready" && runs.length === 0 && (
          <section className="border border-stone-200 bg-white rounded-xl p-8 text-center">
            <h2 className="font-bold">No validation runs yet</h2>
            <p className="text-sm text-stone-500 mt-2">Create a signal and run the real validation pipeline to populate this history.</p>
          </section>
        )}

        <section className="bg-white border border-stone-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between">
            <h2 className="font-bold">Persistent run history</h2>
            <span className="text-xs text-stone-500 font-mono">{runs.length} runs</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
                <tr><th className="px-5 py-3">Run</th><th className="px-5 py-3">Signal</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Data source</th><th className="px-5 py-3">Started</th></tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.id} className="border-t border-stone-100">
                    <td className="px-5 py-4 font-mono text-xs">{run.id}</td>
                    <td className="px-5 py-4 font-semibold">{run.signal_id}</td>
                    <td className="px-5 py-4"><span className="rounded-full bg-stone-100 px-2 py-1 text-xs font-semibold">{run.status}</span></td>
                    <td className="px-5 py-4 text-stone-600">{run.data_source}</td>
                    <td className="px-5 py-4 text-stone-600">{new Date(run.started_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
