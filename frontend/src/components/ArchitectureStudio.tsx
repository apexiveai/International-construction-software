"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  Box, DoorOpen, Download, Eye, EyeOff, Grid3X3, Layers3, Minus,
  MousePointer2, Plus, Redo2, Save, Settings2, Square, Trash2, Undo2,
  AppWindow as WindowIcon, Ruler, Home, Building2
} from "lucide-react";

type ElementKind = "wall" | "door" | "window" | "slab" | "room";
type Opening = { id: string; kind: "door" | "window"; center: number; width: number; height: number; sill: number };
type ArchitectureElement = {
  id: string;
  kind: ElementKind;
  name: string;
  levelId: string;
  visible: boolean;
  x: number;
  z: number;
  rotation: number;
  width: number;
  height: number;
  thickness: number;
  elevation: number;
  color: string;
  hostWallId?: string;
  opening?: Opening;
};
type Level = { id: string; name: string; elevation: number; height: number };
type ModelDocument = { format: "ApexiveAI-Architecture"; version: 1; units: "meters"; levels: Level[]; elements: ArchitectureElement[] };
type HistoryState = { levels: Level[]; elements: ArchitectureElement[]; selectedId: string | null };

const STORAGE_KEY = "apexiveai-architecture-model-v1";
const uid = () => `ae-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const DEFAULT_LEVELS: Level[] = [{ id: "level-00", name: "Level 00 - Ground", elevation: 0, height: 3.2 }, { id: "level-01", name: "Level 01", elevation: 3.2, height: 3.2 }];
const DEFAULT_ELEMENTS: ArchitectureElement[] = [
  { id: "wall-01", kind: "wall", name: "Exterior Wall 01", levelId: "level-00", visible: true, x: 0, z: 0, rotation: 0, width: 8, height: 3.2, thickness: 0.2, elevation: 0, color: "#9aafc5" },
  { id: "wall-02", kind: "wall", name: "Exterior Wall 02", levelId: "level-00", visible: true, x: 0, z: 0, rotation: Math.PI / 2, width: 6, height: 3.2, thickness: 0.2, elevation: 0, color: "#9aafc5" },
  { id: "slab-01", kind: "slab", name: "Ground Floor Slab", levelId: "level-00", visible: true, x: 0, z: 0, rotation: 0, width: 8, height: 6, thickness: 0.18, elevation: -0.09, color: "#647b91" },
];

function makeWallGeometry(element: ArchitectureElement, openings: Opening[]) {
  const shape = new THREE.Shape();
  shape.moveTo(-element.width / 2, 0);
  shape.lineTo(element.width / 2, 0);
  shape.lineTo(element.width / 2, element.height);
  shape.lineTo(-element.width / 2, element.height);
  shape.closePath();
  for (const opening of openings) {
    const left = Math.max(-element.width / 2 + 0.02, opening.center - opening.width / 2);
    const right = Math.min(element.width / 2 - 0.02, opening.center + opening.width / 2);
    const bottom = Math.max(0, opening.sill);
    const top = Math.min(element.height - 0.02, bottom + opening.height);
    if (right <= left || top <= bottom) continue;
    const hole = new THREE.Path();
    hole.moveTo(left, bottom); hole.lineTo(left, top); hole.lineTo(right, top); hole.lineTo(right, bottom); hole.closePath();
    shape.holes.push(hole);
  }
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: element.thickness, bevelEnabled: false, curveSegments: 1 });
  geometry.translate(0, 0, -element.thickness / 2);
  return geometry;
}

function elementLabel(kind: ElementKind) {
  return ({ wall: "Wall", door: "Door", window: "Window", slab: "Floor Slab", room: "Room" })[kind];
}

export default function ArchitectureStudio() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const engineRef = useRef<{ scene: THREE.Scene; camera: THREE.PerspectiveCamera; renderer: THREE.WebGLRenderer; orbit: OrbitControls; raycaster: THREE.Raycaster; pointer: THREE.Vector2; meshes: Map<string, THREE.Object3D>; observer: ResizeObserver } | null>(null);
  const [levels, setLevels] = useState<Level[]>(DEFAULT_LEVELS);
  const [elements, setElements] = useState<ArchitectureElement[]>(DEFAULT_ELEMENTS);
  const [selectedId, setSelectedId] = useState<string | null>("wall-01");
  const [activeLevelId, setActiveLevelId] = useState("level-00");
  const [gridVisible, setGridVisible] = useState(true);
  const [showInspector, setShowInspector] = useState(true);
  const [status, setStatus] = useState("Architecture workspace ready");
  const [storageReady, setStorageReady] = useState(false);
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [future, setFuture] = useState<HistoryState[]>([]);
  const [tool, setTool] = useState<"select" | "wall" | "slab">("select");
  const [designTab, setDesignTab] = useState<
    "Model" | "Planning" | "Documentation" | "Review"
  >("Model");
  const selected = elements.find((element) => element.id === selectedId) ?? null;
  const activeLevel = levels.find((level) => level.id === activeLevelId) ?? levels[0];

  const snapshot = useCallback((): HistoryState => ({ levels: clone(levels), elements: clone(elements), selectedId }), [levels, elements, selectedId]);
  const commit = useCallback(() => { setHistory((current) => [...current.slice(-49), snapshot()]); setFuture([]); }, [snapshot]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || engineRef.current) return;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#09111c");
    scene.fog = new THREE.Fog("#09111c", 55, 130);
    const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 500);
    camera.position.set(12, 10, 14);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.shadowMap.enabled = true;
    renderer.domElement.style.cssText = "display:block;width:100%;height:100%;outline:none";
    host.appendChild(renderer.domElement);
    const orbit = new OrbitControls(camera, renderer.domElement);
    orbit.enableDamping = true; orbit.dampingFactor = 0.07; orbit.target.set(0, 1.4, 0); orbit.maxPolarAngle = Math.PI * 0.495;
    scene.add(new THREE.HemisphereLight(0xc5ddff, 0x1b2634, 2));
    const key = new THREE.DirectionalLight(0xffffff, 3.1); key.position.set(8, 15, 9); key.castShadow = true; key.shadow.mapSize.set(2048, 2048); scene.add(key);
    const fill = new THREE.DirectionalLight(0x6ba9ff, 1.15); fill.position.set(-8, 7, -8); scene.add(fill);
    const grid = new THREE.GridHelper(60, 60, 0x49617a, 0x24374b); grid.name = "__grid"; grid.position.y = -0.015; scene.add(grid);
    const axes = new THREE.AxesHelper(3); axes.name = "__axes"; scene.add(axes);
    const raycaster = new THREE.Raycaster(); const pointer = new THREE.Vector2(); const meshes = new Map<string, THREE.Object3D>();
    const observer = new ResizeObserver(() => { const w = Math.max(host.clientWidth, 1), h = Math.max(host.clientHeight, 1); camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h, false); });
    observer.observe(host);
    const onPointer = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect(); pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1; pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects([...meshes.values()], true);
      let object = hits[0]?.object;
      while (object && !object.userData.elementId && object.parent) object = object.parent;
      setSelectedId((object?.userData.elementId as string | undefined) ?? null);
    };
    renderer.domElement.addEventListener("pointerdown", onPointer);
    engineRef.current = { scene, camera, renderer, orbit, raycaster, pointer, meshes, observer };
    let frame = 0; const animate = () => { frame = requestAnimationFrame(animate); orbit.update(); renderer.render(scene, camera); }; animate();
    return () => { cancelAnimationFrame(frame); renderer.domElement.removeEventListener("pointerdown", onPointer); observer.disconnect(); orbit.dispose(); for (const object of meshes.values()) disposeObject(object); renderer.dispose(); renderer.domElement.remove(); engineRef.current = null; };
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) { const parsed = JSON.parse(raw) as ModelDocument; if (parsed.format === "ApexiveAI-Architecture" && Array.isArray(parsed.elements) && Array.isArray(parsed.levels)) { setElements(parsed.elements); setLevels(parsed.levels); setActiveLevelId(parsed.levels[0]?.id ?? "level-00"); } }
    } catch { setStatus("Saved architecture model could not be loaded"); }
    finally { setStorageReady(true); }
  }, []);

  useEffect(() => {
    const engine = engineRef.current; if (!engine) return;
    const nextIds = new Set(elements.map((element) => element.id));
    for (const [id, object] of engine.meshes) if (!nextIds.has(id)) { engine.scene.remove(object); disposeObject(object); engine.meshes.delete(id); }
    for (const element of elements) {
      let object: THREE.Object3D | null | undefined = engine.meshes.get(element.id);
      if (object) { engine.scene.remove(object); disposeObject(object); engine.meshes.delete(element.id); }
      object = buildElementObject(element, elements);
      if (!object) continue;
      object.userData.elementId = element.id;
      object.visible = element.visible && element.levelId === activeLevelId;
      engine.scene.add(object); engine.meshes.set(element.id, object);
    }
    const grid = engine.scene.getObjectByName("__grid"); if (grid) grid.visible = gridVisible;
    const axes = engine.scene.getObjectByName("__axes"); if (axes) axes.visible = gridVisible;
  }, [elements, activeLevelId, gridVisible]);

  const addElement = (kind: ElementKind) => {
    commit();
    if ((kind === "door" || kind === "window") && !elements.some((element) => element.id === selectedId && element.kind === "wall")) { setStatus(`Select a wall before adding a ${kind}`); return; }
    const id = uid(); const count = elements.filter((element) => element.kind === kind).length + 1;
    const element: ArchitectureElement = {
      id, kind, name: `${elementLabel(kind)} ${String(count).padStart(2, "0")}`, levelId: activeLevelId, visible: true,
      x: 0, z: 0, rotation: 0, width: kind === "wall" ? 5 : kind === "slab" || kind === "room" ? 6 : 0.9,
      height: kind === "wall" ? activeLevel.height : kind === "door" ? 2.1 : kind === "window" ? 1.2 : 0.18,
      thickness: kind === "wall" ? 0.2 : kind === "slab" ? 0.18 : 0.08,
      elevation: kind === "wall" ? activeLevel.elevation : kind === "slab" ? activeLevel.elevation - 0.09 : activeLevel.elevation,
      color: kind === "wall" ? "#9aafc5" : kind === "door" ? "#b58b5b" : kind === "window" ? "#5baac7" : kind === "room" ? "#294c69" : "#647b91",
      ...(kind === "door" || kind === "window" ? { hostWallId: selectedId ?? undefined, opening: { id: uid(), kind, center: 0, width: kind === "door" ? 0.9 : 1.2, height: kind === "door" ? 2.1 : 1.2, sill: kind === "door" ? 0 : 0.9 } } : {})
    };
    setElements((current) => [...current, element]); setSelectedId(id); setTool("select"); setStatus(`${element.name} created`);
  };

  const updateSelected = (patch: Partial<ArchitectureElement>) => {
    if (!selected) return;
    commit();
    setElements((current) => current.map((item) => {
      if (item.id !== selected.id) return item;
      const next = { ...item, ...patch };
      if ((item.kind === "door" || item.kind === "window") && item.opening) {
        next.opening = { ...item.opening, ...(patch.width !== undefined ? { width: patch.width } : {}), ...(patch.height !== undefined ? { height: patch.height } : {}) };
      }
      return next;
    }));
  };
  const deleteSelected = () => { if (!selected) return; commit(); const ids = new Set([selected.id]); if (selected.kind === "wall") for (const item of elements) if (item.hostWallId === selected.id) ids.add(item.id); setElements((current) => current.filter((item) => !ids.has(item.id))); setSelectedId(null); setStatus("Element deleted"); };
  const undo = () => { const previous = history[history.length - 1]; if (!previous) return; setFuture((current) => [snapshot(), ...current]); setHistory((current) => current.slice(0, -1)); setLevels(previous.levels); setElements(previous.elements); setSelectedId(previous.selectedId); setStatus("Undo complete"); };
  const redo = () => { const next = future[0]; if (!next) return; setHistory((current) => [...current, snapshot()]); setFuture((current) => current.slice(1)); setLevels(next.levels); setElements(next.elements); setSelectedId(next.selectedId); setStatus("Redo complete"); };
  const saveModel = () => { try { const document: ModelDocument = { format: "ApexiveAI-Architecture", version: 1, units: "meters", levels, elements }; localStorage.setItem(STORAGE_KEY, JSON.stringify(document)); setStatus("Architecture model saved in this browser"); } catch { setStatus("Save failed: browser storage unavailable"); } };
  const exportModel = () => { const document: ModelDocument = { format: "ApexiveAI-Architecture", version: 1, units: "meters", levels, elements }; downloadJson(document, "apexiveai-architecture-model.json"); setStatus("Architecture model JSON exported"); };
  const importModel = async (file?: File) => { if (!file) return; try { const parsed = JSON.parse(await file.text()) as ModelDocument; if (parsed.format !== "ApexiveAI-Architecture" || !Array.isArray(parsed.elements) || !Array.isArray(parsed.levels)) throw new Error("Unsupported architecture document"); commit(); setElements(parsed.elements); setLevels(parsed.levels); setActiveLevelId(parsed.levels[0]?.id ?? "level-00"); setSelectedId(null); setStatus(`Imported ${parsed.elements.length} model elements`); } catch (error) { setStatus(error instanceof Error ? error.message : "Import failed"); } };
  const addLevel = () => { commit(); const index = levels.length; const previous = levels[index - 1]; const level: Level = { id: uid(), name: `Level ${String(index).padStart(2, "0")}`, elevation: (previous?.elevation ?? 0) + (previous?.height ?? 3.2), height: 3.2 }; setLevels((current) => [...current, level]); setActiveLevelId(level.id); setStatus(`${level.name} added`); };
  const focusModel = () => { const engine = engineRef.current; if (!engine) return; const visible = [...engine.meshes.values()].filter((object) => object.visible); if (!visible.length) return; const bounds = new THREE.Box3(); visible.forEach((object) => bounds.expandByObject(object)); const center = bounds.getCenter(new THREE.Vector3()); const size = Math.max(bounds.getSize(new THREE.Vector3()).length(), 4); engine.orbit.target.copy(center); engine.camera.position.copy(center).add(new THREE.Vector3(size * 0.85, size * 0.65, size * 0.9)); engine.orbit.update(); };

  useEffect(() => { const onKey = (event: KeyboardEvent) => { const target = event.target as HTMLElement | null; if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return; if (event.ctrlKey && event.key.toLowerCase() === "z") { event.preventDefault(); undo(); } else if (event.ctrlKey && event.key.toLowerCase() === "y") { event.preventDefault(); redo(); } else if (event.key === "Delete" || event.key === "Backspace") deleteSelected(); else if (event.key.toLowerCase() === "v") setTool("select"); else if (event.key.toLowerCase() === "w") { setTool("wall"); addElement("wall"); } }; window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey); });

  const hostedOpeningCount = useMemo(() => selected?.kind === "wall" ? elements.filter((element) => element.hostWallId === selected.id).length : 0, [selected, elements]);

  return (
    <main className="a07-shell">
      <style jsx global>{`
        .a07-shell{height:100%;min-height:680px;background:#080e17;color:#dce8f7;display:flex;flex-direction:column;overflow:hidden;font-family:Inter,ui-sans-serif,system-ui,sans-serif}
        .a07-top{height:58px;flex:none;display:flex;align-items:center;justify-content:space-between;padding:0 18px;border-bottom:1px solid #1c2b3d;background:#0c1521;gap:12px}.a07-brand{display:flex;align-items:center;gap:10px}.a07-mark{width:31px;height:31px;border-radius:8px;background:linear-gradient(135deg,#2876c8,#65c7f2);display:grid;place-items:center}.a07-brand b{font-size:12px;letter-spacing:.12em}.a07-brand small{display:block;color:#71869e;font-size:9px;letter-spacing:.15em;margin-top:3px}
        .a07-actions,.a07-tools{display:flex;align-items:center;gap:6px;flex-wrap:wrap}.a07-btn{height:32px;min-width:32px;padding:0 10px;border:1px solid #25364b;border-radius:6px;background:#111e2d;color:#a9bdd4;display:inline-flex;align-items:center;justify-content:center;gap:7px;font-size:11px;cursor:pointer}.a07-btn:hover{border-color:#4d8dca;color:#fff}.a07-btn.active{background:#17385a;border-color:#398bd5;color:#8ccaff}.a07-btn.primary{background:#1769ad;border-color:#287fc5;color:#fff}.a07-btn:disabled{opacity:.35;cursor:not-allowed}
        .a07-workbar{min-height:48px;flex:none;display:flex;align-items:center;gap:12px;padding:7px 16px;border-bottom:1px solid #1b2a3a;background:#0a131e}.a07-label{font-size:9px;color:#607b98;letter-spacing:.15em;margin-right:3px}.a07-sep{width:1px;height:23px;background:#26374a}.a07-stage{flex:1;min-height:0;display:flex;position:relative}.a07-view{flex:1;min-width:0;position:relative;background:#09111c}.a07-hud{position:absolute;left:15px;top:13px;pointer-events:none;color:#7891ac;font-size:10px;line-height:1.8;letter-spacing:.06em}.a07-hud b{color:#c0ddf8}.a07-viewtools{position:absolute;right:14px;top:13px;display:flex;gap:5px}.a07-status{position:absolute;bottom:12px;left:14px;right:14px;display:flex;justify-content:space-between;pointer-events:none;color:#7189a4;font-size:10px}.a07-inspector{width:285px;flex:none;border-left:1px solid #1c2b3d;background:#0d1723;overflow:auto}.a07-head{padding:15px;border-bottom:1px solid #1e3044;display:flex;justify-content:space-between;align-items:center}.a07-head b{font-size:10px;letter-spacing:.13em}.a07-section{padding:13px 15px;border-bottom:1px solid #1c2b3d}.a07-section-title{font-size:9px;color:#7891ac;letter-spacing:.15em;margin-bottom:11px}.a07-row{display:flex;align-items:center;gap:8px;padding:8px;border-radius:5px;color:#9db1c8;font-size:11px;cursor:pointer}.a07-row:hover{background:#142438}.a07-row.selected{background:#17314c;color:#b9ddff}.a07-row span:nth-child(2){flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.a07-field{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:9px 0;color:#8ea5bd;font-size:10px}.a07-field input,.a07-field select{width:125px;height:28px;padding:0 7px;border:1px solid #293d53;border-radius:5px;background:#09121d;color:#dce8f7;font-size:11px;outline:none}.a07-field input:focus,.a07-field select:focus{border-color:#438fd0}.a07-chip{padding:3px 6px;border:1px solid #263a50;border-radius:4px;color:#8fa8c2;font-size:9px}.a07-empty{font-size:11px;color:#71869e;line-height:1.6}.a07-footer{height:27px;flex:none;border-top:1px solid #1c2b3d;background:#0a131e;display:flex;align-items:center;justify-content:space-between;padding:0 12px;color:#6e859f;font-size:9px}
        @media(max-width:900px){.a07-inspector{width:245px}.a07-workbar{gap:6px;padding:7px 8px}.a07-top{padding:0 9px}}@media(max-width:650px){.a07-inspector{position:absolute;right:0;top:0;bottom:0;z-index:5;width:min(285px,84vw);box-shadow:-12px 0 35px #0008}.a07-brand small{display:none}.a07-brand b{font-size:10px}.a07-btn .a07-btn-text{display:none}.a07-workbar{gap:5px}.a07-label{display:none}}
      `}</style>
      <header className="a07-top">
        <div className="a07-brand"><div className="a07-mark"><Building2 size={17}/></div><div><b>APEXIVEAI</b><small>ARCHITECTURE STUDIO</small></div></div>
        <div className="a07-actions">
          <button className="a07-btn" title="Undo" onClick={undo} disabled={!history.length}><Undo2 size={14}/></button>
          <button className="a07-btn" title="Redo" onClick={redo} disabled={!future.length}><Redo2 size={14}/></button>
          <button className="a07-btn" onClick={() => fileRef.current?.click()}><Download size={14}/><span className="a07-btn-text">Import</span></button>
          <button className="a07-btn" onClick={exportModel}><Download size={14}/><span className="a07-btn-text">Export</span></button>
          <button className="a07-btn primary" onClick={saveModel} disabled={!storageReady}><Save size={14}/><span className="a07-btn-text">Save</span></button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(event) => { void importModel(event.target.files?.[0]); event.currentTarget.value = ""; }}/>
        </div>
      </header>
      <nav className="a07-workbar">
        <span className="a07-label">BUILD</span>
        <button className={`a07-btn ${tool === "select" ? "active" : ""}`} onClick={() => setTool("select")}><MousePointer2 size={14}/>Select</button>
        <button className="a07-btn" onClick={() => addElement("wall")}><Minus size={14}/>Wall</button>
        <button className="a07-btn" onClick={() => addElement("door")}><DoorOpen size={14}/>Door</button>
        <button className="a07-btn" onClick={() => addElement("window")}><WindowIcon size={14}/>Window</button>
        <button className="a07-btn" onClick={() => addElement("slab")}><Square size={14}/>Floor</button>
        <button className="a07-btn" onClick={() => addElement("room")}><Home size={14}/>Room</button>
        <span className="a07-sep"/>
        <span className="a07-label">LEVEL</span>
        <select aria-label="Active level" value={activeLevelId} onChange={(event) => setActiveLevelId(event.target.value)} style={{height:32,maxWidth:165,background:"#09121d",color:"#c6d7e9",border:"1px solid #293d53",borderRadius:6,padding:"0 7px",fontSize:11}}>{levels.map((level) => <option key={level.id} value={level.id}>{level.name}</option>)}</select>
        <button className="a07-btn" onClick={addLevel} title="Add level"><Plus size={14}/></button>
        <span className="a07-sep"/>
        {(["Model", "Planning", "Documentation", "Review"] as const).map((tab) => (
          <button
            key={tab}
            className={`a07-btn ${designTab === tab ? "active" : ""}`}
            onClick={() => {
              setDesignTab(tab);
              setStatus(`${tab} workspace opened`);
            }}
          >
            {tab}
          </button>
        ))}
      </nav>
      <section className="a07-stage">
        <div className="a07-view" ref={hostRef}>
          <div className="a07-hud"><b>ARCHITECTURE MODEL VIEW</b><br/>3D BIM workspace · Perspective<br/>Active: {activeLevel?.name ?? "—"} · Units: meters</div>
          <div className="a07-viewtools"><button className={`a07-btn ${gridVisible ? "active" : ""}`} title="Toggle grid" onClick={() => setGridVisible((value) => !value)}><Grid3X3 size={14}/></button><button className="a07-btn" title="Fit model" onClick={focusModel}><Ruler size={14}/></button><button className="a07-btn" title="Toggle inspector" onClick={() => setShowInspector((value) => !value)}><Settings2 size={14}/></button></div>
          <div className="a07-status"><span>{status}</span><span>Orbit: left drag · Pan: right drag · Zoom: scroll</span></div>
        </div>
        {showInspector && <aside className="a07-inspector">
          <div className="a07-head"><b>MODEL EXPLORER</b><span className="a07-chip">{elements.length} ELEMENTS</span></div>
          <div className="a07-section">
            <div className="a07-section-title">{designTab.toUpperCase()} WORKSPACE</div>
            {designTab === "Planning" && ["Site Planning", "Building Layout", "Floor Plan", "Elevation", "Section Drawing", "Roof Design", "Facade Design", "Interior Design", "Room Planning", "Space Planning"].map((tool) => (
              <button key={tool} className="a07-btn" style={{ width: "100%", justifyContent: "flex-start", margin: "3px 0" }} onClick={() => setStatus(`${tool} tool selected`)}>{tool}</button>
            ))}
            {designTab === "Documentation" && ["Door & Window Schedules", "Room Finish Schedules", "Area Calculation", "Architectural Documentation"].map((tool) => (
              <button key={tool} className="a07-btn" style={{ width: "100%", justifyContent: "flex-start", margin: "3px 0" }} onClick={() => setStatus(`${tool} opened`)}>{tool}</button>
            ))}
            {designTab === "Review" && ["Building Code Rules", "Accessibility Checks", "Design Alternatives", "Design Review"].map((tool) => (
              <button key={tool} className="a07-btn" style={{ width: "100%", justifyContent: "flex-start", margin: "3px 0" }} onClick={() => setStatus(`${tool}: validation ready`)}>{tool}</button>
            ))}
            {designTab === "Model" && (
              <>
                <div className="a07-field"><span>Architectural design workspace</span><strong>Active</strong></div>
                <div className="a07-field"><span>Parametric families</span><strong>{elements.filter((item) => item.kind !== "room").length}</strong></div>
              </>
            )}
          </div>
          <div className="a07-section"><div className="a07-section-title">LEVELS</div>{levels.map((level) => <div key={level.id} className={`a07-row ${activeLevelId === level.id ? "selected" : ""}`} onClick={() => setActiveLevelId(level.id)}><Layers3 size={13}/><span>{level.name}</span><span className="a07-chip">{level.elevation.toFixed(2)}m</span></div>)}</div>
          <div className="a07-section"><div className="a07-section-title">ARCHITECTURAL ELEMENTS</div>{elements.filter((element) => element.levelId === activeLevelId).map((element) => <div key={element.id} className={`a07-row ${selectedId === element.id ? "selected" : ""}`} onClick={() => setSelectedId(element.id)}><span style={{width:8,height:8,borderRadius:2,background:element.color,flex:"none"}}/><span>{element.name}</span><button className="a07-btn" style={{width:25,minWidth:25,height:24,padding:0}} title={element.visible ? "Hide" : "Show"} onClick={(event) => { event.stopPropagation(); commit(); setElements((current) => current.map((item) => item.id === element.id ? {...item,visible:!item.visible} : item)); }}>{element.visible ? <Eye size={12}/> : <EyeOff size={12}/>}</button></div>)}</div>
          <div className="a07-section"><div className="a07-section-title">ELEMENT PROPERTIES</div>{selected ? <>
            <label className="a07-field"><span>Name</span><input value={selected.name} onChange={(event) => updateSelected({name:event.target.value})}/></label>
            <label className="a07-field"><span>Width (m)</span><input type="number" min="0.05" step="0.1" value={selected.width} onChange={(event) => updateSelected({width:Math.max(0.05,Number(event.target.value)||0.05)})}/></label>
            <label className="a07-field"><span>Height (m)</span><input type="number" min="0.05" step="0.1" value={selected.height} onChange={(event) => updateSelected({height:Math.max(0.05,Number(event.target.value)||0.05)})}/></label>
            <label className="a07-field"><span>Thickness (m)</span><input type="number" min="0.03" step="0.01" value={selected.thickness} onChange={(event) => updateSelected({thickness:Math.max(0.03,Number(event.target.value)||0.03)})}/></label>
            <label className="a07-field"><span>Position X</span><input type="number" step="0.1" value={selected.x} onChange={(event) => updateSelected({x:Number(event.target.value)||0})}/></label>
            <label className="a07-field"><span>Position Z</span><input type="number" step="0.1" value={selected.z} onChange={(event) => updateSelected({z:Number(event.target.value)||0})}/></label>
            <label className="a07-field"><span>Rotation °</span><input type="number" step="5" value={Math.round(selected.rotation*180/Math.PI)} onChange={(event) => updateSelected({rotation:(Number(event.target.value)||0)*Math.PI/180})}/></label>
            <label className="a07-field"><span>Material</span><input type="color" value={selected.color} onChange={(event) => updateSelected({color:event.target.value})}/></label>
            {selected.kind === "wall" && <div className="a07-field"><span>Hosted openings</span><strong>{hostedOpeningCount}</strong></div>}
            {(selected.kind === "door" || selected.kind === "window") && selected.opening && <><div className="a07-section-title" style={{marginTop:15}}>HOSTED OPENING</div><label className="a07-field"><span>Opening width</span><input type="number" min="0.2" step="0.1" value={selected.opening.width} onChange={(event) => updateSelected({opening:{...selected.opening!,width:Math.max(0.2,Number(event.target.value)||0.2)}})}/></label><label className="a07-field"><span>Sill height</span><input type="number" min="0" step="0.1" value={selected.opening.sill} onChange={(event) => updateSelected({opening:{...selected.opening!,sill:Math.max(0,Number(event.target.value)||0)}})}/></label></>}
            <button className="a07-btn" style={{width:"100%",marginTop:10,color:"#f08c8c"}} onClick={deleteSelected}><Trash2 size={13}/>Delete element</button>
          </> : <div className="a07-empty">Select an element in the viewport or model explorer to inspect its properties.</div>}</div>
          <div className="a07-section"><div className="a07-section-title">MODEL DATA</div><div className="a07-field"><span>Levels</span><strong>{levels.length}</strong></div><div className="a07-field"><span>Walls</span><strong>{elements.filter((e)=>e.kind==="wall").length}</strong></div><div className="a07-field"><span>Doors / Windows</span><strong>{elements.filter((e)=>e.kind==="door"||e.kind==="window").length}</strong></div><div className="a07-field"><span>History</span><strong>{history.length} steps</strong></div></div>
        </aside>}
      </section>
      <footer className="a07-footer"><span>APEXIVEAI DESIGN & ENGINEERING · MILESTONE 07</span><span>Architecture Studio <span className="a07-chip">{storageReady ? "LOCAL MODEL STORAGE" : "LOADING"}</span></span></footer>
    </main>
  );
}

function buildElementObject(element: ArchitectureElement, all: ArchitectureElement[]): THREE.Object3D | null {
  if ((element.kind === "door" || element.kind === "window") && element.hostWallId) return null;
  const group = new THREE.Group(); group.position.set(element.x, element.elevation, element.z); group.rotation.y = element.rotation; group.name = element.name;
  const material = (color: string, opacity = 1) => new THREE.MeshStandardMaterial({ color, roughness: 0.72, metalness: 0.03, transparent: opacity < 1, opacity, side: THREE.DoubleSide });
  if (element.kind === "wall") {
    const openings = all.filter((item) => item.hostWallId === element.id && item.opening).map((item) => item.opening!);
    const mesh = new THREE.Mesh(makeWallGeometry(element, openings), material(element.color)); mesh.castShadow = true; mesh.receiveShadow = true; mesh.position.y = 0; mesh.userData.elementId = element.id; group.add(mesh);
    for (const child of all.filter((item) => item.hostWallId === element.id && item.opening)) {
      const opening = child.opening!; const frameMat = material(child.color);
      if (child.kind === "door") {
        const panel = new THREE.Mesh(new THREE.BoxGeometry(opening.width * 0.94, opening.height * 0.97, Math.max(0.045, element.thickness * 0.35)), material(child.color)); panel.position.set(opening.center, opening.sill + opening.height / 2, element.thickness * 0.04); panel.userData.elementId = child.id; group.add(panel);
      } else {
        const glass = new THREE.Mesh(new THREE.BoxGeometry(opening.width * 0.94, opening.height * 0.94, Math.max(0.025, element.thickness * 0.18)), material("#66c4e8", 0.42)); glass.position.set(opening.center, opening.sill + opening.height / 2, 0); glass.userData.elementId = child.id; group.add(glass);
        const frame = new THREE.Mesh(new THREE.BoxGeometry(opening.width, 0.055, element.thickness * 0.7), frameMat); frame.position.set(opening.center, opening.sill, 0); frame.userData.elementId = child.id; group.add(frame);
      }
    }
  } else if (element.kind === "slab" || element.kind === "room") {
    const geometry = new THREE.BoxGeometry(element.width, element.thickness, element.height);
    const mesh = new THREE.Mesh(geometry, material(element.color, element.kind === "room" ? 0.42 : 1)); mesh.position.y = element.kind === "slab" ? element.thickness / 2 : 0.015; mesh.castShadow = true; mesh.receiveShadow = true; mesh.userData.elementId = element.id; group.add(mesh);
    if (element.kind === "room") { const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(element.width, 0.03, element.height)); const outline = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({color:"#65b8f5"})); outline.position.y = 0.04; outline.userData.elementId = element.id; group.add(outline); }
  } else if (element.kind === "door" || element.kind === "window") {
    // Unhosted openings remain visible as standalone placeholders until assigned to a host wall.
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(element.width, element.height, element.thickness), material(element.color, element.kind === "window" ? 0.5 : 1)); mesh.position.y = element.height / 2; mesh.userData.elementId = element.id; group.add(mesh);
  }
  group.traverse((object) => { if (object instanceof THREE.Mesh) { object.castShadow = true; object.receiveShadow = true; } });
  return group;
}

function disposeObject(object: THREE.Object3D) { object.traverse((child) => { if (child instanceof THREE.Mesh) { child.geometry.dispose(); const materials = Array.isArray(child.material) ? child.material : [child.material]; materials.forEach((material) => material.dispose()); } else if (child instanceof THREE.LineSegments) { child.geometry.dispose(); const materials = Array.isArray(child.material) ? child.material : [child.material]; materials.forEach((material) => material.dispose()); } }); }
function downloadJson(data: unknown, filename: string) { const blob = new Blob([JSON.stringify(data, null, 2)], {type:"application/json"}); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url); }
