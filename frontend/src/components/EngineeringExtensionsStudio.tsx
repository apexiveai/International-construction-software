"use client";

import { useState } from "react";
import { Box, Cpu, Grid3X3, Layers3, Ruler, Settings2 } from "lucide-react";

type Extension = "civil" | "analysis" | "visualization";

const extensionLabels: Record<Extension, string> = {
  civil: "Civil & Infrastructure",
  analysis: "Engineering Analysis",
  visualization: "Visualization Studio",
};

export default function EngineeringExtensionsStudio({ initial = "civil" }: { initial?: Extension }) {
  const [active, setActive] = useState<Extension>(initial);
  const [status, setStatus] = useState("Workspace ready");
  const [quality, setQuality] = useState("High");
  const [camera, setCamera] = useState("Perspective");
  const [section, setSection] = useState(false);

  return (
    <main className="ee-shell">
      <style jsx global>{`
        .ee-shell{height:100%;min-height:620px;background:#09111c;color:#dce7f5;display:flex;flex-direction:column}
        .ee-tabs{height:48px;display:flex;align-items:center;gap:6px;padding:0 12px;border-bottom:1px solid #26384b;background:#0c1623}
        .ee-tab{height:32px;padding:0 12px;border:1px solid transparent;border-radius:6px;background:transparent;color:#91a7c0;font-size:10px;display:flex;align-items:center;gap:7px}
        .ee-tab.active{border-color:#31577a;background:#16314c;color:#91caff}
        .ee-body{flex:1;min-height:0;display:grid;grid-template-columns:210px minmax(0,1fr) 260px}
        .ee-sidebar,.ee-inspector{background:#0d1724;border-right:1px solid #26384b;padding:14px;overflow:auto}
        .ee-inspector{border-right:0;border-left:1px solid #26384b}
        .ee-heading{font-size:9px;color:#7289a3;letter-spacing:1.2px;font-weight:700;margin-bottom:10px}
        .ee-command{width:100%;height:34px;margin:3px 0;padding:0 9px;border:1px solid transparent;border-radius:5px;background:transparent;color:#9ab0c7;text-align:left;font-size:10px}
        .ee-command:hover{background:#172638;border-color:#2a4058;color:#e7eff8}
        .ee-stage{position:relative;overflow:hidden;background:linear-gradient(160deg,#101c2b,#080d15)}
        .ee-canvas-grid{position:absolute;inset:0;background-image:linear-gradient(#26384b66 1px,transparent 1px),linear-gradient(90deg,#26384b66 1px,transparent 1px);background-size:28px 28px}
        .ee-civil-map{position:absolute;left:8%;right:8%;top:12%;bottom:12%;border-radius:18px;border:1px solid #31506a;background:radial-gradient(circle at 32% 48%,#24495b 0 5%,transparent 6%),linear-gradient(135deg,#132637,#0e1a27)}
        .ee-road{position:absolute;width:74%;height:9%;left:14%;top:46%;border:2px dashed #839bb1;border-radius:60%;transform:rotate(-12deg);background:#1a2b3a88}
        .ee-contour{position:absolute;border:1px solid #5e947e;border-radius:50%;opacity:.75}.ee-c1{width:55%;height:50%;left:22%;top:24%}.ee-c2{width:38%;height:34%;left:31%;top:32%}.ee-c3{width:21%;height:18%;left:40%;top:40%}
        .ee-status{position:absolute;left:12px;bottom:12px;padding:7px 9px;border:1px solid #2b3f55;border-radius:5px;background:#0d1723dd;font-size:9px;color:#91a7bd}
        .ee-card{border:1px solid #26384b;border-radius:7px;background:#111e2d;padding:11px;margin-bottom:8px}
        .ee-card strong{display:block;font-size:11px;margin-bottom:5px}.ee-card span{font-size:9px;color:#7f95ac}
        .ee-row{display:flex;justify-content:space-between;align-items:center;min-height:34px;border-bottom:1px solid #223247;color:#91a7c0;font-size:9px}
        .ee-row strong{color:#d7e4f3;font-weight:500}.ee-row input,.ee-row select{width:105px;height:28px;border:1px solid #31455b;border-radius:4px;background:#09131f;color:#dfeafa;padding:0 6px;font-size:9px}
        .ee-progress{height:5px;border-radius:9px;background:#1d2b3b;margin-top:8px;overflow:hidden}.ee-progress i{display:block;height:100%;background:#50a9ec}
        @media(max-width:900px){.ee-body{grid-template-columns:150px minmax(0,1fr)}.ee-inspector{position:absolute;right:0;bottom:0;top:48px;width:240px;z-index:5}}
      `}</style>

      <nav className="ee-tabs">
        {([
          ["civil", "Civil & Infrastructure", Grid3X3],
          ["analysis", "Engineering Analysis", Cpu],
          ["visualization", "Visualization", Box],
        ] as const).map(([id, label, Icon]) => (
          <button key={id} className={`ee-tab ${active === id ? "active" : ""}`} onClick={() => setActive(id)}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </nav>

      <div className="ee-body">
        <aside className="ee-sidebar">
          <div className="ee-heading">{active === "civil" ? "CIVIL COMMANDS" : active === "analysis" ? "ANALYSIS JOBS" : "VISUAL SETTINGS"}</div>
          {active === "civil" && ["Survey Import", "Coordinate Systems", "Terrain / DEM", "Contour Generation", "Horizontal Alignment", "Vertical Alignment", "Corridor & Sections", "Earthwork / Cut-Fill", "Drainage / Pipe Network", "Bridge & Tunnel", "Utility Networks", "Infrastructure Documentation"].map((item) => (
            <button key={item} className="ee-command" onClick={() => setStatus(`${item} tool selected`)}>{item}</button>
          ))}
          {active === "analysis" && ["Structural Analysis", "Finite Element FEA", "CFD / Flow", "Thermal Analysis", "Energy Analysis", "Lighting Analysis", "Acoustic Analysis", "Wind Analysis", "Seismic Analysis", "Load Simulation", "Clash Impact", "Performance Report"].map((item) => (
            <button key={item} className="ee-command" onClick={() => setStatus(`${item} job ready`)}>{item}</button>
          ))}
          {active === "visualization" && ["PBR Material", "Texture Library", "Lighting System", "Sun & Sky", "Environment", "Camera System", "Scene Manager", "Render Quality", "Image / Panorama", "Walkthrough", "Animation Timeline", "Presentation / VR"].map((item) => (
            <button key={item} className="ee-command" onClick={() => setStatus(`${item} settings opened`)}>{item}</button>
          ))}
        </aside>

        <section className="ee-stage">
          <div className="ee-canvas-grid" />
          {active === "civil" ? (
            <div className="ee-civil-map">
              <div className="ee-road" />
              <div className="ee-contour ee-c1" />
              <div className="ee-contour ee-c2" />
              <div className="ee-contour ee-c3" />
            </div>
          ) : (
            <div style={{ position: "absolute", inset: "10%", display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
              {active === "analysis"
                ? ["Displacement", "Von Mises", "Modal Shape", "Flow Velocity", "Temperature", "Illuminance"].map((item, index) => (
                    <div className="ee-card" key={item}>
                      <strong>{item}</strong><span>{index % 2 ? "Completed · 100%" : "Converged · Ready"}</span>
                      <div className="ee-progress"><i style={{ width: `${92 - index * 3}%` }} /></div>
                    </div>
                  ))
                : ["Physically Based Rendering", "Sun / Sky", "Studio Environment", "PBR Materials", "Camera & Composition", "Walkthrough"].map((item) => (
                    <div className="ee-card" key={item}><strong>{item}</strong><span>Ready for configuration</span></div>
                  ))}
            </div>
          )}
          <div className="ee-status"><b>{extensionLabels[active]}</b> · {status}</div>
        </section>

        <aside className="ee-inspector">
          <div className="ee-heading">PROJECT SETTINGS</div>
          {active === "civil" && (
            <>
              <div className="ee-row"><span>Reference system</span><strong>UTM Zone 47N</strong></div>
              <div className="ee-row"><span>Terrain source</span><strong>DEM 1 m</strong></div>
              <div className="ee-row"><span>Cut / Fill</span><strong>Calculating</strong></div>
              <div className="ee-row"><span>Section interval</span><strong>20 m</strong></div>
              <div className="ee-card" style={{ marginTop: 12 }}><strong>Earthwork Summary</strong><span>Cut 12,840 m³</span><br/><span>Fill 9,620 m³ · Balance 3,220 m³</span></div>
            </>
          )}
          {active === "analysis" && (
            <>
              <div className="ee-row"><span>Job state</span><strong>Ready</strong></div>
              <div className="ee-row"><span>Solver</span><strong>Iterative</strong></div>
              <div className="ee-row"><span>Convergence</span><strong>0.01%</strong></div>
              <div className="ee-row"><span>Mesh quality</span><strong>High</strong></div>
              <button className="ee-command" onClick={() => setStatus("Validation passed · Analysis job submitted")}>Run Analysis</button>
              <button className="ee-command" onClick={() => setStatus("Simulation result package opened")}>Open Results</button>
            </>
          )}
          {active === "visualization" && (
            <>
              <div className="ee-row"><span>Render quality</span><select value={quality} onChange={(e) => setQuality(e.target.value)}><option>Draft</option><option>Balanced</option><option>High</option><option>Ultra</option></select></div>
              <div className="ee-row"><span>Camera</span><select value={camera} onChange={(e) => setCamera(e.target.value)}><option>Perspective</option><option>Orthographic</option></select></div>
              <div className="ee-row"><span>Section mode</span><button className="ee-command" style={{ width: 80, margin: 0, textAlign: "center" }} onClick={() => setSection((value) => !value)}>{section ? "Enabled" : "Disabled"}</button></div>
              <button className="ee-command" onClick={() => setStatus(`${quality} render job submitted`)}>Render Image</button>
              <button className="ee-command" onClick={() => setStatus("360° panorama generation started")}>Render Panorama</button>
              <button className="ee-command" onClick={() => setStatus("Walkthrough camera sequence opened")}>Create Walkthrough</button>
            </>
          )}
        </aside>
      </div>
    </main>
  );
}
