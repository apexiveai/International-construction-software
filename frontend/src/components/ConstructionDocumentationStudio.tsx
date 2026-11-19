"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownToLine,
  BookOpen,
  Building2,
  ClipboardList,
  FilePlus2,
  Layers3,
  Printer,
  RefreshCw,
  Ruler,
  Search,
  Sheet,
} from "lucide-react";
import { loadBIMProject } from "@/lib/bim-core";
import type { BIMProject } from "@/lib/bim-core";

type DrawingKind = "Floor Plan" | "Elevation" | "Section" | "3D Coordination";
type DrawingView = {
  id: string;
  name: string;
  kind: DrawingKind;
  levelId: string;
  scale: string;
  notes: string;
};
type DrawingSheet = {
  id: string;
  number: string;
  title: string;
  viewIds: string[];
  revision: string;
  status: "Draft" | "For Review" | "Issued";
};
type Annotation = {
  id: string;
  viewId: string;
  text: string;
  kind: "Note" | "Dimension" | "Callout";
};

const STORAGE_KEY = "apexiveai-construction-documents-v1";
const makeId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

const safeRead = <T,>(key: string, fallback: T): T => {
  try {
    if (typeof window === "undefined") return fallback;
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

export default function ConstructionDocumentationStudio() {
  const [bim, setBim] = useState<BIMProject | null>(null);
  const [docDate, setDocDate] = useState<string>("");
  const [views, setViews] = useState<DrawingView[]>([]);
  const [sheets, setSheets] = useState<DrawingSheet[]>([]);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [activeViewId, setActiveViewId] = useState<string>("");
  const [activeSheetId, setActiveSheetId] = useState<string>("");
  const [viewName, setViewName] = useState("Ground Floor Plan");
  const [viewKind, setViewKind] = useState<DrawingKind>("Floor Plan");
  const [viewLevel, setViewLevel] = useState("bim-level-00");
  const [scale, setScale] = useState("1:100");
  const [sheetTitle, setSheetTitle] = useState("General Arrangement");
  const [annotationText, setAnnotationText] = useState("");
  const [annotationKind, setAnnotationKind] =
    useState<Annotation["kind"]>("Note");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("Documentation workspace ready");

  useEffect(() => {
    setDocDate(new Date().toLocaleDateString());
    try {
      setBim(loadBIMProject());
      const saved = safeRead<{
        views: DrawingView[];
        sheets: DrawingSheet[];
        annotations: Annotation[];
      }>(STORAGE_KEY, { views: [], sheets: [], annotations: [] });
      setViews(saved.views);
      setSheets(saved.sheets);
      setAnnotations(saved.annotations);
      if (saved.views[0]) setActiveViewId(saved.views[0].id);
      if (saved.sheets[0]) setActiveSheetId(saved.sheets[0].id);
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Unable to load project data"
      );
    }
  }, []);

  const activeView = views.find((item) => item.id === activeViewId) ?? null;
  const activeSheet = sheets.find((item) => item.id === activeSheetId) ?? null;
  const levelOptions = bim?.levels ?? [];

  const filteredElements = useMemo(() => {
    const term = query.trim().toLowerCase();
    return (bim?.elements ?? []).filter(
      (item) =>
        !term ||
        `${item.name} ${item.category} ${item.discipline}`
          .toLowerCase()
          .includes(term)
    );
  }, [bim, query]);

  const viewAnnotations = annotations.filter(
    (item) => item.viewId === activeViewId
  );

  const viewElements = useMemo(() => {
    if (!bim || !activeView) return [];
    if (activeView.kind === "Floor Plan") {
      return bim.elements.filter(
        (item) =>
          item.levelId === activeView.levelId ||
          Math.abs(
            item.transform.y -
              (bim.levels.find((l) => l.id === activeView.levelId)?.elevation ??
                0)
          ) < 0.25
      );
    }
    return bim.elements;
  }, [bim, activeView]);

  const persist = (
    nextViews = views,
    nextSheets = sheets,
    nextAnnotations = annotations
  ) => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        views: nextViews,
        sheets: nextSheets,
        annotations: nextAnnotations,
      })
    );
  };

  const createView = () => {
    if (!viewName.trim()) {
      setStatus("Enter a drawing view name");
      return;
    }
    const next: DrawingView = {
      id: makeId("view"),
      name: viewName.trim(),
      kind: viewKind,
      levelId: viewLevel,
      scale,
      notes: "",
    };
    const updated = [...views, next];
    setViews(updated);
    setActiveViewId(next.id);
    persist(updated);
    setStatus(`${next.kind} created`);
  };

  const createSheet = () => {
    const next: DrawingSheet = {
      id: makeId("sheet"),
      number: `A-${String(sheets.length + 1).padStart(3, "0")}`,
      title: sheetTitle.trim() || "Untitled Sheet",
      viewIds: activeViewId ? [activeViewId] : [],
      revision: "A",
      status: "Draft",
    };
    const updated = [...sheets, next];
    setSheets(updated);
    setActiveSheetId(next.id);
    persist(views, updated);
    setStatus(`Sheet ${next.number} created`);
  };

  const addViewToSheet = () => {
    if (!activeSheet || !activeView) return;
    const updated = sheets.map((sheet) =>
      sheet.id === activeSheet.id && !sheet.viewIds.includes(activeView.id)
        ? { ...sheet, viewIds: [...sheet.viewIds, activeView.id] }
        : sheet
    );
    setSheets(updated);
    persist(views, updated);
    setStatus(`${activeView.name} added to ${activeSheet.number}`);
  };

  const addAnnotation = () => {
    if (!activeView || !annotationText.trim()) {
      setStatus("Select a view and enter annotation text");
      return;
    }
    const updated = [
      ...annotations,
      {
        id: makeId("annotation"),
        viewId: activeView.id,
        text: annotationText.trim(),
        kind: annotationKind,
      },
    ];
    setAnnotations(updated);
    persist(views, sheets, updated);
    setAnnotationText("");
    setStatus(`${annotationKind} added`);
  };

  const refreshBim = () => {
    try {
      setBim(loadBIMProject());
      setStatus("Shared BIM model refreshed");
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "BIM refresh failed"
      );
    }
  };

  const updateSheetStatus = (statusValue: DrawingSheet["status"]) => {
    if (!activeSheet) return;
    const updated = sheets.map((sheet) =>
      sheet.id === activeSheet.id ? { ...sheet, status: statusValue } : sheet
    );
    setSheets(updated);
    persist(views, updated);
    setStatus(`${activeSheet.number} status: ${statusValue}`);
  };

  const exportRegister = () => {
    const payload = {
      format: "ApexiveAI-Construction-Documents",
      version: 1,
      exportedAt: new Date().toISOString(),
      views,
      sheets,
      annotations,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "apexiveai-drawing-register.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const printSheet = () => {
    if (!activeSheet) {
      setStatus("Select a drawing sheet first");
      return;
    }
    window.print();
  };

  return (
    <main className="min-h-screen bg-[#080d15] text-slate-100">
      <style jsx global>{`
        @media print {
          body {
            background: white !important;
          }
          .no-print {
            display: none !important;
          }
          .print-area {
            color: #111827 !important;
            background: white !important;
            border: 1px solid #cbd5e1 !important;
            box-shadow: none !important;
          }
          .print-area * {
            color: #111827 !important;
          }
        }
      `}</style>
      <header className="no-print border-b border-white/10 bg-[#0b1420] px-5 py-4 md:px-8">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 p-3 text-cyan-300">
              <Sheet size={24} />
            </div>
            <div>
              <p className="text-xs font-semibold tracking-[0.22em] text-cyan-300">
                APEXIVEAI · ENGINEERING PLATFORM
              </p>
              <h1 className="text-xl font-semibold">
                Construction Documentation
              </h1>
              <p className="text-xs text-slate-400">
                Drawing views · Sheets · Annotations · Registers
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={refreshBim}
              className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-sm hover:bg-white/5"
            >
              <RefreshCw size={15} /> Refresh BIM
            </button>
            <button
              type="button"
              onClick={exportRegister}
              className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-sm hover:bg-white/5"
            >
              <ArrowDownToLine size={15} /> Export Register
            </button>
            <button
              type="button"
              onClick={printSheet}
              className="inline-flex items-center gap-2 rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-300"
            >
              <Printer size={15} /> Print / PDF
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1600px] space-y-5 p-5 md:p-8">
        <section className="no-print grid gap-4 xl:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-[#101b29] p-5">
            <div className="mb-3 flex items-center gap-2 text-sm text-slate-400">
              <BookOpen size={16} /> DRAWING VIEW SETUP
            </div>
            <label className="mb-1 block text-xs text-slate-400">
              View name
            </label>
            <input
              value={viewName}
              onChange={(e) => setViewName(e.target.value)}
              className="mb-3 w-full rounded-lg border border-white/10 bg-[#0a121d] px-3 py-2 text-sm"
            />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-xs text-slate-400">
                  View type
                </label>
                <select
                  value={viewKind}
                  onChange={(e) => setViewKind(e.target.value as DrawingKind)}
                  className="w-full rounded-lg border border-white/10 bg-[#0a121d] px-2 py-2 text-sm"
                >
                  {[
                    "Floor Plan",
                    "Elevation",
                    "Section",
                    "3D Coordination",
                  ].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-400">
                  Scale
                </label>
                <select
                  value={scale}
                  onChange={(e) => setScale(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-[#0a121d] px-2 py-2 text-sm"
                >
                  {["1:20", "1:50", "1:100", "1:200", "NTS"].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </div>
            </div>
            <label className="mb-1 mt-3 block text-xs text-slate-400">
              Level
            </label>
            <select
              value={viewLevel}
              onChange={(e) => setViewLevel(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-[#0a121d] px-3 py-2 text-sm"
            >
              {levelOptions.length ? (
                levelOptions.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))
              ) : (
                <option value="">No BIM levels found</option>
              )}
            </select>
            <button
              type="button"
              onClick={createView}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-400 px-3 py-2 text-sm font-semibold text-slate-950"
            >
              <FilePlus2 size={15} /> Create Drawing View
            </button>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#101b29] p-5">
            <div className="mb-3 flex items-center gap-2 text-sm text-slate-400">
              <ClipboardList size={16} /> SHEET MANAGEMENT
            </div>
            <label className="mb-1 block text-xs text-slate-400">
              Sheet title
            </label>
            <input
              value={sheetTitle}
              onChange={(e) => setSheetTitle(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-[#0a121d] px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={createSheet}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-sm hover:bg-white/5"
            >
              <FilePlus2 size={15} /> Create Sheet
            </button>
            <label className="mb-1 mt-4 block text-xs text-slate-400">
              Active sheet
            </label>
            <select
              value={activeSheetId}
              onChange={(e) => setActiveSheetId(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-[#0a121d] px-3 py-2 text-sm"
            >
              <option value="">Select sheet</option>
              {sheets.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.number} · {s.title}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={addViewToSheet}
              disabled={!activeSheet || !activeView}
              className="mt-3 w-full rounded-lg bg-white/10 px-3 py-2 text-sm hover:bg-white/15 disabled:opacity-40"
            >
              Add Active View to Sheet
            </button>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => updateSheetStatus("For Review")}
                disabled={!activeSheet}
                className="flex-1 rounded-lg border border-white/10 px-2 py-2 text-xs disabled:opacity-40"
              >
                For Review
              </button>
              <button
                type="button"
                onClick={() => updateSheetStatus("Issued")}
                disabled={!activeSheet}
                className="flex-1 rounded-lg border border-emerald-400/30 px-2 py-2 text-xs text-emerald-300 disabled:opacity-40"
              >
                Issue
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#101b29] p-5">
            <div className="mb-3 flex items-center gap-2 text-sm text-slate-400">
              <Ruler size={16} /> ANNOTATIONS
            </div>
            <label className="mb-1 block text-xs text-slate-400">
              Annotation type
            </label>
            <select
              value={annotationKind}
              onChange={(e) =>
                setAnnotationKind(e.target.value as Annotation["kind"])
              }
              className="mb-3 w-full rounded-lg border border-white/10 bg-[#0a121d] px-3 py-2 text-sm"
            >
              <option>Note</option>
              <option>Dimension</option>
              <option>Callout</option>
            </select>
            <textarea
              value={annotationText}
              onChange={(e) => setAnnotationText(e.target.value)}
              rows={3}
              placeholder="Enter drawing note, dimension or callout…"
              className="w-full rounded-lg border border-white/10 bg-[#0a121d] px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={addAnnotation}
              disabled={!activeView}
              className="mt-3 w-full rounded-lg bg-white/10 px-3 py-2 text-sm hover:bg-white/15 disabled:opacity-40"
            >
              Add Annotation to Active View
            </button>
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-[320px_1fr]">
          <div className="no-print space-y-4">
            <div className="rounded-2xl border border-white/10 bg-[#101b29] p-5">
              <h2 className="mb-3 flex items-center gap-2 font-semibold">
                <Layers3 size={17} /> Drawing Views
              </h2>
              <div className="space-y-2">
                {views.map((v) => (
                  <button
                    type="button"
                    key={v.id}
                    onClick={() => setActiveViewId(v.id)}
                    className={`w-full rounded-lg border p-3 text-left ${
                      activeViewId === v.id
                        ? "border-cyan-400/40 bg-cyan-400/10"
                        : "border-white/10 bg-[#0a121d]"
                    }`}
                  >
                    <p className="text-sm font-medium">{v.name}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      {v.kind} · {v.scale}
                    </p>
                  </button>
                ))}
                {!views.length && (
                  <p className="text-sm text-slate-500">
                    No drawing views created
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#101b29] p-5">
              <h2 className="mb-3 flex items-center gap-2 font-semibold">
                <Sheet size={17} /> Sheet Register
              </h2>
              <div className="space-y-2">
                {sheets.map((s) => (
                  <button
                    type="button"
                    key={s.id}
                    onClick={() => setActiveSheetId(s.id)}
                    className={`w-full rounded-lg border p-3 text-left ${
                      activeSheetId === s.id
                        ? "border-cyan-400/40 bg-cyan-400/10"
                        : "border-white/10 bg-[#0a121d]"
                    }`}
                  >
                    <div className="flex justify-between gap-2">
                      <span className="text-sm font-medium">{s.number}</span>
                      <span className="text-[10px] text-slate-400">
                        {s.status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">{s.title}</p>
                    <p className="mt-1 text-[10px] text-slate-500">
                      {s.viewIds.length} views · Rev {s.revision}
                    </p>
                  </button>
                ))}
                {!sheets.length && (
                  <p className="text-sm text-slate-500">No sheets created</p>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#101b29] p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold">Drawing Preview</h2>
                <p className="text-xs text-slate-400">
                  Schematic preview generated from shared BIM element records
                </p>
              </div>
              <div className="relative">
                <Search
                  className="absolute left-3 top-2.5 text-slate-500"
                  size={14}
                />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Filter model elements"
                  className="rounded-lg border border-white/10 bg-[#0a121d] py-2 pl-8 pr-3 text-xs"
                />
              </div>
            </div>

            <div className="print-area min-h-[440px] rounded-xl border border-white/10 bg-[#f8fafc] p-5 text-slate-900">
              <div className="flex items-start justify-between border-b border-slate-300 pb-3">
                <div>
                  <p className="text-[10px] font-bold tracking-[0.2em] text-slate-500">
                    APEXIVEAI · DESIGN & ENGINEERING
                  </p>
                  <h3 className="mt-1 text-xl font-semibold">
                    {activeSheet?.title ??
                      activeView?.name ??
                      "Drawing Preview"}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {activeSheet
                      ? `${activeSheet.number} · Revision ${activeSheet.revision} · ${activeSheet.status}`
                      : activeView
                      ? `${activeView.kind} · ${activeView.scale}`
                      : "Select a view or sheet"}
                  </p>
                </div>
                <div className="text-right text-[10px] text-slate-500">
                  PROJECT DOCUMENT
                  <br />
                  {bim?.project.name ?? "No Shared BIM Project"}
                </div>
              </div>

              {activeSheet ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {activeSheet.viewIds.map((id) => {
                    const v = views.find((item) => item.id === id);
                    return (
                      <div
                        key={id}
                        className="rounded border border-slate-300 p-3"
                      >
                        <p className="text-sm font-semibold">
                          {v?.name ?? "Missing view"}
                        </p>
                        <p className="text-[10px] text-slate-500">
                          {v?.kind} · {v?.scale}
                        </p>
                        <p className="mt-3 text-xs">
                          {(bim?.elements ?? []).length} project elements
                          available
                        </p>
                      </div>
                    );
                  })}
                  {activeSheet.viewIds.length === 0 && (
                    <p className="text-sm text-slate-500">
                      No views assigned to this sheet. Add the active view.
                    </p>
                  )}
                </div>
              ) : activeView ? (
                <>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-[10px] text-slate-500">
                    <span>VIEW: {activeView.kind}</span>
                    <span className="text-right">SCALE: {activeView.scale}</span>
                  </div>
                  <svg
                    viewBox="0 0 800 360"
                    className="mt-3 h-auto w-full border border-slate-300 bg-white"
                  >
                    <defs>
                      <pattern
                        id="doc-grid"
                        width="20"
                        height="20"
                        patternUnits="userSpaceOnUse"
                      >
                        <path
                          d="M 20 0 L 0 0 0 20"
                          fill="none"
                          stroke="#e2e8f0"
                          strokeWidth="1"
                        />
                      </pattern>
                    </defs>
                    <rect width="800" height="360" fill="url(#doc-grid)" />
                    {viewElements.slice(0, 100).map((el) => {
                      const x = 400 + el.transform.x * 12;
                      const y = 180 + el.transform.z * 12;
                      const w = Math.max(
                        8,
                        Math.min(180, el.dimensions.length * 12 || 18)
                      );
                      const h = Math.max(
                        6,
                        Math.min(120, el.dimensions.width * 12 || 10)
                      );
                      const isMep = el.discipline === "MEP";
                      return (
                        <g key={el.id}>
                          <rect
                            x={Math.max(2, Math.min(790, x - w / 2))}
                            y={Math.max(2, Math.min(350, y - h / 2))}
                            width={w}
                            height={h}
                            fill={
                              isMep
                                ? "#bfdbfe"
                                : el.discipline === "Structure"
                                ? "#fde68a"
                                : "#cbd5e1"
                            }
                            stroke={
                              isMep
                                ? "#2563eb"
                                : el.discipline === "Structure"
                                ? "#b45309"
                                : "#334155"
                            }
                            strokeWidth="1.5"
                          />
                          <title>{el.name}</title>
                        </g>
                      );
                    })}
                    <text x="12" y="22" fontSize="10" fill="#64748b">
                      SCHEMATIC MODEL VIEW · NOT A CONSTRUCTION-READY DRAWING
                    </text>
                  </svg>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-[10px]">
                    {["Architecture", "Structure", "MEP"].map((d) => (
                      <div key={d} className="rounded border border-slate-300 p-2">
                        <b>{d}</b>
                        <br />
                        {(bim?.elements ?? []).filter((e) => e.discipline === d)
                          .length}{" "}
                        elements
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex min-h-[300px] items-center justify-center text-sm text-slate-400">
                  Create or select a drawing view to preview
                </div>
              )}

              <div className="mt-4 border-t border-slate-300 pt-3">
                <p className="text-[10px] font-semibold text-slate-600">
                  ANNOTATIONS
                </p>
                {(activeSheet
                  ? annotations.filter((a) =>
                      activeSheet.viewIds.includes(a.viewId)
                    )
                  : viewAnnotations
                ).map((a) => (
                  <p key={a.id} className="mt-1 text-xs">
                    [{a.kind}] {a.text}
                  </p>
                ))}
                {annotations.length === 0 && (
                  <p className="mt-1 text-xs text-slate-400">No annotations</p>
                )}
              </div>

              <div className="mt-5 flex justify-between border-t border-slate-300 pt-2 text-[9px] text-slate-500">
                <span>APEXIVEAI DOCUMENT CONTROL</span>
                <span>{docDate}</span>
              </div>
            </div>
          </div>
        </section>

        <section className="no-print rounded-2xl border border-white/10 bg-[#101b29] p-5">
          <div className="mb-3 flex items-center gap-2">
            <Building2 size={17} />
            <h2 className="font-semibold">Model Element Schedule</h2>
            <span className="ml-auto text-xs text-slate-500">
              {filteredElements.length} records
            </span>
          </div>
          <div className="overflow-auto rounded-lg border border-white/10">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#142235] text-slate-400">
                <tr>
                  {[
                    "Element",
                    "Discipline",
                    "Category",
                    "Level",
                    "Material",
                    "Dimensions (m)",
                  ].map((h) => (
                    <th key={h} className="p-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredElements.slice(0, 300).map((e) => (
                  <tr key={e.id} className="border-t border-white/5">
                    <td className="p-3">{e.name}</td>
                    <td className="p-3">{e.discipline}</td>
                    <td className="p-3">{e.category}</td>
                    <td className="p-3">
                      {bim?.levels.find((l) => l.id === e.levelId)?.name ??
                        "—"}
                    </td>
                    <td className="p-3">{e.material ?? "—"}</td>
                    <td className="p-3">
                      {e.dimensions.length} × {e.dimensions.width} ×{" "}
                      {e.dimensions.height}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!filteredElements.length && (
              <p className="p-6 text-center text-slate-500">
                No BIM elements found. Import and save your discipline models in
                Shared BIM Core first.
              </p>
            )}
          </div>
        </section>

        <p className="text-center text-[11px] text-slate-600">
          {status} · Document metadata stored in this browser · Print/PDF uses
          the browser print dialog
        </p>
      </div>
      <div className="hidden p-8 print:block">
        <h1>APEXIVEAI CONSTRUCTION DOCUMENTATION</h1>
        <p>
          Use the on-screen Print / PDF action to print the active drawing
          sheet.
        </p>
      </div>
    </main>
  );
}