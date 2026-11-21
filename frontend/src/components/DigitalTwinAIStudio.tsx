"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity, Bot, BrainCircuit, Building2, Download, Gauge, Network,
  Plus, Search, Send, Server, Settings2, ShieldCheck, Sparkles, Upload,
  Zap,
} from "lucide-react";

type StudioMode = "twin" | "ai";
type AssetStatus = "Operational" | "Warning" | "Maintenance";
type Asset = {
  id: string;
  name: string;
  category: string;
  location: string;
  status: AssetStatus;
  temperature: number;
  vibration: number;
  energy: number;
  lastMaintenance: string;
};
type ChatMessage = { id: string; role: "assistant" | "user"; text: string };

const ASSET_KEY = "apexiveai-digital-twin-assets-v1";
const uid = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

const DEFAULT_ASSETS: Asset[] = [
  { id: "asset-ahu-01", name: "AHU-01", category: "Air Handling Unit", location: "Level 02 · Roof", status: "Operational", temperature: 18.4, vibration: 1.2, energy: 42.8, lastMaintenance: "2026-10-18" },
  { id: "asset-chw-01", name: "CHW-PUMP-01", category: "Chilled Water Pump", location: "Level B1 · Plant", status: "Warning", temperature: 43.1, vibration: 4.6, energy: 28.3, lastMaintenance: "2026-09-02" },
  { id: "asset-lift-01", name: "LIFT-A", category: "Passenger Lift", location: "Core A · All Levels", status: "Operational", temperature: 24.8, vibration: 0.8, energy: 15.2, lastMaintenance: "2026-11-02" },
  { id: "asset-spr-01", name: "FIRE-PUMP-01", category: "Fire Protection Pump", location: "Level B1 · Fire Room", status: "Maintenance", temperature: 31.5, vibration: 2.1, energy: 8.4, lastMaintenance: "2026-08-21" },
];

