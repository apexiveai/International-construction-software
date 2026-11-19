"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  Activity,
  CheckCircle2,
  Download,
  FileText,
  FolderKanban,
  Plus,
  Search,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";

type ProjectStatus = "Planning" | "Active" | "On Hold" | "Completed";
type TaskStatus = "Not Started" | "In Progress" | "Blocked" | "Done";
type Priority = "Low" | "Medium" | "High" | "Critical";
type Project = {
  id: string;
  code: string;
  name: string;
  client: string;
  status: ProjectStatus;
  startDate: string;
  endDate: string;
  budget: number;
  currency: "MMK" | "USD";
};
type Task = {
  id: string;
  projectId: string;
  title: string;
  description: string;
  assignee: string;
  startDate: string;
  dueDate: string;
  status: TaskStatus;
  priority: Priority;
  progress: number;
};
type Member = {
  id: string;
  name: string;
  role: string;
  email: string;
  capacity: number;
  active: boolean;
};
type Approval = {
  id: string;
  projectId: string;
  title: string;
  requestedBy: string;
  approver: string;
  date: string;
  status: "Pending" | "Approved" | "Rejected";
  note: string;
};
type ProjectFile = {
  id: string;
  projectId: string;
  name: string;
  category: string;
  size: number;
  uploadedAt: string;
  uploadedBy: string;
};
type Workspace = {
  format: "ApexiveAI-Project-Management";
  version: 1;
  projects: Project[];
  tasks: Task[];
  members: Member[];
  approvals: Approval[];
  files: ProjectFile[];
  updatedAt: string;
};

