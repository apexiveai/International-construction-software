"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  Activity,
  AlertTriangle,
  CalendarDays,
  Construction,
  Download,
  Plus,
  Save,
  Search,
  ShieldAlert,
  Truck,
  Users,
  X,
} from "lucide-react";

type Project = {
  id: string;
  code?: string;
  name: string;
  client?: string;
  status?: string;
};
type Diary = {
  id: string;
  projectId: string;
  date: string;
  weather: string;
  location: string;
  work: string;
  delay: string;
  preparedBy: string;
  notes: string;
};
type Manpower = {
  id: string;
  projectId: string;
  date: string;
  trade: string;
  contractor: string;
  headcount: number;
  hours: number;
};
type Equipment = {
  id: string;
  projectId: string;
  date: string;
  name: string;
  assetCode: string;
  hours: number;
  status: "Operational" | "Idle" | "Maintenance";
  operator: string;
};
type Material = {
  id: string;
  projectId: string;
  date: string;
  name: string;
  unit: string;
  quantity: number;
  activity: string;
  supplier: string;
};
type Inspection = {
  id: string;
  projectId: string;
  date: string;
  reference: string;
  area: string;
  type: string;
  inspector: string;
  result: "Passed" | "Failed" | "Pending";
  correctiveAction: string;
};
type Incident = {
  id: string;
  projectId: string;
  date: string;
  severity: "Low" | "Medium" | "High" | "Critical";
  category: string;
  location: string;
  description: string;
  action: string;
  status: "Open" | "Investigating" | "Closed";
};
type Issue = {
  id: string;
  projectId: string;
  date: string;
  title: string;
  owner: string;
  priority: "Low" | "Medium" | "High" | "Critical";
  status: "Open" | "In Progress" | "Resolved";
  dueDate: string;
  description: string;
};
type Workspace = {
  format: "ApexiveAI-Construction-Operations";
  version: 1;
  projects: Project[];
  diaries: Diary[];
  manpower: Manpower[];
  equipment: Equipment[];
  materials: Material[];
  inspections: Inspection[];
  incidents: Incident[];
  issues: Issue[];
  updatedAt: string;
};
type Tab =
  | "Overview"
  | "Site Diary"
  | "Manpower"
  | "Equipment"
  | "Materials"
  | "Inspections"
  | "Safety"
  | "Site Issues";

const KEY = "apexiveai-construction-operations-v1";
const PM_KEY = "apexiveai-project-management-v1";
const uid = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

const panel =
  "rounded-2xl border border-white/10 bg-[#0b1420] p-4 shadow-xl shadow-black/10";
const field =
  "w-full rounded-xl border border-white/10 bg-[#07111c] px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-400/60";
const primary =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-cyan-300";
const secondary =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-medium text-slate-200 hover:bg-white/[0.08]";
const tabs: Tab[] = [
  "Overview",
  "Site Diary",
  "Manpower",
  "Equipment",
  "Materials",
  "Inspections",
  "Safety",
  "Site Issues",
];

