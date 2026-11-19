"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  Download, Droplets, Eye, EyeOff, Flame, Grid3X3, Layers3, Plus, Redo2, Save, Settings2,
  Trash2, Undo2, Upload, Wind, Wrench, Zap
} from "lucide-react";

type MEPKind = "duct" | "pipe" | "cableTray" | "equipment" | "diffuser" | "sprinkler";
type MEPSystem = "HVAC" | "Plumbing" | "Electrical" | "Fire Protection";
type MEPElement = {
  id: string;
  kind: MEPKind;
  system: MEPSystem;
  name: string;
  visible: boolean;
  x: number;
  y: number;
  z: number;
  length: number;
  width: number;
  height: number;
  diameter: number;
  rotation: number;
  elevation: number;
  color: string;
  material: string;
  flow?: number;
  voltage?: number;
  pressure?: number;
};
type MEPSnapshot = { elements: MEPElement[]; selectedId: string | null };
type MEPDocument = { format: "ApexiveAI-MEP"; version: 1; units: "meters"; elements: MEPElement[] };
type Engine = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  objects: Map<string, THREE.Object3D>;
  observer: ResizeObserver;
};

const STORAGE_KEY = "apexiveai-mep-model-v1";
const uid = () => `mep-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const SYSTEM_COLORS: Record<MEPSystem, string> = {
  HVAC: "#42a5d8", Plumbing: "#299c82", Electrical: "#e7b84d", "Fire Protection": "#e66b65"
};
const DEFAULT_ELEMENTS: MEPElement[] = [
  { id: "duct-01", kind: "duct", system: "HVAC", name: "SA Main Duct 01", visible: true, x: 0, y: 3.1, z: 0, length: 7, width: 0.55, height: 0.35, diameter: 0.35, rotation: 0, elevation: 3.1, color: SYSTEM_COLORS.HVAC, material: "Galvanized Steel", flow: 850 },
  { id: "duct-02", kind: "duct", system: "HVAC", name: "SA Branch Duct 01", visible: true, x: -2.2, y: 2.9, z: 1.5, length: 3.2, width: 0.3, height: 0.22, diameter: 0.22, rotation: Math.PI / 2, elevation: 2.9, color: SYSTEM_COLORS.HVAC, material: "Galvanized Steel", flow: 320 },
  { id: "pipe-01", kind: "pipe", system: "Plumbing", name: "Cold Water Main 01", visible: true, x: 0, y: 0.55, z: -1.5, length: 6, width: 0.12, height: 0.12, diameter: 0.12, rotation: 0, elevation: 0.55, color: SYSTEM_COLORS.Plumbing, material: "PPR", pressure: 4 },
  { id: "pipe-02", kind: "pipe", system: "Fire Protection", name: "Fire Main 01", visible: true, x: 0, y: 2.65, z: -2.3, length: 6, width: 0.1, height: 0.1, diameter: 0.1, rotation: 0, elevation: 2.65, color: SYSTEM_COLORS["Fire Protection"], material: "Black Steel", pressure: 8 },
  { id: "tray-01", kind: "cableTray", system: "Electrical", name: "Power Cable Tray 01", visible: true, x: 0, y: 2.35, z: 2.1, length: 6, width: 0.35, height: 0.08, diameter: 0.08, rotation: 0, elevation: 2.35, color: SYSTEM_COLORS.Electrical, material: "Hot-dip Galvanized Steel", voltage: 400 },
  { id: "ahu-01", kind: "equipment", system: "HVAC", name: "AHU-01 Air Handling Unit", visible: true, x: -3.5, y: 0.85, z: -3.1, length: 1.8, width: 1.2, height: 1.7, diameter: 1.2, rotation: 0, elevation: 0, color: "#5d8ca9", material: "Equipment", flow: 2500 },
  { id: "diff-01", kind: "diffuser", system: "HVAC", name: "Ceiling Diffuser 01", visible: true, x: 2, y: 2.95, z: 1, length: 0.45, width: 0.45, height: 0.06, diameter: 0.25, rotation: 0, elevation: 2.95, color: "#8bc4dc", material: "Aluminium", flow: 180 },
  { id: "spr-01", kind: "sprinkler", system: "Fire Protection", name: "Sprinkler Head 01", visible: true, x: 2, y: 2.85, z: -1, length: 0.12, width: 0.12, height: 0.16, diameter: 0.025, rotation: 0, elevation: 2.85, color: SYSTEM_COLORS["Fire Protection"], material: "Brass", pressure: 1.2 },
];

const KIND_LABEL: Record<MEPKind, string> = {
  duct: "Duct", pipe: "Pipe", cableTray: "Cable Tray", equipment: "Equipment", diffuser: "Air Terminal", sprinkler: "Sprinkler"
};
const KIND_SYSTEM: Record<MEPKind, MEPSystem> = {
  duct: "HVAC", pipe: "Plumbing", cableTray: "Electrical", equipment: "HVAC", diffuser: "HVAC", sprinkler: "Fire Protection"
};

function disposeObject(object: THREE.Object3D) {
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const material = mesh.material;
    if (Array.isArray(material)) material.forEach((item) => item.dispose());
    else if (material) material.dispose();
  });
}
function createElementObject(item: MEPElement): THREE.Object3D {
  const material = new THREE.MeshStandardMaterial({ color: item.color, roughness: 0.52, metalness: item.system === "Electrical" ? 0.55 : 0.22 });
  let geometry: THREE.BufferGeometry;
  if (item.kind === "pipe") geometry = new THREE.CylinderGeometry(item.diameter / 2, item.diameter / 2, item.length, 20);
  else if (item.kind === "sprinkler") geometry = new THREE.CylinderGeometry(item.diameter / 2, item.diameter * 0.85, item.height, 16);
  else if (item.kind === "diffuser") geometry = new THREE.BoxGeometry(item.width, item.height, item.length);
  else geometry = new THREE.BoxGeometry(item.length, item.height, item.width);
  const mesh = new THREE.Mesh(geometry, material);
  if (item.kind === "pipe") {
    mesh.rotation.z = Math.PI / 2;
    mesh.rotation.y = item.rotation;
  } else {
    mesh.rotation.y = item.rotation;
  }
  mesh.position.set(item.x, item.y, item.z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.elementId = item.id;
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), new THREE.LineBasicMaterial({ color: 0x14283a, transparent: true, opacity: 0.42 }));
  mesh.add(edges);
  return mesh;
}
function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; anchor.click();
  URL.revokeObjectURL(url);
}

export default function MEPStudio() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const engineRef = useRef<Engine | null>(null);
  const [elements, setElements] = useState<MEPElement[]>(DEFAULT_ELEMENTS);
  const [selectedId, setSelectedId] = useState<string | null>("duct-01");
  const [activeSystem, setActiveSystem] = useState<"All" | MEPSystem>("All");
  const [gridVisible, setGridVisible] = useState(true);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [status, setStatus] = useState("MEP coordination workspace ready");
  const [history, setHistory] = useState<MEPSnapshot[]>([]);
  const [future, setFuture] = useState<MEPSnapshot[]>([]);
  const [storageReady, setStorageReady] = useState(false);
  const selected = elements.find((item) => item.id === selectedId) ?? null;
  const visibleElements = useMemo(() => elements.filter((item) => activeSystem === "All" || item.system === activeSystem), [elements, activeSystem]);
  const counts = useMemo(() => ({
    hvac: elements.filter((e) => e.system === "HVAC").length,
    plumbing: elements.filter((e) => e.system === "Plumbing").length,
    electrical: elements.filter((e) => e.system === "Electrical").length,
    fire: elements.filter((e) => e.system === "Fire Protection").length,
  }), [elements]);

  const snapshot = useCallback((): MEPSnapshot => ({ elements: clone(elements), selectedId }), [elements, selectedId]);
  const commit = useCallback(() => { setHistory((current) => [...current.slice(-49), snapshot()]); setFuture([]); }, [snapshot]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || engineRef.current) return;
    const scene = new THREE.Scene(); scene.background = new THREE.Color("#09111c"); scene.fog = new THREE.Fog("#09111c", 50, 130);
    const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 500); camera.position.set(12, 10, 14);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1; renderer.shadowMap.enabled = true;
    renderer.domElement.style.cssText = "display:block;width:100%;height:100%;outline:none"; host.appendChild(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true; controls.dampingFactor = 0.07; controls.target.set(0, 1.5, 0); controls.maxPolarAngle = Math.PI * 0.495;
    scene.add(new THREE.HemisphereLight(0xc5ddff, 0x1b2634, 2));
    const key = new THREE.DirectionalLight(0xffffff, 3); key.position.set(8, 15, 9); key.castShadow = true; key.shadow.mapSize.set(2048, 2048); scene.add(key);
    const fill = new THREE.DirectionalLight(0x6ba9ff, 1.1); fill.position.set(-8, 7, -8); scene.add(fill);
    const grid = new THREE.GridHelper(60, 60, 0x49617a, 0x24374b); grid.name = "__grid"; grid.position.y = -0.02; scene.add(grid);
    const axes = new THREE.AxesHelper(3); axes.name = "__axes"; scene.add(axes);
    const objects = new Map<string, THREE.Object3D>();
    const observer = new ResizeObserver(() => { const width = Math.max(host.clientWidth, 1), height = Math.max(host.clientHeight, 1); camera.aspect = width / height; camera.updateProjectionMatrix(); renderer.setSize(width, height, false); });
    observer.observe(host);
    const raycaster = new THREE.Raycaster(); const pointer = new THREE.Vector2();
    const onPointer = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect(); pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1; pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera); const hits = raycaster.intersectObjects([...objects.values()], true); let object: THREE.Object3D | undefined = hits[0]?.object;
      while (object && !object.userData.elementId && object.parent) object = object.parent;
      setSelectedId((object?.userData.elementId as string | undefined) ?? null);
    };
    renderer.domElement.addEventListener("pointerdown", onPointer);
    engineRef.current = { scene, camera, renderer, controls, objects, observer };
    let frame = 0; const animate = () => { frame = requestAnimationFrame(animate); controls.update(); renderer.render(scene, camera); }; animate();
    return () => { cancelAnimationFrame(frame); renderer.domElement.removeEventListener("pointerdown", onPointer); observer.disconnect(); controls.dispose(); for (const object of objects.values()) disposeObject(object); renderer.dispose(); renderer.domElement.remove(); engineRef.current = null; };
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) { const parsed = JSON.parse(raw) as MEPDocument; if (parsed.format === "ApexiveAI-MEP" && Array.isArray(parsed.elements)) setElements(parsed.elements); }
    } catch { setStatus("Saved MEP model could not be loaded"); }
    finally { setStorageReady(true); }
  }, []);

  useEffect(() => {
    const engine = engineRef.current; if (!engine) return;
    const nextIds = new Set(elements.map((item) => item.id));
    for (const [id, object] of engine.objects) if (!nextIds.has(id)) { engine.scene.remove(object); disposeObject(object); engine.objects.delete(id); }
    for (const item of elements) {
      const previous = engine.objects.get(item.id);
      if (previous) { engine.scene.remove(previous); disposeObject(previous); engine.objects.delete(item.id); }
      const object = createElementObject(item); object.userData.elementId = item.id; object.visible = item.visible && (activeSystem === "All" || item.system === activeSystem);
      engine.scene.add(object); engine.objects.set(item.id, object);
    }
    const grid = engine.scene.getObjectByName("__grid"); if (grid) grid.visible = gridVisible;
    const axes = engine.scene.getObjectByName("__axes"); if (axes) axes.visible = gridVisible;
  }, [elements, activeSystem, gridVisible]);

  const addElement = (kind: MEPKind) => {
    commit();
    const system = KIND_SYSTEM[kind]; const id = uid();
    const number = elements.filter((item) => item.kind === kind).length + 1;
    const base: MEPElement = {
      id, kind, system, name: `${KIND_LABEL[kind]} ${String(number).padStart(2, "0")}`, visible: true,
      x: 0, y: kind === "duct" || kind === "cableTray" ? 2.8 : 1.2, z: 0,
      length: kind === "equipment" ? 1.5 : kind === "sprinkler" ? 0.12 : 3,
      width: kind === "equipment" ? 1.1 : kind === "duct" ? 0.4 : kind === "cableTray" ? 0.3 : 0.12,
      height: kind === "equipment" ? 1.5 : kind === "duct" ? 0.25 : kind === "sprinkler" ? 0.16 : 0.08,
      diameter: kind === "pipe" ? 0.1 : 0.25, rotation: 0, elevation: 0,
      color: SYSTEM_COLORS[system], material: kind === "pipe" ? "PPR" : kind === "duct" ? "Galvanized Steel" : kind === "cableTray" ? "Galvanized Steel" : "Standard"
    };
    if (kind === "duct" || kind === "diffuser") base.flow = 300;
    if (kind === "pipe" || kind === "sprinkler") base.pressure = 2;
    if (kind === "cableTray") base.voltage = 400;
    setElements((current) => [...current, base]); setSelectedId(id); setActiveSystem("All"); setStatus(`${base.name} created`);
  };
  const updateSelected = (patch: Partial<MEPElement>) => {
    if (!selected) return; commit();
    setElements((current) => current.map((item) => item.id === selected.id ? { ...item, ...patch } : item));
    setStatus(`${selected.name} updated`);
  };
  const removeSelected = () => {
    if (!selected) return; commit(); setElements((current) => current.filter((item) => item.id !== selected.id)); setSelectedId(null); setStatus("Element deleted");
  };
  const toggleVisibility = (id: string) => { commit(); setElements((current) => current.map((item) => item.id === id ? { ...item, visible: !item.visible } : item)); };
  const undo = () => {
    if (!history.length) return; const previous = history[history.length - 1]; setFuture((current) => [snapshot(), ...current]); setHistory((current) => current.slice(0, -1)); setElements(previous.elements); setSelectedId(previous.selectedId); setStatus("Undo complete");
  };
  const redo = () => {
    if (!future.length) return; const next = future[0]; setHistory((current) => [...current, snapshot()]); setFuture((current) => current.slice(1)); setElements(next.elements); setSelectedId(next.selectedId); setStatus("Redo complete");
  };
  const save = () => {
    const document: MEPDocument = { format: "ApexiveAI-MEP", version: 1, units: "meters", elements };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(document)); setStatus(`Saved ${elements.length} MEP elements locally`); }
    catch { setStatus("Save failed: browser storage is unavailable or full"); }
  };
  const exportModel = () => downloadJson({ format: "ApexiveAI-MEP", version: 1, units: "meters", exportedAt: new Date().toISOString(), elements }, "apexiveai-mep-model.json");
  const importModel = async (file?: File) => {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as MEPDocument;
      if (parsed.format !== "ApexiveAI-MEP" || !Array.isArray(parsed.elements)) throw new Error("Unsupported document format");
      if (!parsed.elements.every((item) => item && typeof item.id === "string" && ["duct", "pipe", "cableTray", "equipment", "diffuser", "sprinkler"].includes(item.kind))) throw new Error("Invalid element data");
      commit(); setElements(parsed.elements); setSelectedId(parsed.elements[0]?.id ?? null); setStatus(`Imported ${parsed.elements.length} MEP elements`);
    } catch (error) { setStatus(error instanceof Error ? `Import failed: ${error.message}` : "Import failed"); }
    finally { if (fileRef.current) fileRef.current.value = ""; }
  };

  return (
    <main className="min-h-screen bg-[#070d15] text-slate-100">
      <header className="sticky top-0 z-20 flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-[#0b1420]/95 px-4 py-3 backdrop-blur-xl lg:px-6">
        <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl border border-cyan-400/25 bg-cyan-400/10 text-cyan-300"><Wrench size={20}/></div><div><div className="text-sm font-semibold tracking-[0.16em]">APEXIVEAI <span className="text-cyan-300">MEP</span> STUDIO</div><div className="text-[10px] tracking-[0.2em] text-slate-500">MECHANICAL · ELECTRICAL · PLUMBING</div></div></div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={undo} disabled={!history.length} className="rounded-lg border border-white/10 p-2 text-slate-300 hover:bg-white/10 disabled:opacity-30" title="Undo"><Undo2 size={16}/></button>
          <button onClick={redo} disabled={!future.length} className="rounded-lg border border-white/10 p-2 text-slate-300 hover:bg-white/10 disabled:opacity-30" title="Redo"><Redo2 size={16}/></button>
          <button onClick={save} className="flex items-center gap-2 rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-3 py-2 text-xs font-semibold text-cyan-200 hover:bg-cyan-400/20"><Save size={15}/> Save</button>
          <button onClick={exportModel} className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300 hover:bg-white/10"><Download size={15}/> Export</button>
          <button onClick={() => fileRef.current?.click()} className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300 hover:bg-white/10"><Upload size={15}/> Import</button>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(event) => void importModel(event.target.files?.[0])}/>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-2 border-b border-white/10 bg-[#0a121d] px-4 py-3 md:grid-cols-4 lg:px-6">
        <div className="rounded-xl border border-cyan-400/15 bg-cyan-400/[0.06] p-3"><div className="flex items-center gap-2 text-xs text-cyan-200"><Wind size={15}/> HVAC</div><div className="mt-1 text-2xl font-semibold">{counts.hvac}</div><div className="text-[10px] text-slate-500">Air systems & terminals</div></div>
        <div className="rounded-xl border border-emerald-400/15 bg-emerald-400/[0.06] p-3"><div className="flex items-center gap-2 text-xs text-emerald-200"><Droplets size={15}/> Plumbing</div><div className="mt-1 text-2xl font-semibold">{counts.plumbing}</div><div className="text-[10px] text-slate-500">Pipes & water services</div></div>
        <div className="rounded-xl border border-amber-400/15 bg-amber-400/[0.06] p-3"><div className="flex items-center gap-2 text-xs text-amber-200"><Zap size={15}/> Electrical</div><div className="mt-1 text-2xl font-semibold">{counts.electrical}</div><div className="text-[10px] text-slate-500">Cable containment</div></div>
        <div className="rounded-xl border border-rose-400/15 bg-rose-400/[0.06] p-3"><div className="flex items-center gap-2 text-xs text-rose-200"><Flame size={15}/> Fire Protection</div><div className="mt-1 text-2xl font-semibold">{counts.fire}</div><div className="text-[10px] text-slate-500">Fire mains & sprinklers</div></div>
      </section>

      <div className="grid min-h-[calc(100vh-170px)] grid-cols-1 lg:grid-cols-[270px_minmax(0,1fr)_310px]">
        <aside className="border-b border-white/10 bg-[#0b1420] lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3"><div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-slate-300"><Layers3 size={15}/> SYSTEMS & ELEMENTS</div><span className="text-[10px] text-slate-500">{elements.length} TOTAL</span></div>
          <div className="flex flex-wrap gap-1.5 p-3">{(["All", "HVAC", "Plumbing", "Electrical", "Fire Protection"] as const).map((system) => <button key={system} onClick={() => setActiveSystem(system)} className={`rounded-lg px-2.5 py-1.5 text-[10px] ${activeSystem === system ? "bg-cyan-400/15 text-cyan-200 ring-1 ring-cyan-300/25" : "bg-white/[0.04] text-slate-400 hover:bg-white/10"}`}>{system}</button>)}</div>
          <div className="space-y-1 px-2 pb-3">{visibleElements.map((item) => <div key={item.id} className={`group flex items-center gap-2 rounded-lg px-2 py-2 ${selectedId === item.id ? "bg-cyan-400/10 ring-1 ring-cyan-300/20" : "hover:bg-white/[0.05]"}`}><button onClick={() => setSelectedId(item.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left"><span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: item.color }}/><span className="min-w-0"><span className="block truncate text-xs text-slate-200">{item.name}</span><span className="block text-[10px] text-slate-500">{KIND_LABEL[item.kind]} · {item.system}</span></span></button><button onClick={() => toggleVisibility(item.id)} className="p-1 text-slate-500 hover:text-white" title="Toggle visibility">{item.visible ? <Eye size={14}/> : <EyeOff size={14}/>}</button></div>)}</div>
          <div className="border-t border-white/10 p-3"><div className="mb-2 flex items-center gap-2 text-[10px] font-semibold tracking-wider text-slate-500"><Plus size={13}/> ADD COMPONENT</div><div className="grid grid-cols-2 gap-2">{(["duct", "pipe", "cableTray", "equipment", "diffuser", "sprinkler"] as MEPKind[]).map((kind) => <button key={kind} onClick={() => addElement(kind)} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-2 py-2 text-left text-[11px] text-slate-300 hover:border-cyan-300/30 hover:bg-cyan-400/[0.07]"><Plus size={12} className="text-cyan-300"/>{KIND_LABEL[kind]}</button>)}</div></div>
        </aside>

        <section className="relative min-h-[520px] bg-[#080f18]">
          <div className="pointer-events-none absolute left-4 top-4 z-10 rounded-lg border border-white/10 bg-[#0b1420]/85 px-3 py-2 text-[10px] text-slate-400 backdrop-blur"><div className="mb-1 font-semibold tracking-wider text-slate-200">3D COORDINATION VIEW</div><div>Orbit: drag · Zoom: scroll · Pan: right-drag</div></div>
          <div className="absolute right-4 top-4 z-10 flex gap-2"><button onClick={() => setGridVisible((value) => !value)} className={`rounded-lg border p-2 ${gridVisible ? "border-cyan-300/30 bg-cyan-400/10 text-cyan-200" : "border-white/10 bg-[#0b1420] text-slate-400"}`} title="Toggle grid"><Grid3X3 size={15}/></button><button onClick={() => setInspectorOpen((value) => !value)} className="rounded-lg border border-white/10 bg-[#0b1420] p-2 text-slate-300" title="Toggle properties"><Settings2 size={15}/></button></div>
          <div ref={hostRef} className="absolute inset-0" />
          <div className="pointer-events-none absolute bottom-4 left-4 rounded-lg border border-white/10 bg-[#0b1420]/85 px-3 py-2 text-[10px] text-slate-400"><span className="mr-3"><span className="mr-1 inline-block h-2 w-2 rounded-full bg-cyan-400"/> HVAC</span><span className="mr-3"><span className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-400"/> Plumbing</span><span className="mr-3"><span className="mr-1 inline-block h-2 w-2 rounded-full bg-amber-400"/> Electrical</span><span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-rose-400"/> Fire</span></div>
        </section>

        {inspectorOpen && <aside className="border-t border-white/10 bg-[#0b1420] lg:border-l lg:border-t-0"><div className="flex items-center justify-between border-b border-white/10 px-4 py-3"><div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-slate-300"><Settings2 size={15}/> ELEMENT PROPERTIES</div>{selected && <button onClick={removeSelected} className="rounded-md p-1.5 text-rose-300 hover:bg-rose-400/10" title="Delete element"><Trash2 size={14}/></button>}</div>
          {selected ? <div className="space-y-4 p-4"><div><div className="text-sm font-semibold text-slate-100">{selected.name}</div><div className="mt-1 text-[10px] text-slate-500">{KIND_LABEL[selected.kind]} · {selected.system} · {selected.id}</div></div>
            <Field label="Element name"><input value={selected.name} onChange={(e) => updateSelected({ name: e.target.value })} className={inputClass}/></Field>
            <Field label="System"><select value={selected.system} onChange={(e) => updateSelected({ system: e.target.value as MEPSystem, color: SYSTEM_COLORS[e.target.value as MEPSystem] })} className={inputClass}><option>HVAC</option><option>Plumbing</option><option>Electrical</option><option>Fire Protection</option></select></Field>
            <div className="grid grid-cols-3 gap-2"><NumberField label="X (m)" value={selected.x} onChange={(x) => updateSelected({ x })}/><NumberField label="Y (m)" value={selected.y} onChange={(y) => updateSelected({ y, elevation: y })}/><NumberField label="Z (m)" value={selected.z} onChange={(z) => updateSelected({ z })}/></div>
            <div className="grid grid-cols-2 gap-2"><NumberField label="Length (m)" value={selected.length} min={0.01} onChange={(length) => updateSelected({ length })}/><NumberField label="Rotation (°)" value={Number((selected.rotation * 180 / Math.PI).toFixed(1))} onChange={(value) => updateSelected({ rotation: value * Math.PI / 180 })}/></div>
            {selected.kind === "pipe" || selected.kind === "sprinkler" ? <NumberField label="Diameter (m)" value={selected.diameter} min={0.01} onChange={(diameter) => updateSelected({ diameter })}/> : <div className="grid grid-cols-2 gap-2"><NumberField label="Width (m)" value={selected.width} min={0.01} onChange={(width) => updateSelected({ width })}/><NumberField label="Height (m)" value={selected.height} min={0.01} onChange={(height) => updateSelected({ height })}/></div>}
            <Field label="Material"><select value={selected.material} onChange={(e) => updateSelected({ material: e.target.value })} className={inputClass}>{["Galvanized Steel", "Stainless Steel", "Black Steel", "Copper", "PPR", "uPVC", "HDPE", "Aluminium", "Brass", "Hot-dip Galvanized Steel", "Equipment", "Standard"].map((value) => <option key={value}>{value}</option>)}</select></Field>
            {selected.flow !== undefined && <NumberField label="Design Air / Fluid Flow" value={selected.flow} min={0} onChange={(flow) => updateSelected({ flow })} suffix="m³/h"/>}
            {selected.pressure !== undefined && <NumberField label="Design Pressure" value={selected.pressure} min={0} onChange={(pressure) => updateSelected({ pressure })} suffix="bar"/>}
            {selected.voltage !== undefined && <NumberField label="Voltage" value={selected.voltage} min={0} onChange={(voltage) => updateSelected({ voltage })} suffix="V"/>}
            <Field label="Display color"><div className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#080f18] p-2"><input type="color" value={selected.color} onChange={(e) => updateSelected({ color: e.target.value })} className="h-7 w-9 cursor-pointer border-0 bg-transparent"/><span className="text-xs text-slate-400">{selected.color}</span></div></Field>
            <button onClick={() => updateSelected({ visible: !selected.visible })} className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 py-2 text-xs text-slate-300 hover:bg-white/[0.05]">{selected.visible ? <EyeOff size={14}/> : <Eye size={14}/>} {selected.visible ? "Hide element" : "Show element"}</button>
          </div> : <div className="p-6 text-center text-xs text-slate-500">Select an MEP element in the model or system list to inspect its properties.</div>}
        </aside>}
      </div>
      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 bg-[#0b1420] px-4 py-2.5 text-[10px] text-slate-500 lg:px-6"><div className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400"/>{status}</div><div className="flex items-center gap-3"><span>{elements.length} elements</span><span>Units: meters</span><span>{storageReady ? "Local storage ready" : "Loading storage…"}</span></div></footer>
    </main>
  );
}

const inputClass = "mt-1 w-full rounded-lg border border-white/10 bg-[#080f18] px-2.5 py-2 text-xs text-slate-200 outline-none focus:border-cyan-300/40";
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="block text-[10px] font-medium text-slate-500">{label}{children}</label>; }
function NumberField({ label, value, onChange, min = -10000, suffix }: { label: string; value: number; onChange: (value: number) => void; min?: number; suffix?: string }) {
  return <label className="block text-[10px] font-medium text-slate-500">{label}<div className="mt-1 flex items-center rounded-lg border border-white/10 bg-[#080f18] focus-within:border-cyan-300/40"><input type="number" min={min} step="0.01" value={Number.isFinite(value) ? value : 0} onChange={(e) => onChange(Math.max(min, Number(e.target.value)))} className="w-full min-w-0 bg-transparent px-2.5 py-2 text-xs text-slate-200 outline-none"/>{suffix && <span className="pr-2 text-[9px] text-slate-600">{suffix}</span>}</div></label>;
}
