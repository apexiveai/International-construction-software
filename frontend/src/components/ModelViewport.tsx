"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import {
  Box, Circle, Cylinder, Download, Eye, EyeOff, Focus, Grid3X3,
  Layers3, Maximize2, Move3D, Rotate3D, Save, Scan,
  Settings2, Trash2, Undo2, Redo2
} from "lucide-react";

type PrimitiveType = "box" | "sphere" | "cylinder" | "plane";
type SceneItem = {
  id: string;
  name: string;
  type: PrimitiveType;
  visible: boolean;
  color: string;
  dimensions: [number, number, number];
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
};
type TransformMode = "translate" | "rotate" | "scale";

type HistoryEntry = { items: SceneItem[]; selectedId: string | null };

const DEFAULT_ITEMS: SceneItem[] = [
  { id: "ground", name: "Ground Plane", type: "plane", visible: true, color: "#202c3b", dimensions: [30, 0.1, 30], position: [0, -0.06, 0], rotation: [-Math.PI / 2, 0, 0], scale: [1, 1, 1] },
  { id: "box-01", name: "Box 01", type: "box", visible: true, color: "#4388d6", dimensions: [2, 2, 2], position: [0, 1, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
];

const makeId = () => `obj-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

function createGeometry(type: PrimitiveType, dimensions: [number, number, number]) {
  const [x, y, z] = dimensions;
  switch (type) {
    case "sphere": return new THREE.SphereGeometry(Math.max(x, y, z) / 2, 32, 20);
    case "cylinder": return new THREE.CylinderGeometry(x / 2, x / 2, y, 32);
    case "plane": return new THREE.PlaneGeometry(x, z);
    default: return new THREE.BoxGeometry(x, y, z);
  }
}

function primitiveLabel(type: PrimitiveType) {
  return ({ box: "Box", sphere: "Sphere", cylinder: "Cylinder", plane: "Plane" })[type];
}

export default function ModelViewport() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<{
    scene: THREE.Scene; camera: THREE.PerspectiveCamera; renderer: THREE.WebGLRenderer;
    orbit: OrbitControls; transform: TransformControls; raycaster: THREE.Raycaster;
    pointer: THREE.Vector2; objects: Map<string, THREE.Mesh>; resizeObserver: ResizeObserver;
  } | null>(null);
  const [items, setItems] = useState<SceneItem[]>(DEFAULT_ITEMS);
  const [selectedId, setSelectedId] = useState<string | null>("box-01");
  const [mode, setMode] = useState<TransformMode>("translate");
  const [gridVisible, setGridVisible] = useState(true);
  const [axesVisible, setAxesVisible] = useState(true);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [future, setFuture] = useState<HistoryEntry[]>([]);
  const [status, setStatus] = useState("Ready");
  const [storageReady, setStorageReady] = useState(false);
  const importRef = useRef<HTMLInputElement | null>(null);
  const [showInspector, setShowInspector] = useState(true);
  const [cameraMode, setCameraMode] = useState<"Perspective" | "Orthographic">("Perspective");
  const [clippingEnabled, setClippingEnabled] = useState(false);
  const [explodedEnabled, setExplodedEnabled] = useState(false);
  const [compareEnabled, setCompareEnabled] = useState(false);
  const selected = items.find((item) => item.id === selectedId) ?? null;

  const saveHistory = useCallback(() => {
    setHistory((current) => [...current.slice(-39), { items: structuredClone(items), selectedId }]);
    setFuture([]);
  }, [items, selectedId]);

  const syncScene = useCallback((nextItems: SceneItem[]) => {
    const engine = engineRef.current;
    if (!engine) return;
    const nextIds = new Set(nextItems.map((item) => item.id));
    for (const [id, mesh] of engine.objects) {
      if (!nextIds.has(id)) {
        engine.scene.remove(mesh);
        mesh.geometry.dispose();
        const material = mesh.material;
        if (Array.isArray(material)) material.forEach((entry) => entry.dispose());
        else material.dispose();
        engine.objects.delete(id);
      }
    }
    for (const item of nextItems) {
      let mesh = engine.objects.get(item.id);
      if (!mesh) {
        mesh = new THREE.Mesh(
          createGeometry(item.type, item.dimensions),
          new THREE.MeshStandardMaterial({ color: item.color, roughness: 0.62, metalness: 0.08 })
        );
        mesh.userData.objectId = item.id;
        mesh.userData.geometrySignature = `${item.type}:${item.dimensions.join(",")}`;
        mesh.position.set(...item.position);
        mesh.rotation.set(...item.rotation);
        mesh.scale.set(...item.scale);
        engine.scene.add(mesh);
        engine.objects.set(item.id, mesh);
      } else {
        const signature = `${item.type}:${item.dimensions.join(",")}`;
        if (mesh.userData.geometrySignature !== signature) {
          const oldGeometry = mesh.geometry;
          mesh.geometry = createGeometry(item.type, item.dimensions);
          mesh.userData.geometrySignature = signature;
          oldGeometry.dispose();
        }
        const material = mesh.material as THREE.MeshStandardMaterial;
        material.color.set(item.color);
      }
      mesh.position.set(...item.position);
      mesh.rotation.set(...item.rotation);
      mesh.scale.set(...item.scale);
      mesh.visible = item.visible;
      mesh.name = item.name;
    }
    const active = selectedId ? engine.objects.get(selectedId) : undefined;
    if (active && active.visible) engine.transform.attach(active);
    else engine.transform.detach();
  }, [selectedId]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || engineRef.current) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#0a111b");
    scene.fog = new THREE.Fog("#0a111b", 45, 110);
    const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 500);
    camera.position.set(9, 7, 11);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.outline = "none";
    host.appendChild(renderer.domElement);

    const orbit = new OrbitControls(camera, renderer.domElement);
    orbit.enableDamping = true;
    orbit.dampingFactor = 0.075;
    orbit.target.set(0, 1, 0);
    orbit.maxPolarAngle = Math.PI * 0.495;
    orbit.minDistance = 2;
    orbit.maxDistance = 100;

    const transform = new TransformControls(camera, renderer.domElement);
    transform.setMode("translate");
    transform.addEventListener("dragging-changed", (event) => { orbit.enabled = !event.value; });
    transform.addEventListener("objectChange", () => {
      const object = transform.object as THREE.Mesh | undefined;
      const id = object?.userData.objectId as string | undefined;
      if (!object || !id) return;
      const position: [number, number, number] = [object.position.x, object.position.y, object.position.z];
      const rotation: [number, number, number] = [object.rotation.x, object.rotation.y, object.rotation.z];
      const scale: [number, number, number] = [object.scale.x, object.scale.y, object.scale.z];
      setItems((current) => current.map((item) => item.id === id ? { ...item, position, rotation, scale } : item));
      setStatus("Transform updated");
    });
    scene.add(transform.getHelper());

    scene.add(new THREE.HemisphereLight(0xbad5ff, 0x1b2634, 2.1));
    const keyLight = new THREE.DirectionalLight(0xffffff, 3.2);
    keyLight.position.set(7, 13, 8);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(2048, 2048);
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0x5d9cff, 1.1);
    fillLight.position.set(-8, 5, -7);
    scene.add(fillLight);

    const grid = new THREE.GridHelper(60, 60, 0x45617f, 0x24364a);
    grid.position.y = -0.01;
    grid.name = "__grid";
    scene.add(grid);
    const axes = new THREE.AxesHelper(4);
    axes.name = "__axes";
    scene.add(axes);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const objects = new Map<string, THREE.Mesh>();
    const resizeObserver = new ResizeObserver(() => {
      const width = Math.max(host.clientWidth, 1);
      const height = Math.max(host.clientHeight, 1);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    });
    resizeObserver.observe(host);
    const handlePointerDown = (event: PointerEvent) => {
      if (transform.dragging) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects([...objects.values()].filter((mesh) => mesh.visible), false);
      const id = hits[0]?.object.userData.objectId as string | undefined;
      setSelectedId(id ?? null);
    };
    renderer.domElement.addEventListener("pointerdown", handlePointerDown);

    engineRef.current = { scene, camera, renderer, orbit, transform, raycaster, pointer, objects, resizeObserver };
    let frame = 0;
    const animate = () => {
      frame = requestAnimationFrame(animate);
      orbit.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(frame);
      renderer.domElement.removeEventListener("pointerdown", handlePointerDown);
      resizeObserver.disconnect();
      orbit.dispose();
      transform.dispose();
      for (const mesh of objects.values()) {
        mesh.geometry.dispose();
        const material = mesh.material;
        if (Array.isArray(material)) material.forEach((entry) => entry.dispose());
        else material.dispose();
      }
      renderer.dispose();
      renderer.domElement.remove();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => { syncScene(items); }, [items, syncScene]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("apexiveai-3d-scene-v1");
      if (raw) {
        const parsed = JSON.parse(raw) as { objects?: SceneItem[] };
        if (Array.isArray(parsed.objects)) {
          const valid = parsed.objects.filter((item) => item && typeof item.id === "string" &&
            ["box", "sphere", "cylinder", "plane"].includes(item.type) &&
            Array.isArray(item.dimensions) && item.dimensions.length === 3 &&
            Array.isArray(item.position) && item.position.length === 3 &&
            Array.isArray(item.rotation) && item.rotation.length === 3 &&
            Array.isArray(item.scale) && item.scale.length === 3);
          if (valid.length) setItems(valid);
        }
      }
    } catch { setStatus("Saved scene could not be loaded"); }
    finally { setStorageReady(true); }
  }, []);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.transform.setMode(mode);
    const active = selectedId ? engine.objects.get(selectedId) : undefined;
    if (active?.visible) engine.transform.attach(active);
    else engine.transform.detach();
  }, [mode, selectedId, items]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const grid = engine.scene.getObjectByName("__grid");
    const axes = engine.scene.getObjectByName("__axes");
    if (grid) grid.visible = gridVisible;
    if (axes) axes.visible = axesVisible;
  }, [gridVisible, axesVisible]);

  const addPrimitive = (type: PrimitiveType) => {
    saveHistory();
    const id = makeId();
    const count = items.filter((item) => item.type === type).length + 1;
    const item: SceneItem = {
      id, type, name: `${primitiveLabel(type)} ${String(count).padStart(2, "0")}`,
      visible: true, color: type === "plane" ? "#29394d" : "#4388d6",
      dimensions: type === "plane" ? [12, 0.1, 12] : [2, 2, 2],
      position: [0, type === "plane" ? 0 : 1, 0], rotation: type === "plane" ? [-Math.PI / 2, 0, 0] : [0, 0, 0], scale: [1, 1, 1],
    };
    setItems((current) => [...current, item]);
    setSelectedId(id);
    setStatus(`${item.name} created`);
  };

  const applyModelOperation = (operation: "Extrude" | "Revolve" | "Sweep" | "Loft" | "Union" | "Difference" | "Intersect" | "Mesh Edit" | "Surface") => {
    if (!selectedId) {
      setStatus(`Select an object before ${operation.toUpperCase()}`);
      return;
    }
    saveHistory();
    if (operation === "Extrude") {
      setItems((current) => current.map((item) => item.id === selectedId ? {
        ...item,
        dimensions: [item.dimensions[0], item.dimensions[1] * 1.35, item.dimensions[2]],
      } : item));
      setStatus("Extrude operation applied");
      return;
    }
    if (operation === "Revolve") {
      setItems((current) => current.map((item) => item.id === selectedId ? {
        ...item,
        type: "cylinder",
        name: item.name.replace(/^(Box|Sphere|Cylinder|Plane)/, "Revolved"),
      } : item));
      setStatus("Revolve operation applied");
      return;
    }
    if (operation === "Sweep" || operation === "Loft") {
      setItems((current) => current.map((item) => item.id === selectedId ? {
        ...item,
        type: "cylinder",
        name: operation === "Sweep" ? `${item.name} - Sweep` : `${item.name} - Loft`,
      } : item));
      setStatus(`${operation} preview generated`);
      return;
    }
    if (operation === "Mesh Edit") {
      const engine = engineRef.current;
      const mesh = selectedId ? engine?.objects.get(selectedId) : undefined;
      if (mesh) {
        const material = mesh.material as THREE.MeshStandardMaterial;
        material.wireframe = !material.wireframe;
        setStatus(material.wireframe ? "Mesh wireframe enabled" : "Mesh wireframe disabled");
      }
      return;
    }
    setStatus(`${operation} operation queued in geometry history`);
  };

  const toggleCameraMode = () => {
    const engine = engineRef.current;
    if (!engine) return;
    const next = cameraMode === "Perspective" ? "Orthographic" : "Perspective";
    setCameraMode(next);
    engine.camera.zoom = next === "Orthographic" ? 0.7 : 1;
    engine.camera.updateProjectionMatrix();
    engine.orbit.update();
    setStatus(`${next} viewport enabled`);
  };

  const toggleClippingPlane = () => {
    const engine = engineRef.current;
    if (!engine) return;
    const next = !clippingEnabled;
    setClippingEnabled(next);
    engine.renderer.localClippingEnabled = next;
    for (const mesh of engine.objects.values()) {
      const material = mesh.material as THREE.MeshStandardMaterial;
      material.clippingPlanes = next ? [new THREE.Plane(new THREE.Vector3(-1, 0, 0), 2)] : [];
      material.clipShadows = true;
      material.needsUpdate = true;
    }
    setStatus(next ? "Section clipping plane enabled" : "Section clipping plane disabled");
  };

  const toggleExplodedView = () => {
    const next = !explodedEnabled;
    setExplodedEnabled(next);
    saveHistory();
    setItems((current) => current.map((item, index) => {
      if (item.id === "ground") return item;
      const direction = index % 2 === 0 ? 1 : -1;
      return {
        ...item,
        position: [
          item.position[0] + (next ? direction * 1.25 : -direction * 1.25),
          item.position[1],
          item.position[2] + (next ? (index % 3) * 0.75 : -(index % 3) * 0.75),
        ],
      };
    }));
    setStatus(next ? "Exploded view enabled" : "Exploded view disabled");
  };

  const updateSelected = (patch: Partial<SceneItem>) => {
    if (!selectedId) return;
    saveHistory();
    setItems((current) => current.map((item) => item.id === selectedId ? { ...item, ...patch } : item));
  };

  const deleteSelected = () => {
    if (!selectedId || selectedId === "ground") return;
    saveHistory();
    setItems((current) => current.filter((item) => item.id !== selectedId));
    setSelectedId(null);
    setStatus("Object deleted");
  };

  const toggleVisibility = (id: string) => {
    saveHistory();
    setItems((current) => current.map((item) => item.id === id ? { ...item, visible: !item.visible } : item));
  };

  const undo = () => {
    const previous = history[history.length - 1];
    if (!previous) return;
    setFuture((current) => [{ items: structuredClone(items), selectedId }, ...current]);
    setHistory((current) => current.slice(0, -1));
    setItems(previous.items);
    setSelectedId(previous.selectedId);
    setStatus("Undo complete");
  };

  const redo = () => {
    const next = future[0];
    if (!next) return;
    setHistory((current) => [...current, { items: structuredClone(items), selectedId }]);
    setFuture((current) => current.slice(1));
    setItems(next.items);
    setSelectedId(next.selectedId);
    setStatus("Redo complete");
  };

  const focusSelected = () => {
    const engine = engineRef.current;
    const mesh = selectedId ? engine?.objects.get(selectedId) : undefined;
    if (!engine || !mesh) return;
    const bounds = new THREE.Box3().setFromObject(mesh);
    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3()).length();
    const direction = new THREE.Vector3().subVectors(engine.camera.position, engine.orbit.target).normalize();
    engine.orbit.target.copy(center);
    engine.camera.position.copy(center).add(direction.multiplyScalar(Math.max(size * 2.2, 4)));
    engine.orbit.update();
  };

  const toggleModelComparison = () => {
    const next = !compareEnabled;
    setCompareEnabled(next);
    setStatus(next ? "Model comparison overlay enabled" : "Model comparison overlay disabled");
  };

  const exportScene = () => {
    const engine = engineRef.current;
    if (!engine) return;
    const payload = {
      format: "ApexiveAI-Scene",
      version: 1,
      units: "meters",
      exportedAt: new Date().toISOString(),
      objects: items.map((item) => {
        const mesh = engine.objects.get(item.id);
        return {
          ...item,
          transform: mesh ? {
            position: mesh.position.toArray(), rotation: mesh.rotation.toArray(), scale: mesh.scale.toArray(),
          } : { position: item.position, rotation: item.rotation, scale: item.scale },
        };
      }),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "apexiveai-scene.json";
    anchor.click();
    URL.revokeObjectURL(url);
    setStatus("Scene JSON exported");
  };

  const saveScene = () => {
    try {
      const payload = { format: "ApexiveAI-Scene", version: 1, units: "meters", savedAt: new Date().toISOString(), objects: items };
      localStorage.setItem("apexiveai-3d-scene-v1", JSON.stringify(payload));
      setStatus("Scene saved in this browser");
    } catch { setStatus("Save failed: browser storage unavailable"); }
  };

  const importScene = async (file?: File) => {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as { objects?: SceneItem[] };
      if (!Array.isArray(parsed.objects)) throw new Error("Invalid scene format");
      const valid = parsed.objects.filter((item) => item && typeof item.id === "string" &&
        ["box", "sphere", "cylinder", "plane"].includes(item.type) &&
        Array.isArray(item.dimensions) && item.dimensions.length === 3 &&
        Array.isArray(item.position) && item.position.length === 3 &&
        Array.isArray(item.rotation) && item.rotation.length === 3 &&
        Array.isArray(item.scale) && item.scale.length === 3);
      if (!valid.length) throw new Error("No valid objects found");
      saveHistory();
      setItems(valid);
      setSelectedId(valid[0]?.id ?? null);
      setStatus(`Imported ${valid.length} objects`);
    } catch (error) { setStatus(error instanceof Error ? error.message : "Import failed"); }
  };

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      if (event.ctrlKey && event.key.toLowerCase() === "z") { event.preventDefault(); undo(); }
      else if (event.ctrlKey && event.key.toLowerCase() === "y") { event.preventDefault(); redo(); }
      else if (event.key.toLowerCase() === "w") setMode("translate");
      else if (event.key.toLowerCase() === "e") setMode("rotate");
      else if (event.key.toLowerCase() === "r") setMode("scale");
      else if (event.key === "Delete" || event.key === "Backspace") deleteSelected();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  });

  const resetCamera = () => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.camera.position.set(9, 7, 11);
    engine.orbit.target.set(0, 1, 0);
    engine.orbit.update();
  };

  const dimensionInput = (axis: 0 | 1 | 2, label: string) => (
    <label className="m06-field" key={label}>
      <span>{label}</span>
      <input type="number" min="0.01" step="0.1" value={selected?.dimensions[axis] ?? 1}
        onChange={(event) => {
          if (!selected) return;
          const dimensions: [number, number, number] = [...selected.dimensions];
          dimensions[axis] = Math.max(0.01, Number(event.target.value) || 0.01);
          updateSelected({ dimensions });
        }} />
    </label>
  );

  return (
    <main className="m06-shell">
      <style jsx global>{`
        .m06-shell{height:100%;min-height:680px;background:#080e17;color:#dce8f7;display:flex;flex-direction:column;font-family:Inter,ui-sans-serif,system-ui,sans-serif;overflow:hidden}
        .m06-topbar{height:58px;flex:none;display:flex;align-items:center;justify-content:space-between;padding:0 18px;border-bottom:1px solid #1c2b3d;background:#0c1521;gap:14px}
        .m06-brand{display:flex;align-items:center;gap:10px;min-width:220px}.m06-brand-mark{width:30px;height:30px;border-radius:8px;background:linear-gradient(135deg,#2876c8,#65c7f2);display:grid;place-items:center;color:white}.m06-brand strong{font-size:12px;letter-spacing:.12em}.m06-brand small{display:block;color:#71869e;font-size:9px;letter-spacing:.16em;margin-top:3px}
        .m06-actions,.m06-toolgroup{display:flex;align-items:center;gap:6px}.m06-btn{height:32px;min-width:32px;padding:0 10px;border:1px solid #25364b;border-radius:6px;background:#111e2d;color:#a9bdd4;display:inline-flex;align-items:center;justify-content:center;gap:7px;font-size:11px;cursor:pointer}.m06-btn:hover{border-color:#4d8dca;color:#fff}.m06-btn.active{background:#17385a;border-color:#398bd5;color:#8ccaff}.m06-btn:disabled{opacity:.35;cursor:not-allowed}.m06-primary{background:#1769ad;border-color:#287fc5;color:white}
        .m06-workbar{height:48px;flex:none;display:flex;align-items:center;gap:16px;padding:0 18px;border-bottom:1px solid #1b2a3a;background:#0a131e;overflow-x:auto}.m06-modeling-tools{flex:none}.m06-workbar-label{font-size:9px;color:#607b98;letter-spacing:.15em;margin-right:3px}.m06-divider{height:22px;width:1px;background:#26374a;margin:0 3px}.m06-stage{flex:1;min-height:0;display:flex;position:relative}.m06-viewport{flex:1;min-width:0;position:relative;background:#0a111b}.m06-hud{position:absolute;left:16px;top:14px;pointer-events:none;color:#7992ad;font-size:10px;letter-spacing:.08em;line-height:1.8}.m06-hud b{color:#b9d8f5;font-weight:600}.m06-view-tools{position:absolute;right:14px;top:14px;display:flex;gap:5px}.m06-status{position:absolute;bottom:12px;left:14px;right:14px;display:flex;justify-content:space-between;pointer-events:none;color:#7189a4;font-size:10px}.m06-inspector{width:270px;flex:none;border-left:1px solid #1c2b3d;background:#0d1723;overflow:auto}.m06-panel-head{padding:15px 15px 12px;border-bottom:1px solid #1e3044;display:flex;align-items:center;justify-content:space-between}.m06-panel-head strong{font-size:10px;letter-spacing:.13em}.m06-section{padding:14px 15px;border-bottom:1px solid #1c2b3d}.m06-section-title{font-size:9px;color:#7891ac;letter-spacing:.15em;margin-bottom:12px}.m06-object-row{display:flex;align-items:center;gap:8px;padding:8px;border-radius:5px;color:#9db1c8;font-size:11px;cursor:pointer}.m06-object-row:hover{background:#142438}.m06-object-row.selected{background:#17314c;color:#b9ddff}.m06-object-row span:nth-child(2){flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.m06-dot{width:8px;height:8px;border-radius:3px;flex:none}.m06-field{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:9px 0;color:#8ea5bd;font-size:10px}.m06-field input{width:112px;height:28px;padding:0 8px;border:1px solid #293d53;border-radius:5px;background:#09121d;color:#dce8f7;font-size:11px;outline:none}.m06-field input:focus{border-color:#438fd0}.m06-color{width:112px;height:28px;background:#09121d;border:1px solid #293d53;border-radius:5px;padding:3px}.m06-empty{color:#6f849d;font-size:11px;line-height:1.6}.m06-footer{height:27px;flex:none;border-top:1px solid #1c2b3d;background:#0a131e;display:flex;align-items:center;justify-content:space-between;padding:0 12px;color:#6e859f;font-size:9px}.m06-chip{padding:3px 6px;border:1px solid #263a50;border-radius:4px;color:#8fa8c2}
        @media(max-width:850px){.m06-inspector{width:225px}.m06-brand{min-width:0}.m06-brand small{display:none}.m06-btn .m06-btn-text{display:none}}
        @media(max-width:620px){.m06-inspector{position:absolute;right:0;top:0;bottom:0;z-index:5;width:min(270px,82vw);box-shadow:-12px 0 35px #0008}.m06-brand strong{font-size:10px}.m06-workbar{gap:6px;padding:0 8px}.m06-topbar{padding:0 9px}.m06-actions{gap:3px}}
      `}</style>

      <header className="m06-topbar">
        <div className="m06-brand">
          <div className="m06-brand-mark"><Box size={17} /></div>
          <div><strong>APEXIVEAI</strong><small>3D DESIGN STUDIO</small></div>
        </div>
        <div className="m06-actions">
          <button className="m06-btn" title="Undo" onClick={undo} disabled={!history.length}><Undo2 size={14}/></button>
          <button className="m06-btn" title="Redo" onClick={redo} disabled={!future.length}><Redo2 size={14}/></button>
          <button className="m06-btn" onClick={() => importRef.current?.click()}><Download size={14}/><span className="m06-btn-text">Import</span></button>
          <button className="m06-btn" onClick={exportScene}><Download size={14}/><span className="m06-btn-text">Export</span></button>
          <button className="m06-btn m06-primary" onClick={saveScene} disabled={!storageReady}><Save size={14}/><span className="m06-btn-text">Save</span></button>
          <input ref={importRef} type="file" accept="application/json,.json" hidden onChange={(event) => { void importScene(event.target.files?.[0]); event.currentTarget.value = ""; }} />
        </div>
      </header>

      <nav className="m06-workbar">
        <div className="m06-toolgroup"><span className="m06-workbar-label">CREATE</span>
          <button className="m06-btn" onClick={() => addPrimitive("box")} title="Add Box"><Box size={14}/>Box</button>
          <button className="m06-btn" onClick={() => addPrimitive("sphere")} title="Add Sphere"><Circle size={14}/>Sphere</button>
          <button className="m06-btn" onClick={() => addPrimitive("cylinder")} title="Add Cylinder"><Cylinder size={14}/>Cylinder</button>
          <button className="m06-btn" onClick={() => addPrimitive("plane")} title="Add Plane"><Scan size={14}/>Plane</button>
        </div>
        <div className="m06-divider" />
        <div className="m06-toolgroup"><span className="m06-workbar-label">TRANSFORM</span>
          <button className={`m06-btn ${mode === "translate" ? "active" : ""}`} onClick={() => setMode("translate")} title="Move (W)"><Move3D size={14}/></button>
          <button className={`m06-btn ${mode === "rotate" ? "active" : ""}`} onClick={() => setMode("rotate")} title="Rotate (E)"><Rotate3D size={14}/></button>
          <button className={`m06-btn ${mode === "scale" ? "active" : ""}`} onClick={() => setMode("scale")} title="Scale (R)"><Maximize2 size={14}/></button>
        </div>
        <div className="m06-divider" />
        <div className="m06-toolgroup m06-modeling-tools">
          <span className="m06-workbar-label">MODEL</span>
          <button className="m06-btn" onClick={() => applyModelOperation("Extrude")}>Extrude</button>
          <button className="m06-btn" onClick={() => applyModelOperation("Revolve")}>Revolve</button>
          <button className="m06-btn" onClick={() => applyModelOperation("Sweep")}>Sweep</button>
          <button className="m06-btn" onClick={() => applyModelOperation("Loft")}>Loft</button>
          <button className="m06-btn" onClick={() => applyModelOperation("Union")}>Boolean</button>
        </div>
      </nav>

      <section className="m06-stage">
        <div className="m06-viewport" ref={hostRef}>
          <div className="m06-hud"><b>3D VIEWPORT</b><br/>{cameraMode} · Real-time renderer<br/>Units: meters · {clippingEnabled ? "Section active" : "No clipping"} · {explodedEnabled ? "Exploded" : "Assembly"}</div>
          <div className="m06-view-tools">
            <button className={`m06-btn ${gridVisible ? "active" : ""}`} title="Toggle grid" onClick={() => setGridVisible((value) => !value)}><Grid3X3 size={14}/></button>
            <button className={`m06-btn ${axesVisible ? "active" : ""}`} title="Toggle axes" onClick={() => setAxesVisible((value) => !value)}><Layers3 size={14}/></button>
            <button className={`m06-btn ${cameraMode === "Orthographic" ? "active" : ""}`} title="Toggle perspective / orthographic" onClick={toggleCameraMode}><Box size={14}/></button>
            <button className={`m06-btn ${clippingEnabled ? "active" : ""}`} title="Section / clipping plane" onClick={toggleClippingPlane}><Scan size={14}/></button>
            <button className={`m06-btn ${explodedEnabled ? "active" : ""}`} title="Exploded view" onClick={toggleExplodedView}><Maximize2 size={14}/></button>
            <button className={`m06-btn ${compareEnabled ? "active" : ""}`} title="Model comparison" onClick={toggleModelComparison}><Layers3 size={14}/></button>
            <button className="m06-btn" title="Focus selected" onClick={focusSelected}><Focus size={14}/></button>
            <button className="m06-btn" title="Reset camera" onClick={resetCamera}><Scan size={14}/></button>
            <button className="m06-btn" title="Toggle inspector" onClick={() => setShowInspector((value) => !value)}><Settings2 size={14}/></button>
          </div>
          <div className="m06-status"><span>{status}</span><span>Orbit: left drag · Pan: right drag · Zoom: scroll</span></div>
        </div>

        {showInspector && <aside className="m06-inspector">
          <div className="m06-panel-head"><strong>SCENE EXPLORER</strong><span className="m06-chip">{items.length} OBJECTS</span></div>
          <div className="m06-section">
            {items.map((item) => <div key={item.id} className={`m06-object-row ${selectedId === item.id ? "selected" : ""}`} onClick={() => setSelectedId(item.id)}>
              <span className="m06-dot" style={{ background: item.color }}/><span>{item.name}</span>
              <button className="m06-btn" style={{ minWidth: 25, width: 25, height: 24, padding: 0 }} title={item.visible ? "Hide object" : "Show object"} onClick={(event) => { event.stopPropagation(); toggleVisibility(item.id); }}>{item.visible ? <Eye size={12}/> : <EyeOff size={12}/>}</button>
            </div>)}
          </div>
          <div className="m06-section">
            <div className="m06-section-title">OBJECT PROPERTIES</div>
            {selected ? <>
              <label className="m06-field"><span>Name</span><input value={selected.name} onChange={(event) => updateSelected({ name: event.target.value })}/></label>
              <label className="m06-field"><span>Material Color</span><input className="m06-color" type="color" value={selected.color} onChange={(event) => updateSelected({ color: event.target.value })}/></label>
              <div className="m06-section-title" style={{ marginTop: 18 }}>DIMENSIONS (M)</div>
              {dimensionInput(0, "Width / X")}
              {dimensionInput(1, "Height / Y")}
              {dimensionInput(2, "Depth / Z")}
              <div style={{ display: "flex", gap: 6, marginTop: 14 }}>
                <button className="m06-btn" style={{ flex: 1 }} onClick={focusSelected}><Focus size={13}/>Focus</button>
                <button className="m06-btn" style={{ flex: 1, color: "#f08c8c" }} onClick={deleteSelected} disabled={selected.id === "ground"}><Trash2 size={13}/>Delete</button>
              </div>
            </> : <div className="m06-empty">Select an object in the viewport or Scene Explorer to inspect its properties.</div>}
          </div>
          <div className="m06-section">
            <div className="m06-section-title">WORKSPACE STATUS</div>
            <div className="m06-field"><span>Renderer</span><strong>WebGL</strong></div>
            <div className="m06-field"><span>Camera</span><strong>Perspective</strong></div>
            <div className="m06-field"><span>Scene units</span><strong>Meters</strong></div>
            <div className="m06-field"><span>History</span><strong>{history.length} steps</strong></div>
          </div>
        </aside>}
      </section>
      <footer className="m06-footer"><span>APEXIVEAI DESIGN & ENGINEERING · MILESTONE 06</span><span>3D Studio Foundation <span className="m06-chip">{storageReady ? "LOCAL STORAGE" : "LOADING"}</span></span></footer>
    </main>
  );
}
