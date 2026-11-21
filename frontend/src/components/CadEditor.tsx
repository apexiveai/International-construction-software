
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  MousePointer2, Minus, Square, Circle, Pencil,
  Hand, Undo2, Redo2, Trash2, Grid3X3, Save,
  Download, Plus, Layers3, Ruler, Crosshair,
  X, Check, ChevronDown, Scissors, CornerDownRight, Radius, Slash
} from "lucide-react";

type Point = { x: number; y: number };

type Shape = {
  id: string;
  type:
    | "line"
    | "rect"
    | "circle"
    | "polyline"
    | "arc"
    | "ellipse"
    | "polygon"
    | "spline"
    | "hatch"
    | "boundary"
    | "point"
    | "construction-line"
    | "ray"
    | "region"
    | "text"
    | "leader"
    | "dimension";
  points: Point[];
  layer: string;
  color: string;
  lineWidth: number;
};

type Tool =
  | "select"
  | "line"
  | "rect"
  | "circle"
  | "polyline"
  | "arc"
  | "ellipse"
  | "polygon"
  | "spline"
  | "hatch"
  | "boundary"
  | "point"
  | "construction-line"
  | "ray"
  | "region"
  | "text"
  | "leader"
  | "dimension"
  | "measure"
  | "pan"
  ;

const initialLayers = [
  { name: "0", color: "#dce6f5", visible: true },
  { name: "Walls", color: "#5ca9ff", visible: true },
  { name: "Doors", color: "#e6ad58", visible: true },
  { name: "Windows", color: "#55d5b2", visible: true },
  { name: "Dimensions", color: "#c58bff", visible: true },
];

const tools: {
  id: Tool;
  label: string;
  icon: typeof MousePointer2;
  shortcut: string;
}[] = [
  { id: "select", label: "Select", icon: MousePointer2, shortcut: "V" },
  { id: "line", label: "Line", icon: Minus, shortcut: "L" },
  { id: "rect", label: "Rectangle", icon: Square, shortcut: "R" },
  { id: "circle", label: "Circle", icon: Circle, shortcut: "C" },
  { id: "polyline", label: "Polyline", icon: Pencil, shortcut: "P" },
  { id: "arc", label: "Arc", icon: Ruler, shortcut: "A" },
  { id: "ellipse", label: "Ellipse", icon: Circle, shortcut: "E" },
  { id: "polygon", label: "Polygon", icon: Square, shortcut: "G" },
  { id: "spline", label: "Spline", icon: Pencil, shortcut: "S" },
  { id: "hatch", label: "Hatch", icon: Grid3X3, shortcut: "HATCH" },
  { id: "boundary", label: "Boundary", icon: Square, shortcut: "BO" },
  { id: "point", label: "Point", icon: Crosshair, shortcut: "PO" },
  { id: "construction-line", label: "Construction Line", icon: Minus, shortcut: "XL" },
  { id: "ray", label: "Ray", icon: Slash, shortcut: "RY" },
  { id: "region", label: "Region", icon: Layers3, shortcut: "REG" },
  { id: "text", label: "Text / MText", icon: Ruler, shortcut: "T" },
  { id: "leader", label: "Leader", icon: CornerDownRight, shortcut: "LE" },
  { id: "dimension", label: "Dimension", icon: Ruler, shortcut: "DIM" },
  { id: "pan", label: "Pan", icon: Hand, shortcut: "H" },
  { id: "measure", label: "Measure", icon: Ruler, shortcut: "M" },
];

const distance = (a: Point, b: Point) =>
  Math.hypot(a.x - b.x, a.y - b.y);

type GeometryCommand = "trim" | "extend" | null;

const lineIntersection = (a: Point, b: Point, c: Point, d: Point) => {
  const r = { x: b.x - a.x, y: b.y - a.y };
  const s = { x: d.x - c.x, y: d.y - c.y };
  const cross = r.x * s.y - r.y * s.x;
  if (Math.abs(cross) < 1e-9) return null;
  const q = { x: c.x - a.x, y: c.y - a.y };
  const t = (q.x * s.y - q.y * s.x) / cross;
  const u = (q.x * r.y - q.y * r.x) / cross;
  return { point: { x: a.x + t * r.x, y: a.y + t * r.y }, t, u };
};

const cornerChamfer = (points: Point[], amount: number): Point[] => {
  if (points.length < 3 || amount <= 0) return points.map((p) => ({ ...p }));
  const result: Point[] = [{ ...points[0] }];
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const current = points[i];
    const next = points[i + 1];
    const lenA = distance(prev, current);
    const lenB = distance(current, next);
    if (!lenA || !lenB) continue;
    const cutA = Math.min(amount, lenA * 0.45);
    const cutB = Math.min(amount, lenB * 0.45);
    result.push({
      x: current.x + ((prev.x - current.x) / lenA) * cutA,
      y: current.y + ((prev.y - current.y) / lenA) * cutA,
    });
    result.push({
      x: current.x + ((next.x - current.x) / lenB) * cutB,
      y: current.y + ((next.y - current.y) / lenB) * cutB,
    });
  }
  result.push({ ...points[points.length - 1] });
  return result;
};

const cornerFillet = (points: Point[], radius: number): Point[] => {
  if (points.length < 3 || radius <= 0) return points.map((p) => ({ ...p }));
  const result: Point[] = [{ ...points[0] }];
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const current = points[i];
    const next = points[i + 1];
    const lenA = distance(prev, current);
    const lenB = distance(current, next);
    if (!lenA || !lenB) continue;
    const trim = Math.min(radius, lenA * 0.45, lenB * 0.45);
    const start = {
      x: current.x + ((prev.x - current.x) / lenA) * trim,
      y: current.y + ((prev.y - current.y) / lenA) * trim,
    };
    const end = {
      x: current.x + ((next.x - current.x) / lenB) * trim,
      y: current.y + ((next.y - current.y) / lenB) * trim,
    };
    result.push(start);
    // Quadratic Bezier samples create a smooth rounded corner approximation.
    for (let step = 1; step <= 6; step++) {
      const t = step / 7;
      const one = 1 - t;
      result.push({
        x: one * one * start.x + 2 * one * t * current.x + t * t * end.x,
        y: one * one * start.y + 2 * one * t * current.y + t * t * end.y,
      });
    }
    result.push(end);
  }
  result.push({ ...points[points.length - 1] });
  return result;
};

