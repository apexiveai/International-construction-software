"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  Archive, ArrowDownToLine, ArrowUpFromLine, Boxes, ClipboardList,
  FileText, Package, Plus, Search, ShoppingCart, Truck, Warehouse,
  CheckCircle2, Clock3, AlertTriangle, Trash2, X,
} from "lucide-react";

type Status = "Draft" | "Pending Approval" | "Approved" | "Ordered" | "Partially Received" | "Received" | "Cancelled";
type Tab = "overview" | "requisitions" | "orders" | "receipts" | "inventory" | "suppliers";
type Supplier = { id: string; name: string; contact: string; phone: string; email: string; status: "Active" | "Inactive" };
type Requisition = { id: string; project: string; requester: string; date: string; neededBy: string; item: string; quantity: number; unit: string; supplier: string; status: Status };
type PurchaseOrder = { id: string; project: string; supplier: string; date: string; item: string; quantity: number; unit: string; unitCost: number; currency: "MMK" | "USD"; status: Status };
type Receipt = { id: string; poId: string; date: string; item: string; quantity: number; unit: string; warehouse: string; receivedBy: string };
type StockItem = { id: string; sku: string; name: string; category: string; warehouse: string; quantity: number; unit: string; reorderLevel: number; unitCost: number; currency: "MMK" | "USD" };

const KEY = "apexiveai-procurement-inventory-v1";
const initialSuppliers: Supplier[] = [
  { id: "SUP-001", name: "Yangon Building Materials", contact: "Sales Team", phone: "", email: "", status: "Active" },
  { id: "SUP-002", name: "Apex Engineering Supply", contact: "Procurement Desk", phone: "", email: "", status: "Active" },
];
const initialStock: StockItem[] = [
  { id: "STK-001", sku: "MAT-CEM-001", name: "Portland Cement", category: "Building Material", warehouse: "Main Warehouse", quantity: 120, unit: "bags", reorderLevel: 50, unitCost: 12500, currency: "MMK" },
  { id: "STK-002", sku: "MAT-REB-001", name: "Rebar 12mm", category: "Steel", warehouse: "Main Warehouse", quantity: 2.5, unit: "tons", reorderLevel: 1, unitCost: 1850000, currency: "MMK" },
  { id: "STK-003", sku: "MAT-SND-001", name: "Construction Sand", category: "Aggregate", warehouse: "Site Warehouse A", quantity: 8, unit: "m³", reorderLevel: 10, unitCost: 38000, currency: "MMK" },
];

const money = (n: number, currency: string) => `${currency} ${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(n || 0)}`;
const id = (prefix: string) => `${prefix}-${Date.now().toString().slice(-7)}`;