const KEY = "apexiveai-project-management-v1";
const FINANCE_KEY = "apexiveai-project-finance-v1";
const uid = (p: string) =>
  `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n || 0);
const panel =
  "rounded-2xl border border-white/10 bg-[#0b1420] p-4 shadow-xl shadow-black/10";
const field =
  "w-full rounded-xl border border-white/10 bg-[#07111c] px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-400/60";
const primary =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-40";
const secondary =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-medium text-slate-200 hover:bg-white/[0.08]";
const tabs = [
  "Overview",
  "Tasks",
  "Timeline",
  "Team",
  "Approvals",
  "Documents",
] as const;
type Tab = (typeof tabs)[number];

function download(
  filename: string,
  content: string,
  type = "application/json"
) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function projectFromFinance(fallbackDate = ""): Project[] {
  try {
    if (typeof window === "undefined") return [];
    const raw = window.localStorage.getItem(FINANCE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      (parsed as { format?: unknown }).format !==
        "ApexiveAI-Project-Finance" ||
      !Array.isArray((parsed as { projects?: unknown }).projects)
    ) {
      return [];
    }
    return (parsed as { projects: unknown[] }).projects
      .filter(
        (item): item is Record<string, unknown> =>
          typeof item === "object" && item !== null
      )
      .map((p) => {
        const rawStatus = String(p.status ?? "");
        const status: ProjectStatus =
          rawStatus === "Completed" ||
          rawStatus === "On Hold" ||
          rawStatus === "Active"
            ? rawStatus
            : "Planning";
        return {
          id: String(p.id ?? ""),
          code: String(p.code ?? ""),
          name: String(p.name ?? "Untitled Project"),
          client: String(p.client ?? ""),
          status,
          startDate: String(p.startDate ?? fallbackDate),
          endDate: String(p.endDate ?? ""),
          budget: Number(p.budget ?? 0),
          currency: p.currency === "USD" ? "USD" : "MMK",
        };
      });
  } catch {
    return [];
  }
}

export default function ProjectManagementStudio() {
  const [tab, setTab] = useState<Tab>("Overview");
  const [ready, setReady] = useState(false);
  const [currentDate, setCurrentDate] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [message, setMessage] = useState(
    "Workspace ready · Browser-local mode"
  );
  const [query, setQuery] = useState("");
  const [taskForm, setTaskForm] = useState({
    projectId: "",
    title: "",
    description: "",
    assignee: "",
    startDate: "",
    dueDate: "",
    priority: "Medium" as Priority,
  });
  const [memberForm, setMemberForm] = useState({
    name: "",
    role: "Project Manager",
    email: "",
    capacity: "100",
  });
  const [approvalForm, setApprovalForm] = useState({
    projectId: "",
    title: "",
    requestedBy: "",
    approver: "",
    note: "",
  });
  const [showTask, setShowTask] = useState(false);
  const [showMember, setShowMember] = useState(false);
  const [showApproval, setShowApproval] = useState(false);

  useEffect(() => {
    const day = new Date().toISOString().slice(0, 10);
    setCurrentDate(day);
    setTaskForm((v) => ({ ...v, startDate: v.startDate || day }));

    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const d = JSON.parse(raw) as Partial<Workspace>;
        if (
          d.format === "ApexiveAI-Project-Management" &&
          d.version === 1
        ) {
          setProjects(Array.isArray(d.projects) ? d.projects : []);
          setTasks(Array.isArray(d.tasks) ? d.tasks : []);
          setMembers(Array.isArray(d.members) ? d.members : []);
          setApprovals(Array.isArray(d.approvals) ? d.approvals : []);
          setFiles(Array.isArray(d.files) ? d.files : []);
        }
      }
      const linked = projectFromFinance(day);
      if (linked.length) {
        setProjects((current) => {
          const map = new Map(current.map((p) => [p.id, p]));
          linked.forEach((p) => {
            const existing = map.get(p.id);
            map.set(p.id, existing ? { ...existing, ...p } : p);
          });
          return Array.from(map.values());
        });
      }
    } catch {
      setMessage("Could not read saved workspace · Starting fresh");
    } finally {
      setReady(true);
    }
  }, []);

  const buildWorkspace = (): Workspace => ({
    format: "ApexiveAI-Project-Management",
    version: 1,
    projects,
    tasks,
    members,
    approvals,
    files,
    updatedAt: new Date().toISOString(),
  });

  const save = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(buildWorkspace()));
      setMessage(
        `Saved · ${projects.length} projects · ${tasks.length} tasks · ${members.length} team members`
      );
    } catch {
      setMessage("Save failed · Browser storage may be full");
    }
  };

  const exportData = () =>
    download(
      "apexiveai-project-management.json",
      JSON.stringify(buildWorkspace(), null, 2)
    );

  const importData = async (file?: File) => {
    if (!file) return;
    try {
      const d = JSON.parse(await file.text()) as Partial<Workspace>;
      if (
        d.format !== "ApexiveAI-Project-Management" ||
        d.version !== 1 ||
        !Array.isArray(d.projects) ||
        !Array.isArray(d.tasks) ||
        !Array.isArray(d.members) ||
        !Array.isArray(d.approvals) ||
        !Array.isArray(d.files)
      ) {
        throw new Error("Unsupported workspace format");
      }
      setProjects(d.projects);
      setTasks(d.tasks);
      setMembers(d.members);
      setApprovals(d.approvals);
      setFiles(d.files);
      setMessage("Workspace imported · Save to persist in this browser");
    } catch (e) {
      setMessage(
        e instanceof Error ? `Import rejected · ${e.message}` : "Import rejected"
      );
    }
  };

  const projectName = (id: string) =>
    projects.find((p) => p.id === id)?.name ?? "Unassigned project";
  const visibleTasks = tasks.filter((t) =>
    `${t.title} ${t.assignee} ${projectName(t.projectId)}`
      .toLowerCase()
      .includes(query.toLowerCase())
  );
  const done = tasks.filter((t) => t.status === "Done").length;
  const active = tasks.filter((t) => t.status === "In Progress").length;
  const pendingApprovals = approvals.filter(
    (a) => a.status === "Pending"
  ).length;
  const avgProgress = tasks.length
    ? Math.round(tasks.reduce((s, t) => s + t.progress, 0) / tasks.length)
    : 0;

  const addTask = (e: FormEvent) => {
    e.preventDefault();
    const start = taskForm.startDate || currentDate;
    if (
      !taskForm.title.trim() ||
      !taskForm.projectId ||
      !taskForm.dueDate ||
      (start && taskForm.dueDate < start)
    ) {
      setMessage("Task title, project and valid dates are required");
      return;
    }
    setTasks((v) => [
      ...v,
      {
        ...taskForm,
        startDate: start,
        id: uid("task"),
        title: taskForm.title.trim(),
        description: taskForm.description.trim(),
        assignee: taskForm.assignee.trim(),
        status: "Not Started",
        progress: 0,
      },
    ]);
    setTaskForm({
      projectId: "",
      title: "",
      description: "",
      assignee: "",
      startDate: currentDate,
      dueDate: "",
      priority: "Medium",
    });
    setShowTask(false);
    setMessage("Task created · Save workspace to keep changes");
  };

  const updateTask = (id: string, patch: Partial<Task>) =>
    setTasks((v) =>
      v.map((t) =>
        t.id === id
          ? {
              ...t,
              ...patch,
              progress:
                patch.status === "Done"
                  ? 100
                  : patch.status === "Not Started"
                  ? 0
                  : patch.progress ?? t.progress,
            }
          : t
      )
    );

  const addMember = (e: FormEvent) => {
    e.preventDefault();
    if (!memberForm.name.trim() || !memberForm.role.trim()) return;
    setMembers((v) => [
      ...v,
      {
        id: uid("member"),
        ...memberForm,
        name: memberForm.name.trim(),
        capacity: Math.min(
          100,
          Math.max(0, Number(memberForm.capacity) || 0)
        ),
        active: true,
      },
    ]);
    setMemberForm({
      name: "",
      role: "Project Manager",
      email: "",
      capacity: "100",
    });
    setShowMember(false);
    setMessage("Team member added · Save workspace to keep changes");
  };

  const addApproval = (e: FormEvent) => {
    e.preventDefault();
    if (
      !approvalForm.projectId ||
      !approvalForm.title.trim() ||
      !approvalForm.approver.trim()
    )
      return;
    setApprovals((v) => [
      ...v,
      {
        id: uid("approval"),
        ...approvalForm,
        title: approvalForm.title.trim(),
        requestedBy: approvalForm.requestedBy.trim(),
        approver: approvalForm.approver.trim(),
        date: currentDate,
        status: "Pending",
      },
    ]);
    setApprovalForm({
      projectId: "",
      title: "",
      requestedBy: "",
      approver: "",
      note: "",
    });
    setShowApproval(false);
    setMessage("Approval request submitted");
  };

  const addFiles = (projectId: string, selected?: FileList | null) => {
    if (!selected?.length) return;
    const timestamp = new Date().toISOString();
    const added = Array.from(selected).map((f) => ({
      id: uid("file"),
      projectId,
      name: f.name,
      category: f.type || "Unclassified",
      size: f.size,
      uploadedAt: timestamp,
      uploadedBy: "Current workspace user",
    }));
    setFiles((v) => [...v, ...added]);
    setMessage(
      `${added.length} file record(s) added · Actual file bytes are not stored in this browser workspace`
    );
  };

  return (
    <main className="min-h-screen bg-[#050a11] text-slate-100">
      <div className="mx-auto max-w-[1500px] space-y-6 px-4 py-6 md:px-8 md:py-9">
        <header className="flex flex-col justify-between gap-4 border-b border-white/10 pb-6 lg:flex-row lg:items-end">
          <div>
            <div className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.28em] text-cyan-300">
              <FolderKanban size={14} /> ApexiveAI · Enterprise Workspace
            </div>
            <h1 className="text-2xl font-semibold tracking-tight md:text-4xl">
              Project Management
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">
              Plan delivery, coordinate teams, track execution and manage
              approvals across projects.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={secondary}
              onClick={() =>
                download(
                  "apexiveai-project-management.csv",
                  [
                    "Project,Task,Assignee,Start,Due,Status,Priority,Progress",
                    ...tasks.map((t) =>
                      [
                        projectName(t.projectId),
                        t.title,
                        t.assignee,
                        t.startDate,
                        t.dueDate,
                        t.status,
                        t.priority,
                        t.progress,
                      ]
                        .map((x) => `"${String(x).replace(/"/g, '""')}"`)
                        .join(",")
                    ),
                  ].join("\n"),
                  "text/csv"
                )
              }
            >
              <Download size={14} /> Export CSV
            </button>
            <button type="button" className={secondary} onClick={exportData}>
              <Download size={14} /> Backup JSON
            </button>
            <label className={`${secondary} cursor-pointer`}>
              <Activity size={14} /> Import
              <input
                type="file"
                accept="application/json"
                className="hidden"
                onChange={(e) => {
                  void importData(e.target.files?.[0]);
                  e.currentTarget.value = "";
                }}
              />
            </label>
            <button
              type="button"
              className={primary}
              onClick={save}
              disabled={!ready}
            >
              Save Workspace
            </button>
          </div>
        </header>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <nav className="flex flex-wrap gap-1 rounded-2xl border border-white/10 bg-white/[0.03] p-1">
            {tabs.map((t) => (
              <button
                type="button"
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-xl px-3 py-2 text-xs font-medium transition ${
                  tab === t
                    ? "bg-cyan-400 text-slate-950"
                    : "text-slate-400 hover:bg-white/[0.06] hover:text-white"
                }`}
              >
                {t}
              </button>
            ))}
          </nav>
          <p className="text-[11px] text-slate-500">{message}</p>
        </div>

        {tab === "Overview" && (
          <>
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                {
                  label: "Total Projects",
                  value: projects.length,
                  icon: FolderKanban,
                },
                {
                  label: "Tasks In Progress",
                  value: active,
                  icon: Activity,
                },
                {
                  label: "Tasks Completed",
                  value: `${done}/${tasks.length}`,
                  icon: CheckCircle2,
                },
                {
                  label: "Pending Approvals",
                  value: pendingApprovals,
                  icon: ShieldCheck,
                },
              ].map((k) => (
                <div key={k.label} className={panel}>
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>{k.label}</span>
                    <k.icon size={16} className="text-cyan-300" />
                  </div>
                  <p className="mt-4 text-3xl font-semibold tracking-tight">
                    {k.value}
                  </p>
                </div>
              ))}
            </section>
            <section className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
              <div className={panel}>
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="font-semibold">Project Portfolio</h2>
                    <p className="mt-1 text-xs text-slate-500">
                      Projects synchronized from Finance workspace on page load
                    </p>
                  </div>
                  <button
                    type="button"
                    className={secondary}
                    onClick={() => {
                      const p = projectFromFinance(currentDate);
                      setProjects((current) => {
                        const m = new Map(current.map((x) => [x.id, x]));
                        p.forEach((x) => {
                          const existing = m.get(x.id);
                          m.set(x.id, existing ? { ...existing, ...x } : x);
                        });
                        return Array.from(m.values());
                      });
                      setMessage(
                        `Finance projects synchronized · ${p.length} records`
                      );
                    }}
                  >
                    Sync Finance
                  </button>
                </div>
                {projects.length ? (
                  <div className="space-y-3">
                    {projects.map((p) => {
                      const list = tasks.filter((t) => t.projectId === p.id);
                      const progress = list.length
                        ? Math.round(
                            list.reduce((s, t) => s + t.progress, 0) /
                              list.length
                          )
                        : 0;
                      return (
                        <div
                          key={p.id}
                          className="rounded-xl border border-white/10 bg-[#07111c] p-3"
                        >
                          <div className="flex flex-wrap justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold">{p.name}</p>
                              <p className="mt-1 text-[11px] text-slate-500">
                                {p.code} · {p.client || "Client not set"}
                              </p>
                            </div>
                            <span className="h-fit rounded-full border border-cyan-300/20 px-2.5 py-1 text-[10px] text-cyan-200">
                              {p.status}
                            </span>
                          </div>
                          <div className="mt-3 flex justify-between text-[10px] text-slate-500">
                            <span>{list.length} tasks</span>
                            <span>{progress}% task progress</span>
                          </div>
                          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                            <div
                              className="h-full rounded-full bg-cyan-400"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <p className="mt-2 text-[10px] text-slate-500">
                            {p.startDate} → {p.endDate || "End date not set"} ·
                            Budget {fmt(p.budget)} {p.currency}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <Empty text="No projects yet. Add projects in Project Finance, then select Sync Finance." />
                )}
              </div>
              <div className={panel}>
                <h2 className="font-semibold">Execution Snapshot</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Based on tasks currently registered
                </p>
                <div className="my-6 flex items-center gap-5">
                  <div
                    className="relative grid size-28 shrink-0 place-items-center rounded-full"
                    style={{
                      background: `conic-gradient(#22d3ee ${avgProgress}%, #1e293b 0)`,
                    }}
                  >
                    <div className="grid size-20 place-items-center rounded-full bg-[#0b1420]">
                      <span className="text-2xl font-semibold">
                        {avgProgress}%
                      </span>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-semibold">
                      Average task completion
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {done} completed · {active} in progress
                    </p>
                  </div>
                </div>
                <div className="space-y-3">
                  {(
                    [
                      "Not Started",
                      "In Progress",
                      "Blocked",
                      "Done",
                    ] as TaskStatus[]
                  ).map((s) => {
                    const n = tasks.filter((t) => t.status === s).length;
                    return (
                      <div key={s}>
                        <div className="mb-1 flex justify-between text-xs">
                          <span className="text-slate-400">{s}</span>
                          <span>{n}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-white/5">
                          <div
                            className="h-1.5 rounded-full bg-cyan-400"
                            style={{
                              width: `${
                                tasks.length ? (n / tasks.length) * 100 : 0
                              }%`,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          </>
        )}

        {tab === "Tasks" && (
          <section className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Task Register</h2>
                <p className="text-xs text-slate-500">
                  Assign work, set delivery dates and track progress
                </p>
              </div>
              <button
                type="button"
                className={primary}
                onClick={() => setShowTask((v) => !v)}
              >
                <Plus size={15} /> New Task
              </button>
            </div>
            <div className="relative max-w-sm">
              <Search
                size={14}
                className="absolute left-3 top-3 text-slate-500"
              />
              <input
                className={`${field} pl-9`}
                placeholder="Search tasks, assignees, projects..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            {showTask && (
              <form
                onSubmit={addTask}
                className={`${panel} grid gap-3 md:grid-cols-3`}
              >
                <input
                  className={field}
                  placeholder="Task title"
                  value={taskForm.title}
                  onChange={(e) =>
                    setTaskForm((v) => ({ ...v, title: e.target.value }))
                  }
                  required
                />
                <select
                  className={field}
                  value={taskForm.projectId}
                  onChange={(e) =>
                    setTaskForm((v) => ({ ...v, projectId: e.target.value }))
                  }
                  required
                >
                  <option value="">Select project</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} · {p.name}
                    </option>
                  ))}
                </select>
                <input
                  className={field}
                  placeholder="Assignee"
                  value={taskForm.assignee}
                  onChange={(e) =>
                    setTaskForm((v) => ({ ...v, assignee: e.target.value }))
                  }
                />
                <input
                  className={field}
                  type="date"
                  value={taskForm.startDate}
                  onChange={(e) =>
                    setTaskForm((v) => ({ ...v, startDate: e.target.value }))
                  }
                  required
                />
                <input
                  className={field}
                  type="date"
                  value={taskForm.dueDate}
                  onChange={(e) =>
                    setTaskForm((v) => ({ ...v, dueDate: e.target.value }))
                  }
                  required
                />
                <select
                  className={field}
                  value={taskForm.priority}
                  onChange={(e) =>
                    setTaskForm((v) => ({
                      ...v,
                      priority: e.target.value as Priority,
                    }))
                  }
                >
                  {["Low", "Medium", "High", "Critical"].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
                <textarea
                  className={`${field} md:col-span-3`}
                  placeholder="Task description"
                  value={taskForm.description}
                  onChange={(e) =>
                    setTaskForm((v) => ({ ...v, description: e.target.value }))
                  }
                />
                <div className="flex gap-2 md:col-span-3">
                  <button className={primary} type="submit">
                    Create Task
                  </button>
                  <button
                    className={secondary}
                    type="button"
                    onClick={() => setShowTask(false)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
            <div className={`${panel} overflow-x-auto`}>
              <table className="w-full min-w-[950px] text-left text-xs">
                <thead className="text-[10px] uppercase tracking-wider text-slate-500">
                  <tr>
                    {[
                      "Task / Project",
                      "Assignee",
                      "Dates",
                      "Priority",
                      "Status",
                      "Progress",
                    ].map((x) => (
                      <th key={x} className="p-3">
                        {x}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleTasks.map((t) => (
                    <tr key={t.id} className="border-t border-white/5">
                      <td className="p-3">
                        <p className="font-semibold text-slate-200">
                          {t.title}
                        </p>
                        <p className="mt-1 text-[10px] text-slate-500">
                          {projectName(t.projectId)}
                        </p>
                      </td>
                      <td className="p-3">{t.assignee || "Unassigned"}</td>
                      <td className="p-3">
                        {t.startDate}
                        <p className="text-[10px] text-slate-500">
                          Due {t.dueDate}
                        </p>
                      </td>
                      <td className="p-3">{t.priority}</td>
                      <td className="p-3">
                        <select
                          className="rounded-lg border border-white/10 bg-[#07111c] p-2"
                          value={t.status}
                          onChange={(e) =>
                            updateTask(t.id, {
                              status: e.target.value as TaskStatus,
                            })
                          }
                        >
                          {[
                            "Not Started",
                            "In Progress",
                            "Blocked",
                            "Done",
                          ].map((x) => (
                            <option key={x}>{x}</option>
                          ))}
                        </select>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <input
                            aria-label="Task progress"
                            className="w-20 accent-cyan-400"
                            type="range"
                            min="0"
                            max="100"
                            step="5"
                            value={t.progress}
                            onChange={(e) =>
                              updateTask(t.id, {
                                progress: Number(e.target.value),
                                status:
                                  Number(e.target.value) === 100
                                    ? "Done"
                                    : Number(e.target.value) === 0
                                    ? "Not Started"
                                    : "In Progress",
                              })
                            }
                          />
                          <span>{t.progress}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {visibleTasks.length === 0 && (
                <Empty text="No matching tasks. Create a task to start tracking delivery." />
              )}
            </div>
          </section>
        )}

        {tab === "Timeline" && (
          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Project Timeline</h2>
              <p className="text-xs text-slate-500">
                Gantt-style schedule view based on task start and due dates
              </p>
            </div>
            <div className={`${panel} space-y-4 overflow-x-auto`}>
              {tasks.length ? (
                tasks.map((t) => {
                  const start = new Date(`${t.startDate}T00:00:00`).getTime();
                  const end = new Date(`${t.dueDate}T00:00:00`).getTime();
                  const allStarts = tasks
                    .map((x) => new Date(`${x.startDate}T00:00:00`).getTime())
                    .filter(Number.isFinite);
                  const allEnds = tasks
                    .map((x) => new Date(`${x.dueDate}T00:00:00`).getTime())
                    .filter(Number.isFinite);
                  const min = Math.min(...allStarts);
                  const max = Math.max(...allEnds, min + 86400000);
                  const left = Math.max(0, ((start - min) / (max - min)) * 100);
                  const width = Math.max(
                    1.5,
                    ((end - start) / (max - min)) * 100
                  );
                  return (
                    <div
                      key={t.id}
                      className="grid min-w-[700px] grid-cols-[220px_1fr] items-center gap-4"
                    >
                      <div>
                        <p className="truncate text-xs font-medium">{t.title}</p>
                        <p className="truncate text-[10px] text-slate-500">
                          {projectName(t.projectId)} · {t.dueDate}
                        </p>
                      </div>
                      <div className="relative h-8 rounded-lg bg-white/[0.035]">
                        <div
                          className={`absolute top-1 h-6 rounded-md ${
                            t.status === "Done"
                              ? "bg-emerald-400/80"
                              : t.status === "Blocked"
                              ? "bg-rose-400/80"
                              : "bg-cyan-400/80"
                          }`}
                          style={{ left: `${left}%`, width: `${width}%` }}
                        >
                          <span className="px-2 text-[9px] font-semibold leading-6 text-slate-950">
                            {t.progress}%
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <Empty text="Add tasks with start and due dates to populate the timeline." />
              )}
            </div>
          </section>
        )}

        {tab === "Team" && (
          <section className="space-y-4">
            <div className="flex items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">
                  Team & Resource Allocation
                </h2>
                <p className="text-xs text-slate-500">
                  Maintain project team directory and indicative capacity
                </p>
              </div>
              <button
                type="button"
                className={primary}
                onClick={() => setShowMember((v) => !v)}
              >
                <Plus size={15} /> Add Member
              </button>
            </div>
            {showMember && (
              <form
                onSubmit={addMember}
                className={`${panel} grid gap-3 md:grid-cols-4`}
              >
                <input
                  className={field}
                  placeholder="Full name"
                  value={memberForm.name}
                  onChange={(e) =>
                    setMemberForm((v) => ({ ...v, name: e.target.value }))
                  }
                  required
                />
                <input
                  className={field}
                  placeholder="Role"
                  value={memberForm.role}
                  onChange={(e) =>
                    setMemberForm((v) => ({ ...v, role: e.target.value }))
                  }
                  required
                />
                <input
                  className={field}
                  type="email"
                  placeholder="Email"
                  value={memberForm.email}
                  onChange={(e) =>
                    setMemberForm((v) => ({ ...v, email: e.target.value }))
                  }
                />
                <input
                  className={field}
                  type="number"
                  min="0"
                  max="100"
                  placeholder="Capacity %"
                  value={memberForm.capacity}
                  onChange={(e) =>
                    setMemberForm((v) => ({ ...v, capacity: e.target.value }))
                  }
                />
                <div className="md:col-span-4">
                  <button className={primary} type="submit">
                    Add to Team
                  </button>
                </div>
              </form>
            )}
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {members.map((m) => (
                <div key={m.id} className={panel}>
                  <div className="flex items-start justify-between">
                    <div className="grid size-10 place-items-center rounded-xl bg-cyan-400/10 text-cyan-200">
                      <Users size={18} />
                    </div>
                    <button
                      type="button"
                      className="text-slate-500 hover:text-rose-300"
                      onClick={() =>
                        setMembers((v) => v.filter((x) => x.id !== m.id))
                      }
                      aria-label="Remove member"
                    >
                      <X size={15} />
                    </button>
                  </div>
                  <p className="mt-3 font-semibold">{m.name}</p>
                  <p className="text-xs text-slate-400">{m.role}</p>
                  <p className="mt-2 text-[11px] text-slate-500">
                    {m.email || "No email recorded"}
                  </p>
                  <div className="mt-4 flex justify-between text-[10px] text-slate-500">
                    <span>Allocated capacity</span>
                    <span>{m.capacity}%</span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-white/10">
                    <div
                      className="h-1.5 rounded-full bg-cyan-400"
                      style={{ width: `${m.capacity}%` }}
                    />
                  </div>
                </div>
              ))}
              {members.length === 0 && (
                <div className={`${panel} md:col-span-2 xl:col-span-3`}>
                  <Empty text="No team members registered yet." />
                </div>
              )}
            </div>
          </section>
        )}

        {tab === "Approvals" && (
          <section className="space-y-4">
            <div className="flex items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Approval Workflow</h2>
                <p className="text-xs text-slate-500">
                  Track project decisions and approval status
                </p>
              </div>
              <button
                type="button"
                className={primary}
                onClick={() => setShowApproval((v) => !v)}
              >
                <Plus size={15} /> New Request
              </button>
            </div>
            {showApproval && (
              <form
                onSubmit={addApproval}
                className={`${panel} grid gap-3 md:grid-cols-2`}
              >
                <select
                  className={field}
                  value={approvalForm.projectId}
                  onChange={(e) =>
                    setApprovalForm((v) => ({
                      ...v,
                      projectId: e.target.value,
                    }))
                  }
                  required
                >
                  <option value="">Select project</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} · {p.name}
                    </option>
                  ))}
                </select>
                <input
                  className={field}
                  placeholder="Approval subject"
                  value={approvalForm.title}
                  onChange={(e) =>
                    setApprovalForm((v) => ({ ...v, title: e.target.value }))
                  }
                  required
                />
                <input
                  className={field}
                  placeholder="Requested by"
                  value={approvalForm.requestedBy}
                  onChange={(e) =>
                    setApprovalForm((v) => ({
                      ...v,
                      requestedBy: e.target.value,
                    }))
                  }
                />
                <input
                  className={field}
                  placeholder="Approver"
                  value={approvalForm.approver}
                  onChange={(e) =>
                    setApprovalForm((v) => ({ ...v, approver: e.target.value }))
                  }
                  required
                />
                <textarea
                  className={`${field} md:col-span-2`}
                  placeholder="Decision context / notes"
                  value={approvalForm.note}
                  onChange={(e) =>
                    setApprovalForm((v) => ({ ...v, note: e.target.value }))
                  }
                />
                <div className="md:col-span-2">
                  <button className={primary} type="submit">
                    Submit for Approval
                  </button>
                </div>
              </form>
            )}
            <div className={`${panel} overflow-x-auto`}>
              <table className="w-full min-w-[750px] text-left text-xs">
                <thead className="text-[10px] uppercase text-slate-500">
                  <tr>
                    {[
                      "Request",
                      "Project",
                      "Requested By",
                      "Approver",
                      "Date",
                      "Decision",
                    ].map((x) => (
                      <th key={x} className="p-3">
                        {x}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {approvals.map((a) => (
                    <tr key={a.id} className="border-t border-white/5">
                      <td className="p-3 font-medium">
                        {a.title}
                        <p className="text-[10px] text-slate-500">{a.note}</p>
                      </td>
                      <td className="p-3">{projectName(a.projectId)}</td>
                      <td className="p-3">{a.requestedBy || "—"}</td>
                      <td className="p-3">{a.approver}</td>
                      <td className="p-3">{a.date}</td>
                      <td className="p-3">
                        <select
                          className="rounded-lg border border-white/10 bg-[#07111c] p-2"
                          value={a.status}
                          onChange={(e) =>
                            setApprovals((v) =>
                              v.map((x) =>
                                x.id === a.id
                                  ? {
                                      ...x,
                                      status: e.target
                                        .value as Approval["status"],
                                    }
                                  : x
                              )
                            )
                          }
                        >
                          <option>Pending</option>
                          <option>Approved</option>
                          <option>Rejected</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {approvals.length === 0 && (
                <Empty text="No approval requests yet." />
              )}
            </div>
          </section>
        )}

        {tab === "Documents" && (
          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Project Documents</h2>
              <p className="text-xs text-slate-500">
                Register document metadata against projects
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {projects.map((p) => (
                <div key={p.id} className={panel}>
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">{p.name}</p>
                      <p className="text-[10px] text-slate-500">{p.code}</p>
                    </div>
                    <label className={`${secondary} cursor-pointer`}>
                      <Plus size={13} /> Add Files
                      <input
                        className="hidden"
                        type="file"
                        multiple
                        onChange={(e) => {
                          addFiles(p.id, e.target.files);
                          e.currentTarget.value = "";
                        }}
                      />
                    </label>
                  </div>
                  <div className="mt-3 space-y-2">
                    {files
                      .filter((f) => f.projectId === p.id)
                      .map((f) => (
                        <div
                          key={f.id}
                          className="flex items-center gap-2 rounded-lg bg-white/[0.035] p-2"
                        >
                          <FileText size={14} className="text-cyan-300" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs">{f.name}</p>
                            <p className="text-[10px] text-slate-500">
                              {(f.size / 1024).toFixed(1)} KB ·{" "}
                              {f.uploadedAt.slice(0, 10)}
                            </p>
                          </div>
                          <button
                            type="button"
                            className="text-slate-500 hover:text-rose-300"
                            onClick={() =>
                              setFiles((v) => v.filter((x) => x.id !== f.id))
                            }
                            aria-label="Remove file record"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    {!files.some((f) => f.projectId === p.id) && (
                      <p className="py-3 text-xs text-slate-600">
                        No documents registered
                      </p>
                    )}
                  </div>
                </div>
              ))}
              {projects.length === 0 && (
                <div className={`${panel} md:col-span-2`}>
                  <Empty text="Create projects in Finance first, then sync them here." />
                </div>
              )}
            </div>
            <p className="text-[11px] leading-5 text-amber-200/70">
              Important: this browser-only milestone stores document metadata
              only. Selected file contents are not uploaded or persisted.
              Connect secure object storage and backend permissions before
              production use.
            </p>
          </section>
        )}

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-white/5 pt-4 text-[10px] text-slate-600">
          <span>
            ApexiveAI Project Management · Milestone 14 · Workspace schema v1
          </span>
          <span>
            {projects.length} projects · {tasks.length} tasks ·{" "}
            {members.length} members · {approvals.length} approvals
          </span>
        </footer>
      </div>
    </main>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="grid min-h-28 place-items-center px-4 text-center text-xs text-slate-500">
      {text}
    </div>
  );
}