"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  Box, Columns3, Download, Eye, EyeOff, Grid3X3, Layers3,
  Redo2, Save, SlidersHorizontal, Trash2, Undo2,
  Workflow, Ruler, Building2, RotateCcw, Upload
} from "lucide-react";

type StructuralKind = "column" | "beam" | "slab" | "footing" | "grid";
type StructuralElement = {
  id: string;
  kind: StructuralKind;
  name: string;
  visible: boolean;
  x: number;
  y: number;
  z: number;
  length: number;
  width: number;
  height: number;
  rotation: number;
  elevation: number;
  color: string;
  material: string;
};
type StructuralDocument = {
  format: "ApexiveAI-Structure";
  version: 1;
  units: "meters";
  elements: StructuralElement[];
};
type Snapshot = { elements: StructuralElement[]; selectedId: string | null };
type Engine = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  raycaster: THREE.Raycaster;
  pointer: THREE.Vector2;
  objects: Map<string, THREE.Object3D>;
  resize: ResizeObserver;
};

const STORAGE_KEY = "apexiveai-structure-model-v1";
const uid = () => `st-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const DEFAULT_ELEMENTS: StructuralElement[] = [
  { id: "col-01", kind: "column", name: "C1 - RC Column", visible: true, x: -3, y: 1.6, z: -2, length: 0.4, width: 0.4, height: 3.2, rotation: 0, elevation: 0, color: "#7ea6c8", material: "Reinforced Concrete" },
  { id: "col-02", kind: "column", name: "C2 - RC Column", visible: true, x: 3, y: 1.6, z: -2, length: 0.4, width: 0.4, height: 3.2, rotation: 0, elevation: 0, color: "#7ea6c8", material: "Reinforced Concrete" },
  { id: "col-03", kind: "column", name: "C3 - RC Column", visible: true, x: -3, y: 1.6, z: 2, length: 0.4, width: 0.4, height: 3.2, rotation: 0, elevation: 0, color: "#7ea6c8", material: "Reinforced Concrete" },
  { id: "col-04", kind: "column", name: "C4 - RC Column", visible: true, x: 3, y: 1.6, z: 2, length: 0.4, width: 0.4, height: 3.2, rotation: 0, elevation: 0, color: "#7ea6c8", material: "Reinforced Concrete" },
  { id: "bm-01", kind: "beam", name: "B1 - Main Beam", visible: true, x: 0, y: 3.0, z: -2, length: 6, width: 0.3, height: 0.5, rotation: 0, elevation: 0, color: "#d2a56c", material: "Reinforced Concrete" },
  { id: "bm-02", kind: "beam", name: "B2 - Main Beam", visible: true, x: 0, y: 3.0, z: 2, length: 6, width: 0.3, height: 0.5, rotation: 0, elevation: 0, color: "#d2a56c", material: "Reinforced Concrete" },
  { id: "slab-01", kind: "slab", name: "S1 - Floor Slab", visible: true, x: 0, y: 3.0, z: 0, length: 6.6, width: 4.6, height: 0.18, rotation: 0, elevation: 0, color: "#8297aa", material: "Reinforced Concrete" },
  { id: "ft-01", kind: "footing", name: "F1 - Isolated Footing", visible: true, x: -3, y: -0.3, z: -2, length: 1.5, width: 1.5, height: 0.6, rotation: 0, elevation: 0, color: "#647d94", material: "Reinforced Concrete" },
  { id: "ft-02", kind: "footing", name: "F2 - Isolated Footing", visible: true, x: 3, y: -0.3, z: -2, length: 1.5, width: 1.5, height: 0.6, rotation: 0, elevation: 0, color: "#647d94", material: "Reinforced Concrete" },
  { id: "ft-03", kind: "footing", name: "F3 - Isolated Footing", visible: true, x: -3, y: -0.3, z: 2, length: 1.5, width: 1.5, height: 0.6, rotation: 0, elevation: 0, color: "#647d94", material: "Reinforced Concrete" },
  { id: "ft-04", kind: "footing", name: "F4 - Isolated Footing", visible: true, x: 3, y: -0.3, z: 2, length: 1.5, width: 1.5, height: 0.6, rotation: 0, elevation: 0, color: "#647d94", material: "Reinforced Concrete" },
];

function label(kind: StructuralKind) {
  return ({ column: "Column", beam: "Beam", slab: "Slab", footing: "Footing", grid: "Grid" })[kind];
}
function disposeObject(object: THREE.Object3D) {
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const material = mesh.material;
    if (Array.isArray(material)) material.forEach((item) => item.dispose());
    else if (material) material.dispose();
  });
}
function buildElement(item: StructuralElement): THREE.Object3D {
  const material = new THREE.MeshStandardMaterial({ color: item.color, roughness: 0.72, metalness: item.material === "Structural Steel" ? 0.55 : 0.05 });
  let geometry: THREE.BufferGeometry;
  if (item.kind === "column") geometry = new THREE.BoxGeometry(item.length, item.height, item.width);
  else if (item.kind === "beam") geometry = new THREE.BoxGeometry(item.length, item.height, item.width);
  else if (item.kind === "footing") geometry = new THREE.BoxGeometry(item.length, item.height, item.width);
  else geometry = new THREE.BoxGeometry(item.length, item.height, item.width);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(item.x, item.y, item.z);
  mesh.rotation.y = item.rotation;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.elementId = item.id;
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), new THREE.LineBasicMaterial({ color: 0x172b3e, transparent: true, opacity: 0.45 }));
  mesh.add(edges);
  return mesh;
}
function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; anchor.click();
  URL.revokeObjectURL(url);
}

export default function StructureStudio() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const engineRef = useRef<Engine | null>(null);
  const [elements, setElements] = useState<StructuralElement[]>(DEFAULT_ELEMENTS);
  const [selectedId, setSelectedId] = useState<string | null>("col-01");
  const [gridVisible, setGridVisible] = useState(true);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [status, setStatus] = useState("Structural workspace ready");
  const [storageReady, setStorageReady] = useState(false);
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [future, setFuture] = useState<Snapshot[]>([]);
  const [filter, setFilter] = useState<"all" | StructuralKind>("all");
  const selected = elements.find((item) => item.id === selectedId) ?? null;
  const visibleElements = useMemo(() => elements.filter((item) => filter === "all" || item.kind === filter), [elements, filter]);

  const snapshot = useCallback((): Snapshot => ({ elements: clone(elements), selectedId }), [elements, selectedId]);
  const commit = useCallback(() => { setHistory((current) => [...current.slice(-49), snapshot()]); setFuture([]); }, [snapshot]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || engineRef.current) return;
    const scene = new THREE.Scene(); scene.background = new THREE.Color("#09111c"); scene.fog = new THREE.Fog("#09111c", 45, 120);
    const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 400); camera.position.set(11, 9, 12);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1; renderer.shadowMap.enabled = true;
    renderer.domElement.style.cssText = "display:block;width:100%;height:100%;outline:none"; host.appendChild(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true; controls.dampingFactor = 0.07; controls.target.set(0, 1.4, 0); controls.maxPolarAngle = Math.PI * 0.495;
    scene.add(new THREE.HemisphereLight(0xc5ddff, 0x1b2634, 2));
    const key = new THREE.DirectionalLight(0xffffff, 3); key.position.set(8, 15, 9); key.castShadow = true; key.shadow.mapSize.set(2048, 2048); scene.add(key);
    const fill = new THREE.DirectionalLight(0x6ba9ff, 1.1); fill.position.set(-8, 7, -8); scene.add(fill);
    const grid = new THREE.GridHelper(60, 60, 0x49617a, 0x24374b); grid.name = "__grid"; grid.position.y = -0.02; scene.add(grid);
    const axes = new THREE.AxesHelper(3); axes.name = "__axes"; scene.add(axes);
    const raycaster = new THREE.Raycaster(); const pointer = new THREE.Vector2(); const objects = new Map<string, THREE.Object3D>();
    const resize = new ResizeObserver(() => { const width = Math.max(host.clientWidth, 1), height = Math.max(host.clientHeight, 1); camera.aspect = width / height; camera.updateProjectionMatrix(); renderer.setSize(width, height, false); }); resize.observe(host);
    const onPointer = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect(); pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1; pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera); const hits = raycaster.intersectObjects([...objects.values()], true); let object = hits[0]?.object;
      while (object && !object.userData.elementId && object.parent) object = object.parent;
      setSelectedId((object?.userData.elementId as string | undefined) ?? null);
    };
    renderer.domElement.addEventListener("pointerdown", onPointer);
    engineRef.current = { scene, camera, renderer, controls, raycaster, pointer, objects, resize };
    let frame = 0; const animate = () => { frame = requestAnimationFrame(animate); controls.update(); renderer.render(scene, camera); }; animate();
    return () => { cancelAnimationFrame(frame); renderer.domElement.removeEventListener("pointerdown", onPointer); resize.disconnect(); controls.dispose(); for (const object of objects.values()) disposeObject(object); renderer.dispose(); renderer.domElement.remove(); engineRef.current = null; };
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as StructuralDocument;
          if (parsed.format === "ApexiveAI-Structure" && Array.isArray(parsed.elements)) setElements(parsed.elements);
        }
      } catch {
        setStatus("Saved structural model could not be loaded");
      } finally {
        setStorageReady(true);
      }
    });
  }, []);

  useEffect(() => {
    const engine = engineRef.current; if (!engine) return;
    const nextIds = new Set(elements.map((item) => item.id));
    for (const [id, object] of engine.objects) if (!nextIds.has(id)) { engine.scene.remove(object); disposeObject(object); engine.objects.delete(id); }
    for (const item of elements) {
      const old = engine.objects.get(item.id); if (old) { engine.scene.remove(old); disposeObject(old); engine.objects.delete(item.id); }
      const object = buildElement(item);
      const mesh = object as THREE.Mesh;
      const material = mesh.material as THREE.MeshStandardMaterial;
      material.emissive.set(item.id === selectedId ? "#174d76" : "#000000");
      material.emissiveIntensity = item.id === selectedId ? 0.45 : 0;
      object.visible = item.visible;
      engine.scene.add(object);
      engine.objects.set(item.id, object);
    }
    const grid = engine.scene.getObjectByName("__grid"); if (grid) grid.visible = gridVisible;
    const axes = engine.scene.getObjectByName("__axes"); if (axes) axes.visible = gridVisible;
  }, [elements, gridVisible, selectedId]);

  const addElement = (kind: StructuralKind) => {
    commit();
    const index = elements.filter((item) => item.kind === kind).length + 1;
    const defaults: Record<StructuralKind, Omit<StructuralElement, "id" | "name">> = {
      column: { kind, visible: true, x: 0, y: 1.6, z: 0, length: 0.4, width: 0.4, height: 3.2, rotation: 0, elevation: 0, color: "#7ea6c8", material: "Reinforced Concrete" },
      beam: { kind, visible: true, x: 0, y: 3, z: 0, length: 5, width: 0.3, height: 0.5, rotation: 0, elevation: 0, color: "#d2a56c", material: "Reinforced Concrete" },
      slab: { kind, visible: true, x: 0, y: 3, z: 0, length: 5, width: 4, height: 0.18, rotation: 0, elevation: 0, color: "#8297aa", material: "Reinforced Concrete" },
      footing: { kind, visible: true, x: 0, y: -0.3, z: 0, length: 1.5, width: 1.5, height: 0.6, rotation: 0, elevation: 0, color: "#647d94", material: "Reinforced Concrete" },
      grid: { kind, visible: true, x: 0, y: 0, z: 0, length: 10, width: 0.05, height: 0.05, rotation: 0, elevation: 0, color: "#4b789b", material: "Reference" },
    };
    const item: StructuralElement = { id: uid(), name: `${label(kind)} ${String(index).padStart(2, "0")}`, ...defaults[kind] };
    setElements((current) => [...current, item]); setSelectedId(item.id); setStatus(`${item.name} added`);
  };
  const updateSelected = (patch: Partial<StructuralElement>) => { if (!selected) return; commit(); setElements((current) => current.map((item) => item.id === selected.id ? { ...item, ...patch } : item)); };
  const deleteSelected = () => { if (!selected) return; commit(); setElements((current) => current.filter((item) => item.id !== selected.id)); setSelectedId(null); setStatus("Structural element deleted"); };
  const undo = () => { const previous = history[history.length - 1]; if (!previous) return; setFuture((current) => [snapshot(), ...current]); setHistory((current) => current.slice(0, -1)); setElements(previous.elements); setSelectedId(previous.selectedId); setStatus("Undo complete"); };
  const redo = () => { const next = future[0]; if (!next) return; setHistory((current) => [...current, snapshot()]); setFuture((current) => current.slice(1)); setElements(next.elements); setSelectedId(next.selectedId); setStatus("Redo complete"); };
  const documentData = (): StructuralDocument => ({ format: "ApexiveAI-Structure", version: 1, units: "meters", elements });
  const save = () => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(documentData())); setStatus("Structural model saved in this browser"); } catch { setStatus("Save failed: browser storage unavailable"); } };
  const exportModel = () => { downloadJson({ ...documentData(), exportedAt: new Date().toISOString() }, "apexiveai-structural-model.json"); setStatus("Structural model JSON exported"); };
  const importModel = async (file?: File) => {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as StructuralDocument;
      if (parsed.format !== "ApexiveAI-Structure" || !Array.isArray(parsed.elements)) throw new Error("Unsupported structural document");
      if (!parsed.elements.every((item) =>
        item && typeof item.id === "string" &&
        typeof item.name === "string" &&
        ["column", "beam", "slab", "footing", "grid"].includes(item.kind) &&
        ["x", "y", "z", "length", "width", "height", "rotation", "elevation"].every((key) => Number.isFinite(Number(item[key as keyof StructuralElement])))
      )) throw new Error("Invalid structural element data");
      commit();
      setElements(parsed.elements.map((item) => ({
        ...item,
        visible: item.visible !== false,
        material: item.material || "Reinforced Concrete",
        color: item.color || "#7ea6c8",
      })));
      setSelectedId(parsed.elements[0]?.id ?? null);
      setStatus(`${parsed.elements.length} structural elements imported`);
    } catch (error) { setStatus(error instanceof Error ? `Import failed: ${error.message}` : "Import failed"); }
  };
  const focusModel = () => { const engine = engineRef.current; if (!engine) return; const objects = [...engine.objects.values()].filter((object) => object.visible); if (!objects.length) return; const bounds = new THREE.Box3(); objects.forEach((object) => bounds.expandByObject(object)); const center = bounds.getCenter(new THREE.Vector3()); const size = Math.max(bounds.getSize(new THREE.Vector3()).length(), 4); engine.controls.target.copy(center); engine.camera.position.copy(center).add(new THREE.Vector3(size * 0.9, size * 0.7, size)); engine.controls.update(); };
  const toggleVisibility = (item: StructuralElement) => { commit(); setElements((current) => current.map((entry) => entry.id === item.id ? { ...entry, visible: !entry.visible } : entry)); };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { const target = event.target as HTMLElement | null; if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return; if (event.ctrlKey && event.key.toLowerCase() === "z") { event.preventDefault(); undo(); } else if (event.ctrlKey && event.key.toLowerCase() === "y") { event.preventDefault(); redo(); } else if (event.key === "Delete" || event.key === "Backspace") deleteSelected(); else if (event.key.toLowerCase() === "f") focusModel(); };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  });

  const stats = useMemo(() => ({ columns: elements.filter((item) => item.kind === "column").length, beams: elements.filter((item) => item.kind === "beam").length, slabs: elements.filter((item) => item.kind === "slab").length, footings: elements.filter((item) => item.kind === "footing").length }), [elements]);

  return (
    <main className="st-shell">
      <style jsx global>{`
        .st-shell{height:100%;min-height:680px;background:#080e17;color:#dce8f7;display:flex;flex-direction:column;overflow:hidden;font-family:Inter,ui-sans-serif,system-ui,sans-serif}
        .st-top{height:58px;flex:none;display:flex;align-items:center;justify-content:space-between;padding:0 18px;border-bottom:1px solid #1c2b3d;background:#0c1521;gap:12px}.st-brand{display:flex;align-items:center;gap:10px}.st-mark{width:31px;height:31px;border-radius:8px;background:linear-gradient(135deg,#2876c8,#65c7f2);display:grid;place-items:center}.st-brand b{font-size:12px;letter-spacing:.12em}.st-brand small{display:block;color:#71869e;font-size:9px;letter-spacing:.15em;margin-top:3px}
        .st-actions,.st-tools{display:flex;align-items:center;gap:6px;flex-wrap:wrap}.st-btn{height:32px;min-width:32px;padding:0 10px;border:1px solid #25364b;border-radius:6px;background:#111e2d;color:#a9bdd4;display:inline-flex;align-items:center;justify-content:center;gap:7px;font-size:11px;cursor:pointer}.st-btn:hover{border-color:#4d8dca;color:#fff}.st-btn.active{background:#17385a;border-color:#398bd5;color:#8ccaff}.st-btn.primary{background:#1769ad;border-color:#287fc5;color:#fff}.st-btn:disabled{opacity:.35;cursor:not-allowed}
        .st-workbar{min-height:48px;flex:none;display:flex;align-items:center;gap:8px;padding:7px 16px;border-bottom:1px solid #1b2a3a;background:#0a131e;flex-wrap:wrap}.st-label{font-size:9px;color:#607b98;letter-spacing:.15em;margin-right:3px}.st-sep{width:1px;height:23px;background:#26374a}.st-stage{flex:1;min-height:0;display:flex;position:relative}.st-view{flex:1;min-width:0;position:relative;background:#09111c}.st-hud{position:absolute;left:15px;top:13px;pointer-events:none;color:#7891ac;font-size:10px;line-height:1.8;letter-spacing:.06em}.st-hud b{color:#c0ddf8}.st-viewtools{position:absolute;right:14px;top:13px;display:flex;gap:5px}.st-inspector{width:292px;flex:none;border-left:1px solid #1c2b3d;background:#0d1723;overflow:auto}.st-head{padding:15px;border-bottom:1px solid #1e3044;display:flex;justify-content:space-between;align-items:center}.st-head b{font-size:10px;letter-spacing:.13em}.st-section{padding:13px 15px;border-bottom:1px solid #1c2b3d}.st-section-title{font-size:9px;color:#7891ac;letter-spacing:.15em;margin-bottom:11px}.st-row{display:flex;align-items:center;gap:8px;padding:8px;border-radius:5px;color:#9db1c8;font-size:11px;cursor:pointer}.st-row:hover{background:#142438}.st-row.selected{background:#17314c;color:#b9ddff}.st-row span:nth-child(2){flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.st-field{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:9px 0;color:#8ea5bd;font-size:10px}.st-field input,.st-field select{width:132px;height:28px;padding:0 7px;border:1px solid #293d53;border-radius:5px;background:#09121d;color:#dce8f7;font-size:11px;outline:none}.st-field input:focus,.st-field select:focus{border-color:#438fd0}.st-chip{padding:3px 6px;border:1px solid #263a50;border-radius:4px;color:#8fa8c2;font-size:9px}.st-statgrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.st-stat{padding:9px;background:#101f2e;border:1px solid #22364b;border-radius:6px}.st-stat small{display:block;color:#7891ac;font-size:9px}.st-stat b{display:block;font-size:18px;margin-top:4px}.st-footer{height:27px;flex:none;border-top:1px solid #1c2b3d;background:#0a131e;display:flex;align-items:center;justify-content:space-between;padding:0 12px;color:#6e859f;font-size:9px}
        @media(max-width:900px){.st-inspector{width:250px}.st-workbar{padding:7px 8px}.st-top{padding:0 9px}}@media(max-width:650px){.st-inspector{position:absolute;right:0;top:0;bottom:0;z-index:5;width:min(292px,84vw);box-shadow:-12px 0 35px #0008}.st-brand small{display:none}.st-brand b{font-size:10px}.st-btn .st-btn-text{display:none}.st-workbar{gap:5px}.st-label{display:none}}
      `}</style>
      <header className="st-top">
        <div className="st-brand"><div className="st-mark"><Building2 size={17}/></div><div><b>APEXIVEAI</b><small>STRUCTURAL ENGINEERING STUDIO</small></div></div>
        <div className="st-actions">
          <button className="st-btn" title="Undo" onClick={undo} disabled={!history.length}><Undo2 size={14}/></button>
          <button className="st-btn" title="Redo" onClick={redo} disabled={!future.length}><Redo2 size={14}/></button>
          <button className="st-btn" onClick={() => fileRef.current?.click()}><Upload size={14}/><span className="st-btn-text">Import</span></button>
          <button className="st-btn" onClick={exportModel}><Download size={14}/><span className="st-btn-text">Export</span></button>
          <button className="st-btn primary" onClick={save} disabled={!storageReady}><Save size={14}/><span className="st-btn-text">Save</span></button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(event) => { void importModel(event.target.files?.[0]); event.currentTarget.value = ""; }}/>
        </div>
      </header>
      <nav className="st-workbar">
        <span className="st-label">STRUCTURAL ELEMENTS</span>
        <button className="st-btn" onClick={() => addElement("column")}><Columns3 size={14}/>Column</button>
        <button className="st-btn" onClick={() => addElement("beam")}><Workflow size={14}/>Beam</button>
        <button className="st-btn" onClick={() => addElement("slab")}><Layers3 size={14}/>Slab</button>
        <button className="st-btn" onClick={() => addElement("footing")}><Box size={14}/>Footing</button>
        <span className="st-sep"/>
        <button className={`st-btn ${gridVisible ? "active" : ""}`} onClick={() => setGridVisible((value) => !value)}><Grid3X3 size={14}/>Grid</button>
        <button className="st-btn" onClick={focusModel}><Ruler size={14}/>Focus</button>
      </nav>
      <section className="st-stage">
        <div className="st-view" ref={hostRef}>
          <div className="st-hud"><b>STRUCTURAL MODEL / 3D</b><br/>Units: Meters · Perspective View<br/>Select elements in viewport to inspect</div>
          <div className="st-viewtools"><button className="st-btn" onClick={() => setInspectorOpen((value) => !value)}><SlidersHorizontal size={14}/></button><button className="st-btn" onClick={focusModel}><RotateCcw size={14}/></button></div>
          <div className="st-status" style={{ position: "absolute", bottom: 12, left: 14, right: 14, display: "flex", justifyContent: "space-between", pointerEvents: "none", color: "#7189a4", fontSize: 10 }}><span>{status}</span><span>{elements.length} elements · {selected ? selected.name : "No selection"}</span></div>
        </div>
        {inspectorOpen && <aside className="st-inspector">
          <div className="st-head"><b>MODEL EXPLORER</b><span className="st-chip">{elements.length} ELEMENTS</span></div>
          <div className="st-section"><div className="st-section-title">MODEL SUMMARY</div><div className="st-statgrid"><div className="st-stat"><small>Columns</small><b>{stats.columns}</b></div><div className="st-stat"><small>Beams</small><b>{stats.beams}</b></div><div className="st-stat"><small>Slabs</small><b>{stats.slabs}</b></div><div className="st-stat"><small>Footings</small><b>{stats.footings}</b></div></div></div>
          <div className="st-section"><div className="st-section-title">ELEMENT FILTER</div><select value={filter} onChange={(event) => setFilter(event.target.value as "all" | StructuralKind)} style={{ width: "100%", height: 30, background: "#09121d", color: "#dce8f7", border: "1px solid #293d53", borderRadius: 5, padding: "0 8px", fontSize: 11 }}><option value="all">All structural elements</option><option value="column">Columns</option><option value="beam">Beams</option><option value="slab">Slabs</option><option value="footing">Footings</option><option value="grid">Grids</option></select>
            <div style={{ maxHeight: 220, overflow: "auto", marginTop: 8 }}>{visibleElements.map((item) => <div key={item.id} className={`st-row ${selectedId === item.id ? "selected" : ""}`} onClick={() => setSelectedId(item.id)}><span style={{ width: 7, height: 7, borderRadius: 2, background: item.color }}/><span>{item.name}</span><button title={item.visible ? "Hide" : "Show"} onClick={(event) => { event.stopPropagation(); toggleVisibility(item); }} style={{ border: 0, background: "transparent", color: "#8ea5bd", cursor: "pointer", padding: 2 }}>{item.visible ? <Eye size={13}/> : <EyeOff size={13}/>}</button></div>)}</div>
          </div>
          <div className="st-section"><div className="st-section-title">ELEMENT PROPERTIES</div>{selected ? <>
            <label className="st-field">Name<input value={selected.name} onChange={(event) => updateSelected({ name: event.target.value })}/></label>
            <label className="st-field">Material<select value={selected.material} onChange={(event) => updateSelected({ material: event.target.value })}><option>Reinforced Concrete</option><option>Structural Steel</option><option>Timber</option><option>Reference</option></select></label>
            <label className="st-field">X Position (m)<input type="number" step="0.1" value={selected.x} onChange={(event) => updateSelected({ x: Number(event.target.value) })}/></label>
            <label className="st-field">Y Position (m)<input type="number" step="0.1" value={selected.y} onChange={(event) => updateSelected({ y: Number(event.target.value) })}/></label>
            <label className="st-field">Z Position (m)<input type="number" step="0.1" value={selected.z} onChange={(event) => updateSelected({ z: Number(event.target.value) })}/></label>
            <label className="st-field">Length (m)<input type="number" min="0.05" step="0.05" value={selected.length} onChange={(event) => updateSelected({ length: Math.max(0.05, Number(event.target.value)) })}/></label>
            <label className="st-field">Width (m)<input type="number" min="0.05" step="0.05" value={selected.width} onChange={(event) => updateSelected({ width: Math.max(0.05, Number(event.target.value)) })}/></label>
            <label className="st-field">Height (m)<input type="number" min="0.05" step="0.05" value={selected.height} onChange={(event) => updateSelected({ height: Math.max(0.05, Number(event.target.value)) })}/></label>
            <label className="st-field">Rotation (°)<input type="number" step="5" value={Math.round(THREE.MathUtils.radToDeg(selected.rotation))} onChange={(event) => updateSelected({ rotation: THREE.MathUtils.degToRad(Number(event.target.value)) })}/></label>
            <label className="st-field">Display Color<input type="color" value={selected.color} onChange={(event) => updateSelected({ color: event.target.value })}/></label>
            <button className="st-btn" style={{ width: "100%", marginTop: 10, color: "#f3a2a2", borderColor: "#70404a" }} onClick={deleteSelected}><Trash2 size={13}/>Delete Element</button>
          </> : <div style={{ color: "#71869e", fontSize: 11, lineHeight: 1.6 }}>Select a structural element in the model or explorer to edit its properties.</div>}</div>
          <div className="st-section"><div className="st-section-title">COORDINATION STATUS</div><div style={{ color: "#71869e", fontSize: 10, lineHeight: 1.7 }}>Editable 3D structural geometry · Element visibility · Property editing · Undo / redo · Local save · JSON import and export</div></div>
        </aside>}
      </section>
      <footer className="st-footer"><span>APEXIVEAI STRUCTURE STUDIO · MODEL SPACE</span><span>WASD not required · Orbit: drag · Zoom: scroll · Focus: F</span></footer>
    </main>
  );
}