function download(name: string, content: string) {
  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function readProjects(): Project[] {
  try {
    if (typeof window === "undefined") return [];
    const raw = window.localStorage.getItem(PM_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !Array.isArray((parsed as { projects?: unknown }).projects)
    ) {
      return [];
    }
    return (parsed as { projects: unknown[] }).projects
      .filter(
        (item): item is Record<string, unknown> =>
          typeof item === "object" && item !== null
      )
      .map((p) => ({
        id: String(p.id ?? ""),
        code: typeof p.code === "string" ? p.code : "",
        name: typeof p.name === "string" ? p.name : "Untitled project",
        client: typeof p.client === "string" ? p.client : "",
        status: typeof p.status === "string" ? p.status : "Planning",
      }));
  } catch {
    return [];
  }
}

function Stat({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: typeof Activity;
}) {
  return (
    <div className={panel}>
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400">{label}</span>
        <Icon size={17} className="text-cyan-300" />
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-[10px] text-slate-500">{detail}</p>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="grid min-h-28 place-items-center px-4 text-center text-xs text-slate-500">
      {text}
    </div>
  );
}

export default function ConstructionOperationsStudio() {
  const [tab, setTab] = useState<Tab>("Overview");
  const [ready, setReady] = useState(false);
  const [currentDate, setCurrentDate] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState("");
  const [diaries, setDiaries] = useState<Diary[]>([]);
  const [manpower, setManpower] = useState<Manpower[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [message, setMessage] = useState(
    "Site workspace ready · Browser-local mode"
  );
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);

  const [diaryForm, setDiaryForm] = useState({
    date: "",
    weather: "Clear",
    location: "",
    work: "",
    delay: "",
    preparedBy: "",
    notes: "",
  });
  const [manpowerForm, setManpowerForm] = useState({
    date: "",
    trade: "General Worker",
    contractor: "",
    headcount: "1",
    hours: "8",
  });
  const [equipmentForm, setEquipmentForm] = useState({
    date: "",
    name: "",
    assetCode: "",
    hours: "0",
    status: "Operational" as Equipment["status"],
    operator: "",
  });
  const [materialForm, setMaterialForm] = useState({
    date: "",
    name: "",
    unit: "pcs",
    quantity: "0",
    activity: "",
    supplier: "",
  });
  const [inspectionForm, setInspectionForm] = useState({
    date: "",
    reference: "",
    area: "",
    type: "Workmanship",
    inspector: "",
    result: "Pending" as Inspection["result"],
    correctiveAction: "",
  });
  const [incidentForm, setIncidentForm] = useState({
    date: "",
    severity: "Medium" as Incident["severity"],
    category: "Near Miss",
    location: "",
    description: "",
    action: "",
  });
  const [issueForm, setIssueForm] = useState({
    date: "",
    title: "",
    owner: "",
    priority: "Medium" as Issue["priority"],
    status: "Open" as Issue["status"],
    dueDate: "",
    description: "",
  });

  useEffect(() => {
    const day = new Date().toISOString().slice(0, 10);
    setCurrentDate(day);
    setDiaryForm((v) => ({ ...v, date: v.date || day }));
    setManpowerForm((v) => ({ ...v, date: v.date || day }));
    setEquipmentForm((v) => ({ ...v, date: v.date || day }));
    setMaterialForm((v) => ({ ...v, date: v.date || day }));
    setInspectionForm((v) => ({ ...v, date: v.date || day }));
    setIncidentForm((v) => ({ ...v, date: v.date || day }));
    setIssueForm((v) => ({ ...v, date: v.date || day }));

    try {
      const linked = readProjects();
      setProjects(linked);
      if (linked[0]) setSelectedProject(linked[0].id);

      const raw = localStorage.getItem(KEY);
      if (raw) {
        const d = JSON.parse(raw) as Partial<Workspace>;
        if (
          d.format === "ApexiveAI-Construction-Operations" &&
          d.version === 1
        ) {
          setDiaries(Array.isArray(d.diaries) ? d.diaries : []);
          setManpower(Array.isArray(d.manpower) ? d.manpower : []);
          setEquipment(Array.isArray(d.equipment) ? d.equipment : []);
          setMaterials(Array.isArray(d.materials) ? d.materials : []);
          setInspections(Array.isArray(d.inspections) ? d.inspections : []);
          setIncidents(Array.isArray(d.incidents) ? d.incidents : []);
          setIssues(Array.isArray(d.issues) ? d.issues : []);
        }
      }
    } catch {
      setMessage("Could not read saved workspace · Starting fresh");
    } finally {
      setReady(true);
    }
  }, []);

  const buildWorkspace = (): Workspace => ({
    format: "ApexiveAI-Construction-Operations",
    version: 1,
    projects,
    diaries,
    manpower,
    equipment,
    materials,
    inspections,
    incidents,
    issues,
    updatedAt: new Date().toISOString(),
  });

  const save = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(buildWorkspace()));
      setMessage(
        `Saved · ${projects.length} projects · ${diaries.length} diary entries · ${issues.length} issues`
      );
    } catch {
      setMessage("Save failed · Browser storage may be full");
    }
  };

  const syncProjects = () => {
    const linked = readProjects();
    setProjects(linked);
    if (!linked.some((p) => p.id === selectedProject)) {
      setSelectedProject(linked[0]?.id ?? "");
    }
    setMessage(
      `Project list refreshed · ${linked.length} projects from Project Management`
    );
  };

  const projectName = (id: string) =>
    projects.find((p) => p.id === id)?.name ?? "Unknown project";

  const scoped = <T extends { projectId: string }>(items: T[]) =>
    items.filter((x) => !selectedProject || x.projectId === selectedProject);

  const scopedDiaries = useMemo(
    () => scoped(diaries),
    [diaries, selectedProject]
  );
  const scopedManpower = useMemo(
    () => scoped(manpower),
    [manpower, selectedProject]
  );
  const scopedEquipment = useMemo(
    () => scoped(equipment),
    [equipment, selectedProject]
  );
  const scopedMaterials = useMemo(
    () => scoped(materials),
    [materials, selectedProject]
  );
  const scopedInspections = useMemo(
    () => scoped(inspections),
    [inspections, selectedProject]
  );
  const scopedIncidents = useMemo(
    () => scoped(incidents),
    [incidents, selectedProject]
  );
  const scopedIssues = useMemo(
    () => scoped(issues),
    [issues, selectedProject]
  );

  const totalHeadcount = currentDate
    ? scopedManpower
        .filter((x) => x.date === currentDate)
        .reduce((n, x) => n + x.headcount, 0)
    : 0;
  const openIncidents = scopedIncidents.filter(
    (x) => x.status !== "Closed"
  ).length;
  const openIssues = scopedIssues.filter((x) => x.status !== "Resolved").length;
  const todayDiary = currentDate
    ? scopedDiaries.filter((x) => x.date === currentDate).length
    : 0;

  const recordCount =
    tab === "Site Diary"
      ? scopedDiaries.length
      : tab === "Manpower"
      ? scopedManpower.length
      : tab === "Equipment"
      ? scopedEquipment.length
      : tab === "Materials"
      ? scopedMaterials.length
      : tab === "Inspections"
      ? scopedInspections.length
      : tab === "Safety"
      ? scopedIncidents.length
      : scopedIssues.length;

  const addDiary = (e: FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !diaryForm.work.trim()) return;
    setDiaries((v) => [
      {
        id: uid("diary"),
        projectId: selectedProject,
        ...diaryForm,
        date: diaryForm.date || currentDate,
        work: diaryForm.work.trim(),
      },
      ...v,
    ]);
    setShowForm(false);
    setMessage("Site diary entry added · Save workspace to persist");
  };

  const addManpower = (e: FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !manpowerForm.trade.trim()) return;
    setManpower((v) => [
      {
        id: uid("labor"),
        projectId: selectedProject,
        ...manpowerForm,
        date: manpowerForm.date || currentDate,
        headcount: Math.max(0, Number(manpowerForm.headcount) || 0),
        hours: Math.max(0, Number(manpowerForm.hours) || 0),
      },
      ...v,
    ]);
    setShowForm(false);
    setMessage("Manpower record added · Save workspace to persist");
  };

  const addEquipment = (e: FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !equipmentForm.name.trim()) return;
    setEquipment((v) => [
      {
        id: uid("equipment"),
        projectId: selectedProject,
        ...equipmentForm,
        date: equipmentForm.date || currentDate,
        hours: Math.max(0, Number(equipmentForm.hours) || 0),
      },
      ...v,
    ]);
    setShowForm(false);
    setMessage("Equipment log added · Save workspace to persist");
  };

  const addMaterial = (e: FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !materialForm.name.trim()) return;
    setMaterials((v) => [
      {
        id: uid("material"),
        projectId: selectedProject,
        ...materialForm,
        date: materialForm.date || currentDate,
        quantity: Math.max(0, Number(materialForm.quantity) || 0),
      },
      ...v,
    ]);
    setShowForm(false);
    setMessage("Material usage recorded · Save workspace to persist");
  };

  const addInspection = (e: FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !inspectionForm.reference.trim()) return;
    setInspections((v) => [
      {
        id: uid("inspection"),
        projectId: selectedProject,
        ...inspectionForm,
        date: inspectionForm.date || currentDate,
      },
      ...v,
    ]);
    setShowForm(false);
    setMessage("Inspection record added · Save workspace to persist");
  };

  const addIncident = (e: FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !incidentForm.description.trim()) return;
    setIncidents((v) => [
      {
        id: uid("incident"),
        projectId: selectedProject,
        ...incidentForm,
        date: incidentForm.date || currentDate,
        status: "Open",
      },
      ...v,
    ]);
    setShowForm(false);
    setMessage("Safety incident recorded · Follow up immediately");
  };

  const addIssue = (e: FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !issueForm.title.trim()) return;
    setIssues((v) => [
      {
        id: uid("issue"),
        projectId: selectedProject,
        ...issueForm,
        date: issueForm.date || currentDate,
        title: issueForm.title.trim(),
      },
      ...v,
    ]);
    setShowForm(false);
    setMessage("Site issue created · Save workspace to persist");
  };

  const form = () => {
    const common = (
      <div className="flex items-center justify-between md:col-span-2">
        <h3 className="font-semibold">New {tab} Record</h3>
        <button
          type="button"
          className="text-slate-400"
          onClick={() => setShowForm(false)}
        >
          <X size={17} />
        </button>
      </div>
    );
    if (tab === "Site Diary")
      return (
        <form
          onSubmit={addDiary}
          className={`${panel} grid gap-3 md:grid-cols-2`}
        >
          {common}
          <div className="grid gap-3 md:col-span-2 md:grid-cols-2">
            <input
              className={field}
              type="date"
              value={diaryForm.date}
              onChange={(e) =>
                setDiaryForm((v) => ({ ...v, date: e.target.value }))
              }
            />
            <select
              className={field}
              value={diaryForm.weather}
              onChange={(e) =>
                setDiaryForm((v) => ({ ...v, weather: e.target.value }))
              }
            >
              {["Clear", "Cloudy", "Rain", "Storm", "Extreme Heat"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
            <input
              className={field}
              placeholder="Site location / zone"
              value={diaryForm.location}
              onChange={(e) =>
                setDiaryForm((v) => ({ ...v, location: e.target.value }))
              }
            />
            <input
              className={field}
              placeholder="Prepared by"
              value={diaryForm.preparedBy}
              onChange={(e) =>
                setDiaryForm((v) => ({ ...v, preparedBy: e.target.value }))
              }
            />
            <textarea
              className={`${field} md:col-span-2`}
              placeholder="Work completed today"
              value={diaryForm.work}
              onChange={(e) =>
                setDiaryForm((v) => ({ ...v, work: e.target.value }))
              }
              required
            />
            <textarea
              className={`${field} md:col-span-2`}
              placeholder="Delays / constraints"
              value={diaryForm.delay}
              onChange={(e) =>
                setDiaryForm((v) => ({ ...v, delay: e.target.value }))
              }
            />
            <textarea
              className={`${field} md:col-span-2`}
              placeholder="Additional notes"
              value={diaryForm.notes}
              onChange={(e) =>
                setDiaryForm((v) => ({ ...v, notes: e.target.value }))
              }
            />
          </div>
          <button className={`${primary} md:col-span-2`}>
            <Plus size={15} /> Add Diary Entry
          </button>
        </form>
      );
    if (tab === "Manpower")
      return (
        <form
          onSubmit={addManpower}
          className={`${panel} grid gap-3 md:grid-cols-3`}
        >
          {common}
          <input
            className={field}
            type="date"
            value={manpowerForm.date}
            onChange={(e) =>
              setManpowerForm((v) => ({ ...v, date: e.target.value }))
            }
          />
          <input
            className={field}
            placeholder="Trade / crew"
            value={manpowerForm.trade}
            onChange={(e) =>
              setManpowerForm((v) => ({ ...v, trade: e.target.value }))
            }
          />
          <input
            className={field}
            placeholder="Subcontractor"
            value={manpowerForm.contractor}
            onChange={(e) =>
              setManpowerForm((v) => ({ ...v, contractor: e.target.value }))
            }
          />
          <input
            className={field}
            type="number"
            min="0"
            placeholder="Headcount"
            value={manpowerForm.headcount}
            onChange={(e) =>
              setManpowerForm((v) => ({ ...v, headcount: e.target.value }))
            }
          />
          <input
            className={field}
            type="number"
            min="0"
            step="0.5"
            placeholder="Hours per worker"
            value={manpowerForm.hours}
            onChange={(e) =>
              setManpowerForm((v) => ({ ...v, hours: e.target.value }))
            }
          />
          <button className={primary}>
            <Plus size={15} /> Add Crew Log
          </button>
        </form>
      );
    if (tab === "Equipment")
      return (
        <form
          onSubmit={addEquipment}
          className={`${panel} grid gap-3 md:grid-cols-3`}
        >
          {common}
          <input
            className={field}
            type="date"
            value={equipmentForm.date}
            onChange={(e) =>
              setEquipmentForm((v) => ({ ...v, date: e.target.value }))
            }
          />
          <input
            className={field}
            placeholder="Equipment name"
            value={equipmentForm.name}
            onChange={(e) =>
              setEquipmentForm((v) => ({ ...v, name: e.target.value }))
            }
            required
          />
          <input
            className={field}
            placeholder="Asset / plate number"
            value={equipmentForm.assetCode}
            onChange={(e) =>
              setEquipmentForm((v) => ({ ...v, assetCode: e.target.value }))
            }
          />
          <input
            className={field}
            placeholder="Operating hours"
            type="number"
            min="0"
            step="0.5"
            value={equipmentForm.hours}
            onChange={(e) =>
              setEquipmentForm((v) => ({ ...v, hours: e.target.value }))
            }
          />
          <select
            className={field}
            value={equipmentForm.status}
            onChange={(e) =>
              setEquipmentForm((v) => ({
                ...v,
                status: e.target.value as Equipment["status"],
              }))
            }
          >
            <option>Operational</option>
            <option>Idle</option>
            <option>Maintenance</option>
          </select>
          <input
            className={field}
            placeholder="Operator"
            value={equipmentForm.operator}
            onChange={(e) =>
              setEquipmentForm((v) => ({ ...v, operator: e.target.value }))
            }
          />
          <button className={primary}>
            <Plus size={15} /> Add Equipment Log
          </button>
        </form>
      );
    if (tab === "Materials")
      return (
        <form
          onSubmit={addMaterial}
          className={`${panel} grid gap-3 md:grid-cols-3`}
        >
          {common}
          <input
            className={field}
            type="date"
            value={materialForm.date}
            onChange={(e) =>
              setMaterialForm((v) => ({ ...v, date: e.target.value }))
            }
          />
          <input
            className={field}
            placeholder="Material name"
            value={materialForm.name}
            onChange={(e) =>
              setMaterialForm((v) => ({ ...v, name: e.target.value }))
            }
            required
          />
          <input
            className={field}
            placeholder="Unit (m³, kg, pcs...)"
            value={materialForm.unit}
            onChange={(e) =>
              setMaterialForm((v) => ({ ...v, unit: e.target.value }))
            }
          />
          <input
            className={field}
            type="number"
            min="0"
            step="0.001"
            placeholder="Quantity"
            value={materialForm.quantity}
            onChange={(e) =>
              setMaterialForm((v) => ({ ...v, quantity: e.target.value }))
            }
          />
          <input
            className={field}
            placeholder="Work activity / zone"
            value={materialForm.activity}
            onChange={(e) =>
              setMaterialForm((v) => ({ ...v, activity: e.target.value }))
            }
          />
          <input
            className={field}
            placeholder="Supplier"
            value={materialForm.supplier}
            onChange={(e) =>
              setMaterialForm((v) => ({ ...v, supplier: e.target.value }))
            }
          />
          <button className={primary}>
            <Plus size={15} /> Record Material
          </button>
        </form>
      );
    if (tab === "Inspections")
      return (
        <form
          onSubmit={addInspection}
          className={`${panel} grid gap-3 md:grid-cols-3`}
        >
          {common}
          <input
            className={field}
            type="date"
            value={inspectionForm.date}
            onChange={(e) =>
              setInspectionForm((v) => ({ ...v, date: e.target.value }))
            }
          />
          <input
            className={field}
            placeholder="Inspection / RFI reference"
            value={inspectionForm.reference}
            onChange={(e) =>
              setInspectionForm((v) => ({ ...v, reference: e.target.value }))
            }
            required
          />
          <input
            className={field}
            placeholder="Area / grid / level"
            value={inspectionForm.area}
            onChange={(e) =>
              setInspectionForm((v) => ({ ...v, area: e.target.value }))
            }
          />
          <input
            className={field}
            placeholder="Inspection type"
            value={inspectionForm.type}
            onChange={(e) =>
              setInspectionForm((v) => ({ ...v, type: e.target.value }))
            }
          />
          <input
            className={field}
            placeholder="Inspector"
            value={inspectionForm.inspector}
            onChange={(e) =>
              setInspectionForm((v) => ({ ...v, inspector: e.target.value }))
            }
          />
          <select
            className={field}
            value={inspectionForm.result}
            onChange={(e) =>
              setInspectionForm((v) => ({
                ...v,
                result: e.target.value as Inspection["result"],
              }))
            }
          >
            <option>Pending</option>
            <option>Passed</option>
            <option>Failed</option>
          </select>
          <textarea
            className={`${field} md:col-span-2`}
            placeholder="Corrective action / comments"
            value={inspectionForm.correctiveAction}
            onChange={(e) =>
              setInspectionForm((v) => ({
                ...v,
                correctiveAction: e.target.value,
              }))
            }
          />
          <button className={primary}>
            <Plus size={15} /> Add Inspection
          </button>
        </form>
      );
    if (tab === "Safety")
      return (
        <form
          onSubmit={addIncident}
          className={`${panel} grid gap-3 md:grid-cols-2`}
        >
          {common}
          <input
            className={field}
            type="date"
            value={incidentForm.date}
            onChange={(e) =>
              setIncidentForm((v) => ({ ...v, date: e.target.value }))
            }
          />
          <select
            className={field}
            value={incidentForm.severity}
            onChange={(e) =>
              setIncidentForm((v) => ({
                ...v,
                severity: e.target.value as Incident["severity"],
              }))
            }
          >
            {["Low", "Medium", "High", "Critical"].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
          <input
            className={field}
            placeholder="Incident category"
            value={incidentForm.category}
            onChange={(e) =>
              setIncidentForm((v) => ({ ...v, category: e.target.value }))
            }
          />
          <input
            className={field}
            placeholder="Location"
            value={incidentForm.location}
            onChange={(e) =>
              setIncidentForm((v) => ({ ...v, location: e.target.value }))
            }
          />
          <textarea
            className={`${field} md:col-span-2`}
            placeholder="Incident / near-miss description"
            value={incidentForm.description}
            onChange={(e) =>
              setIncidentForm((v) => ({ ...v, description: e.target.value }))
            }
            required
          />
          <textarea
            className={`${field} md:col-span-2`}
            placeholder="Immediate action taken"
            value={incidentForm.action}
            onChange={(e) =>
              setIncidentForm((v) => ({ ...v, action: e.target.value }))
            }
          />
          <button className={`${primary} md:col-span-2`}>
            <Plus size={15} /> Record Safety Incident
          </button>
        </form>
      );
    return (
      <form
        onSubmit={addIssue}
        className={`${panel} grid gap-3 md:grid-cols-2`}
      >
        {common}
        <input
          className={field}
          type="date"
          value={issueForm.date}
          onChange={(e) =>
            setIssueForm((v) => ({ ...v, date: e.target.value }))
          }
        />
        <input
          className={field}
          placeholder="Issue title"
          value={issueForm.title}
          onChange={(e) =>
            setIssueForm((v) => ({ ...v, title: e.target.value }))
          }
          required
        />
        <input
          className={field}
          placeholder="Responsible owner"
          value={issueForm.owner}
          onChange={(e) =>
            setIssueForm((v) => ({ ...v, owner: e.target.value }))
          }
        />
        <select
          className={field}
          value={issueForm.priority}
          onChange={(e) =>
            setIssueForm((v) => ({
              ...v,
              priority: e.target.value as Issue["priority"],
            }))
          }
        >
          {["Low", "Medium", "High", "Critical"].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
        <select
          className={field}
          value={issueForm.status}
          onChange={(e) =>
            setIssueForm((v) => ({
              ...v,
              status: e.target.value as Issue["status"],
            }))
          }
        >
          <option>Open</option>
          <option>In Progress</option>
          <option>Resolved</option>
        </select>
        <input
          className={field}
          type="date"
          value={issueForm.dueDate}
          onChange={(e) =>
            setIssueForm((v) => ({ ...v, dueDate: e.target.value }))
          }
        />
        <textarea
          className={`${field} md:col-span-2`}
          placeholder="Issue details / proposed resolution"
          value={issueForm.description}
          onChange={(e) =>
            setIssueForm((v) => ({ ...v, description: e.target.value }))
          }
        />
        <button className={`${primary} md:col-span-2`}>
          <Plus size={15} /> Create Site Issue
        </button>
      </form>
    );
  };

  const addButton = tab !== "Overview";
  const filteredIssues = scopedIssues.filter((x) =>
    `${x.title} ${x.owner} ${x.description}`
      .toLowerCase()
      .includes(query.toLowerCase())
  );

  return (
    <main className="min-h-screen bg-[#050b12] text-slate-100">
      <div className="mx-auto max-w-[1500px] space-y-6 px-4 py-6 md:px-8 md:py-8">
        <header className="flex flex-col gap-4 border-b border-white/10 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-300">
              <Construction size={14} /> ApexiveAI · Construction Suite
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">
              Construction Operations
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-400">
              Field execution, workforce, equipment, materials, quality
              inspections and site safety in one workspace.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={secondary} onClick={syncProjects}>
              <Activity size={14} /> Sync Projects
            </button>
            <button
              type="button"
              className={secondary}
              onClick={() =>
                download(
                  "apexiveai-construction-operations.json",
                  JSON.stringify(buildWorkspace(), null, 2)
                )
              }
            >
              <Download size={14} /> Export JSON
            </button>
            <button
              type="button"
              className={primary}
              onClick={save}
              disabled={!ready}
            >
              <Save size={14} /> Save Workspace
            </button>
          </div>
        </header>

        <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.025] p-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="size-2 rounded-full bg-emerald-400" />
            {ready ? message : "Loading workspace…"}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-[11px] text-slate-500">Active project</label>
            <select
              className={`${field} min-w-64 md:w-80`}
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
            >
              <option value="">All projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code ? `${p.code} · ` : ""}
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <nav className="flex gap-2 overflow-x-auto pb-1">
          {tabs.map((t) => (
            <button
              type="button"
              key={t}
              onClick={() => {
                setTab(t);
                setShowForm(false);
              }}
              className={`whitespace-nowrap rounded-xl px-3 py-2 text-xs font-medium transition ${
                tab === t
                  ? "bg-cyan-400 text-slate-950"
                  : "border border-white/10 bg-white/[0.03] text-slate-400 hover:text-white"
              }`}
            >
              {t}
            </button>
          ))}
        </nav>

        {tab === "Overview" && (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Stat
                label="Site Diary · Today"
                value={todayDiary}
                detail="Daily site reports"
                icon={CalendarDays}
              />
              <Stat
                label="Manpower · Today"
                value={totalHeadcount}
                detail="Workers recorded today"
                icon={Users}
              />
              <Stat
                label="Open Safety Incidents"
                value={openIncidents}
                detail="Requires follow-up"
                icon={ShieldAlert}
              />
              <Stat
                label="Open Site Issues"
                value={openIssues}
                detail="Outstanding site actions"
                icon={AlertTriangle}
              />
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
              <section className={`${panel} space-y-3`}>
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold">Latest Site Diary</h2>
                  <button
                    type="button"
                    className={secondary}
                    onClick={() => setTab("Site Diary")}
                  >
                    View records
                  </button>
                </div>
                {scopedDiaries.slice(0, 5).map((d) => (
                  <div key={d.id} className="rounded-xl bg-white/[0.035] p-3">
                    <div className="flex justify-between gap-2">
                      <span className="text-xs font-semibold">
                        {d.date} · {d.location || "Site location not specified"}
                      </span>
                      <span className="text-[10px] text-cyan-300">
                        {d.weather}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-300">{d.work}</p>
                    {d.delay && (
                      <p className="mt-1 text-[10px] text-amber-300">
                        Delay: {d.delay}
                      </p>
                    )}
                  </div>
                ))}
                {scopedDiaries.length === 0 && (
                  <Empty text="No diary entries yet. Record the first site report." />
                )}
              </section>
              <section className={`${panel} space-y-3`}>
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold">Quality & Safety Snapshot</h2>
                  <button
                    type="button"
                    className={secondary}
                    onClick={() => setTab("Inspections")}
                  >
                    Inspections
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-white/[0.035] p-3">
                    <p className="text-[10px] text-slate-500">
                      Inspections passed
                    </p>
                    <p className="mt-1 text-2xl font-semibold text-emerald-300">
                      {
                        scopedInspections.filter((x) => x.result === "Passed")
                          .length
                      }
                    </p>
                  </div>
                  <div className="rounded-xl bg-white/[0.035] p-3">
                    <p className="text-[10px] text-slate-500">
                      Failed / pending
                    </p>
                    <p className="mt-1 text-2xl font-semibold text-amber-300">
                      {
                        scopedInspections.filter((x) => x.result !== "Passed")
                          .length
                      }
                    </p>
                  </div>
                </div>
                {scopedIncidents.slice(0, 3).map((i) => (
                  <div
                    key={i.id}
                    className="flex items-start gap-3 rounded-xl bg-white/[0.035] p-3"
                  >
                    <ShieldAlert
                      size={16}
                      className="mt-0.5 text-rose-300"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold">
                        {i.category} · {i.severity}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-400">
                        {i.description}
                      </p>
                    </div>
                    <span className="text-[10px] text-slate-500">
                      {i.status}
                    </span>
                  </div>
                ))}
                {scopedIncidents.length === 0 && (
                  <Empty text="No safety incidents recorded." />
                )}
              </section>
            </div>
          </>
        )}

        {addButton && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">{tab}</h2>
              <p className="text-xs text-slate-500">
                {projectName(selectedProject)} · {recordCount} records
              </p>
            </div>
            <button
              type="button"
              className={primary}
              onClick={() => setShowForm((v) => !v)}
            >
              <Plus size={15} /> Add Record
            </button>
          </div>
        )}

        {showForm && addButton && form()}

        {tab === "Site Diary" && (
          <div className="grid gap-3">
            {scopedDiaries
              .filter((d) =>
                `${d.work} ${d.location} ${d.preparedBy}`
                  .toLowerCase()
                  .includes(query.toLowerCase())
              )
              .map((d) => (
                <article key={d.id} className={panel}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold">
                        {d.date} · {d.location || "Site Diary"}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        {projectName(d.projectId)} · {d.weather} ·{" "}
                        {d.preparedBy || "No author"}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="text-slate-500 hover:text-rose-300"
                      onClick={() =>
                        setDiaries((v) => v.filter((x) => x.id !== d.id))
                      }
                      aria-label="Delete diary"
                    >
                      <X size={15} />
                    </button>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm text-slate-300">
                    {d.work}
                  </p>
                  {d.delay && (
                    <p className="mt-2 text-xs text-amber-300">
                      Delay: {d.delay}
                    </p>
                  )}
                  {d.notes && (
                    <p className="mt-2 text-xs text-slate-500">{d.notes}</p>
                  )}
                </article>
              ))}
            {scopedDiaries.length === 0 && (
              <div className={panel}>
                <Empty text="No site diary records." />
              </div>
            )}
          </div>
        )}

        {tab === "Manpower" && (
          <div className={`${panel} overflow-x-auto`}>
            <table className="w-full min-w-[700px] text-left text-xs">
              <thead className="text-[10px] uppercase text-slate-500">
                <tr>
                  {[
                    "Date",
                    "Trade / Crew",
                    "Contractor",
                    "Headcount",
                    "Hours / Worker",
                    "Total Man-hours",
                    "",
                  ].map((x) => (
                    <th className="p-3" key={x}>
                      {x}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {scopedManpower.map((m) => (
                  <tr key={m.id} className="border-t border-white/5">
                    <td className="p-3">{m.date}</td>
                    <td className="p-3 font-medium">{m.trade}</td>
                    <td className="p-3">{m.contractor || "—"}</td>
                    <td className="p-3">{m.headcount}</td>
                    <td className="p-3">{m.hours}</td>
                    <td className="p-3">{m.headcount * m.hours}</td>
                    <td className="p-3">
                      <button
                        type="button"
                        onClick={() =>
                          setManpower((v) => v.filter((x) => x.id !== m.id))
                        }
                        className="text-slate-500 hover:text-rose-300"
                      >
                        <X size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {scopedManpower.length === 0 && (
              <Empty text="No manpower logs recorded." />
            )}
          </div>
        )}

        {tab === "Equipment" && (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {scopedEquipment.map((e) => (
              <article key={e.id} className={panel}>
                <div className="flex justify-between">
                  <Truck size={18} className="text-cyan-300" />
                  <button
                    type="button"
                    onClick={() =>
                      setEquipment((v) => v.filter((x) => x.id !== e.id))
                    }
                    className="text-slate-500"
                  >
                    <X size={14} />
                  </button>
                </div>
                <h3 className="mt-3 font-semibold">{e.name}</h3>
                <p className="text-[10px] text-slate-500">
                  {e.assetCode || "No asset code"} · {e.date}
                </p>
                <div className="mt-3 flex justify-between text-xs">
                  <span>{e.operator || "Operator not recorded"}</span>
                  <span>{e.hours} hours</span>
                </div>
                <p
                  className={`mt-3 text-xs ${
                    e.status === "Operational"
                      ? "text-emerald-300"
                      : e.status === "Maintenance"
                      ? "text-amber-300"
                      : "text-slate-400"
                  }`}
                >
                  {e.status}
                </p>
              </article>
            ))}
            {scopedEquipment.length === 0 && (
              <div className={`${panel} md:col-span-2 xl:col-span-3`}>
                <Empty text="No equipment usage logs." />
              </div>
            )}
          </div>
        )}

        {tab === "Materials" && (
          <div className={`${panel} overflow-x-auto`}>
            <table className="w-full min-w-[700px] text-left text-xs">
              <thead className="text-[10px] uppercase text-slate-500">
                <tr>
                  {[
                    "Date",
                    "Material",
                    "Quantity",
                    "Unit",
                    "Activity / Zone",
                    "Supplier",
                    "",
                  ].map((x) => (
                    <th className="p-3" key={x}>
                      {x}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {scopedMaterials.map((m) => (
                  <tr key={m.id} className="border-t border-white/5">
                    <td className="p-3">{m.date}</td>
                    <td className="p-3 font-medium">{m.name}</td>
                    <td className="p-3">{m.quantity}</td>
                    <td className="p-3">{m.unit}</td>
                    <td className="p-3">{m.activity || "—"}</td>
                    <td className="p-3">{m.supplier || "—"}</td>
                    <td className="p-3">
                      <button
                        type="button"
                        onClick={() =>
                          setMaterials((v) => v.filter((x) => x.id !== m.id))
                        }
                        className="text-slate-500"
                      >
                        <X size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {scopedMaterials.length === 0 && (
              <Empty text="No material usage recorded." />
            )}
          </div>
        )}

        {tab === "Inspections" && (
          <div className={`${panel} overflow-x-auto`}>
            <table className="w-full min-w-[800px] text-left text-xs">
              <thead className="text-[10px] uppercase text-slate-500">
                <tr>
                  {[
                    "Date",
                    "Reference",
                    "Area",
                    "Type",
                    "Inspector",
                    "Result",
                    "Corrective Action",
                    "",
                  ].map((x) => (
                    <th className="p-3" key={x}>
                      {x}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {scopedInspections.map((i) => (
                  <tr key={i.id} className="border-t border-white/5">
                    <td className="p-3">{i.date}</td>
                    <td className="p-3 font-medium">{i.reference}</td>
                    <td className="p-3">{i.area || "—"}</td>
                    <td className="p-3">{i.type || "—"}</td>
                    <td className="p-3">{i.inspector || "—"}</td>
                    <td className="p-3">
                      <select
                        className="rounded-lg border border-white/10 bg-[#07111c] p-2"
                        value={i.result}
                        onChange={(e) =>
                          setInspections((v) =>
                            v.map((x) =>
                              x.id === i.id
                                ? {
                                    ...x,
                                    result: e.target
                                      .value as Inspection["result"],
                                  }
                                : x
                            )
                          )
                        }
                      >
                        <option>Pending</option>
                        <option>Passed</option>
                        <option>Failed</option>
                      </select>
                    </td>
                    <td className="p-3">{i.correctiveAction || "—"}</td>
                    <td className="p-3">
                      <button
                        type="button"
                        onClick={() =>
                          setInspections((v) => v.filter((x) => x.id !== i.id))
                        }
                        className="text-slate-500"
                      >
                        <X size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {scopedInspections.length === 0 && (
              <Empty text="No inspections recorded." />
            )}
          </div>
        )}

        {tab === "Safety" && (
          <div className="space-y-3">
            {scopedIncidents.map((inc) => (
              <article key={inc.id} className={panel}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold">
                      {inc.category} · {inc.severity}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {inc.date} · {inc.location || "Location not set"} ·{" "}
                      {projectName(inc.projectId)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      className="rounded-lg border border-white/10 bg-[#07111c] px-2 py-1 text-xs"
                      value={inc.status}
                      onChange={(e) =>
                        setIncidents((v) =>
                          v.map((x) =>
                            x.id === inc.id
                              ? {
                                  ...x,
                                  status: e.target.value as Incident["status"],
                                }
                              : x
                          )
                        )
                      }
                    >
                      <option>Open</option>
                      <option>Investigating</option>
                      <option>Closed</option>
                    </select>
                    <button
                      type="button"
                      onClick={() =>
                        setIncidents((v) => v.filter((x) => x.id !== inc.id))
                      }
                      className="text-slate-500"
                    >
                      <X size={15} />
                    </button>
                  </div>
                </div>
                <p className="mt-2 text-sm text-slate-300">{inc.description}</p>
                {inc.action && (
                  <p className="mt-1 text-xs text-cyan-300">
                    Action: {inc.action}
                  </p>
                )}
              </article>
            ))}
            {scopedIncidents.length === 0 && (
              <div className={panel}>
                <Empty text="No safety incidents recorded." />
              </div>
            )}
          </div>
        )}

        {tab === "Site Issues" && (
          <div className="space-y-3">
            <div className="relative max-w-sm">
              <Search
                size={14}
                className="absolute left-3 top-3 text-slate-500"
              />
              <input
                className={`${field} pl-9`}
                placeholder="Search site issues..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            {filteredIssues.map((iss) => (
              <article key={iss.id} className={panel}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold">{iss.title}</p>
                    <p className="text-[10px] text-slate-500">
                      {projectName(iss.projectId)} · Owner:{" "}
                      {iss.owner || "Unassigned"} · Priority: {iss.priority}
                      {iss.dueDate ? ` · Due ${iss.dueDate}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      className="rounded-lg border border-white/10 bg-[#07111c] px-2 py-1 text-xs"
                      value={iss.status}
                      onChange={(e) =>
                        setIssues((v) =>
                          v.map((x) =>
                            x.id === iss.id
                              ? {
                                  ...x,
                                  status: e.target.value as Issue["status"],
                                }
                              : x
                          )
                        )
                      }
                    >
                      <option>Open</option>
                      <option>In Progress</option>
                      <option>Resolved</option>
                    </select>
                    <button
                      type="button"
                      onClick={() =>
                        setIssues((v) => v.filter((x) => x.id !== iss.id))
                      }
                      className="text-slate-500"
                    >
                      <X size={15} />
                    </button>
                  </div>
                </div>
                {iss.description && (
                  <p className="mt-2 text-xs text-slate-300">
                    {iss.description}
                  </p>
                )}
              </article>
            ))}
            {filteredIssues.length === 0 && (
              <div className={panel}>
                <Empty text="No site issues found." />
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}