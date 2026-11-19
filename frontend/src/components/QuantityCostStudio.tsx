"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import {
  BarChart3, Building2, Calculator, Download, FileJson, FileSpreadsheet,
  FileUp, Plus, RefreshCw, Save, Search, Trash2, Wallet, Boxes,
} from "lucide-react";
import {
  BIM_PROJECT_STORAGE_KEY,
  validateBIMProject,
} from "@/lib/bim-core";
import type { BIMElement, BIMProject } from "@/lib/bim-core";

type Currency = "MMK" | "USD";
type Unit = "m" | "m²" | "m³" | "pcs";
type MeasureMethod = "length" | "area" | "volume" | "count" | "manual";
type BoqItem = {
  id: string;
  code: string;
  description: string;
  discipline: "Architecture" | "Structure" | "MEP" | "General";
  unit: Unit;
  quantity: number;
  unitRate: number;
  wastePercent: number;
  laborPercent: number;
  sourceElementId?: string;
  method: MeasureMethod;
};
type CostSettings = {
  currency: Currency;
  overheadPercent: number;
  contingencyPercent: number;
  taxPercent: number;
};

type CostDocument = {
  format: "ApexiveAI-Quantity-Cost-Estimate";
  version: 1;
  projectId: string;
  projectName: string;
  updatedAt: string;
  settings: CostSettings;
  items: BoqItem[];
};

