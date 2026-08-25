"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { createSignal, fetchDatasets, fetchResearchRuns, fetchSignals, startValidation } from "../../services/quantApi";

type Signal = { id: string; name: string; category: string; description: string; formula: string };
type Dataset = { id: string; label: string; ticker: string; source: string; kind: string };
type ResearchRun = { id: string; signal_id: string; status: string; result: Record<string, unknown> | null; data_source: string; error: string | null; started_at: string };

export default function ValidationPage() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [runs, setRuns] = useState<ResearchRun[]>([]);
  const [signalId, setSignalId] = useState("");
  const [datasetId, setDatasetId] = useState("");
  const [dates, setDates] = useState({ start: "2020-01-01", end: "2024-12-31" });
  const [status, setStatus] = useState("Loading real catalog...");
  const [busy, setBusy] = useState(false);
  const [newSignal, setNewSignal] = useState({ id: "", name: "", code: "", category: "Momentum", description: "", formula: "" });

  async function load() {
    try {
      const [catalog, dataCatalog, history] = await Promise.all([fetchSignals(), fetchDatasets(), fetchResearchRuns()]);
      setSignals(catalog.candidates);
      setDatasets(dataCatalog.datasets);
      setRuns(history.runs as ResearchRun[]);
      if (!signalId && catalog.candidates[0]) setSignalId(catalog.candidates[0].id);
      if (!datasetId && dataCatalog.datasets[0]) setDatasetId(dataCatalog.datasets[0].id);
      setStatus("Connected to real signal and dataset services");
    } catch {
      setStatus("Unavailable: start the API and connect Neon; no fallback data is shown.");
    }
  }

  useEffect(() => { void load(); }, []);

  async function submitSignal(event: FormEvent) {
    event.preventDefault();
    try {
      await createSignal({ ...newSignal, id: newSignal.id || `sig-${Date.now()}`, code: newSignal.code || "ema_crossover", description: newSignal.description || "User-authored research signal", formula: newSignal.formula || "EMA(20) > EMA(50)" });
      setStatus("Signal persisted. It is now available for validation.");
      setNewSignal({ id: "", name: "", code: "", category: "Momentum", description: "", formula: "" });
      await load();
    } catch (error) { setStatus(error instanceof Error ? error.message : "Signal could not be created."); }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const dataset = datasets.find((item) => item.id === datasetId);
    if (!signalId || !dataset) return setStatus("Select a signal and a real dataset first.");
    setBusy(true);
    try {
      const started = await startValidation({ signalId, ticker: dataset.ticker, startDate: dates.start, endDate: dates.end, cvFolds: 5, embargoPct: 0.01, nTrials: 50 });
      setStatus(`Validation ${started.run_id} queued. Tracking persisted progress...`);
      const poll = window.setInterval(async () => {
        try {
          const history = await fetchResearchRuns();
          const nextRuns = history.runs as ResearchRun[];
          setRuns(nextRuns);
          const current = nextRuns.find((run) => run.id === started.run_id);
          if (current?.status === "completed" || current?.status === "failed") {
            window.clearInterval(poll);
            setStatus(`Validation ${started.run_id} ${current.status}. Result persisted in Neon.`);
          }
        } catch {
          window.clearInterval(poll);
          setStatus("Progress unavailable; the persisted run remains safe in Neon.");
        }
      }, 2000);
      await load();
    } catch (error) { setStatus(error instanceof Error ? error.message : "Validation could not start."); }
    finally { setBusy(false); }
  }

  return (
    <main className="min-h-screen bg-[#f5f5f2] text-stone-900 p-8">
      <div className="max-w-6xl mx-auto flex flex-col gap-8">
        <header><Link href="/research" className="text-sm text-orange-700 font-semibold">Back to Research</Link><h1 className="text-3xl font-bold tracking-tight mt-3">Real Validation Workflow</h1><p className="text-stone-600 mt-2 max-w-2xl leading-relaxed">Create a persistent signal, select verified market data, execute CPCV/PBO/DSR validation, and retain the complete run history.</p></header>
        <form onSubmit={submitSignal} className="bg-white border border-stone-200 rounded-xl p-6 grid gap-4 md:grid-cols-4"><h2 className="md:col-span-4 font-bold">Create signal candidate</h2><input aria-label="Signal name" placeholder="Signal name" value={newSignal.name} onChange={(e) => setNewSignal({ ...newSignal, name: e.target.value })} className="border border-stone-300 rounded-lg p-2" required /><input aria-label="Signal formula" placeholder="Formula, e.g. EMA(20) > EMA(50)" value={newSignal.formula} onChange={(e) => setNewSignal({ ...newSignal, formula: e.target.value })} className="border border-stone-300 rounded-lg p-2 md:col-span-2" required /><button className="rounded-lg border border-orange-600 text-orange-700 px-4 py-2 font-semibold">Save candidate</button></form>
        <form onSubmit={submit} className="bg-white border border-stone-200 rounded-xl p-6 grid gap-5 md:grid-cols-4">
          <label className="flex flex-col gap-2 text-sm font-semibold">Signal<select value={signalId} onChange={(e) => setSignalId(e.target.value)} className="border border-stone-300 rounded-lg p-2 font-normal" disabled={!signals.length}><option value="">No signals available</option>{signals.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label className="flex flex-col gap-2 text-sm font-semibold">Dataset<select value={datasetId} onChange={(e) => setDatasetId(e.target.value)} className="border border-stone-300 rounded-lg p-2 font-normal" disabled={!datasets.length}><option value="">No datasets available</option>{datasets.map((item) => <option key={item.id} value={item.id}>{item.label} · {item.source}</option>)}</select></label>
          <label className="flex flex-col gap-2 text-sm font-semibold">Start date<input type="date" value={dates.start} onChange={(e) => setDates({ ...dates, start: e.target.value })} className="border border-stone-300 rounded-lg p-2 font-normal" /></label>
          <label className="flex flex-col gap-2 text-sm font-semibold">End date<input type="date" value={dates.end} onChange={(e) => setDates({ ...dates, end: e.target.value })} className="border border-stone-300 rounded-lg p-2 font-normal" /></label>
          <button className="md:col-span-4 rounded-lg bg-orange-600 text-white px-4 py-3 font-semibold disabled:opacity-50" disabled={busy || !signals.length || !datasets.length}>{busy ? "Starting..." : "Run real validation"}</button>
        </form>
        <p className="text-sm text-stone-600" role="status">{status}</p>
        <section className="bg-white border border-stone-200 rounded-xl overflow-hidden"><div className="px-5 py-4 border-b border-stone-200 flex justify-between"><h2 className="font-bold">Persisted validation runs</h2><button onClick={() => void load()} className="text-sm text-orange-700 font-semibold">Refresh</button></div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-500"><tr><th className="px-5 py-3">Run</th><th className="px-5 py-3">Signal</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Data</th><th className="px-5 py-3">Started</th></tr></thead><tbody>{runs.map((run) => <tr key={run.id} className="border-t border-stone-100"><td className="px-5 py-4 font-mono text-xs">{run.id}</td><td className="px-5 py-4 font-semibold">{run.signal_id}</td><td className="px-5 py-4">{run.status}</td><td className="px-5 py-4 text-stone-600">{run.data_source}</td><td className="px-5 py-4 text-stone-600">{new Date(run.started_at).toLocaleString()}</td></tr>)}</tbody></table>{!runs.length && <p className="p-8 text-center text-sm text-stone-500">No persisted runs yet.</p>}</div></section>
      </div>
    </main>
  );
}