export default function DigitalTwinAIStudio({ initial = "twin" }: { initial?: StudioMode }) {
  const [mode, setMode] = useState<StudioMode>(initial);
  const [assets, setAssets] = useState<Asset[]>(DEFAULT_ASSETS);
  const [selectedId, setSelectedId] = useState("asset-ahu-01");
  const [status, setStatus] = useState("Digital twin core synchronized");
  const [assetSearch, setAssetSearch] = useState("");
  const [activeTwinTab, setActiveTwinTab] = useState("Dashboard");
  const [maintenanceType, setMaintenanceType] = useState("Preventive");
  const [telemetryLive, setTelemetryLive] = useState(true);
  const [chatInput, setChatInput] = useState("");
  const [chat, setChat] = useState<ChatMessage[]>([
    { id: "chat-1", role: "assistant", text: "I am ready. Ask me to review drawings, validate BIM elements, estimate quantities, check compliance, or explain clashes." },
  ]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(ASSET_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Asset[];
        if (Array.isArray(parsed) && parsed.length) setAssets(parsed);
      }
    } catch {
      setStatus("Local asset registry could not be loaded");
    }
  }, []);

  useEffect(() => {
    if (!telemetryLive) return;
    const timer = window.setInterval(() => {
      setAssets((current) => current.map((asset) => ({
        ...asset,
        temperature: Number((asset.temperature + (Math.random() - 0.5) * 0.18).toFixed(1)),
        vibration: Number((asset.vibration + (Math.random() - 0.5) * 0.12).toFixed(1)),
        energy: Number(Math.max(0, asset.energy + (Math.random() - 0.5) * 0.35).toFixed(1)),
      })));
    }, 3500);
    return () => window.clearInterval(timer);
  }, [telemetryLive]);

  const selected = assets.find((asset) => asset.id === selectedId) ?? assets[0];
  const filteredAssets = useMemo(
    () => assets.filter((asset) =>
      `${asset.name} ${asset.category} ${asset.location}`.toLowerCase().includes(assetSearch.toLowerCase())
    ),
    [assets, assetSearch]
  );

  const saveAssets = () => {
    localStorage.setItem(ASSET_KEY, JSON.stringify(assets));
    setStatus("Asset registry and telemetry state saved");
  };

  const addAsset = () => {
    const asset: Asset = {
      id: uid("asset"),
      name: `ASSET-${String(assets.length + 1).padStart(3, "0")}`,
      category: "Equipment",
      location: "Unassigned",
      status: "Operational",
      temperature: 22,
      vibration: 0.5,
      energy: 10,
      lastMaintenance: new Date().toISOString().slice(0, 10),
    };
    setAssets((current) => [...current, asset]);
    setSelectedId(asset.id);
    setStatus(`${asset.name} added to asset hierarchy`);
  };

  const updateSelected = (patch: Partial<Asset>) => {
    if (!selected) return;
    setAssets((current) => current.map((asset) => asset.id === selected.id ? { ...asset, ...patch } : asset));
  };

  const exportAssets = () => {
    const blob = new Blob([JSON.stringify({
      format: "ApexiveAI-Digital-Twin",
      version: 1,
      exportedAt: new Date().toISOString(),
      assets,
    }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "apexiveai-digital-twin.json";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const respondToPrompt = () => {
    const prompt = chatInput.trim();
    if (!prompt) return;
    const lower = prompt.toLowerCase();
    let reply = "I can prepare that task once project documents are connected.";
    if (lower.includes("quantity")) reply = "Quantity workflow ready: selected BIM elements can be grouped by category, level, host, and measurement rule.";
    else if (lower.includes("cost")) reply = "Cost estimation can connect measured quantities to the project rate library and generate BOQ cost ranges.";
    else if (lower.includes("clash")) reply = "Clash explanation: compare each intersecting system's clearance envelope, host context, and priority level.";
    else if (lower.includes("compliance") || lower.includes("code")) reply = "Code-compliance review requires the applicable jurisdiction and code edition. I can map findings to clauses and evidence.";
    else if (lower.includes("drawing") || lower.includes("pdf")) reply = "Drawing/PDF recognition workflow ready: import sheets, detect title blocks, symbols, dimensions, and annotations.";
    else if (lower.includes("bim") || lower.includes("model")) reply = "BIM assistant ready to search elements by discipline, category, level, property, relationship, or semantic description.";
    else if (lower.includes("maint") || lower.includes("predict")) reply = "Maintenance assistant found an example priority: CHW-PUMP-01 has elevated vibration and should be inspected during the next service window.";
    setChat((current) => [
      ...current,
      { id: uid("chat"), role: "user", text: prompt },
      { id: uid("chat"), role: "assistant", text: reply },
    ]);
    setChatInput("");
  };

  return (
    <main className="dtai-shell">
      <style jsx global>{`
        .dtai-shell{height:100%;min-height:620px;display:flex;flex-direction:column;background:#08101a;color:#dce7f5}
        .dtai-tabs{height:48px;display:flex;align-items:center;gap:6px;padding:0 12px;border-bottom:1px solid #26384b;background:#0c1623}
        .dtai-tab{height:32px;padding:0 12px;border:1px solid transparent;border-radius:6px;background:transparent;color:#91a7c0;font-size:10px;display:flex;align-items:center;gap:7px}
        .dtai-tab.active{border-color:#31577a;background:#16314c;color:#91caff}
        .dtai-actions{margin-left:auto;display:flex;gap:5px}
        .dtai-action{height:30px;padding:0 9px;border:1px solid #2b4057;border-radius:5px;background:#111f2f;color:#9bb1c8;font-size:9px;display:flex;align-items:center;gap:6px}
        .dtai-action.primary{background:#1769ad;border-color:#287fc5;color:white}
        .dtai-body{flex:1;min-height:0;display:grid;grid-template-columns:215px minmax(0,1fr) 260px}
        .dtai-sidebar,.dtai-inspector{background:#0d1724;border-right:1px solid #26384b;padding:14px;overflow:auto}
        .dtai-inspector{border-right:0;border-left:1px solid #26384b}
        .dtai-heading{font-size:9px;color:#7289a3;letter-spacing:1.2px;font-weight:700;margin-bottom:10px}
        .dtai-search{height:31px;width:100%;border:1px solid #2b4057;border-radius:5px;background:#09131f;color:#dce8f7;padding:0 8px;font-size:9px;margin-bottom:9px}
        .dtai-asset-row{width:100%;display:flex;align-items:center;gap:8px;padding:8px;margin:2px 0;border:1px solid transparent;border-radius:6px;background:transparent;color:#91a7be;text-align:left}
        .dtai-asset-row:hover,.dtai-asset-row.active{background:#17283a;border-color:#2a4561}
        .dtai-dot{width:8px;height:8px;border-radius:50%;flex:none}.dtai-asset-row strong{display:block;color:#dbe7f4;font-size:10px}.dtai-asset-row small{display:block;color:#6f879f;font-size:8px;margin-top:2px}
        .dtai-stage{min-width:0;overflow:auto;background:#09121d}
        .dtai-twinbar{height:43px;display:flex;align-items:center;gap:4px;padding:0 12px;border-bottom:1px solid #26384b}
        .dtai-subtab{height:27px;padding:0 9px;border:1px solid transparent;border-radius:5px;background:transparent;color:#8197ad;font-size:9px}.dtai-subtab.active{background:#17314c;border-color:#31577a;color:#a8d5ff}
        .dtai-metrics{display:grid;grid-template-columns:repeat(4,minmax(120px,1fr));gap:8px;padding:12px}
        .dtai-card{border:1px solid #26384b;border-radius:8px;background:#101c2a;padding:12px}.dtai-card span{font-size:8px;color:#8298af;text-transform:uppercase;letter-spacing:.8px}.dtai-card strong{display:block;font-size:19px;margin-top:5px}.dtai-card small{display:block;margin-top:4px;color:#6f879f;font-size:8px}
        .dtai-twin-grid{display:grid;grid-template-columns:1.4fr 1fr;gap:10px;padding:0 12px 12px}
        .dtai-live-map{height:300px;position:relative;border:1px solid #26384b;border-radius:8px;background:linear-gradient(145deg,#102131,#09131d);overflow:hidden}
        .dtai-floor{position:absolute;left:11%;right:11%;top:16%;bottom:16%;border:1px solid #3a5a73;transform:perspective(700px) rotateX(58deg) rotateZ(-7deg);background-image:linear-gradient(#314860 1px,transparent 1px),linear-gradient(90deg,#314860 1px,transparent 1px);background-size:42px 42px}
        .dtai-node{position:absolute;width:13px;height:13px;border:3px solid #08121d;border-radius:50%;box-shadow:0 0 14px currentColor}.dtai-node-a{left:31%;top:40%;color:#55c7a2;background:#55c7a2}.dtai-node-b{left:58%;top:52%;color:#e7b84d;background:#e7b84d}.dtai-node-c{left:74%;top:30%;color:#55a3dd;background:#55a3dd}
        .dtai-list{border:1px solid #26384b;border-radius:8px;background:#101c2a;overflow:hidden}.dtai-list-row{display:grid;grid-template-columns:1fr 80px 70px;gap:7px;padding:9px;border-bottom:1px solid #223247;font-size:9px;color:#91a7be}.dtai-list-row strong{color:#d7e4f3}
        .dtai-field{display:block;margin-bottom:9px;color:#7f96ad;font-size:9px}.dtai-field input,.dtai-field select{width:100%;height:31px;margin-top:5px;border:1px solid #2d435a;border-radius:5px;background:#09131f;color:#dce8f7;padding:0 8px;font-size:9px}
        .dtai-status-row{display:flex;justify-content:space-between;align-items:center;height:35px;border-bottom:1px solid #223247;font-size:9px;color:#8298af}.dtai-status-row strong{color:#d7e4f3;font-weight:500}
        .dtai-ai-layout{height:100%;display:grid;grid-template-columns:220px minmax(0,1fr)}
        .dtai-ai-tools{border-right:1px solid #26384b;padding:12px;background:#0c1723}
        .dtai-ai-tool{width:100%;height:36px;margin:3px 0;padding:0 8px;border:1px solid transparent;border-radius:5px;background:transparent;color:#92a8bf;text-align:left;font-size:9px}.dtai-ai-tool:hover{border-color:#2d4661;background:#172638}
        .dtai-chat{min-width:0;display:flex;flex-direction:column}.dtai-messages{flex:1;overflow:auto;padding:16px}.dtai-message{max-width:78%;margin:6px 0;padding:10px 12px;border:1px solid #26384b;border-radius:9px;font-size:10px;line-height:1.6}.dtai-message.assistant{background:#101d2a;color:#b8cbe0}.dtai-message.user{margin-left:auto;background:#173650;border-color:#315a78;color:#d9efff}
        .dtai-chat-input{display:flex;gap:7px;padding:10px;border-top:1px solid #26384b}.dtai-chat-input input{flex:1;height:38px;border:1px solid #2d455d;border-radius:6px;background:#09131f;color:#e2edf8;padding:0 10px;font-size:10px}.dtai-send{width:38px;border:1px solid #2d6da0;border-radius:6px;background:#1769ad;color:white;display:grid;place-items:center}
        @media(max-width:950px){.dtai-body{grid-template-columns:180px minmax(0,1fr)}.dtai-inspector{position:absolute;right:0;top:48px;bottom:0;width:250px;z-index:5}.dtai-metrics{grid-template-columns:repeat(2,minmax(120px,1fr))}.dtai-twin-grid{grid-template-columns:1fr}}
      `}</style>

      <nav className="dtai-tabs">
        <button className={`dtai-tab ${mode === "twin" ? "active" : ""}`} onClick={() => setMode("twin")}><Building2 size={14}/> Digital Twin & Asset Lifecycle</button>
        <button className={`dtai-tab ${mode === "ai" ? "active" : ""}`} onClick={() => setMode("ai")}><Sparkles size={14}/> AI Engineering Assistant</button>
        <div className="dtai-actions">
          <button className="dtai-action" onClick={() => setTelemetryLive((value) => !value)}><Activity size={13}/> {telemetryLive ? "Live" : "Paused"}</button>
          {mode === "twin" && <button className="dtai-action" onClick={saveAssets}><Server size={13}/> Save</button>}
          {mode === "twin" && <button className="dtai-action primary" onClick={exportAssets}><Download size={13}/> Export</button>}
        </div>
      </nav>

      {mode === "twin" ? (
        <div className="dtai-body">
          <aside className="dtai-sidebar">
            <div className="dtai-heading">ASSET HIERARCHY</div>
            <input className="dtai-search" value={assetSearch} onChange={(event) => setAssetSearch(event.target.value)} placeholder="Search assets..." />
            {filteredAssets.map((asset) => (
              <button key={asset.id} className={`dtai-asset-row ${selectedId === asset.id ? "active" : ""}`} onClick={() => setSelectedId(asset.id)}>
                <span className="dtai-dot" style={{ background: asset.status === "Operational" ? "#53c8a2" : asset.status === "Warning" ? "#e7b84d" : "#e66b65" }} />
                <span><strong>{asset.name}</strong><small>{asset.category}</small></span>
              </button>
            ))}
            <button className="dtai-action" style={{ width: "100%", justifyContent: "center", marginTop: 10 }} onClick={addAsset}><Plus size={13}/> Add Asset</button>
          </aside>

          <section className="dtai-stage">
            <div className="dtai-twinbar">
              {["Dashboard", "Telemetry", "Operations", "Maintenance", "Lifecycle"].map((tab) => (
                <button key={tab} className={`dtai-subtab ${activeTwinTab === tab ? "active" : ""}`} onClick={() => setActiveTwinTab(tab)}>{tab}</button>
              ))}
            </div>
            <div className="dtai-metrics">
              <div className="dtai-card"><span>Connected Assets</span><strong>{assets.length}</strong><small>IoT gateway online</small></div>
              <div className="dtai-card"><span>Live Energy</span><strong>{assets.reduce((sum, asset) => sum + asset.energy, 0).toFixed(1)} kW</strong><small>Building demand</small></div>
              <div className="dtai-card"><span>Warnings</span><strong>{assets.filter((asset) => asset.status === "Warning").length}</strong><small>Requires review</small></div>
              <div className="dtai-card"><span>Availability</span><strong>{((assets.filter((asset) => asset.status === "Operational").length / assets.length) * 100).toFixed(0)}%</strong><small>Asset service level</small></div>
            </div>
            <div className="dtai-twin-grid">
              <div className="dtai-live-map">
                <div className="dtai-floor" />
                <span className="dtai-node dtai-node-a" /><span className="dtai-node dtai-node-b" /><span className="dtai-node dtai-node-c" />
                <div style={{ position: "absolute", left: 12, bottom: 10, fontSize: 9, color: "#8fa6bd" }}>LIVE DIGITAL TWIN · LEVEL 02</div>
              </div>
              <div className="dtai-list">
                <div className="dtai-list-row" style={{ background: "#152438", color: "#819bb4" }}><strong>Sensor / Event</strong><strong>Value</strong><strong>State</strong></div>
                {assets.slice(0, 5).map((asset) => (
                  <div className="dtai-list-row" key={asset.id}>
                    <span>{asset.name}<br/><small>{asset.location}</small></span>
                    <span>{asset.temperature} °C</span>
                    <span style={{ color: asset.status === "Operational" ? "#55c7a2" : asset.status === "Warning" ? "#e7b84d" : "#e66b65" }}>{asset.status}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <aside className="dtai-inspector">
            <div className="dtai-heading">ASSET DETAIL</div>
            {selected ? (
              <>
                <label className="dtai-field">Asset name<input value={selected.name} onChange={(event) => updateSelected({ name: event.target.value })} /></label>
                <label className="dtai-field">Category<select value={selected.category} onChange={(event) => updateSelected({ category: event.target.value })}><option>Air Handling Unit</option><option>Chilled Water Pump</option><option>Passenger Lift</option><option>Fire Protection Pump</option><option>Equipment</option></select></label>
                <label className="dtai-field">Location<input value={selected.location} onChange={(event) => updateSelected({ location: event.target.value })} /></label>
                <label className="dtai-field">Operational state<select value={selected.status} onChange={(event) => updateSelected({ status: event.target.value as AssetStatus })}><option>Operational</option><option>Warning</option><option>Maintenance</option></select></label>
                <div className="dtai-status-row"><span>Temperature</span><strong>{selected.temperature} °C</strong></div>
                <div className="dtai-status-row"><span>Vibration</span><strong>{selected.vibration} mm/s</strong></div>
                <div className="dtai-status-row"><span>Power demand</span><strong>{selected.energy} kW</strong></div>
                <div className="dtai-status-row"><span>Last maintenance</span><strong>{selected.lastMaintenance}</strong></div>
                <label className="dtai-field" style={{ marginTop: 12 }}>Maintenance strategy<select value={maintenanceType} onChange={(event) => setMaintenanceType(event.target.value)}><option>Preventive</option><option>Predictive</option><option>Corrective</option></select></label>
                <button className="dtai-action primary" style={{ width: "100%", justifyContent: "center" }} onClick={() => setStatus(`${maintenanceType} work plan created for ${selected.name}`)}><Gauge size={13}/> Create Work Plan</button>
              </>
            ) : <div className="dtai-heading">No asset selected</div>}
            <div className="dtai-heading" style={{ marginTop: 18 }}>LIFECYCLE HISTORY</div>
            {["Commissioned · 2023", "Annual inspection · 2025", "Maintenance · 2026", "Live telemetry · Now"].map((item) => (
              <div className="dtai-status-row" key={item}><span>{item}</span><ShieldCheck size={12} /></div>
            ))}
          </aside>
        </div>
      ) : (
        <div className="dtai-body" style={{ gridTemplateColumns: "1fr" }}>
          <div className="dtai-ai-layout">
            <aside className="dtai-ai-tools">
              <div className="dtai-heading">AI ENGINEERING TOOLS</div>
              {["AI Design Assistant", "Natural Language Commands", "AI Drawing Assistant", "AI BIM Assistant", "AI Model Search", "Element Classification", "Drawing Recognition", "PDF Drawing Extraction", "Model Validation", "Clash Explanation", "Quantity Estimation", "Cost Estimation", "Design Suggestions", "Code Compliance", "Documentation", "Report Generation", "Project Knowledge Base", "Workflow Automation", "RPA Integration", "AI Agent API"].map((tool) => (
                <button className="dtai-ai-tool" key={tool} onClick={() => setStatus(`${tool} workspace selected`)}>{tool}</button>
              ))}
            </aside>
            <section className="dtai-chat">
              <div className="dtai-messages">
                {chat.map((message) => (
                  <div key={message.id} className={`dtai-message ${message.role}`}>
                    {message.role === "assistant" && <><BrainCircuit size={13} style={{ verticalAlign: "middle", marginRight: 7 }} /><b>ApexiveAI</b><br /></>}
                    {message.text}
                  </div>
                ))}
              </div>
              <form className="dtai-chat-input" onSubmit={(event) => { event.preventDefault(); respondToPrompt(); }}>
                <input value={chatInput} onChange={(event) => setChatInput(event.target.value)} placeholder="Ask about drawings, BIM models, quantities, compliance, clashes, or maintenance..." />
                <button className="dtai-send" type="submit" title="Send"><Send size={16}/></button>
              </form>
            </section>
          </div>
        </div>
      )}
      <footer style={{ height: 28, flex: "none", display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid #26384b", background: "#0b1420", padding: "0 12px", color: "#71879f", fontSize: 9 }}>
        <span>{status}</span><span>{assets.length} assets · {telemetryLive ? "Telemetry live" : "Telemetry paused"}</span>
      </footer>
    </main>
  );
}
