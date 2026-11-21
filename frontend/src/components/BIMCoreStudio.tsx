"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import {
  Activity,
  Building2,
  CheckCircle2,
  Download,
  FileUp,
  Grid3X3,
  Layers3,
  RefreshCw,
  Save,
  ShieldCheck,
  Workflow,
  ClipboardList,
  Component,
  Database,
} from "lucide-react";
import {
  addAudit,
  addProjectGrid,
  addProjectLevel,
  BIM_CORE_FORMAT,
  BIMProject,
  downloadBIMProject,
  importLegacyBrowserModels,
  loadBIMProject,
  saveBIMProject,
  validateBIMProject,
} from "@/lib/bim-core";

const number = (value: string, fallback = 0) =>
  Number.isFinite(Number(value)) ? Number(value) : fallback;

const INITIAL_PROJECT: BIMProject = {
  format: BIM_CORE_FORMAT,
  schemaVersion: 1,
  project: {
    id: "default-project",
    name: "ApexiveAI Engineering Project",
    units: "meters",
    createdAt: "",
    updatedAt: "",
  },
  levels: [
    {
      id: "level-01",
      name: "Level 01",
      elevation: 0,
      height: 3.2,
    },
  ],
  grids: [],
  elements: [],
  auditTrail: [],
};

export default function BIMCoreStudio() {
  const [project, setProject] = useState<BIMProject>(INITIAL_PROJECT);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState("Shared BIM Core initialized");
  const [selectedDiscipline, setSelectedDiscipline] = useState("All");
  const [query, setQuery] = useState("");
  const [levelName, setLevelName] = useState("Level 02");
  const [levelElevation, setLevelElevation] = useState("6.4");
  const [levelHeight, setLevelHeight] = useState("3.2");
  const [gridName, setGridName] = useState("Grid A");
  const [gridAxis, setGridAxis] = useState<"X" | "Z">("X");
  const [gridPosition, setGridPosition] = useState("0");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeDataTab, setActiveDataTab] = useState<
    "Overview" | "Authoring" | "Data" | "Management"
  >("Overview");
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    try {
      const stored = loadBIMProject();
      if (stored) {
        setProject(stored);
        setStatus("Existing shared BIM project loaded");
      } else {
        const stamp = new Date().toISOString();
        setProject((current) => ({
          ...current,
          project: {
            ...current.project,
            createdAt: current.project.createdAt || stamp,
            updatedAt: current.project.updatedAt || stamp,
          },
        }));
      }
    } catch (error) {
      setStatus(
        error instanceof Error
          ? `Saved project error: ${error.message}`
          : "Saved project could not be loaded"
      );
    } finally {
      setReady(true);
    }
  }, []);

  const visibleElements = useMemo(
    () =>
      project.elements.filter((element) => {
        const matchesDiscipline =
          selectedDiscipline === "All" ||
          element.discipline === selectedDiscipline;
        const term = query.trim().toLowerCase();
        const matchesQuery =
          !term ||
          `${element.name} ${element.category} ${element.id} ${
            element.material ?? ""
          }`
            .toLowerCase()
            .includes(term);
        return matchesDiscipline && matchesQuery;
      }),
    [project.elements, selectedDiscipline, query]
  );

  const selected =
    project.elements.find((item) => item.id === selectedId) ?? null;

  const counts = useMemo(
    () => ({
      Architecture: project.elements.filter(
        (item) => item.discipline === "Architecture"
      ).length,
      Structure: project.elements.filter(
        (item) => item.discipline === "Structure"
      ).length,
      MEP: project.elements.filter((item) => item.discipline === "MEP").length,
    }),
    [project.elements]
  );

  const relationshipCount = project.elements.filter(
    (item) =>
      item.relationships.hostId ||
      (item.relationships.connectedTo?.length ?? 0) > 0
  ).length;

  const validation = useMemo(() => validateBIMProject(project), [project]);

  const update = (next: BIMProject, message: string) => {
    setProject(next);
    setStatus(message);
  };

  const importLegacy = () => {
    try {
      const result = importLegacyBrowserModels(project);
      update(
        result.project,
        `Imported Architecture ${result.imported.Architecture}, Structure ${result.imported.Structure}, MEP ${result.imported.MEP}`
      );
      if (result.warnings.length) {
        setStatus((current) => `${current}. ${result.warnings.join("; ")}`);
      }
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Legacy import failed"
      );
    }
  };

  const save = () => {
    try {
      const saved = saveBIMProject(project);
      setProject(saved);
      setStatus(
        `Saved ${saved.elements.length} elements to shared BIM project`
      );
    } catch (error) {
      setStatus(
        error instanceof Error ? `Save failed: ${error.message}` : "Save failed"
      );
    }
  };

  const createLevel = () => {
    if (!levelName.trim() || number(levelHeight) <= 0) {
      setStatus("Enter a level name and a positive level height");
      return;
    }
    update(
      addProjectLevel(
        project,
        levelName,
        number(levelElevation),
        number(levelHeight)
      ),
      `Added level ${levelName}`
    );
    setLevelName(`Level ${String(project.levels.length + 1).padStart(2, "0")}`);
  };

  const createGrid = () => {
    if (!gridName.trim()) {
      setStatus("Enter a grid name");
      return;
    }
    update(
      addProjectGrid(project, gridName, gridAxis, number(gridPosition)),
      `Added grid ${gridName}`
    );
    setGridName(`Grid ${String.fromCharCode(65 + project.grids.length)}`);
  };

  const importFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const parsed: unknown = JSON.parse(await file.text());
      const result = validateBIMProject(parsed);
      if (!result.valid) throw new Error(result.errors.join("; "));
      const imported = addAudit(
        result.value,
        "project-imported",
        `Imported from ${file.name}`
      );
      setProject(imported);
      setStatus(
        `Imported ${imported.elements.length} BIM elements from ${file.name}`
      );
    } catch (error) {
      setStatus(
        error instanceof Error
          ? `Import rejected: ${error.message}`
          : "Import rejected"
      );
    } finally {
      event.target.value = "";
    }
  };

  const renameProject = (name: string) =>
    setProject((current) => ({
      ...current,
      project: {
        ...current.project,
        name,
        updatedAt: new Date().toISOString(),
      },
    }));

  if (!ready) {
    return (
      <main className="min-h-screen bg-[#080d15] p-8 text-slate-200">
        Loading Shared BIM Core…
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#080d15] text-slate-100">
      <header className="border-b border-white/10 bg-[#0b1420] px-5 py-4 md:px-8">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 p-3 text-cyan-300">
              <Workflow size={24} />
            </div>
            <div>
              <p className="text-xs font-semibold tracking-[0.24em] text-cyan-300">
                APEXIVEAI · ENGINEERING PLATFORM
              </p>
              <h1 className="text-xl font-semibold">Shared BIM Core</h1>
              <p className="text-xs text-slate-400">
                Unified project data across Architecture, Structure and MEP
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={importLegacy}
              className="inline-flex items-center gap-2 rounded-lg border border-cyan-400/30 px-3 py-2 text-sm text-cyan-200 hover:bg-cyan-400/10"
            >
              <RefreshCw size={15} /> Import Workspaces
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-sm hover:bg-white/5"
            >
              <FileUp size={15} /> Import BIM JSON
            </button>
            <button
              type="button"
              onClick={() => downloadBIMProject(project)}
              disabled={!validation.valid}
              className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-sm hover:bg-white/5 disabled:opacity-40"
            >
              <Download size={15} /> Export
            </button>
            <button
              type="button"
              onClick={save}
              disabled={!validation.valid}
              className="inline-flex items-center gap-2 rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-300 disabled:opacity-40"
            >
              <Save size={15} /> Save Project
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={importFile}
            />
          </div>
        </div>
      </header>

      <nav className="border-b border-white/10 bg-[#0a121d] px-5 md:px-8">
        <div className="mx-auto flex max-w-[1600px] gap-2 py-3">
          {(["Overview", "Authoring", "Data", "Management"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveDataTab(tab)}
              className={`rounded-lg px-3 py-2 text-xs ${
                activeDataTab === tab
                  ? "bg-cyan-400/15 text-cyan-200 ring-1 ring-cyan-300/25"
                  : "text-slate-400 hover:bg-white/5"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </nav>

      <div className="mx-auto max-w-[1600px] space-y-5 p-5 md:p-8">
        {activeDataTab === "Authoring" && (
          <section className="rounded-2xl border border-white/10 bg-[#101b29] p-5">
            <div className="mb-4 flex items-center gap-2">
              <Component size={17} className="text-cyan-300" />
              <h2 className="font-semibold">BIM Authoring Tools</h2>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
              {[
                "Wall", "Floor", "Roof", "Ceiling", "Door", "Window",
                "Stair", "Railing", "Column", "Beam", "Foundation",
                "Room & Space", "Curtain Wall", "Component",
                "Parametric Family", "Type & Instance Properties",
              ].map((tool) => (
                <button
                  key={tool}
                  type="button"
                  onClick={() => setStatus(`${tool} authoring tool selected`)}
                  className="rounded-lg border border-white/10 bg-[#0a121d] px-3 py-3 text-left text-xs text-slate-300 hover:border-cyan-300/30 hover:bg-cyan-400/[0.06]"
                >
                  {tool}
                </button>
              ))}
            </div>
          </section>
        )}

        {activeDataTab === "Data" && (
          <section className="rounded-2xl border border-white/10 bg-[#101b29] p-5">
            <div className="mb-4 flex items-center gap-2">
              <Database size={17} className="text-cyan-300" />
              <h2 className="font-semibold">BIM Data Structure</h2>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {[
                "BIM Project", "BIM Model", "BIM Model Version", "Building",
                "Building Storey", "Levels", "Grids", "Spaces", "Zones",
                "Elements", "Element Types", "Families", "Family Types",
                "Parameters", "Shared Parameters", "Materials", "Assemblies",
                "Element Relationships", "Element Constraints",
                "Element Classification",
              ].map((item) => (
                <div key={item} className="rounded-lg border border-white/[0.07] bg-[#0a121d] px-3 py-2.5">
                  <p className="text-xs text-slate-200">{item}</p>
                  <p className="mt-1 text-[10px] text-emerald-400">Available in shared data model</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {activeDataTab === "Management" && (
          <section className="rounded-2xl border border-white/10 bg-[#101b29] p-5">
            <div className="mb-4 flex items-center gap-2">
              <ClipboardList size={17} className="text-cyan-300" />
              <h2 className="font-semibold">BIM Data Management</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["Element Properties", `${project.elements.length} records`],
                ["Element Schedules", `${project.levels.length} levels`],
                ["Quantity Takeoff", "Dimension-based quantities"],
                ["Material Takeoff", "Material roll-up"],
                ["Element Revision", "Revision snapshots"],
                ["Model Versioning", "Named model versions"],
                ["Model History", `${project.auditTrail.length} audit events`],
                ["Change Tracking", "Source and shared changes"],
                ["Model Validation", validation.valid ? "Schema valid" : "Errors found"],
                ["Model Audit", "Audit trail ready"],
              ].map(([title, detail]) => (
                <button
                  key={title}
                  type="button"
                  onClick={() => setStatus(`${title} opened`)}
                  className="rounded-lg border border-white/[0.07] bg-[#0a121d] p-3 text-left"
                >
                  <p className="text-xs font-medium text-slate-200">{title}</p>
                  <p className="mt-2 text-[10px] text-slate-500">{detail}</p>
                </button>
              ))}
            </div>
          </section>
        )}
        <section className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
          <div className="rounded-2xl border border-white/10 bg-[#101b29] p-5">
            <div className="mb-3 flex items-center gap-2 text-sm text-slate-400">
              <Building2 size={16} /> BIM PROJECT
            </div>
            <input
              value={project.project.name}
              onChange={(event) => renameProject(event.target.value)}
              className="w-full border-b border-white/10 bg-transparent pb-2 text-2xl font-semibold outline-none focus:border-cyan-400"
            />
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-400">
              <span>Units: meters</span>
              <span>Schema: v{project.schemaVersion}</span>
              <span>Project ID: {project.project.id}</span>
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#101b29] p-5">
            <div className="mb-3 flex items-center gap-2 text-sm text-slate-400">
              <ShieldCheck size={16} /> MODEL VALIDATION
            </div>
            <div className="flex items-center gap-2 text-lg font-semibold">
              {validation.valid ? (
                <CheckCircle2 className="text-emerald-400" />
              ) : (
                <Activity className="text-rose-400" />
              )}
              {validation.valid ? "Schema valid" : "Validation errors"}
            </div>
            <p className="mt-2 text-xs text-slate-400">
              {validation.valid
                ? `${project.elements.length} elements · ${project.levels.length} levels · ${project.grids.length} grids`
                : validation.errors.join(" · ")}
            </p>
            <p className="mt-3 text-xs text-slate-500">{status}</p>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {(
            [
              {
                label: "Architecture",
                value: counts.Architecture,
                icon: <Building2 />,
                color: "text-sky-300",
              },
              {
                label: "Structure",
                value: counts.Structure,
                icon: <Layers3 />,
                color: "text-amber-300",
              },
              {
                label: "MEP",
                value: counts.MEP,
                icon: <Activity />,
                color: "text-emerald-300",
              },
              {
                label: "Relationships",
                value: relationshipCount,
                icon: <Workflow />,
                color: "text-violet-300",
              },
            ] as const
          ).map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-white/10 bg-[#101b29] p-4"
            >
              <div className={`mb-3 ${item.color}`}>{item.icon}</div>
              <p className="text-2xl font-semibold">{item.value}</p>
              <p className="text-xs text-slate-400">{item.label}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-5 xl:grid-cols-[1.45fr_1fr]">
          <div className="rounded-2xl border border-white/10 bg-[#101b29] p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold">Unified Model Elements</h2>
                <p className="text-xs text-slate-400">
                  Normalized discipline records with preserved source properties
                </p>
              </div>
              <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-400">
                {visibleElements.length} shown
              </span>
            </div>
            <div className="mb-3 flex flex-wrap gap-2">
              <select
                value={selectedDiscipline}
                onChange={(event) => setSelectedDiscipline(event.target.value)}
                className="rounded-lg border border-white/10 bg-[#0a121d] px-3 py-2 text-sm"
              >
                <option>All</option>
                <option>Architecture</option>
                <option>Structure</option>
                <option>MEP</option>
              </select>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search name, category, material…"
                className="min-w-[180px] flex-1 rounded-lg border border-white/10 bg-[#0a121d] px-3 py-2 text-sm outline-none focus:border-cyan-400"
              />
            </div>
            <div className="max-h-[470px] overflow-auto rounded-xl border border-white/10">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-[#142235] text-xs text-slate-400">
                  <tr>
                    <th className="p-3">Element</th>
                    <th className="p-3">Discipline</th>
                    <th className="p-3">Category</th>
                    <th className="p-3">Level</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleElements.map((element) => (
                    <tr
                      key={element.id}
                      onClick={() => setSelectedId(element.id)}
                      className={`cursor-pointer border-t border-white/5 hover:bg-white/5 ${
                        selectedId === element.id ? "bg-cyan-400/10" : ""
                      }`}
                    >
                      <td className="p-3">
                        <p className="font-medium">{element.name}</p>
                        <p className="text-[10px] text-slate-500">
                          {element.id}
                        </p>
                      </td>
                      <td className="p-3 text-slate-300">
                        {element.discipline}
                      </td>
                      <td className="p-3 text-slate-400">
                        {element.category}
                      </td>
                      <td className="p-3 text-slate-400">
                        {project.levels.find(
                          (level) => level.id === element.levelId
                        )?.name ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {visibleElements.length === 0 && (
                <p className="p-8 text-center text-sm text-slate-500">
                  No elements. Import the existing discipline workspaces to begin.
                </p>
              )}
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-2xl border border-white/10 bg-[#101b29] p-5">
              <h2 className="mb-1 font-semibold">Element Properties</h2>
              <p className="mb-4 text-xs text-slate-400">
                Select an element from the unified model table
              </p>
              {selected ? (
                <div className="space-y-3 text-sm">
                  <div>
                    <p className="text-xs text-slate-500">Name</p>
                    <p className="font-medium">{selected.name}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-slate-500">Discipline</p>
                      {selected.discipline}
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Material</p>
                      {selected.material ?? "Not specified"}
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Position (X,Y,Z)</p>
                      {selected.transform.x.toFixed(2)},{" "}
                      {selected.transform.y.toFixed(2)},{" "}
                      {selected.transform.z.toFixed(2)}
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">
                        Dimensions (L,W,H)
                      </p>
                      {selected.dimensions.length.toFixed(2)},{" "}
                      {selected.dimensions.width.toFixed(2)},{" "}
                      {selected.dimensions.height.toFixed(2)}
                    </div>
                  </div>
                  <div className="rounded-lg bg-[#0a121d] p-3">
                    <p className="mb-1 text-xs text-slate-500">
                      Preserved source properties
                    </p>
                    <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all text-[10px] text-slate-300">
                      {JSON.stringify(selected.properties, null, 2)}
                    </pre>
                  </div>
                </div>
              ) : (
                <p className="rounded-lg bg-[#0a121d] p-5 text-sm text-slate-500">
                  No element selected
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#101b29] p-5">
              <div className="mb-4 flex items-center gap-2">
                <Layers3 size={17} className="text-cyan-300" />
                <h2 className="font-semibold">Project Levels</h2>
              </div>
              <div className="space-y-2">
                {project.levels.map((level) => (
                  <div
                    key={level.id}
                    className="flex items-center justify-between rounded-lg bg-[#0a121d] px-3 py-2 text-sm"
                  >
                    <span>{level.name}</span>
                    <span className="text-xs text-slate-400">
                      {level.elevation.toFixed(2)} m
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                <input
                  value={levelName}
                  onChange={(e) => setLevelName(e.target.value)}
                  aria-label="Level name"
                  className="col-span-3 rounded-lg border border-white/10 bg-[#0a121d] px-3 py-2 text-xs"
                />
                <input
                  value={levelElevation}
                  onChange={(e) => setLevelElevation(e.target.value)}
                  aria-label="Elevation"
                  type="number"
                  step="0.1"
                  className="rounded-lg border border-white/10 bg-[#0a121d] px-2 py-2 text-xs"
                />
                <input
                  value={levelHeight}
                  onChange={(e) => setLevelHeight(e.target.value)}
                  aria-label="Height"
                  type="number"
                  step="0.1"
                  className="rounded-lg border border-white/10 bg-[#0a121d] px-2 py-2 text-xs"
                />
                <button
                  type="button"
                  onClick={createLevel}
                  className="rounded-lg bg-white/10 px-2 py-2 text-xs hover:bg-white/15"
                >
                  Add Level
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#101b29] p-5">
              <div className="mb-4 flex items-center gap-2">
                <Grid3X3 size={17} className="text-cyan-300" />
                <h2 className="font-semibold">Shared Grids</h2>
              </div>
              <div className="space-y-2">
                {project.grids.map((grid) => (
                  <div
                    key={grid.id}
                    className="flex items-center justify-between rounded-lg bg-[#0a121d] px-3 py-2 text-sm"
                  >
                    <span>
                      {grid.name}{" "}
                      <span className="text-xs text-slate-500">
                        ({grid.axis})
                      </span>
                    </span>
                    <span className="text-xs text-slate-400">
                      {grid.position.toFixed(2)} m
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                <input
                  value={gridName}
                  onChange={(e) => setGridName(e.target.value)}
                  aria-label="Grid name"
                  className="col-span-3 rounded-lg border border-white/10 bg-[#0a121d] px-3 py-2 text-xs"
                />
                <select
                  value={gridAxis}
                  onChange={(e) => setGridAxis(e.target.value as "X" | "Z")}
                  aria-label="Grid axis"
                  className="rounded-lg border border-white/10 bg-[#0a121d] px-2 py-2 text-xs"
                >
                  <option value="X">X Axis</option>
                  <option value="Z">Z Axis</option>
                </select>
                <input
                  value={gridPosition}
                  onChange={(e) => setGridPosition(e.target.value)}
                  aria-label="Grid position"
                  type="number"
                  step="0.1"
                  className="rounded-lg border border-white/10 bg-[#0a121d] px-2 py-2 text-xs"
                />
                <button
                  type="button"
                  onClick={createGrid}
                  className="rounded-lg bg-white/10 px-2 py-2 text-xs hover:bg-white/15"
                >
                  Add Grid
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-[#101b29] p-5">
          <div className="mb-3 flex items-center gap-2">
            <Activity size={17} className="text-cyan-300" />
            <h2 className="font-semibold">Audit Trail</h2>
            <span className="ml-auto text-xs text-slate-500">
              Latest {Math.min(project.auditTrail.length, 8)} events
            </span>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {project.auditTrail.slice(0, 8).map((entry) => (
              <div key={entry.id} className="rounded-lg bg-[#0a121d] p-3">
                <p className="text-xs font-medium text-slate-200">
                  {entry.message}
                </p>
                <p className="mt-1 text-[10px] text-slate-500">
                  {entry.timestamp.slice(0, 19).replace("T", " ")} ·{" "}
                  {entry.action}
                </p>
              </div>
            ))}
          </div>
        </section>

        <p className="text-center text-[11px] text-slate-600">
          {BIM_CORE_FORMAT} · Native ApexiveAI schema · Local browser
          persistence · JSON interchange
        </p>
      </div>
    </main>
  );
}