export default function ProcurementInventoryStudio() {
  const [tab, setTab] = useState<Tab>("overview");
  const [search, setSearch] = useState("");
  const [suppliers, setSuppliers] = useState<Supplier[]>(initialSuppliers);
  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [stock, setStock] = useState<StockItem[]>(initialStock);
  const [loaded, setLoaded] = useState(false);
  const [modal, setModal] = useState<"requisition" | "order" | "receipt" | "supplier" | null>(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const data = JSON.parse(raw);
        setSuppliers(Array.isArray(data.suppliers) ? data.suppliers : initialSuppliers);
        setRequisitions(Array.isArray(data.requisitions) ? data.requisitions : []);
        setOrders(Array.isArray(data.orders) ? data.orders : []);
        setReceipts(Array.isArray(data.receipts) ? data.receipts : []);
        setStock(Array.isArray(data.stock) ? data.stock : initialStock);
      }
    } catch { setNotice("Saved data could not be loaded. Starting with sample data."); }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(KEY, JSON.stringify({ suppliers, requisitions, orders, receipts, stock }));
  }, [loaded, suppliers, requisitions, orders, receipts, stock]);

  const lowStock = stock.filter((s) => s.quantity <= s.reorderLevel);
  const totalPO = orders.reduce((sum, o) => sum + o.quantity * o.unitCost, 0);
  const pending = requisitions.filter((r) => r.status === "Pending Approval").length;
  const filteredStock = useMemo(() => stock.filter((s) => `${s.sku} ${s.name} ${s.category} ${s.warehouse}`.toLowerCase().includes(search.toLowerCase())), [stock, search]);
  const filteredOrders = useMemo(() => orders.filter((o) => `${o.id} ${o.project} ${o.supplier} ${o.item}`.toLowerCase().includes(search.toLowerCase())), [orders, search]);

  function updateReqStatus(reqId: string, status: Status) {
    setRequisitions((prev) => prev.map((r) => r.id === reqId ? { ...r, status } : r));
  }
  function exportData() {
    const blob = new Blob([JSON.stringify({ suppliers, requisitions, orders, receipts, stock }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "apexiveai-procurement-inventory.json"; a.click(); URL.revokeObjectURL(url);
  }
  function importData(file?: File) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { try { const d = JSON.parse(String(reader.result)); setSuppliers(d.suppliers ?? []); setRequisitions(d.requisitions ?? []); setOrders(d.orders ?? []); setReceipts(d.receipts ?? []); setStock(d.stock ?? []); setNotice("Data imported."); } catch { setNotice("Invalid JSON file."); } };
    reader.readAsText(file);
  }

  const nav: { key: Tab; label: string; icon: typeof Boxes }[] = [
    { key: "overview", label: "Overview", icon: Boxes }, { key: "requisitions", label: "Requisitions", icon: ClipboardList },
    { key: "orders", label: "Purchase Orders", icon: ShoppingCart }, { key: "receipts", label: "Goods Receipts", icon: Truck },
    { key: "inventory", label: "Inventory", icon: Warehouse }, { key: "suppliers", label: "Suppliers", icon: Archive },
  ];

  return (
    <main className="min-h-screen bg-[#080b12] text-slate-100">
      <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-6 flex flex-col justify-between gap-4 border-b border-white/10 pb-6 md:flex-row md:items-center">
          <div><div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[.24em] text-cyan-400"><Package size={15}/> ApexiveAI · Construction Suite</div><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Procurement & Inventory</h1><p className="mt-1 text-sm text-slate-400">Purchasing, receiving, suppliers and site stock control</p></div>
          <div className="flex flex-wrap gap-2"><label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-300 hover:bg-white/5"><ArrowUpFromLine size={16}/> Import JSON<input className="hidden" type="file" accept="application/json,.json" onChange={(e) => importData(e.target.files?.[0])}/></label><button onClick={exportData} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-300 hover:bg-white/5"><ArrowDownToLine size={16}/> Export JSON</button></div>
        </header>
        {notice && <div className="mb-4 flex items-center justify-between rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-200">{notice}<button onClick={() => setNotice("")}><X size={16}/></button></div>}
        <nav className="mb-6 flex gap-2 overflow-x-auto pb-1">{nav.map(({ key, label, icon: Icon }) => <button key={key} onClick={() => { setTab(key); setSearch(""); }} className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm transition ${tab === key ? "bg-cyan-400 text-slate-950" : "border border-white/10 bg-white/[.03] text-slate-300 hover:bg-white/[.07]"}`}><Icon size={16}/>{label}</button>)}</nav>
        {tab === "overview" && <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="Inventory SKUs" value={String(stock.length)} icon={<Boxes/>} detail="Tracked stock items"/>
            <Metric label="Purchase Orders" value={String(orders.length)} icon={<ShoppingCart/>} detail={`Committed value: ${money(totalPO, "MMK")}`} />
            <Metric label="Pending Requisitions" value={String(pending)} icon={<Clock3/>} detail="Awaiting approval"/>
            <Metric label="Low Stock Alerts" value={String(lowStock.length)} icon={<AlertTriangle/>} detail="At or below reorder level" warn={lowStock.length > 0}/>
          </div>
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <Panel title="Reorder Alerts" subtitle="Items that reached their configured reorder level"><div className="space-y-3">{lowStock.length ? lowStock.map((s) => <div key={s.id} className="flex items-center justify-between rounded-xl border border-amber-400/20 bg-amber-400/[.06] p-3"><div><p className="font-medium">{s.name}</p><p className="text-xs text-slate-400">{s.sku} · {s.warehouse}</p></div><div className="text-right"><p className="font-semibold text-amber-300">{s.quantity} {s.unit}</p><p className="text-xs text-slate-500">Reorder at {s.reorderLevel}</p></div></div>) : <Empty text="No low-stock alerts."/>}</div></Panel>
            <Panel title="Recent Purchase Orders" subtitle="Latest procurement commitments"><div className="space-y-3">{orders.slice(-5).reverse().map((o) => <div key={o.id} className="flex items-center justify-between border-b border-white/5 pb-3 last:border-0"><div><p className="font-medium">{o.item}</p><p className="text-xs text-slate-400">{o.id} · {o.supplier}</p></div><div className="text-right"><p className="font-medium">{money(o.quantity * o.unitCost, o.currency)}</p><StatusPill status={o.status}/></div></div>)}{orders.length === 0 && <Empty text="No purchase orders created yet."/>}</div></Panel>
          </div>
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/[.025] p-4"><h3 className="font-semibold">Procurement workflow</h3><div className="mt-4 grid gap-2 sm:grid-cols-4">{[{n:"01",t:"Requisition",d:"Request materials"},{n:"02",t:"Approval",d:"Review and authorize"},{n:"03",t:"Purchase Order",d:"Commit to supplier"},{n:"04",t:"Goods Receipt",d:"Receive and update stock"}].map((x) => <div key={x.n} className="rounded-xl border border-white/10 bg-black/20 p-3"><span className="text-xs text-cyan-400">{x.n}</span><p className="mt-1 font-medium">{x.t}</p><p className="text-xs text-slate-500">{x.d}</p></div>)}</div></div>
        </>}
        {tab === "requisitions" && <Section title="Purchase Requisitions" description="Create and review project material requests" action={<button onClick={() => setModal("requisition")} className="primary"><Plus size={16}/> New Requisition</button>}><div className="mb-3"><SearchBox value={search} onChange={setSearch}/></div><div className="overflow-x-auto"><table><thead><tr><th>Request</th><th>Project / Requester</th><th>Material</th><th>Quantity</th><th>Needed by</th><th>Status</th><th>Actions</th></tr></thead><tbody>{requisitions.filter(r => `${r.id} ${r.project} ${r.item} ${r.requester}`.toLowerCase().includes(search.toLowerCase())).map(r => <tr key={r.id}><td className="font-medium">{r.id}<small>{r.date}</small></td><td>{r.project}<small>{r.requester}</small></td><td>{r.item}<small>{r.supplier || "Supplier not selected"}</small></td><td>{r.quantity} {r.unit}</td><td>{r.neededBy || "—"}</td><td><StatusPill status={r.status}/></td><td><select aria-label="Update requisition status" value={r.status} onChange={e => updateReqStatus(r.id, e.target.value as Status)} className="field min-w-36"><option>Draft</option><option>Pending Approval</option><option>Approved</option><option>Cancelled</option></select></td></tr>)}</tbody></table>{requisitions.length === 0 && <Empty text="No requisitions yet. Create your first material request."/>}</div></Section>}
        {tab === "orders" && <Section title="Purchase Orders" description="Supplier orders and committed procurement costs" action={<button onClick={() => setModal("order")} className="primary"><Plus size={16}/> New Purchase Order</button>}><div className="mb-3"><SearchBox value={search} onChange={setSearch}/></div><div className="overflow-x-auto"><table><thead><tr><th>PO Number</th><th>Project</th><th>Supplier</th><th>Item</th><th>Quantity</th><th>Amount</th><th>Status</th></tr></thead><tbody>{filteredOrders.map(o => <tr key={o.id}><td className="font-medium">{o.id}<small>{o.date}</small></td><td>{o.project}</td><td>{o.supplier}</td><td>{o.item}</td><td>{o.quantity} {o.unit}</td><td>{money(o.quantity * o.unitCost, o.currency)}</td><td><StatusPill status={o.status}/></td></tr>)}</tbody></table>{filteredOrders.length === 0 && <Empty text="No purchase orders found."/>}</div></Section>}
        {tab === "receipts" && <Section title="Goods Received Notes" description="Record deliveries against purchase orders" action={<button onClick={() => setModal("receipt")} className="primary"><Plus size={16}/> Record Receipt</button>}><div className="overflow-x-auto"><table><thead><tr><th>GRN</th><th>Purchase Order</th><th>Material</th><th>Quantity Received</th><th>Warehouse</th><th>Received By</th><th>Date</th></tr></thead><tbody>{receipts.map(r => <tr key={r.id}><td className="font-medium">{r.id}</td><td>{r.poId}</td><td>{r.item}</td><td>{r.quantity}</td><td>{r.warehouse}</td><td>{r.receivedBy}</td><td>{r.date}</td></tr>)}</tbody></table>{receipts.length === 0 && <Empty text="No goods receipts recorded."/>}</div></Section>}
        {tab === "inventory" && <Section title="Inventory & Warehouse" description="On-hand balances and reorder thresholds" action={<button onClick={() => setStock(s => [...s, { id: id("STK"), sku: "NEW-SKU", name: "New stock item", category: "General", warehouse: "Main Warehouse", quantity: 0, unit: "pcs", reorderLevel: 0, unitCost: 0, currency: "MMK" }])} className="primary"><Plus size={16}/> Add Stock Row</button>}><div className="mb-3"><SearchBox value={search} onChange={setSearch}/></div><div className="overflow-x-auto"><table><thead><tr><th>SKU</th><th>Item</th><th>Warehouse</th><th>On Hand</th><th>Reorder Level</th><th>Unit Cost</th><th>Action</th></tr></thead><tbody>{filteredStock.map(s => <tr key={s.id}><td className="font-medium">{s.sku}</td><td>{s.name}<small>{s.category}</small></td><td>{s.warehouse}</td><td className={s.quantity <= s.reorderLevel ? "text-amber-300" : ""}>{s.quantity} {s.unit}</td><td>{s.reorderLevel} {s.unit}</td><td>{money(s.unitCost, s.currency)}</td><td><button title="Delete stock row" onClick={() => setStock(prev => prev.filter(x => x.id !== s.id))} className="icon-button"><Trash2 size={15}/></button></td></tr>)}</tbody></table>{filteredStock.length === 0 && <Empty text="No stock items match your search."/>}</div><p className="mt-3 text-xs text-slate-500">Stock quantities are adjusted when a Goods Receipt is recorded. Manual stock adjustments and material issue/return controls are planned for a later milestone.</p></Section>}
        {tab === "suppliers" && <Section title="Supplier Directory" description="Maintain approved vendors and procurement contacts" action={<button onClick={() => setModal("supplier")} className="primary"><Plus size={16}/> Add Supplier</button>}><div className="overflow-x-auto"><table><thead><tr><th>Supplier ID</th><th>Company</th><th>Contact</th><th>Phone</th><th>Email</th><th>Status</th></tr></thead><tbody>{suppliers.map(s => <tr key={s.id}><td className="font-medium">{s.id}</td><td>{s.name}</td><td>{s.contact}</td><td>{s.phone || "—"}</td><td>{s.email || "—"}</td><td><span className="text-emerald-300">{s.status}</span></td></tr>)}</tbody></table>{suppliers.length === 0 && <Empty text="No suppliers registered."/>}</div></Section>}
      </div>
      {modal && <Modal title={modal === "requisition" ? "New Purchase Requisition" : modal === "order" ? "New Purchase Order" : modal === "receipt" ? "Record Goods Receipt" : "Add Supplier"} onClose={() => setModal(null)}>
        {modal === "requisition" && <RequisitionForm suppliers={suppliers} onCancel={() => setModal(null)} onSave={r => { setRequisitions(p => [...p, { ...r, id: id("PR"), date: new Date().toISOString().slice(0,10), status: "Pending Approval" }]); setModal(null); }}/ >}
        {modal === "order" && <OrderForm suppliers={suppliers} onCancel={() => setModal(null)} onSave={o => { setOrders(p => [...p, { ...o, id: id("PO"), date: new Date().toISOString().slice(0,10), status: "Ordered" }]); setModal(null); }}/ >}
        {modal === "receipt" && <ReceiptForm orders={orders} onCancel={() => setModal(null)} onSave={r => { const receipt = { ...r, id: id("GRN"), date: new Date().toISOString().slice(0,10) }; setReceipts(p => [...p, receipt]); setStock(prev => { const found = prev.find(s => s.name.toLowerCase() === r.item.toLowerCase() && s.warehouse === r.warehouse); if (found) return prev.map(s => s.id === found.id ? { ...s, quantity: s.quantity + r.quantity } : s); return [...prev, { id: id("STK"), sku: `GRN-${Date.now().toString().slice(-5)}`, name: r.item, category: "Received Material", warehouse: r.warehouse, quantity: r.quantity, unit: r.unit, reorderLevel: 0, unitCost: 0, currency: "MMK" }]; }); const receivedBefore = receipts.filter(x => x.poId === r.poId).reduce((sum, x) => sum + x.quantity, 0); setOrders(prev => prev.map(o => o.id === r.poId ? { ...o, status: receivedBefore + r.quantity >= o.quantity ? "Received" : "Partially Received" } : o)); setModal(null); }}/ >}
        {modal === "supplier" && <SupplierForm onCancel={() => setModal(null)} onSave={s => { setSuppliers(p => [...p, { ...s, id: id("SUP"), status: "Active" }]); setModal(null); }}/ >}
      </Modal>}
      <style jsx global>{`
        .primary{display:inline-flex;align-items:center;gap:8px;border-radius:12px;background:#67e8f9;color:#07111b;padding:10px 14px;font-size:13px;font-weight:700}.primary:hover{background:#a5f3fc}
        table{width:100%;border-collapse:collapse;text-align:left;font-size:13px}th{padding:12px 14px;color:#64748b;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;white-space:nowrap;border-bottom:1px solid #ffffff12}td{padding:13px 14px;border-bottom:1px solid #ffffff0c;color:#cbd5e1;white-space:nowrap}td small{display:block;margin-top:3px;color:#64748b;font-size:11px}
        .field{width:100%;border:1px solid #ffffff1a;border-radius:10px;background:#101722;color:#e2e8f0;padding:10px 11px;font-size:13px;outline:none}.field:focus{border-color:#22d3ee}.field option{background:#101722}
        .icon-button{padding:7px;border-radius:8px;color:#94a3b8}.icon-button:hover{background:#ffffff10;color:#f87171}
      `}</style>
    </main>
  );
}

function Metric({ label, value, icon, detail, warn }: { label: string; value: string; icon: ReactNode; detail: string; warn?: boolean }) { return <div className="rounded-2xl border border-white/10 bg-white/[.03] p-4"><div className="flex items-center justify-between text-slate-400"><span className="text-sm">{label}</span><span className={warn ? "text-amber-300" : "text-cyan-300"}>{icon}</span></div><p className="mt-3 text-3xl font-semibold tracking-tight">{value}</p><p className="mt-1 text-xs text-slate-500">{detail}</p></div>; }
function Panel({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) { return <section className="rounded-2xl border border-white/10 bg-white/[.025] p-4"><h2 className="font-semibold">{title}</h2><p className="mb-4 mt-1 text-xs text-slate-500">{subtitle}</p>{children}</section>; }
function Section({ title, description, action, children }: { title: string; description: string; action: ReactNode; children: ReactNode }) { return <section className="rounded-2xl border border-white/10 bg-white/[.025] p-4 sm:p-5"><div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><h2 className="text-lg font-semibold">{title}</h2><p className="mt-1 text-xs text-slate-500">{description}</p></div>{action}</div>{children}</section>; }
function SearchBox({ value, onChange }: { value: string; onChange: (v: string) => void }) { return <div className="relative max-w-sm"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16}/><input className="field pl-9" placeholder="Search records..." value={value} onChange={e => onChange(e.target.value)}/></div>; }
function Empty({ text }: { text: string }) { return <div className="py-10 text-center text-sm text-slate-500">{text}</div>; }
function StatusPill({ status }: { status: Status }) { const cls = status === "Approved" || status === "Received" ? "bg-emerald-400/10 text-emerald-300" : status === "Pending Approval" ? "bg-amber-400/10 text-amber-300" : status === "Cancelled" ? "bg-rose-400/10 text-rose-300" : "bg-slate-400/10 text-slate-300"; return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ${cls}`}>{status}</span>; }
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) { return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-white/10 bg-[#0d1420] p-5 shadow-2xl"><div className="mb-5 flex items-center justify-between"><h2 className="text-lg font-semibold">{title}</h2><button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-white/10"><X size={18}/></button></div>{children}</div></div>; }
function FormField({ label, children }: { label: string; children: ReactNode }) { return <label className="block"><span className="mb-1.5 block text-xs font-medium text-slate-400">{label}</span>{children}</label>; }
function RequisitionForm({ suppliers, onSave, onCancel }: { suppliers: Supplier[]; onSave: (r: Omit<Requisition,"id"|"date"|"status">) => void; onCancel: () => void }) { const [v,setV]=useState({project:"",requester:"",neededBy:"",item:"",quantity:1,unit:"pcs",supplier:""}); return <form className="space-y-3" onSubmit={e=>{e.preventDefault();onSave(v);}}><FormField label="Project name"><input required className="field" value={v.project} onChange={e=>setV({...v,project:e.target.value})}/></FormField><FormField label="Requested by"><input required className="field" value={v.requester} onChange={e=>setV({...v,requester:e.target.value})}/></FormField><FormField label="Material / Item"><input required className="field" value={v.item} onChange={e=>setV({...v,item:e.target.value})}/></FormField><div className="grid grid-cols-2 gap-3"><FormField label="Quantity"><input required min="0.01" step="any" type="number" className="field" value={v.quantity} onChange={e=>setV({...v,quantity:Number(e.target.value)})}/></FormField><FormField label="Unit"><input className="field" value={v.unit} onChange={e=>setV({...v,unit:e.target.value})}/></FormField></div><FormField label="Needed by"><input type="date" className="field" value={v.neededBy} onChange={e=>setV({...v,neededBy:e.target.value})}/></FormField><FormField label="Preferred supplier"><select className="field" value={v.supplier} onChange={e=>setV({...v,supplier:e.target.value})}><option value="">Not selected</option>{suppliers.map(s=><option key={s.id}>{s.name}</option>)}</select></FormField><FormActions onCancel={onCancel}/></form>; }
function OrderForm({ suppliers, onSave, onCancel }: { suppliers: Supplier[]; onSave: (o: Omit<PurchaseOrder,"id"|"date"|"status">) => void; onCancel: () => void }) { const [v,setV]=useState({project:"",supplier:suppliers[0]?.name||"",item:"",quantity:1,unit:"pcs",unitCost:0,currency:"MMK" as "MMK"|"USD"}); return <form className="space-y-3" onSubmit={e=>{e.preventDefault();onSave(v);}}><FormField label="Project name"><input required className="field" value={v.project} onChange={e=>setV({...v,project:e.target.value})}/></FormField><FormField label="Supplier"><select required className="field" value={v.supplier} onChange={e=>setV({...v,supplier:e.target.value})}>{suppliers.map(s=><option key={s.id}>{s.name}</option>)}</select></FormField><FormField label="Item"><input required className="field" value={v.item} onChange={e=>setV({...v,item:e.target.value})}/></FormField><div className="grid grid-cols-2 gap-3"><FormField label="Quantity"><input type="number" min="0.01" step="any" required className="field" value={v.quantity} onChange={e=>setV({...v,quantity:Number(e.target.value)})}/></FormField><FormField label="Unit"><input className="field" value={v.unit} onChange={e=>setV({...v,unit:e.target.value})}/></FormField><FormField label="Unit cost"><input type="number" min="0" step="any" required className="field" value={v.unitCost} onChange={e=>setV({...v,unitCost:Number(e.target.value)})}/></FormField><FormField label="Currency"><select className="field" value={v.currency} onChange={e=>setV({...v,currency:e.target.value as "MMK"|"USD"})}><option>MMK</option><option>USD</option></select></FormField></div><FormActions onCancel={onCancel}/></form>; }
function ReceiptForm({ orders, onSave, onCancel }: { orders: PurchaseOrder[]; onSave: (r: Omit<Receipt,"id"|"date">) => void; onCancel: () => void }) { const available=orders.filter(o=>o.status!=="Received"&&o.status!=="Cancelled"); const [poId,setPoId]=useState(available[0]?.id||""); const selected=available.find(o=>o.id===poId); const [v,setV]=useState({quantity:1,warehouse:"Main Warehouse",receivedBy:""}); return <form className="space-y-3" onSubmit={e=>{e.preventDefault();if(selected)onSave({poId,item:selected.item,unit:selected.unit,...v});}}><FormField label="Purchase Order"><select required className="field" value={poId} onChange={e=>setPoId(e.target.value)}>{available.map(o=><option key={o.id} value={o.id}>{o.id} · {o.item}</option>)}</select></FormField>{selected&&<p className="text-xs text-slate-400">Ordered quantity: {selected.quantity} {selected.unit}</p>}<FormField label="Quantity received"><input type="number" min="0.01" step="any" required className="field" value={v.quantity} onChange={e=>setV({...v,quantity:Number(e.target.value)})}/></FormField><FormField label="Warehouse"><input required className="field" value={v.warehouse} onChange={e=>setV({...v,warehouse:e.target.value})}/></FormField><FormField label="Received by"><input required className="field" value={v.receivedBy} onChange={e=>setV({...v,receivedBy:e.target.value})}/></FormField>{available.length===0&&<p className="text-sm text-amber-300">Create a purchase order before recording a receipt.</p>}<FormActions onCancel={onCancel} disabled={!selected}/></form>; }
function SupplierForm({ onSave, onCancel }: { onSave: (s: Omit<Supplier,"id"|"status">) => void; onCancel: () => void }) { const [v,setV]=useState({name:"",contact:"",phone:"",email:""}); return <form className="space-y-3" onSubmit={e=>{e.preventDefault();onSave(v);}}><FormField label="Supplier / Company name"><input required className="field" value={v.name} onChange={e=>setV({...v,name:e.target.value})}/></FormField><FormField label="Contact person / department"><input className="field" value={v.contact} onChange={e=>setV({...v,contact:e.target.value})}/></FormField><FormField label="Phone"><input className="field" value={v.phone} onChange={e=>setV({...v,phone:e.target.value})}/></FormField><FormField label="Email"><input type="email" className="field" value={v.email} onChange={e=>setV({...v,email:e.target.value})}/></FormField><FormActions onCancel={onCancel}/></form>; }
function FormActions({ onCancel, disabled=false }: { onCancel: () => void; disabled?: boolean }) { return <div className="flex justify-end gap-2 border-t border-white/10 pt-4"><button type="button" onClick={onCancel} className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-300">Cancel</button><button disabled={disabled} type="submit" className="primary disabled:cursor-not-allowed disabled:opacity-40"><CheckCircle2 size={15}/> Save</button></div>; }