export default function CadEditor() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [osnapEnabled, setOsnapEnabled] = useState(true);
  const [orthoEnabled, setOrthoEnabled] = useState(false);
  const [polarEnabled, setPolarEnabled] = useState(false);

  const [snapLabel, setSnapLabel] = useState("NONE");
  const [measurement, setMeasurement] = useState<number | null>(null);

  const measurePointsRef = useRef<Point[]>([]);
  const shapesRef = useRef<Shape[]>([]);
  const historyRef = useRef<Shape[][]>([[]]);
  const historyIndexRef = useRef(0);

  const viewRef = useRef({
    x: 0,
    y: 0,
    zoom: 1,
  });

  const activeLayerRef = useRef("0");
  const toolRef = useRef<Tool>("select");
  const drawingRef = useRef(false);
  const startRef = useRef<Point | null>(null);
  const currentRef = useRef<Point | null>(null);
  const polylineRef = useRef<Point[]>([]);
  const panStartRef = useRef<{
    x: number;
    y: number;
    vx: number;
    vy: number;
  } | null>(null);
  const selectedRef = useRef<string | null>(null);
  const dragRef = useRef<Point | null>(null);

  const [tool, setTool] = useState<Tool>("select");
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [layers, setLayers] = useState(initialLayers);
  const [activeLayer, setActiveLayer] = useState("0");
  const [gridEnabled, setGridEnabled] = useState(true);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [zoom, setZoom] = useState(100);
  const [status, setStatus] = useState("Ready");
  const [coordinate, setCoordinate] = useState<Point>({ x: 0, y: 0 });
  const [newLayerName, setNewLayerName] = useState("");
  const [showLayerInput, setShowLayerInput] = useState(false);
  const [offsetDistance, setOffsetDistance] = useState(100);
  const [cornerDistance, setCornerDistance] = useState(50);
  const [geometryCommand, setGeometryCommand] = useState<GeometryCommand>(null);
  const commandFirstIdRef = useRef<string | null>(null);
  const [inspectorTab, setInspectorTab] = useState<"properties" | "blocks" | "management">("properties");
  const [selectionFilter, setSelectionFilter] = useState("All objects");
  const [ucs, setUcs] = useState<"WCS" | "UCS">("WCS");
  const [commandText, setCommandText] = useState("");

  const [properties, setProperties] = useState({
    color: "#dce6f5",
    lineWidth: 1,
  });

  const activeLayerData =
    layers.find((l) => l.name === activeLayer) ?? layers[0];

  const setToolMode = (next: Tool) => {
    toolRef.current = next;
    setTool(next);
    drawingRef.current = false;
    startRef.current = null;
    polylineRef.current = [];
    setGeometryCommand(null);
    commandFirstIdRef.current = null;
    setStatus(`${next.toUpperCase()} tool active`);
  };

  const commitHistory = useCallback(() => {
    const next = shapesRef.current.map((s) => ({
      ...s,
      points: s.points.map((p) => ({ ...p })),
    }));

    const history = historyRef.current.slice(
      0,
      historyIndexRef.current + 1
    );

    history.push(next);

    if (history.length > 100) history.shift();

    historyRef.current = history;
    historyIndexRef.current = history.length - 1;

    setShapes(next);
  }, []);

  const undo = () => {
    if (historyIndexRef.current <= 0) return;

    historyIndexRef.current--;
    const previous = historyRef.current[historyIndexRef.current];
    shapesRef.current = previous.map((s) => ({
      ...s,
      points: s.points.map((p) => ({ ...p })),
    }));
    setShapes(shapesRef.current);
    setSelectedId(null);
    selectedRef.current = null;
    setStatus("Undo");
  };

  const redo = () => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;

    historyIndexRef.current++;
    const next = historyRef.current[historyIndexRef.current];
    shapesRef.current = next.map((s) => ({
      ...s,
      points: s.points.map((p) => ({ ...p })),
    }));
    setShapes(shapesRef.current);
    setStatus("Redo");
  };

  const screenToWorld = (sx: number, sy: number): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const view = viewRef.current;

    return {
      x: (sx - rect.left - view.x) / view.zoom,
      y: (sy - rect.top - view.y) / view.zoom,
    };
  };

  const constrainPoint = (start: Point, end: Point): Point => {
    const dx = end.x - start.x;
    const dy = end.y - start.y;

    if (orthoEnabled) {
      return Math.abs(dx) >= Math.abs(dy)
        ? { x: end.x, y: start.y }
        : { x: start.x, y: end.y };
    }

    if (polarEnabled) {
      const angle = Math.atan2(dy, dx);
      const increment = Math.PI / 12;
      const snappedAngle = Math.round(angle / increment) * increment;
      const length = Math.hypot(dx, dy);

      return {
        x: start.x + Math.cos(snappedAngle) * length,
        y: start.y + Math.sin(snappedAngle) * length,
      };
    }

    return end;
  };

  const snapPoint = (p: Point): Point => {
    let result = snapEnabled
      ? {
        x: Math.round(p.x / 10) * 10,
        y: Math.round(p.y / 10) * 10,
      }
      : p;

    let bestDistance = 10 / viewRef.current.zoom;
    let bestLabel = snapEnabled ? "GRID" : "NONE";

    if (osnapEnabled) {
      const candidates: { point: Point; label: string }[] = [];

      shapesRef.current.forEach((shape) => {
        const pts = shape.points;

        pts.forEach((point) => {
          candidates.push({ point, label: "ENDPOINT" });
        });

        if (shape.type === "line" && pts.length >= 2) {
          candidates.push({
            point: {
              x: (pts[0].x + pts[1].x) / 2,
              y: (pts[0].y + pts[1].y) / 2,
            },
            label: "MIDPOINT",
          });
        }

        if (shape.type === "rect" && pts.length >= 2) {
          const [a, b] = pts;
          const corners = [
            { x: a.x, y: b.y },
            { x: b.x, y: a.y },
            { x: (a.x + b.x) / 2, y: a.y },
            { x: (a.x + b.x) / 2, y: b.y },
            { x: a.x, y: (a.y + b.y) / 2 },
            { x: b.x, y: (a.y + b.y) / 2 },
          ];

          corners.forEach((point, index) => {
            candidates.push({
              point,
              label: index < 2 ? "ENDPOINT" : "MIDPOINT",
            });
          });
        }

        if (shape.type === "circle" && pts.length >= 2) {
          candidates.push({
            point: pts[0],
            label: "CENTER",
          });
        }
      });

      candidates.forEach((candidate) => {
        const d = distance(p, candidate.point);

        if (d < bestDistance) {
          bestDistance = d;
          result = candidate.point;
          bestLabel = candidate.label;
        }
      });
    }

    setSnapLabel(bestLabel);
    return result;
  };

  const getShapeColor = (shape: Shape) => {
    return shape.color;
  };

  const drawShape = (
    ctx: CanvasRenderingContext2D,
    shape: Shape,
    preview = false
  ) => {
    if (shape.points.length === 0) return;

    const [a, b] = shape.points;
    const color = preview ? "#65b5ff" : getShapeColor(shape);

    ctx.strokeStyle = color;
    ctx.lineWidth = shape.lineWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (shape.id === selectedRef.current && !preview) {
      ctx.shadowColor = "#4ca5ff";
      ctx.shadowBlur = 7;
    }

    ctx.beginPath();

    if (shape.type === "line" && b) {
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
    }

    if (shape.type === "rect" && b) {
      ctx.rect(a.x, a.y, b.x - a.x, b.y - a.y);
    }

    if (shape.type === "circle" && b) {
      ctx.arc(a.x, a.y, distance(a, b), 0, Math.PI * 2);
    }

    if (shape.type === "ellipse" && b) {
      ctx.ellipse(
        a.x,
        a.y,
        Math.max(1, Math.abs(b.x - a.x)),
        Math.max(1, Math.abs(b.y - a.y)),
        0,
        0,
        Math.PI * 2
      );
    }

    if (shape.type === "polygon" && b) {
      const radius = distance(a, b);
      const sides = 6;
      ctx.moveTo(a.x + radius, a.y);
      for (let i = 1; i <= sides; i++) {
        const angle = (i * Math.PI * 2) / sides;
        ctx.lineTo(a.x + Math.cos(angle) * radius, a.y + Math.sin(angle) * radius);
      }
      ctx.closePath();
    }

    if (shape.type === "point") {
      ctx.moveTo(a.x - 5, a.y);
      ctx.lineTo(a.x + 5, a.y);
      ctx.moveTo(a.x, a.y - 5);
      ctx.lineTo(a.x, a.y + 5);
    }

    if (
      (shape.type === "construction-line" || shape.type === "ray") &&
      b
    ) {
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const length = Math.hypot(dx, dy) || 1;
      if (shape.type === "ray") {
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(a.x + dx * 100, a.y + dy * 100);
      } else {
        ctx.moveTo(a.x - dx * 100, a.y - dy * 100);
        ctx.lineTo(a.x + dx * 100, a.y + dy * 100);
      }
    }

    if (
      (shape.type === "text" || shape.type === "leader" || shape.type === "dimension") &&
      b
    ) {
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      if (shape.type === "text") {
        ctx.fillStyle = color;
        ctx.font = "12px ui-monospace, monospace";
        ctx.fillText("TEXT", a.x + 8, a.y - 8);
      }
    }

    if (
      shape.type === "polyline" ||
      shape.type === "spline" ||
      shape.type === "hatch" ||
      shape.type === "boundary" ||
      shape.type === "region"
    ) {
      ctx.moveTo(a.x, a.y);
      shape.points.slice(1).forEach((p) => ctx.lineTo(p.x, p.y));
      if (shape.type === "hatch" || shape.type === "boundary" || shape.type === "region") {
        ctx.closePath();
      }
    }

    if (shape.type === "arc" && b) {
      const radius = distance(a, b);
      const endAngle = Math.atan2(b.y - a.y, b.x - a.x);
      ctx.arc(a.x, a.y, radius, 0, endAngle);
    }

    ctx.stroke();
    ctx.shadowBlur = 0;
  };

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const rect = wrap.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = Math.max(1, rect.width * dpr);
    canvas.height = Math.max(1, rect.height * dpr);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#0d1420";
    ctx.fillRect(0, 0, rect.width, rect.height);

    const view = viewRef.current;

    ctx.save();
    ctx.translate(view.x, view.y);
    ctx.scale(view.zoom, view.zoom);

    if (gridEnabled) {
      const step = 10;
      const left = -view.x / view.zoom;
      const top = -view.y / view.zoom;
      const right = (rect.width - view.x) / view.zoom;
      const bottom = (rect.height - view.y) / view.zoom;

      const startX = Math.floor(left / step) * step;
      const startY = Math.floor(top / step) * step;

      ctx.fillStyle = "#27364b";

      for (let x = startX; x <= right; x += step) {
        for (let y = startY; y <= bottom; y += step) {
          ctx.fillRect(x - 0.5, y - 0.5, 1, 1);
        }
      }

      ctx.strokeStyle = "#40516b";
      ctx.lineWidth = 1 / view.zoom;

      ctx.beginPath();
      ctx.moveTo(0, top);
      ctx.lineTo(0, bottom);
      ctx.moveTo(left, 0);
      ctx.lineTo(right, 0);
      ctx.stroke();
    }

    shapesRef.current.forEach((shape) => {
      const layer = layers.find((l) => l.name === shape.layer);
      if (layer?.visible === false) return;
      drawShape(ctx, shape);
    });

    if (drawingRef.current && startRef.current && currentRef.current) {
      const type = toolRef.current;
      if (
        type === "line" ||
        type === "rect" ||
        type === "circle" ||
        type === "arc" ||
        type === "ellipse" ||
        type === "polygon" ||
        type === "point" ||
        type === "construction-line" ||
        type === "ray" ||
        type === "text" ||
        type === "leader" ||
        type === "dimension"
      ) {
        drawShape(ctx, {
          id: "preview",
          type,
          points: [startRef.current, currentRef.current],
          layer: activeLayerRef.current,
          color: "#65b5ff",
          lineWidth: 1,
        }, true);
      }
    }

    if (polylineRef.current.length > 0) {
      const points = [...polylineRef.current];
      if (currentRef.current) points.push(currentRef.current);

      drawShape(ctx, {
        id: "poly-preview",
        type: "polyline",
        points,
        layer: activeLayerRef.current,
        color: "#65b5ff",
        lineWidth: 1,
      }, true);
    }

    ctx.restore();
  }, [gridEnabled, layers]);

  useEffect(() => {
    redraw();

    const observer = new ResizeObserver(redraw);
    if (wrapRef.current) observer.observe(wrapRef.current);

    return () => observer.disconnect();
  }, [redraw]);

  const findShape = (p: Point): Shape | null => {
    const visible = shapesRef.current.filter((shape) =>
      layers.find((l) => l.name === shape.layer)?.visible !== false
    );

    for (let i = visible.length - 1; i >= 0; i--) {
      const shape = visible[i];
      const [a, b] = shape.points;
      if (!a) continue;

      if (shape.type === "rect" && b) {
        const minX = Math.min(a.x, b.x);
        const maxX = Math.max(a.x, b.x);
        const minY = Math.min(a.y, b.y);
        const maxY = Math.max(a.y, b.y);

        const inside =
          p.x >= minX - 5 && p.x <= maxX + 5 &&
          p.y >= minY - 5 && p.y <= maxY + 5;

        if (inside) return shape;
      }

      if (shape.type === "circle" && b) {
        const radius = distance(a, b);
        if (Math.abs(distance(a, p) - radius) < 7) return shape;
      }

      if (shape.type === "line" && b) {
        const len = distance(a, b);
        if (len === 0) continue;

        const t = Math.max(
          0,
          Math.min(1,
            ((p.x - a.x) * (b.x - a.x) +
              (p.y - a.y) * (b.y - a.y)) / (len * len)
          )
        );

        const projection = {
          x: a.x + t * (b.x - a.x),
          y: a.y + t * (b.y - a.y),
        };

        if (distance(p, projection) < 7) return shape;
      }

      if (shape.type === "polyline") {
        for (let j = 1; j < shape.points.length; j++) {
          const first = shape.points[j - 1];
          const second = shape.points[j];
          const len = distance(first, second);
          if (!len) continue;

          const t = Math.max(
            0,
            Math.min(1,
              ((p.x - first.x) * (second.x - first.x) +
                (p.y - first.y) * (second.y - first.y)) / (len * len)
            )
          );

          const projection = {
            x: first.x + t * (second.x - first.x),
            y: first.y + t * (second.y - first.y),
          };

          if (distance(p, projection) < 7) return shape;
        }
      }

      if (shape.type === "arc" && b) {
        const radius = distance(a, b);
        const radial = Math.abs(distance(a, p) - radius);
        const end = Math.atan2(b.y - a.y, b.x - a.x);
        const angle = Math.atan2(p.y - a.y, p.x - a.x);
        if (radial < 7 && angle >= 0 && angle <= end) return shape;
      }
    }

    return null;
  };

  const addShape = (shape: Shape) => {
    shapesRef.current = [...shapesRef.current, shape];
    commitHistory();
    setStatus(`${shape.type.toUpperCase()} created`);
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.setPointerCapture(event.pointerId);

    let point = snapPoint(
      screenToWorld(event.clientX, event.clientY)
    );

    if (
      drawingRef.current &&
      startRef.current &&
      (orthoEnabled || polarEnabled)
    ) {
      point = constrainPoint(startRef.current, point);
    }

    if (event.button === 1 || event.button === 2 || toolRef.current === "pan") {
      panStartRef.current = {
        x: event.clientX,
        y: event.clientY,
        vx: viewRef.current.x,
        vy: viewRef.current.y,
      };
      return;
    }

    if (geometryCommand) {
      const found = findShape(point);
      if (!found) {
        setStatus(`Select a ${geometryCommand === "trim" ? "cutting edge" : "boundary"} object`);
        return;
      }
      if (!commandFirstIdRef.current) {
        commandFirstIdRef.current = found.id;
        setStatus(`${geometryCommand.toUpperCase()}: cutting/boundary edge selected; click a LINE to modify`);
        return;
      }
      const first = shapesRef.current.find((shape) => shape.id === commandFirstIdRef.current);
      commandFirstIdRef.current = null;
      setGeometryCommand(null);
      if (!first || first.id === found.id || first.type !== "line" || found.type !== "line" || first.points.length < 2 || found.points.length < 2) {
        setStatus(`${geometryCommand.toUpperCase()} currently supports two different LINE objects`);
        return;
      }
      const [ca, cb] = first.points;
      const [ta, tb] = found.points;
      const hit = lineIntersection(ta, tb, ca, cb);
      if (!hit || hit.u < 0 || hit.u > 1) {
        setStatus(`${geometryCommand.toUpperCase()}: no intersection with the selected cutting/boundary segment`);
        return;
      }
      if (geometryCommand === "trim") {
        if (hit.t < 0 || hit.t > 1) {
          setStatus("TRIM: intersection is outside the target line");
          return;
        }
        const keepStart = distance(point, ta) <= distance(point, tb);
        found.points = keepStart ? [ta, hit.point] : [hit.point, tb];
        setStatus("TRIM completed");
      } else {
        if (hit.t >= 0 && hit.t <= 1) {
          setStatus("EXTEND: target line already reaches the boundary");
          return;
        }
        found.points = hit.t < 0 ? [hit.point, ta] : [ta, hit.point];
        setStatus("EXTEND completed");
      }
      selectedRef.current = found.id;
      setSelectedId(found.id);
      commitHistory();
      redraw();
      return;
    }

    if (toolRef.current === "select") {
      const found = findShape(point);
      selectedRef.current = found?.id ?? null;
      setSelectedId(found?.id ?? null);

      if (found) {
        setProperties({
          color: found.color,
          lineWidth: found.lineWidth,
        });
        dragRef.current = point;
        setStatus(`Selected ${found.type}`);
      } else {
        setStatus("No object selected");
      }

      return;
    }

    if (toolRef.current === "measure") {
      measurePointsRef.current = [
        ...measurePointsRef.current,
        point,
      ];

      if (measurePointsRef.current.length === 2) {
        const [a, b] = measurePointsRef.current;
        const result = distance(a, b);

        setMeasurement(result);
        setStatus(`DISTANCE: ${result.toFixed(3)} mm`);

        measurePointsRef.current = [];
        drawingRef.current = false;
      }

      redraw();
      return;
    }

    if (
      toolRef.current === "polyline" ||
      toolRef.current === "spline" ||
      toolRef.current === "hatch" ||
      toolRef.current === "boundary" ||
      toolRef.current === "region"
    ) {
      polylineRef.current = [...polylineRef.current, point];
      currentRef.current = point;
      drawingRef.current = true;
      redraw();
      return;
    }

    if (!drawingRef.current) {
      drawingRef.current = true;
      startRef.current = point;
      currentRef.current = point;
      redraw();
      return;
    }

    const start = startRef.current;
    if (!start) return;

    addShape({
      id: crypto.randomUUID(),
      type: toolRef.current as Shape["type"],
      points: [start, point],
      layer: activeLayerRef.current,
      color: activeLayerData.color,
      lineWidth: 1,
    });

    drawingRef.current = false;
    startRef.current = null;
    currentRef.current = null;
    redraw();
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    let point = snapPoint(
      screenToWorld(event.clientX, event.clientY)
    );

    setCoordinate(point);

    if (
      drawingRef.current &&
      startRef.current &&
      (orthoEnabled || polarEnabled)
    ) {
      point = constrainPoint(startRef.current, point);
    }

    if (panStartRef.current) {
      const pan = panStartRef.current;
      viewRef.current.x = pan.vx + event.clientX - pan.x;
      viewRef.current.y = pan.vy + event.clientY - pan.y;
      redraw();
      return;
    }

    if (dragRef.current && selectedRef.current) {
      const dx = point.x - dragRef.current.x;
      const dy = point.y - dragRef.current.y;

      const shape = shapesRef.current.find(
        (s) => s.id === selectedRef.current
      );

      if (shape) {
        shape.points = shape.points.map((p) => ({
          x: p.x + dx,
          y: p.y + dy,
        }));
      }

      dragRef.current = point;
      redraw();
      return;
    }

    currentRef.current = point;

    if (drawingRef.current) redraw();
  };

  const handlePointerUp = () => {
    if (dragRef.current) {
      dragRef.current = null;
      commitHistory();
    }
    panStartRef.current = null;
  };

  const handleDoubleClick = () => {
    if (
      toolRef.current !== "polyline" &&
      toolRef.current !== "spline" &&
      toolRef.current !== "hatch" &&
      toolRef.current !== "boundary" &&
      toolRef.current !== "region"
    ) return;
    if (polylineRef.current.length < 2) return;

    addShape({
      id: crypto.randomUUID(),
      type: toolRef.current as Shape["type"],
      points: [...polylineRef.current],
      layer: activeLayerRef.current,
      color: activeLayerData.color,
      lineWidth: 1,
    });

    polylineRef.current = [];
    currentRef.current = null;
    drawingRef.current = false;
    redraw();
  };

  const handleWheel = (event: React.WheelEvent<HTMLCanvasElement>) => {
    event.preventDefault();

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouse = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };

    const view = viewRef.current;
    const oldZoom = view.zoom;
    const nextZoom = Math.max(
      0.15,
      Math.min(8, oldZoom * (event.deltaY < 0 ? 1.1 : 0.9))
    );

    const worldX = (mouse.x - view.x) / oldZoom;
    const worldY = (mouse.y - view.y) / oldZoom;

    view.zoom = nextZoom;
    view.x = mouse.x - worldX * nextZoom;
    view.y = mouse.y - worldY * nextZoom;

    setZoom(Math.round(nextZoom * 100));
    redraw();
  };

  const deleteSelected = () => {
    if (!selectedRef.current) return;

    shapesRef.current = shapesRef.current.filter(
      (s) => s.id !== selectedRef.current
    );

    selectedRef.current = null;
    setSelectedId(null);
    commitHistory();
    redraw();
    setStatus("Object deleted");
  };

  const updateSelectedProperty = (
    key: "color" | "lineWidth",
    value: string | number
  ) => {
    const shape = shapesRef.current.find(
      (s) => s.id === selectedRef.current
    );
    if (!shape) return;

    if (key === "color") shape.color = String(value);
    if (key === "lineWidth") shape.lineWidth = Number(value);

    setProperties((old) => ({ ...old, [key]: value }));
    commitHistory();
    redraw();
  };

  const getShapeBoundsCenter = (shape: Shape): Point => {
    const xs = shape.points.map((p) => p.x);
    const ys = shape.points.map((p) => p.y);
    return {
      x: (Math.min(...xs) + Math.max(...xs)) / 2,
      y: (Math.min(...ys) + Math.max(...ys)) / 2,
    };
  };

  const offsetPolylinePoints = (points: Point[], amount: number): Point[] => {
    if (points.length < 2) return points.map((p) => ({ ...p }));

    const normals: Point[] = [];
    for (let i = 0; i < points.length - 1; i++) {
      const dx = points[i + 1].x - points[i].x;
      const dy = points[i + 1].y - points[i].y;
      const length = Math.hypot(dx, dy) || 1;
      normals.push({ x: dy / length, y: -dx / length });
    }

    return points.map((point, index) => {
      let normal: Point;
      if (index === 0) {
        normal = normals[0];
      } else if (index === points.length - 1) {
        normal = normals[normals.length - 1];
      } else {
        const nx = normals[index - 1].x + normals[index].x;
        const ny = normals[index - 1].y + normals[index].y;
        const length = Math.hypot(nx, ny) || 1;
        normal = { x: nx / length, y: ny / length };
      }
      return {
        x: point.x + normal.x * amount,
        y: point.y + normal.y * amount,
      };
    });
  };

  const offsetSelected = () => {
    const selected = shapesRef.current.find((shape) => shape.id === selectedRef.current);
    if (!selected) {
      setStatus("Select an object before using OFFSET");
      return;
    }

    const amount = Math.abs(Number(offsetDistance));
    if (!Number.isFinite(amount) || amount <= 0) {
      setStatus("OFFSET distance must be greater than zero");
      return;
    }

    let points: Point[];
    if (selected.type === "line" || selected.type === "polyline") {
      points = offsetPolylinePoints(selected.points, amount);
    } else if (selected.type === "rect" && selected.points.length >= 2) {
      const [a, b] = selected.points;
      const minX = Math.min(a.x, b.x) - amount;
      const maxX = Math.max(a.x, b.x) + amount;
      const minY = Math.min(a.y, b.y) - amount;
      const maxY = Math.max(a.y, b.y) + amount;
      points = [{ x: minX, y: minY }, { x: maxX, y: maxY }];
    } else if (selected.type === "circle" && selected.points.length >= 2) {
      const center = selected.points[0];
      const radius = distance(center, selected.points[1]) + amount;
      points = [center, { x: center.x + radius, y: center.y }];
    } else {
      setStatus("OFFSET currently supports Line, Polyline, Rectangle and Circle");
      return;
    }

    addShape({
      ...selected,
      id: crypto.randomUUID(),
      points,
    });
    setStatus(`OFFSET created at ${amount.toFixed(2)} mm`);
  };

  const mirrorSelected = () => {
    const selected = shapesRef.current.find((shape) => shape.id === selectedRef.current);
    if (!selected) {
      setStatus("Select an object before using MIRROR");
      return;
    }

    const center = getShapeBoundsCenter(selected);
    const points = selected.points.map((point) => ({
      x: 2 * center.x - point.x,
      y: point.y,
    }));

    addShape({
      ...selected,
      id: crypto.randomUUID(),
      points,
    });
    setStatus("MIRROR created across vertical center axis");
  };

  const copySelected = () => {
    const selected = shapesRef.current.find((shape) => shape.id === selectedRef.current);
    if (!selected) {
      setStatus("Select an object before using COPY");
      return;
    }
    addShape({
      ...selected,
      id: crypto.randomUUID(),
      points: selected.points.map((point) => ({ x: point.x + 100, y: point.y + 100 })),
    });
    setStatus("COPY created with 100 mm offset");
  };

  const rotateSelected = () => {
    const selected = shapesRef.current.find((shape) => shape.id === selectedRef.current);
    if (!selected) return;
    const center = getShapeBoundsCenter(selected);
    const angle = Math.PI / 6;
    selected.points = selected.points.map((point) => {
      const dx = point.x - center.x;
      const dy = point.y - center.y;
      return {
        x: center.x + dx * Math.cos(angle) - dy * Math.sin(angle),
        y: center.y + dx * Math.sin(angle) + dy * Math.cos(angle),
      };
    });
    commitHistory();
    redraw();
    setStatus("ROTATE applied: 30 degrees");
  };

  const scaleSelected = () => {
    const selected = shapesRef.current.find((shape) => shape.id === selectedRef.current);
    if (!selected) return;
    const center = getShapeBoundsCenter(selected);
    selected.points = selected.points.map((point) => ({
      x: center.x + (point.x - center.x) * 1.25,
      y: center.y + (point.y - center.y) * 1.25,
    }));
    commitHistory();
    redraw();
    setStatus("SCALE applied: 125%");
  };

  const startGeometryCommand = (command: Exclude<GeometryCommand, null>) => {
    commandFirstIdRef.current = null;
    setGeometryCommand(command);
    setStatus(`${command.toUpperCase()}: click cutting/boundary LINE, then target LINE`);
  };

  const applyCornerOperation = (operation: "fillet" | "chamfer") => {
    const selected = shapesRef.current.find((shape) => shape.id === selectedRef.current);
    if (!selected) {
      setStatus(`Select a polyline before using ${operation.toUpperCase()}`);
      return;
    }
    if (selected.type !== "polyline") {
      setStatus(`${operation.toUpperCase()} currently supports open POLYLINE objects`);
      return;
    }
    const amount = Number(cornerDistance);
    if (!Number.isFinite(amount) || amount <= 0) {
      setStatus(`${operation.toUpperCase()} distance must be greater than zero`);
      return;
    }
    const points = operation === "fillet"
      ? cornerFillet(selected.points, amount)
      : cornerChamfer(selected.points, amount);
    if (points.length <= selected.points.length) {
      setStatus(`Not enough polyline vertices for ${operation.toUpperCase()}`);
      return;
    }
    selected.points = points;
    commitHistory();
    redraw();
    setStatus(`${operation.toUpperCase()} applied to selected polyline`);
  };

  const createLayer = () => {
    const name = newLayerName.trim();
    if (!name || layers.some((l) => l.name === name)) return;

    setLayers((old) => [
      ...old,
      {
        name,
        color: "#63aaff",
        visible: true,
      },
    ]);

    setActiveLayer(name);
    activeLayerRef.current = name;
    setNewLayerName("");
    setShowLayerInput(false);
  };

  const exportDrawing = () => {
    const payload = {
      format: "ApexiveAI CAD Drawing Data",
      version: "1.0",
      units: "mm",
      layers,
      shapes: shapesRef.current,
      exportedAt: new Date().toISOString(),
    };

    const blob = new Blob(
      [JSON.stringify(payload, null, 2)],
      { type: "application/json" }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "apexiveai-drawing.json";
    link.click();
    URL.revokeObjectURL(url);
    setStatus("Drawing data exported");
  };

  const saveDrawing = () => {
    localStorage.setItem(
      "apexiveai-cad-drawing",
      JSON.stringify({
        version: 1,
        layers,
        shapes: shapesRef.current,
      })
    );
    setStatus("Drawing saved locally");
  };

  const executeCommand = (raw: string) => {
    const command = raw.trim().toLowerCase();
    if (!command) return;

    const commandTools: Record<string, Tool> = {
      l: "line",
      line: "line",
      r: "rect",
      rect: "rect",
      c: "circle",
      circle: "circle",
      p: "polyline",
      pl: "polyline",
      a: "arc",
      arc: "arc",
      e: "ellipse",
      ellipse: "ellipse",
      g: "polygon",
      polygon: "polygon",
      s: "spline",
      spline: "spline",
      po: "point",
      point: "point",
      xl: "construction-line",
      ray: "ray",
      t: "text",
      text: "text",
      m: "measure",
      measure: "measure",
    };

    if (command === "undo") undo();
    else if (command === "redo") redo();
    else if (command === "erase" || command === "delete") deleteSelected();
    else if (command === "save") saveDrawing();
    else if (command === "export") exportDrawing();
    else if (command === "trim") startGeometryCommand("trim");
    else if (command === "extend") startGeometryCommand("extend");
    else if (commandTools[command]) setToolMode(commandTools[command]);
    else setStatus(`Unknown command: ${raw.trim().toUpperCase()}`);

    setCommandText("");
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA"
      ) return;

      const key = event.key.toLowerCase();

      if (key === "f3") {
        event.preventDefault();
        setOsnapEnabled((v) => !v);
        return;
      }

      if (key === "f8") {
        event.preventDefault();
        setOrthoEnabled((v) => !v);
        return;
      }

      if (key === "f9") {
        event.preventDefault();
        setSnapEnabled((v) => !v);
        return;
      }

      if (key === "f10") {
        event.preventDefault();
        setPolarEnabled((v) => !v);
        return;
      }

      if ((event.ctrlKey || event.metaKey) && key === "z") {
        event.preventDefault();
        undo();
      } else if ((event.ctrlKey || event.metaKey) && key === "y") {
        event.preventDefault();
        redo();
      } else if (key === "delete" || key === "backspace") {
        deleteSelected();
      } else {
        const match = tools.find((t) => t.shortcut.toLowerCase() === key);
        if (match) setToolMode(match.id);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  useEffect(() => {
    redraw();
  }, [shapes, redraw]);

  return (
    <div className="cad-shell">
      <div className="cad-toolbar">
        <div className="cad-tool-group">
          <button className="cad-action" onClick={undo} title="Undo (Ctrl+Z)">
            <Undo2 size={16} />
          </button>
          <button className="cad-action" onClick={redo} title="Redo (Ctrl+Y)">
            <Redo2 size={16} />
          </button>
          <span className="cad-separator" />
          <button className="cad-action" onClick={saveDrawing}>
            <Save size={15} /> Save
          </button>
          <button className="cad-action" onClick={exportDrawing}>
            <Download size={15} /> Export
          </button>
          <span className="cad-separator" />
          <button className="cad-action" onClick={copySelected}>Copy</button>
          <button className="cad-action" onClick={rotateSelected}>Rotate</button>
          <button className="cad-action" onClick={scaleSelected}>Scale</button>
          <button className="cad-action" onClick={mirrorSelected}>Mirror</button>
          <button className="cad-action" onClick={offsetSelected}>Offset</button>
        </div>

        <div className="cad-tool-group">
          <button
            className={`cad-toggle ${gridEnabled ? "on" : ""}`}
            onClick={() => setGridEnabled(!gridEnabled)}
          >
            <Grid3X3 size={15} /> Grid
          </button>
          <button
            className={`cad-toggle ${snapEnabled ? "on" : ""}`}
            onClick={() => setSnapEnabled(!snapEnabled)}
          >
            <Crosshair size={15} /> Snap
          </button>
          <button
            className={`cad-toggle ${osnapEnabled ? "on" : ""}`}
            onClick={() => setOsnapEnabled(!osnapEnabled)}
            title="Object Snap (F3)"
          >
            <Crosshair size={15} /> OSNAP
          </button>
          <button
            className={`cad-toggle ${orthoEnabled ? "on" : ""}`}
            onClick={() => setOrthoEnabled(!orthoEnabled)}
            title="Orthographic Mode (F8)"
          >
            ORTHO
          </button>
          <button
            className={`cad-toggle ${polarEnabled ? "on" : ""}`}
            onClick={() => setPolarEnabled(!polarEnabled)}
            title="Polar Tracking (F10)"
          >
            POLAR
          </button>
          <button
            className="cad-toggle"
            onClick={() => setUcs((value) => value === "WCS" ? "UCS" : "WCS")}
            title="Toggle World / User Coordinate System"
          >
            {ucs}
          </button>
        </div>
      </div>

      <div className="cad-body">
        <aside className="cad-tools">
          <div className="cad-panel-label">DRAWING TOOLS</div>
          {tools.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={`cad-tool ${tool === item.id ? "active" : ""}`}
                onClick={() => setToolMode(item.id)}
                title={`${item.label} (${item.shortcut})`}
              >
                <Icon size={17} />
                <span>{item.label}</span>
                <small>{item.shortcut}</small>
              </button>
            );
          })}

          <div className="cad-tools-divider" />
          <button className="cad-tool danger" onClick={deleteSelected}>
            <Trash2 size={17} />
            <span>Delete</span>
          </button>
        </aside>

        <div className="cad-drawing-area">
          <div className="cad-canvas-header">
            <div>
              <span className="cad-live-dot" />
              MODEL SPACE
            </div>
            <span>ORTHOGRAPHIC · 2D</span>
          </div>

          <div className="cad-canvas-wrap" ref={wrapRef}>
            <canvas
              ref={canvasRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onDoubleClick={handleDoubleClick}
              onWheel={handleWheel}
              onContextMenu={(e) => e.preventDefault()}
            />
            <div className="cad-canvas-hint">
              {geometryCommand
                ? `${geometryCommand.toUpperCase()}: click cutting/boundary line, then target line`
                : tool === "polyline"
                  ? "Click to add points · Double-click to finish"
                  : tool === "select"
                    ? "Click to select · Drag to move · Scroll to zoom"
                    : "Click first point · Click second point to finish"}
            </div>
          </div>

          <div className="cad-command-line">
            <span className="command-prompt">COMMAND</span>
            <input
              value={commandText}
              onChange={(event) => setCommandText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") executeCommand(commandText);
              }}
              placeholder={status}
              aria-label="CAD command"
            />
            <ChevronDown size={13} />
          </div>

          <div className="cad-statusbar">
            <span>X: {coordinate.x.toFixed(2)}</span>
            <span>Y: {coordinate.y.toFixed(2)}</span>
            <span>OSNAP: {osnapEnabled ? snapLabel : "OFF"}</span>
            <span>ORTHO: {orthoEnabled ? "ON" : "OFF"}</span>
            <span>POLAR: {polarEnabled ? "ON" : "OFF"}</span>

            {measurement !== null && (
              <span>DIST: {measurement.toFixed(2)} mm</span>
            )}
            <span>ZOOM {zoom}%</span>
            <span>MM</span>
            <span>{shapes.length} OBJECTS</span>
          </div>
        </div>

        <aside className="cad-inspector">
          <div className="cad-inspector-tabs" role="tablist">
            <button
              className={inspectorTab === "properties" ? "active" : ""}
              onClick={() => setInspectorTab("properties")}
            >
              Properties
            </button>
            <button
              className={inspectorTab === "blocks" ? "active" : ""}
              onClick={() => setInspectorTab("blocks")}
            >
              Blocks
            </button>
            <button
              className={inspectorTab === "management" ? "active" : ""}
              onClick={() => setInspectorTab("management")}
            >
              Manage
            </button>
          </div>

          {inspectorTab === "management" ? (
            <div className="cad-inspector-section cad-management">
              <div className="cad-inspector-heading">
                <div><small>DOCUMENT MANAGEMENT</small><h3>Drawing Resources</h3></div>
              </div>
              {[
                ["Linetype Manager", "Continuous, Dashed, Center"],
                ["Lineweight Manager", "0.25 — 2.00 mm"],
                ["Text Styles", "Standard / Annotative"],
                ["Dimension Styles", "ISO-25 / Metric"],
                ["Layouts", "Model, Layout 1"],
                ["Sheet Manager", "A1, A3, Custom"],
                ["Drawing Templates", "ISO A3, ISO A1"],
                ["External References", "No XREF loaded"],
              ].map(([title, detail]) => (
                <button className="cad-management-row" key={title}>
                  <span>{title}</span>
                  <small>{detail}</small>
                </button>
              ))}
            </div>
          ) : inspectorTab === "blocks" ? (
            <div className="cad-inspector-section">
              <div className="cad-inspector-heading">
                <div><small>BLOCK LIBRARY</small><h3>Blocks & References</h3></div>
                <button className="cad-icon-button" title="Create block"><Plus size={16} /></button>
              </div>
              <button className="cad-block-card"><strong>DOOR-900</strong><small>Architectural / Door</small></button>
              <button className="cad-block-card"><strong>WINDOW-1200</strong><small>Architectural / Window</small></button>
              <button className="cad-block-card"><strong>COL-300</strong><small>Structural / Column</small></button>
              <button className="cad-block-card"><strong>XREF-DWG</strong><small>External reference</small></button>
            </div>
          ) : (
            <>
          <div className="cad-inspector-section">
            <div className="cad-inspector-heading">
              <div>
                <small>DRAWING STRUCTURE</small>
                <h3>Layers</h3>
              </div>
              <button
                className="cad-icon-button"
                onClick={() => setShowLayerInput(!showLayerInput)}
                title="Add Layer"
              >
                <Plus size={16} />
              </button>
            </div>

            {showLayerInput && (
              <div className="cad-new-layer">
                <input
                  value={newLayerName}
                  onChange={(e) => setNewLayerName(e.target.value)}
                  placeholder="Layer name"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") createLayer();
                  }}
                />
                <button onClick={createLayer}><Check size={14} /></button>
                <button onClick={() => setShowLayerInput(false)}><X size={14} /></button>
              </div>
            )}

            <div className="cad-layer-list">
              {layers.map((layer) => (
                <div
                  key={layer.name}
                  className={`cad-layer ${activeLayer === layer.name ? "active" : ""}`}
                  onClick={() => {
                    setActiveLayer(layer.name);
                    activeLayerRef.current = layer.name;
                  }}
                >
                  <span
                    className="cad-layer-color"
                    style={{ background: layer.color }}
                  />
                  <span>{layer.name}</span>
                  <button
                    className={`cad-visibility ${layer.visible ? "visible" : ""}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setLayers((old) => old.map((l) =>
                        l.name === layer.name
                          ? { ...l, visible: !l.visible }
                          : l
                      ));
                    }}
                    title="Toggle visibility"
                  >
                    {layer.visible ? "●" : "○"}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="cad-inspector-section">
            <div className="cad-inspector-heading">
              <div>
                <small>OBJECT INSPECTOR</small>
                <h3>Properties</h3>
              </div>
              <Layers3 size={16} />
            </div>

            {selectedId ? (
              <div className="cad-property-form">
                <label>Object ID</label>
                <span className="cad-property-value">
                  {selectedId.slice(0, 15)}
                </span>

                <label>Geometry</label>
                <span className="cad-property-value">
                  {shapesRef.current.find((s) => s.id === selectedId)?.type}
                </span>

                <label>Line Color</label>
                <input
                  type="color"
                  value={properties.color}
                  onChange={(e) =>
                    updateSelectedProperty("color", e.target.value)
                  }
                />

                <label>Line Width</label>
                <input
                  type="number"
                  min="0.1"
                  max="20"
                  step="0.1"
                  value={properties.lineWidth}
                  onChange={(e) =>
                    updateSelectedProperty("lineWidth", Number(e.target.value))
                  }
                />

                <label>Offset Distance (mm)</label>
                <input
                  type="number"
                  min="0.1"
                  step="1"
                  value={offsetDistance}
                  onChange={(e) => setOffsetDistance(Number(e.target.value))}
                />

                <div className="cad-geometry-actions">
                  <button className="cad-action" onClick={offsetSelected}>
                    OFFSET
                  </button>
                  <button className="cad-action" onClick={mirrorSelected}>
                    MIRROR
                  </button>
                  <button className="cad-action" onClick={() => startGeometryCommand("trim")}>
                    <Scissors size={14} /> TRIM
                  </button>
                  <button className="cad-action" onClick={() => startGeometryCommand("extend")}>
                    <CornerDownRight size={14} /> EXTEND
                  </button>
                </div>

                <label>Fillet / Chamfer Distance (mm)</label>
                <input
                  type="number"
                  min="0.1"
                  step="1"
                  value={cornerDistance}
                  onChange={(e) => setCornerDistance(Number(e.target.value))}
                />
                <div className="cad-geometry-actions">
                  <button className="cad-action" onClick={() => applyCornerOperation("fillet")}>
                    <Radius size={14} /> FILLET
                  </button>
                  <button className="cad-action" onClick={() => applyCornerOperation("chamfer")}>
                    <Slash size={14} /> CHAMFER
                  </button>
                </div>
              </div>
            ) : (
              <div className="cad-empty">
                <MousePointer2 size={23} />
                <p>Select a drawing object to inspect its properties.</p>
              </div>
            )}
          </div>

          <div className="cad-inspector-section cad-document-info">
            <small>DOCUMENT SETTINGS</small>
            <div><span>Units</span><strong>Millimeters</strong></div>
            <div><span>Grid spacing</span><strong>10 mm</strong></div>
            <div><span>Active layer</span><strong>{activeLayer}</strong></div>
            <div><span>Coordinate system</span><strong>{ucs}</strong></div>
            <div><span>Selection filter</span><strong>{selectionFilter}</strong></div>
          </div>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