const STORAGE_KEY = "apexiveai-quantity-cost-estimate-v1";
const DEFAULT_SETTINGS: CostSettings = { currency: "MMK", overheadPercent: 10, contingencyPercent: 5, taxPercent: 0 };
const uid = () => `boq-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const safeNumber = (value: number, fallback = 0) => Number.isFinite(value) ? value : fallback;
const clean = (value: string) => value.replace(/[\r\n,]+/g, " ").trim();
const money = (value: number, currency: Currency) => new Intl.NumberFormat("en-US", { maximumFractionDigits: currency === "MMK" ? 0 : 2 }).format(value) + (currency === "MMK" ? " MMK" : " USD");

function measureElement(element: BIMElement): { quantity: number; unit: Unit; method: MeasureMethod } {
  const category = `${element.category} ${element.name}`.toLowerCase();
  const { length, width, height } = element.dimensions;
  const l = Math.max(0, safeNumber(length));
  const w = Math.max(0, safeNumber(width));
  const h = Math.max(0, safeNumber(height));
  if (/door|window|fixture|diffuser|sprinkler|equipment|device|terminal|panel|light/.test(category)) {
    return { quantity: 1, unit: "pcs", method: "count" };
  }
  if (/wall|partition/.test(category) && l > 0 && h > 0) return { quantity: l * h, unit: "m²", method: "area" };
  if (/slab|floor|roof|ceiling|paving/.test(category) && l > 0 && w > 0) return { quantity: l * w, unit: "m²", method: "area" };
  if (/pipe|duct|cable|tray|conduit|linear|beam|rafter|rail/.test(category) && l > 0) return { quantity: l, unit: "m", method: "length" };
  if (l > 0 && w > 0 && h > 0) return { quantity: l * w * h, unit: "m³", method: "volume" };
  if (l > 0) return { quantity: l, unit: "m", method: "length" };
  return { quantity: 1, unit: "pcs", method: "count" };
}

function rateFor(element: BIMElement, unit: Unit): number {
  const category = `${element.category} ${element.name}`.toLowerCase();
  if (unit === "pcs") return /door|window/.test(category) ? 250000 : 50000;
  if (unit === "m") return /pipe/.test(category) ? 18000 : /duct/.test(category) ? 35000 : 12000;
  if (unit === "m²") return /wall/.test(category) ? 45000 : 65000;
  if (unit === "m³") return /concrete|column|beam|footing|foundation|slab/.test(category) ? 280000 : 150000;
  return 0;
}

function makeItem(element: BIMElement): BoqItem {
  const measured = measureElement(element);
  return {
    id: uid(),
    code: `${element.discipline.slice(0, 3).toUpperCase()}-${element.sourceId.slice(0, 8)}`,
    description: element.name || `${element.discipline} ${element.category}`,
    discipline: element.discipline,
    unit: measured.unit,
    quantity: Number(measured.quantity.toFixed(4)),
    unitRate: rateFor(element, measured.unit),
    wastePercent: 0,
    laborPercent: 20,
    sourceElementId: element.id,
    method: measured.method,
  };
}

function exportCsv(items: BoqItem[], currency: Currency) {
  const headers = ["Code", "Description", "Discipline", "Unit", "Quantity", "Unit Rate", "Waste %", "Labor %", "Amount", "Source Element ID", "Measurement Method"];
  const rows = items.map((item) => [item.code, item.description, item.discipline, item.unit, item.quantity, item.unitRate, item.wastePercent, item.laborPercent, item.quantity * (1 + item.wastePercent / 100) * item.unitRate, item.sourceElementId ?? "", item.method]);
  const csv = [headers, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\r\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = `apexiveai-boq-${currency.toLowerCase()}.csv`; a.click(); URL.revokeObjectURL(url);
}

export default function QuantityCostStudio() {
  const [bim, setBim] = useState<BIMProject | null>(null);
  const [items, setItems] = useState<BoqItem[]>([]);
  const [settings, setSettings] = useState<CostSettings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState("Quantity & Cost Estimation initialized");
  const [query, setQuery] = useState("");
  const [discipline, setDiscipline] = useState("All");
  const [newDescription, setNewDescription] = useState("");
  const [newUnit, setNewUnit] = useState<Unit>("pcs");
  const [newQuantity, setNewQuantity] = useState("1");
  const [newRate, setNewRate] = useState("0");
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    try {
      const rawBim = localStorage.getItem(BIM_PROJECT_STORAGE_KEY);
      if (rawBim) {
        const parsed: unknown = JSON.parse(rawBim);
        const validation = validateBIMProject(parsed);
        if (validation.valid) setBim(validation.value);
        else setStatus(`Shared BIM project rejected: ${validation.errors.join("; ")}`);
      }
      const rawCost = localStorage.getItem(STORAGE_KEY);
      if (rawCost) {
        const parsed = JSON.parse(rawCost) as Partial<CostDocument>;
        if (parsed.format === "ApexiveAI-Quantity-Cost-Estimate" && Array.isArray(parsed.items)) {
          setItems(parsed.items as BoqItem[]);
          if (parsed.settings) setSettings({ ...DEFAULT_SETTINGS, ...parsed.settings });
          setStatus("Saved quantity estimate loaded");
        }
      }
    } catch (error) {
      setStatus(error instanceof Error ? `Load error: ${error.message}` : "Could not load saved estimate");
    } finally { setReady(true); }
  }, []);

  const filteredItems = useMemo(() => items.filter((item) => {
    const matchesDiscipline = discipline === "All" || item.discipline === discipline;
    const term = query.trim().toLowerCase();
    return matchesDiscipline && (!term || `${item.code} ${item.description} ${item.sourceElementId ?? ""}`.toLowerCase().includes(term));
  }), [items, discipline, query]);

  const totals = useMemo(() => {
    const material = items.reduce((sum, item) => sum + item.quantity * (1 + item.wastePercent / 100) * item.unitRate, 0);
    const labor = items.reduce((sum, item) => sum + item.quantity * (1 + item.wastePercent / 100) * item.unitRate * item.laborPercent / 100, 0);
    const direct = material + labor;
    const overhead = direct * settings.overheadPercent / 100;
    const contingency = (direct + overhead) * settings.contingencyPercent / 100;
    const beforeTax = direct + overhead + contingency;
    const tax = beforeTax * settings.taxPercent / 100;
    return { material, labor, direct, overhead, contingency, beforeTax, tax, grand: beforeTax + tax };
  }, [items, settings]);

  const updateItem = useCallback((id: string, patch: Partial<BoqItem>) => {
    setItems((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
  }, []);

  const importBim = () => {
    try {
      const raw = localStorage.getItem(BIM_PROJECT_STORAGE_KEY);
      if (!raw) { setStatus("No Shared BIM Project found. Save a project in /bim-core first."); return; }
      const validation = validateBIMProject(JSON.parse(raw) as unknown);
      if (!validation.valid) throw new Error(validation.errors.join("; "));
      setBim(validation.value);
      const existingSources = new Set(items.map((item) => item.sourceElementId).filter(Boolean));
      const fresh = validation.value.elements.filter((element) => !existingSources.has(element.id)).map(makeItem);
      setItems((current) => [...current, ...fresh]);
      setStatus(`Imported ${fresh.length} new measurable elements from Shared BIM Core`);
    } catch (error) { setStatus(error instanceof Error ? error.message : "BIM import failed"); }
  };

  const save = () => {
    try {
      const doc: CostDocument = {
        format: "ApexiveAI-Quantity-Cost-Estimate", version: 1,
        projectId: bim?.project.id ?? "unlinked-project",
        projectName: bim?.project.name ?? "Unlinked Estimate",
        updatedAt: new Date().toISOString(), settings, items,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(doc));
      setStatus(`Saved ${items.length} BOQ items to this browser`);
    } catch (error) { setStatus(error instanceof Error ? error.message : "Save failed"); }
  };

  const addManualItem = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const quantity = Number(newQuantity), unitRate = Number(newRate);
    if (!newDescription.trim() || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitRate) || unitRate < 0) {
      setStatus("Enter a description, positive quantity and non-negative unit rate"); return;
    }
    setItems((current) => [...current, { id: uid(), code: `GEN-${String(current.length + 1).padStart(4, "0")}`, description: clean(newDescription), discipline: "General", unit: newUnit, quantity, unitRate, wastePercent: 0, laborPercent: 0, method: "manual" }]);
    setNewDescription(""); setNewQuantity("1"); setNewRate("0"); setStatus("Manual BOQ item added");
  };

  const importJson = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return;
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (typeof parsed !== "object" || parsed === null || !("format" in parsed) || parsed.format !== "ApexiveAI-Quantity-Cost-Estimate" || !("items" in parsed) || !Array.isArray(parsed.items)) throw new Error("Unsupported estimate JSON format");
      setItems(parsed.items as BoqItem[]);
      if ("settings" in parsed && typeof parsed.settings === "object" && parsed.settings) setSettings({ ...DEFAULT_SETTINGS, ...(parsed.settings as Partial<CostSettings>) });
      setStatus(`Imported ${parsed.items.length} BOQ items from ${file.name}`);
    } catch (error) { setStatus(error instanceof Error ? `Import rejected: ${error.message}` : "Import rejected"); }
    finally { event.target.value = ""; }
  };

  const exportJson = () => {
    const doc: CostDocument = { format: "ApexiveAI-Quantity-Cost-Estimate", version: 1, projectId: bim?.project.id ?? "unlinked-project", projectName: bim?.project.name ?? "Unlinked Estimate", updatedAt: new Date().toISOString(), settings, items };
    const blob = new Blob([JSON.stringify(doc, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "apexiveai-quantity-cost-estimate.json"; a.click(); URL.revokeObjectURL(url);
  };

  if (!ready) return <main className="min-h-screen bg-[#080d15] p-8 text-slate-200">Loading Quantity & Cost Studio…</main>;

  return (
    <main className="min-h-screen bg-[#080d15] text-slate-100">
      <header className="border-b border-white/10 bg-[#0b1420] px-5 py-4 md:px-8">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3"><div className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 p-3 text-cyan-300"><Calculator size={24}/></div><div><p className="text-xs font-semibold tracking-[0.22em] text-cyan-300">APEXIVEAI · ENGINEERING PLATFORM</p><h1 className="text-xl font-semibold">Quantity & Cost Estimation</h1><p className="text-xs text-slate-400">BIM-linked takeoff · BOQ · Cost planning</p></div></div>
          <div className="flex flex-wrap gap-2"><button onClick={importBim} className="inline-flex items-center gap-2 rounded-lg border border-cyan-400/30 px-3 py-2 text-sm text-cyan-200 hover:bg-cyan-400/10"><RefreshCw size={15}/> Import Shared BIM</button><button onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-sm hover:bg-white/5"><FileUp size={15}/> Import JSON</button><button onClick={exportJson} className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-sm hover:bg-white/5"><FileJson size={15}/> Export JSON</button><button onClick={save} className="inline-flex items-center gap-2 rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-300"><Save size={15}/> Save Estimate</button><input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={importJson}/></div>
        </div>
      </header>
      <div className="mx-auto max-w-[1600px] space-y-5 p-5 md:p-8">
        <section className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
          <div className="rounded-2xl border border-white/10 bg-[#101b29] p-5"><div className="mb-2 flex items-center gap-2 text-sm text-slate-400"><Building2 size={16}/> LINKED ENGINEERING PROJECT</div><h2 className="text-2xl font-semibold">{bim?.project.name ?? "No Shared BIM Project Linked"}</h2><p className="mt-2 text-xs text-slate-500">{bim ? `${bim.elements.length} BIM elements · ${bim.project.units} · ${bim.project.id}` : "Create and save a project in Shared BIM Core, then import it here."}</p></div>
          <div className="rounded-2xl border border-white/10 bg-[#101b29] p-5"><div className="mb-2 flex items-center gap-2 text-sm text-slate-400"><Wallet size={16}/> ESTIMATE SUMMARY</div><p className="text-3xl font-semibold text-cyan-200">{money(totals.grand, settings.currency)}</p><p className="mt-2 text-xs text-slate-400">{items.length} BOQ lines · {settings.currency} · {status}</p></div>
        </section>
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[{label:"Material / Base",value:totals.material},{label:"Labor",value:totals.labor},{label:"Overhead + Contingency",value:totals.overhead + totals.contingency},{label:"Tax",value:totals.tax}].map((card) => <div key={card.label} className="rounded-xl border border-white/10 bg-[#101b29] p-4"><p className="text-xs text-slate-400">{card.label}</p><p className="mt-2 text-xl font-semibold">{money(card.value, settings.currency)}</p></div>)}
        </section>
        <section className="grid gap-5 xl:grid-cols-[1fr_340px]">
          <div className="space-y-5">
            <div className="rounded-2xl border border-white/10 bg-[#101b29] p-5"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">Bill of Quantities</h2><p className="text-xs text-slate-400">Editable quantities and unit rates · Source BIM element traceability</p></div><div className="flex gap-2"><button onClick={() => exportCsv(items, settings.currency)} className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-xs hover:bg-white/5"><FileSpreadsheet size={14}/> Export CSV</button><button onClick={() => setItems([])} className="inline-flex items-center gap-2 rounded-lg border border-rose-400/20 px-3 py-2 text-xs text-rose-300 hover:bg-rose-400/10"><Trash2 size={14}/> Clear BOQ</button></div></div>
              <div className="mb-3 flex flex-wrap gap-2"><div className="relative min-w-[180px] flex-1"><Search size={14} className="absolute left-3 top-2.5 text-slate-500"/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search BOQ…" className="w-full rounded-lg border border-white/10 bg-[#0a121d] py-2 pl-8 pr-3 text-sm outline-none focus:border-cyan-400"/></div><select value={discipline} onChange={(e) => setDiscipline(e.target.value)} className="rounded-lg border border-white/10 bg-[#0a121d] px-3 py-2 text-sm"><option>All</option><option>Architecture</option><option>Structure</option><option>MEP</option><option>General</option></select></div>
              <div className="overflow-auto rounded-xl border border-white/10"><table className="w-full min-w-[1050px] text-left text-xs"><thead className="bg-[#142235] text-slate-400"><tr>{["Code / Description","Discipline","Unit","Quantity","Unit Rate","Waste %","Labor %","Amount",""].map((head) => <th key={head} className="p-3">{head}</th>)}</tr></thead><tbody>{filteredItems.map((item) => { const amount = item.quantity * (1 + item.wastePercent / 100) * item.unitRate; return <tr key={item.id} className="border-t border-white/5 align-top"><td className="p-3"><p className="font-medium text-slate-200">{item.description}</p><p className="mt-1 text-[10px] text-slate-500">{item.code}{item.sourceElementId ? ` · ${item.sourceElementId}` : " · Manual"}</p></td><td className="p-3 text-slate-400">{item.discipline}</td><td className="p-3"><select value={item.unit} onChange={(e) => updateItem(item.id, { unit: e.target.value as Unit })} className="rounded bg-[#0a121d] p-1"><option>m</option><option>m²</option><option>m³</option><option>pcs</option></select></td><td className="p-3"><input aria-label="Quantity" type="number" min="0" step="0.0001" value={item.quantity} onChange={(e) => updateItem(item.id, { quantity: Math.max(0, Number(e.target.value) || 0) })} className="w-24 rounded border border-white/10 bg-[#0a121d] px-2 py-1 tabular-nums"/></td><td className="p-3"><input aria-label="Unit rate" type="number" min="0" step="any" value={item.unitRate} onChange={(e) => updateItem(item.id, { unitRate: Math.max(0, Number(e.target.value) || 0) })} className="w-28 rounded border border-white/10 bg-[#0a121d] px-2 py-1 tabular-nums"/></td><td className="p-3"><input aria-label="Waste percentage" type="number" min="0" max="100" value={item.wastePercent} onChange={(e) => updateItem(item.id, { wastePercent: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })} className="w-16 rounded border border-white/10 bg-[#0a121d] px-2 py-1"/></td><td className="p-3"><input aria-label="Labor percentage" type="number" min="0" max="500" value={item.laborPercent} onChange={(e) => updateItem(item.id, { laborPercent: Math.min(500, Math.max(0, Number(e.target.value) || 0)) })} className="w-16 rounded border border-white/10 bg-[#0a121d] px-2 py-1"/></td><td className="p-3 font-semibold text-cyan-200">{money(amount, settings.currency)}</td><td className="p-3"><button aria-label="Delete BOQ item" onClick={() => setItems((current) => current.filter((row) => row.id !== item.id))} className="rounded p-1 text-rose-300 hover:bg-rose-400/10"><Trash2 size={14}/></button></td></tr>; })}</tbody></table>{filteredItems.length === 0 && <p className="p-8 text-center text-sm text-slate-500">No BOQ items. Import Shared BIM or add a manual item.</p>}</div>
            </div>
            <form onSubmit={addManualItem} className="rounded-2xl border border-white/10 bg-[#101b29] p-5"><div className="mb-4 flex items-center gap-2"><Plus size={17} className="text-cyan-300"/><h2 className="font-semibold">Add Manual BOQ Item</h2></div><div className="grid gap-3 md:grid-cols-5"><input required value={newDescription} onChange={(e) => setNewDescription(e.target.value)} placeholder="Item description" className="rounded-lg border border-white/10 bg-[#0a121d] px-3 py-2 text-sm md:col-span-2"/><select value={newUnit} onChange={(e) => setNewUnit(e.target.value as Unit)} className="rounded-lg border border-white/10 bg-[#0a121d] px-3 py-2 text-sm"><option>pcs</option><option>m</option><option>m²</option><option>m³</option></select><input required type="number" min="0.0001" step="any" value={newQuantity} onChange={(e) => setNewQuantity(e.target.value)} placeholder="Quantity" className="rounded-lg border border-white/10 bg-[#0a121d] px-3 py-2 text-sm"/><input required type="number" min="0" step="any" value={newRate} onChange={(e) => setNewRate(e.target.value)} placeholder="Unit rate" className="rounded-lg border border-white/10 bg-[#0a121d] px-3 py-2 text-sm"/></div><button type="submit" className="mt-3 inline-flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-sm hover:bg-white/15"><Plus size={15}/> Add BOQ Line</button></form>
          </div>
          <aside className="space-y-5">
            <div className="rounded-2xl border border-white/10 bg-[#101b29] p-5"><div className="mb-4 flex items-center gap-2"><Calculator size={17} className="text-cyan-300"/><h2 className="font-semibold">Estimate Settings</h2></div><label className="mb-1 block text-xs text-slate-400">Currency</label><select value={settings.currency} onChange={(e) => setSettings((s) => ({ ...s, currency: e.target.value as Currency }))} className="mb-4 w-full rounded-lg border border-white/10 bg-[#0a121d] px-3 py-2 text-sm"><option value="MMK">MMK — Myanmar Kyat</option><option value="USD">USD — US Dollar</option></select>{([{key:"overheadPercent",label:"Overhead %"},{key:"contingencyPercent",label:"Contingency %"},{key:"taxPercent",label:"Tax %"}] as const).map((field) => <label key={field.key} className="mb-3 block text-xs text-slate-400">{field.label}<input type="number" min="0" max="100" step="0.1" value={settings[field.key]} onChange={(e) => setSettings((s) => ({ ...s, [field.key]: Math.min(100, Math.max(0, Number(e.target.value) || 0)) }))} className="mt-1 w-full rounded-lg border border-white/10 bg-[#0a121d] px-3 py-2 text-sm text-slate-100"/></label>)}</div>
            <div className="rounded-2xl border border-cyan-400/20 bg-[#101b29] p-5"><div className="mb-4 flex items-center gap-2"><BarChart3 size={17} className="text-cyan-300"/><h2 className="font-semibold">Cost Breakdown</h2></div><div className="space-y-3 text-sm">{[{label:"Material / Base",value:totals.material},{label:"Labor",value:totals.labor},{label:"Direct Cost",value:totals.direct},{label:"Overhead",value:totals.overhead},{label:"Contingency",value:totals.contingency},{label:"Tax",value:totals.tax}].map((row) => <div key={row.label} className="flex justify-between gap-3"><span className="text-slate-400">{row.label}</span><span className="tabular-nums">{money(row.value, settings.currency)}</span></div>)}<div className="border-t border-white/10 pt-3"><p className="text-xs text-slate-400">Estimated Total</p><p className="mt-1 text-2xl font-semibold text-cyan-200">{money(totals.grand, settings.currency)}</p></div></div></div>
            <div className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-4 text-xs leading-5 text-amber-100/80"><Boxes size={17} className="mb-2 text-amber-200"/>Automatic quantities are preliminary rule-based measurements from the current BIM element dimensions. Review measurement methods, rates, waste, labor and local tax assumptions before using this estimate commercially. Rates are editable starting values, not verified market quotations.</div>
          </aside>
        </section>
        <p className="text-center text-[11px] text-slate-600">ApexiveAI Quantity & Cost Estimation · Local browser persistence · CSV / JSON interchange · {new Date().getFullYear()}</p>
      </div>
    </main>
  );
}
