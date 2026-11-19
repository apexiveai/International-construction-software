"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  Activity,
  ArrowDownLeft,
  ArrowUpRight,
  BriefcaseBusiness,
  Building2,
  Download,
  FileText,
  Landmark,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Wallet,
} from "lucide-react";

type Currency = "MMK" | "USD";
type ProjectStatus = "Planning" | "Active" | "On Hold" | "Completed";
type FinanceProject = {
  id: string;
  code: string;
  name: string;
  client: string;
  status: ProjectStatus;
  currency: Currency;
  budget: number;
  startDate: string;
  endDate: string;
};
type AccountType = "Asset" | "Liability" | "Equity" | "Income" | "Expense";
type Account = {
  code: string;
  name: string;
  type: AccountType;
  normal: "Debit" | "Credit";
};
type JournalLine = {
  accountCode: string;
  debit: number;
  credit: number;
  projectId: string;
};
type JournalEntry = {
  id: string;
  date: string;
  reference: string;
  description: string;
  currency: Currency;
  status: "Draft" | "Posted";
  lines: JournalLine[];
  createdAt: string;
};
type Invoice = {
  id: string;
  number: string;
  projectId: string;
  client: string;
  issueDate: string;
  dueDate: string;
  currency: Currency;
  amount: number;
  status: "Draft" | "Sent" | "Paid" | "Overdue";
};
type Expense = {
  id: string;
  date: string;
  projectId: string;
  vendor: string;
  category: string;
  description: string;
  currency: Currency;
  amount: number;
  status: "Pending" | "Approved" | "Paid";
};
type FinanceDocument = {
  format: "ApexiveAI-Project-Finance";
  version: 1;
  updatedAt: string;
  projects: FinanceProject[];
  accounts: Account[];
  journals: JournalEntry[];
  invoices: Invoice[];
  expenses: Expense[];
};

const STORAGE_KEY = "apexiveai-project-finance-v1";
const uid = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

const money = (value: number, currency: Currency) =>
  new Intl.NumberFormat("en-US", {
    maximumFractionDigits: currency === "MMK" ? 0 : 2,
  }).format(Number.isFinite(value) ? value : 0) +
  (currency === "MMK" ? " MMK" : " USD");

const numberValue = (value: string) => {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

const DEFAULT_ACCOUNTS: Account[] = [
  { code: "1000", name: "Cash on Hand", type: "Asset", normal: "Debit" },
  { code: "1010", name: "Bank Account", type: "Asset", normal: "Debit" },
  { code: "1100", name: "Accounts Receivable", type: "Asset", normal: "Debit" },
  { code: "2000", name: "Accounts Payable", type: "Liability", normal: "Credit" },
  { code: "3000", name: "Owner's Equity", type: "Equity", normal: "Credit" },
  { code: "4000", name: "Project Revenue", type: "Income", normal: "Credit" },
  { code: "5000", name: "Materials & Supplies", type: "Expense", normal: "Debit" },
  { code: "5100", name: "Labor Cost", type: "Expense", normal: "Debit" },
  { code: "5200", name: "Equipment & Rental", type: "Expense", normal: "Debit" },
  { code: "5300", name: "Transport & Logistics", type: "Expense", normal: "Debit" },
  { code: "5900", name: "Other Project Expenses", type: "Expense", normal: "Debit" },
];

const EMPTY_PROJECT: FinanceProject = {
  id: "",
  code: "",
  name: "",
  client: "",
  status: "Planning",
  currency: "MMK",
  budget: 0,
  startDate: "",
  endDate: "",
};

function downloadText(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function csvCell(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

export default function ProjectFinanceStudio() {
  const [ready, setReady] = useState(false);
  const [currentDate, setCurrentDate] = useState("");
  const [tab, setTab] = useState<
    | "Overview"
    | "Projects"
    | "Journal"
    | "Invoices"
    | "Expenses"
    | "Accounts"
    | "Reports"
  >("Overview");
  const [projects, setProjects] = useState<FinanceProject[]>([]);
  const [accounts, setAccounts] = useState<Account[]>(DEFAULT_ACCOUNTS);
  const [journals, setJournals] = useState<JournalEntry[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [status, setStatus] = useState(
    "Finance workspace ready · Browser-local mode"
  );
  const [query, setQuery] = useState("");
  const [projectForm, setProjectForm] = useState<FinanceProject>(EMPTY_PROJECT);
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState({
    projectId: "",
    client: "",
    issueDate: "",
    dueDate: "",
    currency: "MMK" as Currency,
    amount: "",
  });
  const [expenseForm, setExpenseForm] = useState({
    projectId: "",
    date: "",
    vendor: "",
    category: "Materials & Supplies",
    description: "",
    currency: "MMK" as Currency,
    amount: "",
  });
  const [journalForm, setJournalForm] = useState({
    date: "",
    reference: "",
    description: "",
    currency: "MMK" as Currency,
    debitAccount: "5000",
    creditAccount: "1000",
    amount: "",
    projectId: "",
  });

  useEffect(() => {
    const day = new Date().toISOString().slice(0, 10);
    setCurrentDate(day);
    setProjectForm((p) => ({ ...p, startDate: p.startDate || day }));
    setInvoiceForm((p) => ({ ...p, issueDate: p.issueDate || day }));
    setExpenseForm((p) => ({ ...p, date: p.date || day }));
    setJournalForm((p) => ({ ...p, date: p.date || day }));

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<FinanceDocument>;
        if (
          parsed.format === "ApexiveAI-Project-Finance" &&
          parsed.version === 1
        ) {
          setProjects(Array.isArray(parsed.projects) ? parsed.projects : []);
          setAccounts(
            Array.isArray(parsed.accounts) && parsed.accounts.length
              ? parsed.accounts
              : DEFAULT_ACCOUNTS
          );
          setJournals(Array.isArray(parsed.journals) ? parsed.journals : []);
          setInvoices(Array.isArray(parsed.invoices) ? parsed.invoices : []);
          setExpenses(Array.isArray(parsed.expenses) ? parsed.expenses : []);
          setStatus("Finance workspace loaded from this browser");
        }
      }
    } catch {
      setStatus(
        "Saved finance data could not be read · Start with a new workspace"
      );
    } finally {
      setReady(true);
    }
  }, []);

  const buildFinanceDocument = (): FinanceDocument => ({
    format: "ApexiveAI-Project-Finance",
    version: 1,
    updatedAt: new Date().toISOString(),
    projects,
    accounts,
    journals,
    invoices,
    expenses,
  });

  const save = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(buildFinanceDocument()));
      setStatus(
        `Saved locally · ${projects.length} projects · ${journals.length} journal entries`
      );
    } catch {
      setStatus("Save failed · Browser storage may be full");
    }
  };

  const exportJson = () =>
    downloadText(
      "apexiveai-project-finance.json",
      JSON.stringify(buildFinanceDocument(), null, 2),
      "application/json"
    );

  const importJson = async (file?: File) => {
    if (!file) return;
    try {
      const data = JSON.parse(await file.text()) as Partial<FinanceDocument>;
      if (
        data.format !== "ApexiveAI-Project-Finance" ||
        data.version !== 1 ||
        !Array.isArray(data.projects) ||
        !Array.isArray(data.journals) ||
        !Array.isArray(data.invoices) ||
        !Array.isArray(data.expenses)
      ) {
        throw new Error("Unsupported Finance document format");
      }
      setProjects(data.projects);
      setAccounts(Array.isArray(data.accounts) ? data.accounts : DEFAULT_ACCOUNTS);
      setJournals(data.journals);
      setInvoices(data.invoices);
      setExpenses(data.expenses);
      setStatus(
        `Imported finance workspace from ${file.name} · Save to keep it in this browser`
      );
    } catch (error) {
      setStatus(
        error instanceof Error
          ? `Import rejected · ${error.message}`
          : "Import rejected"
      );
    }
  };

  const totals = useMemo(() => {
    const byCurrency = (currency: Currency) => {
      const revenue = invoices
        .filter((x) => x.currency === currency && x.status === "Paid")
        .reduce((s, x) => s + x.amount, 0);
      const receivable = invoices
        .filter((x) => x.currency === currency && x.status !== "Paid")
        .reduce((s, x) => s + x.amount, 0);
      const expense = expenses
        .filter((x) => x.currency === currency && x.status !== "Pending")
        .reduce((s, x) => s + x.amount, 0);
      const budget = projects
        .filter((x) => x.currency === currency)
        .reduce((s, x) => s + x.budget, 0);
      return { revenue, receivable, expense, budget, net: revenue - expense };
    };
    return { MMK: byCurrency("MMK"), USD: byCurrency("USD") };
  }, [projects, invoices, expenses]);

  const projectName = (id: string) =>
    projects.find((p) => p.id === id)?.name ?? "Unassigned";

  const projectPerformance = useMemo(
    () =>
      projects.map((p) => {
        const billed = invoices
          .filter(
            (i) =>
              i.projectId === p.id &&
              i.status === "Paid" &&
              i.currency === p.currency
          )
          .reduce((s, i) => s + i.amount, 0);
        const spent = expenses
          .filter(
            (e) =>
              e.projectId === p.id &&
              e.status !== "Pending" &&
              e.currency === p.currency
          )
          .reduce((s, e) => s + e.amount, 0);
        const pct = p.budget > 0 ? Math.min(100, (spent / p.budget) * 100) : 0;
        return { ...p, billed, spent, remaining: p.budget - spent, pct };
      }),
    [projects, invoices, expenses]
  );

  const addProject = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (
      !projectForm.name.trim() ||
      !projectForm.code.trim() ||
      projectForm.budget < 0
    ) {
      setStatus(
        "Project name, project code and valid budget are required"
      );
      return;
    }
    setProjects((current) => [
      ...current,
      {
        ...projectForm,
        id: uid("prj"),
        code: projectForm.code.trim().toUpperCase(),
        name: projectForm.name.trim(),
        client: projectForm.client.trim(),
        startDate: projectForm.startDate || currentDate,
      },
    ]);
    setProjectForm({ ...EMPTY_PROJECT, startDate: currentDate });
    setShowProjectForm(false);
    setStatus("Project registered · Remember to Save Workspace");
  };

  const addInvoice = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const amount = numberValue(invoiceForm.amount);
    if (
      !invoiceForm.projectId ||
      !invoiceForm.client.trim() ||
      amount <= 0 ||
      !invoiceForm.dueDate
    ) {
      setStatus(
        "Select a project, enter client, due date and positive invoice amount"
      );
      return;
    }
    setInvoices((current) => [
      ...current,
      {
        id: uid("inv"),
        number: `INV-${String(current.length + 1).padStart(5, "0")}`,
        ...invoiceForm,
        issueDate: invoiceForm.issueDate || currentDate,
        client: invoiceForm.client.trim(),
        amount,
        status: "Draft",
      },
    ]);
    setInvoiceForm({
      projectId: "",
      client: "",
      issueDate: currentDate,
      dueDate: "",
      currency: "MMK",
      amount: "",
    });
    setStatus("Invoice created as Draft · Not yet posted to the ledger");
  };

  const addExpense = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const amount = numberValue(expenseForm.amount);
    if (
      !expenseForm.projectId ||
      !expenseForm.vendor.trim() ||
      !expenseForm.description.trim() ||
      amount <= 0
    ) {
      setStatus(
        "Select a project and enter vendor, description and positive amount"
      );
      return;
    }
    setExpenses((current) => [
      ...current,
      {
        id: uid("exp"),
        ...expenseForm,
        date: expenseForm.date || currentDate,
        vendor: expenseForm.vendor.trim(),
        description: expenseForm.description.trim(),
        amount,
        status: "Pending",
      },
    ]);
    setExpenseForm({
      projectId: "",
      date: currentDate,
      vendor: "",
      category: "Materials & Supplies",
      description: "",
      currency: "MMK",
      amount: "",
    });
    setStatus("Expense submitted for approval");
  };

  const addJournal = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const amount = numberValue(journalForm.amount);
    if (
      amount <= 0 ||
      !journalForm.description.trim() ||
      journalForm.debitAccount === journalForm.creditAccount
    ) {
      setStatus(
        "Journal needs a description, positive amount and two different accounts"
      );
      return;
    }
    const entryDate = journalForm.date || currentDate;
    const entry: JournalEntry = {
      id: uid("je"),
      date: entryDate,
      reference:
        journalForm.reference.trim() ||
        `JE-${String(journals.length + 1).padStart(5, "0")}`,
      description: journalForm.description.trim(),
      currency: journalForm.currency,
      status: "Draft",
      createdAt: new Date().toISOString(),
      lines: [
        {
          accountCode: journalForm.debitAccount,
          debit: amount,
          credit: 0,
          projectId: journalForm.projectId,
        },
        {
          accountCode: journalForm.creditAccount,
          debit: 0,
          credit: amount,
          projectId: journalForm.projectId,
        },
      ],
    };
    setJournals((current) => [...current, entry]);
    setJournalForm({
      date: currentDate,
      reference: "",
      description: "",
      currency: "MMK",
      debitAccount: "5000",
      creditAccount: "1000",
      amount: "",
      projectId: "",
    });
    setStatus("Balanced journal draft created · Post after review");
  };

  const updateInvoice = (id: string, nextStatus: Invoice["status"]) =>
    setInvoices((current) =>
      current.map((x) => (x.id === id ? { ...x, status: nextStatus } : x))
    );

  const updateExpense = (id: string, nextStatus: Expense["status"]) =>
    setExpenses((current) =>
      current.map((x) => (x.id === id ? { ...x, status: nextStatus } : x))
    );

  const postJournal = (id: string) => {
    const entry = journals.find((x) => x.id === id);
    if (!entry) return;
    const debit = entry.lines.reduce((s, l) => s + l.debit, 0);
    const credit = entry.lines.reduce((s, l) => s + l.credit, 0);
    if (Math.abs(debit - credit) > 0.000001 || debit <= 0) {
      setStatus("Posting blocked · Journal is not balanced");
      return;
    }
    setJournals((current) =>
      current.map((x) => (x.id === id ? { ...x, status: "Posted" } : x))
    );
    setStatus(
      `Journal ${entry.reference} posted · Posted entries are locked in this workspace`
    );
  };

  const exportLedgerCsv = () => {
    const rows = [
      [
        "Date",
        "Reference",
        "Description",
        "Account Code",
        "Account Name",
        "Project",
        "Currency",
        "Debit",
        "Credit",
        "Status",
      ],
    ];
    journals.forEach((j) =>
      j.lines.forEach((l) =>
        rows.push([
          j.date,
          j.reference,
          j.description,
          l.accountCode,
          accounts.find((a) => a.code === l.accountCode)?.name ?? "Unknown",
          projectName(l.projectId),
          j.currency,
          String(l.debit),
          String(l.credit),
          j.status,
        ])
      )
    );
    downloadText(
      "apexiveai-general-ledger.csv",
      "\uFEFF" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n"),
      "text/csv;charset=utf-8"
    );
  };

  const filteredProjects = projectPerformance.filter((p) =>
    `${p.code} ${p.name} ${p.client}`
      .toLowerCase()
      .includes(query.toLowerCase())
  );

  if (!ready) {
    return (
      <main className="min-h-screen bg-[#080d15] p-8 text-slate-200">
        Loading Project Finance Studio…
      </main>
    );
  }

  const nav = [
    "Overview",
    "Projects",
    "Journal",
    "Invoices",
    "Expenses",
    "Accounts",
    "Reports",
  ] as const;
  const inputClass =
    "w-full rounded-lg border border-white/10 bg-[#0a1420] px-3 py-2.5 text-sm text-slate-100 outline-none transition focus:border-cyan-400/60";
  const panel = "rounded-2xl border border-white/10 bg-[#101b29] p-5";
  const button =
    "inline-flex items-center justify-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-xs font-medium text-slate-200 transition hover:bg-white/5";
  const primary =
    "inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-400 px-4 py-2.5 text-xs font-semibold text-slate-950 transition hover:bg-cyan-300";
  const selectClass = inputClass;
  const metric = (
    label: string,
    value: string,
    note: string,
    icon: ReactNode
  ) => (
    <div className={panel}>
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-400">{label}</p>
        <span className="rounded-lg bg-cyan-400/10 p-2 text-cyan-300">
          {icon}
        </span>
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-[11px] text-slate-500">{note}</p>
    </div>
  );

  return (
    <main className="min-h-screen bg-[#080d15] text-slate-100">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#0b1420]/95 px-4 py-4 backdrop-blur md:px-7">
        <div className="mx-auto flex max-w-[1680px] flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 p-3 text-cyan-300">
              <Landmark size={23} />
            </div>
            <div>
              <p className="text-[10px] font-bold tracking-[0.24em] text-cyan-300">
                APEXIVEAI · PROJECT DELIVERY
              </p>
              <h1 className="text-lg font-semibold md:text-xl">
                Project Management & Finance
              </h1>
              <p className="text-[11px] text-slate-500">
                Project controls · Double-entry journals · Financial operations
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <label className={button}>
              <RefreshCw size={14} /> Import JSON
              <input
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={(e) => {
                  void importJson(e.target.files?.[0]);
                  e.currentTarget.value = "";
                }}
              />
            </label>
            <button type="button" className={button} onClick={exportJson}>
              <Download size={14} /> Export
            </button>
            <button type="button" className={primary} onClick={save}>
              <Save size={14} /> Save Workspace
            </button>
          </div>
        </div>
        <nav className="mx-auto mt-4 flex max-w-[1680px] gap-1 overflow-x-auto pb-0.5">
          {nav.map((item) => (
            <button
              type="button"
              key={item}
              onClick={() => setTab(item)}
              className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs transition ${
                tab === item
                  ? "bg-cyan-400/15 text-cyan-200"
                  : "text-slate-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              {item}
            </button>
          ))}
        </nav>
      </header>

      <div className="mx-auto max-w-[1680px] space-y-5 p-4 md:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <ShieldCheck size={14} className="text-emerald-300" /> {status}
          </div>
          <div className="flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/5 px-3 py-1.5 text-[10px] text-amber-200">
            <Activity size={12} /> LOCAL WORKSPACE · NOT A POSTGRESQL LEDGER
          </div>
        </div>

        {tab === "Overview" && (
          <>
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {metric(
                "Portfolio Budget · MMK",
                money(totals.MMK.budget, "MMK"),
                `${projects.filter((p) => p.currency === "MMK").length} MMK projects`,
                <BriefcaseBusiness size={17} />
              )}
              {metric(
                "Paid Revenue · MMK",
                money(totals.MMK.revenue, "MMK"),
                `${invoices.filter((i) => i.currency === "MMK" && i.status === "Paid").length} paid invoices`,
                <ArrowDownLeft size={17} />
              )}
              {metric(
                "Approved / Paid Expenses · MMK",
                money(totals.MMK.expense, "MMK"),
                `${expenses.filter((e) => e.currency === "MMK" && e.status !== "Pending").length} processed expenses`,
                <ArrowUpRight size={17} />
              )}
              {metric(
                "Net Cash Indicator · MMK",
                money(totals.MMK.net, "MMK"),
                "Paid revenue less processed expenses",
                <Wallet size={17} />
              )}
            </section>
            <section className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
              <div className={panel}>
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="font-semibold">Project Financial Control</h2>
                    <p className="mt-1 text-xs text-slate-500">
                      Budget utilization from approved and paid expenses
                    </p>
                  </div>
                  <button
                    type="button"
                    className={button}
                    onClick={() => setTab("Projects")}
                  >
                    All Projects
                  </button>
                </div>
                {projectPerformance.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-500">
                    No projects registered yet. Add your first project in
                    Projects.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {projectPerformance.slice(0, 6).map((p) => (
                      <div key={p.id}>
                        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-medium">{p.name}</p>
                            <p className="text-[10px] text-slate-500">
                              {p.code} · {p.client || "Client not assigned"}
                            </p>
                          </div>
                          <p className="text-xs tabular-nums text-slate-300">
                            {money(p.spent, p.currency)} /{" "}
                            {money(p.budget, p.currency)}
                          </p>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-white/5">
                          <div
                            className={`h-full rounded-full ${
                              p.pct >= 90 ? "bg-amber-400" : "bg-cyan-400"
                            }`}
                            style={{ width: `${p.pct}%` }}
                          />
                        </div>
                        <p className="mt-1 text-[10px] text-slate-500">
                          {p.pct.toFixed(1)}% budget used ·{" "}
                          {money(p.remaining, p.currency)} remaining
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className={panel}>
                <h2 className="font-semibold">Finance Snapshot</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Multi-currency totals are kept separate
                </p>
                <div className="mt-5 space-y-4">
                  {(["MMK", "USD"] as Currency[]).map((c) => (
                    <div
                      key={c}
                      className="rounded-xl border border-white/10 bg-[#0b1420] p-4"
                    >
                      <div className="flex justify-between">
                        <span className="text-xs font-semibold text-cyan-200">
                          {c}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          Portfolio
                        </span>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-[10px] text-slate-500">
                            Receivables
                          </p>
                          <p className="mt-1 text-sm font-semibold">
                            {money(totals[c].receivable, c)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-500">
                            Processed Expenses
                          </p>
                          <p className="mt-1 text-sm font-semibold">
                            {money(totals[c].expense, c)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 rounded-xl border border-amber-400/15 bg-amber-400/5 p-3 text-[11px] leading-5 text-amber-100/80">
                  This overview is an operational summary, not a bank
                  reconciliation or statutory financial statement.
                </div>
              </div>
            </section>
            <section className="grid gap-3 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => setTab("Projects")}
                className={`${panel} text-left transition hover:border-cyan-400/30`}
              >
                <Building2 className="mb-3 text-cyan-300" />
                <p className="text-sm font-semibold">Project Register</p>
                <p className="mt-1 text-xs text-slate-500">
                  {projects.length} registered projects
                </p>
              </button>
              <button
                type="button"
                onClick={() => setTab("Journal")}
                className={`${panel} text-left transition hover:border-cyan-400/30`}
              >
                <FileText className="mb-3 text-cyan-300" />
                <p className="text-sm font-semibold">General Journal</p>
                <p className="mt-1 text-xs text-slate-500">
                  {journals.length} journal entries ·{" "}
                  {journals.filter((j) => j.status === "Posted").length} posted
                </p>
              </button>
              <button
                type="button"
                onClick={() => setTab("Invoices")}
                className={`${panel} text-left transition hover:border-cyan-400/30`}
              >
                <Wallet className="mb-3 text-cyan-300" />
                <p className="text-sm font-semibold">Billing & Receivables</p>
                <p className="mt-1 text-xs text-slate-500">
                  {invoices.length} invoices ·{" "}
                  {invoices.filter((i) => i.status !== "Paid").length}{" "}
                  outstanding
                </p>
              </button>
            </section>
          </>
        )}

        {tab === "Projects" && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Project Register</h2>
                <p className="text-xs text-slate-500">
                  Track client, contract budget, timeline and financial
                  performance
                </p>
              </div>
              <button
                type="button"
                className={primary}
                onClick={() => setShowProjectForm((v) => !v)}
              >
                <Plus size={15} /> New Project
              </button>
            </div>
            {showProjectForm && (
              <form
                onSubmit={addProject}
                className={`${panel} grid gap-3 md:grid-cols-3`}
              >
                <input
                  className={inputClass}
                  placeholder="Project code · e.g. APEX-001"
                  value={projectForm.code}
                  onChange={(e) =>
                    setProjectForm((p) => ({ ...p, code: e.target.value }))
                  }
                  required
                />
                <input
                  className={inputClass}
                  placeholder="Project name"
                  value={projectForm.name}
                  onChange={(e) =>
                    setProjectForm((p) => ({ ...p, name: e.target.value }))
                  }
                  required
                />
                <input
                  className={inputClass}
                  placeholder="Client / Employer"
                  value={projectForm.client}
                  onChange={(e) =>
                    setProjectForm((p) => ({ ...p, client: e.target.value }))
                  }
                />
                <select
                  className={selectClass}
                  value={projectForm.status}
                  onChange={(e) =>
                    setProjectForm((p) => ({
                      ...p,
                      status: e.target.value as ProjectStatus,
                    }))
                  }
                >
                  <option>Planning</option>
                  <option>Active</option>
                  <option>On Hold</option>
                  <option>Completed</option>
                </select>
                <select
                  className={selectClass}
                  value={projectForm.currency}
                  onChange={(e) =>
                    setProjectForm((p) => ({
                      ...p,
                      currency: e.target.value as Currency,
                    }))
                  }
                >
                  <option>MMK</option>
                  <option>USD</option>
                </select>
                <input
                  className={inputClass}
                  type="number"
                  min="0"
                  placeholder="Approved budget"
                  value={projectForm.budget || ""}
                  onChange={(e) =>
                    setProjectForm((p) => ({
                      ...p,
                      budget: numberValue(e.target.value),
                    }))
                  }
                />
                <input
                  className={inputClass}
                  type="date"
                  value={projectForm.startDate}
                  onChange={(e) =>
                    setProjectForm((p) => ({
                      ...p,
                      startDate: e.target.value,
                    }))
                  }
                />
                <input
                  className={inputClass}
                  type="date"
                  value={projectForm.endDate}
                  onChange={(e) =>
                    setProjectForm((p) => ({ ...p, endDate: e.target.value }))
                  }
                />
                <div className="flex gap-2">
                  <button className={primary} type="submit">
                    Create Project
                  </button>
                  <button
                    className={button}
                    type="button"
                    onClick={() => setShowProjectForm(false)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
            <div className={panel}>
              <div className="mb-4 flex items-center gap-2 rounded-lg border border-white/10 bg-[#0a1420] px-3">
                <Search size={15} className="text-slate-500" />
                <input
                  className="w-full bg-transparent py-2.5 text-sm outline-none"
                  placeholder="Search projects, code or client…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-left text-xs">
                  <thead className="text-[10px] uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="p-3">Project</th>
                      <th className="p-3">Client</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Budget</th>
                      <th className="p-3">Spent</th>
                      <th className="p-3">Remaining</th>
                      <th className="p-3">Usage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProjects.map((p) => (
                      <tr key={p.id} className="border-t border-white/5">
                        <td className="p-3">
                          <p className="font-semibold">{p.name}</p>
                          <p className="mt-1 text-[10px] text-slate-500">
                            {p.code} · {p.startDate} – {p.endDate || "TBD"}
                          </p>
                        </td>
                        <td className="p-3 text-slate-300">
                          {p.client || "—"}
                        </td>
                        <td className="p-3">
                          <span className="rounded-full bg-white/5 px-2 py-1">
                            {p.status}
                          </span>
                        </td>
                        <td className="p-3 tabular-nums">
                          {money(p.budget, p.currency)}
                        </td>
                        <td className="p-3 tabular-nums">
                          {money(p.spent, p.currency)}
                        </td>
                        <td className="p-3 tabular-nums">
                          {money(p.remaining, p.currency)}
                        </td>
                        <td className="p-3">{p.pct.toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredProjects.length === 0 && (
                  <p className="p-8 text-center text-sm text-slate-500">
                    No matching projects.
                  </p>
                )}
              </div>
            </div>
          </>
        )}

        {tab === "Journal" && (
          <>
            <div>
              <h2 className="text-lg font-semibold">General Journal</h2>
              <p className="text-xs text-slate-500">
                Balanced debit / credit entries · Draft and posted states
              </p>
            </div>
            <form
              onSubmit={addJournal}
              className={`${panel} grid gap-3 md:grid-cols-4`}
            >
              <input
                className={inputClass}
                type="date"
                value={journalForm.date}
                onChange={(e) =>
                  setJournalForm((p) => ({ ...p, date: e.target.value }))
                }
              />
              <input
                className={inputClass}
                placeholder="Reference (optional)"
                value={journalForm.reference}
                onChange={(e) =>
                  setJournalForm((p) => ({ ...p, reference: e.target.value }))
                }
              />
              <select
                className={selectClass}
                value={journalForm.currency}
                onChange={(e) =>
                  setJournalForm((p) => ({
                    ...p,
                    currency: e.target.value as Currency,
                  }))
                }
              >
                <option>MMK</option>
                <option>USD</option>
              </select>
              <select
                className={selectClass}
                value={journalForm.projectId}
                onChange={(e) =>
                  setJournalForm((p) => ({ ...p, projectId: e.target.value }))
                }
              >
                <option value="">No project allocation</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} · {p.name}
                  </option>
                ))}
              </select>
              <input
                className={`${inputClass} md:col-span-2`}
                placeholder="Transaction description"
                value={journalForm.description}
                onChange={(e) =>
                  setJournalForm((p) => ({
                    ...p,
                    description: e.target.value,
                  }))
                }
                required
              />
              <select
                className={selectClass}
                value={journalForm.debitAccount}
                onChange={(e) =>
                  setJournalForm((p) => ({
                    ...p,
                    debitAccount: e.target.value,
                  }))
                }
              >
                {accounts.map((a) => (
                  <option key={a.code} value={a.code}>
                    {a.code} · {a.name}
                  </option>
                ))}
              </select>
              <select
                className={selectClass}
                value={journalForm.creditAccount}
                onChange={(e) =>
                  setJournalForm((p) => ({
                    ...p,
                    creditAccount: e.target.value,
                  }))
                }
              >
                {accounts.map((a) => (
                  <option key={a.code} value={a.code}>
                    {a.code} · {a.name}
                  </option>
                ))}
              </select>
              <input
                className={inputClass}
                type="number"
                min="0.01"
                step="0.01"
                placeholder="Amount"
                value={journalForm.amount}
                onChange={(e) =>
                  setJournalForm((p) => ({ ...p, amount: e.target.value }))
                }
                required
              />
              <div className="flex items-center gap-2 text-[10px] text-emerald-300">
                <ShieldCheck size={14} /> Auto-balanced two-line entry
              </div>
              <div className="md:col-span-4">
                <button className={primary} type="submit">
                  <Plus size={14} /> Add Journal Draft
                </button>
              </div>
            </form>
            <div className={panel}>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-semibold">Journal Register</h3>
                  <p className="text-xs text-slate-500">
                    Posted entries are locked in this browser interface
                  </p>
                </div>
                <button
                  type="button"
                  className={button}
                  onClick={exportLedgerCsv}
                >
                  <Download size={14} /> Export Ledger CSV
                </button>
              </div>
              <div className="space-y-3">
                {journals.length === 0 && (
                  <p className="p-6 text-center text-sm text-slate-500">
                    No journal entries yet.
                  </p>
                )}
                {[...journals].reverse().map((j) => (
                  <div
                    key={j.id}
                    className="rounded-xl border border-white/10 bg-[#0b1420] p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">
                          {j.description}
                        </p>
                        <p className="mt-1 text-[10px] text-slate-500">
                          {j.date} · {j.reference} · {j.currency}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-full px-2 py-1 text-[10px] ${
                            j.status === "Posted"
                              ? "bg-emerald-400/10 text-emerald-300"
                              : "bg-amber-400/10 text-amber-200"
                          }`}
                        >
                          {j.status}
                        </span>
                        {j.status === "Draft" && (
                          <button
                            type="button"
                            className={button}
                            onClick={() => postJournal(j.id)}
                          >
                            Post Entry
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {j.lines.map((l, i) => (
                        <div
                          key={i}
                          className="flex justify-between rounded-lg bg-white/[0.03] p-2 text-xs"
                        >
                          <span>
                            {l.accountCode} ·{" "}
                            {
                              accounts.find((a) => a.code === l.accountCode)
                                ?.name
                            }
                          </span>
                          <span className="tabular-nums">
                            {l.debit
                              ? `Dr ${money(l.debit, j.currency)}`
                              : `Cr ${money(l.credit, j.currency)}`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {tab === "Invoices" && (
          <>
            <div>
              <h2 className="text-lg font-semibold">Invoices & Receivables</h2>
              <p className="text-xs text-slate-500">
                Create invoices, track payment status and outstanding amounts
              </p>
            </div>
            <form
              onSubmit={addInvoice}
              className={`${panel} grid gap-3 md:grid-cols-3`}
            >
              <select
                className={selectClass}
                value={invoiceForm.projectId}
                onChange={(e) =>
                  setInvoiceForm((p) => ({ ...p, projectId: e.target.value }))
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
                className={inputClass}
                placeholder="Client / Bill to"
                value={invoiceForm.client}
                onChange={(e) =>
                  setInvoiceForm((p) => ({ ...p, client: e.target.value }))
                }
                required
              />
              <input
                className={inputClass}
                type="date"
                value={invoiceForm.issueDate}
                onChange={(e) =>
                  setInvoiceForm((p) => ({ ...p, issueDate: e.target.value }))
                }
              />
              <input
                className={inputClass}
                type="date"
                value={invoiceForm.dueDate}
                onChange={(e) =>
                  setInvoiceForm((p) => ({ ...p, dueDate: e.target.value }))
                }
                required
              />
              <select
                className={selectClass}
                value={invoiceForm.currency}
                onChange={(e) =>
                  setInvoiceForm((p) => ({
                    ...p,
                    currency: e.target.value as Currency,
                  }))
                }
              >
                <option>MMK</option>
                <option>USD</option>
              </select>
              <input
                className={inputClass}
                type="number"
                min="0.01"
                step="0.01"
                placeholder="Invoice amount"
                value={invoiceForm.amount}
                onChange={(e) =>
                  setInvoiceForm((p) => ({ ...p, amount: e.target.value }))
                }
                required
              />
              <div className="md:col-span-3">
                <button className={primary} type="submit">
                  <Plus size={14} /> Create Draft Invoice
                </button>
              </div>
            </form>
            <div className={`${panel} overflow-x-auto`}>
              <table className="w-full min-w-[820px] text-left text-xs">
                <thead className="text-[10px] uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="p-3">Invoice</th>
                    <th className="p-3">Project</th>
                    <th className="p-3">Client</th>
                    <th className="p-3">Due</th>
                    <th className="p-3">Amount</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="border-t border-white/5">
                      <td className="p-3 font-medium">{inv.number}</td>
                      <td className="p-3">{projectName(inv.projectId)}</td>
                      <td className="p-3">{inv.client}</td>
                      <td className="p-3">{inv.dueDate || "—"}</td>
                      <td className="p-3 tabular-nums">
                        {money(inv.amount, inv.currency)}
                      </td>
                      <td className="p-3">
                        <select
                          className="rounded-lg border border-white/10 bg-[#0a1420] px-2 py-1 text-xs"
                          value={inv.status}
                          onChange={(e) =>
                            updateInvoice(
                              inv.id,
                              e.target.value as Invoice["status"]
                            )
                          }
                        >
                          <option>Draft</option>
                          <option>Sent</option>
                          <option>Paid</option>
                          <option>Overdue</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {invoices.length === 0 && (
                <p className="p-8 text-center text-sm text-slate-500">
                  No invoices created yet.
                </p>
              )}
            </div>
          </>
        )}

        {tab === "Expenses" && (
          <>
            <div>
              <h2 className="text-lg font-semibold">Project Expenses</h2>
              <p className="text-xs text-slate-500">
                Record project costs and track approval status
              </p>
            </div>
            <form
              onSubmit={addExpense}
              className={`${panel} grid gap-3 md:grid-cols-3`}
            >
              <select
                className={selectClass}
                value={expenseForm.projectId}
                onChange={(e) =>
                  setExpenseForm((p) => ({ ...p, projectId: e.target.value }))
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
                className={inputClass}
                type="date"
                value={expenseForm.date}
                onChange={(e) =>
                  setExpenseForm((p) => ({ ...p, date: e.target.value }))
                }
              />
              <input
                className={inputClass}
                placeholder="Vendor / Supplier"
                value={expenseForm.vendor}
                onChange={(e) =>
                  setExpenseForm((p) => ({ ...p, vendor: e.target.value }))
                }
                required
              />
              <select
                className={selectClass}
                value={expenseForm.category}
                onChange={(e) =>
                  setExpenseForm((p) => ({ ...p, category: e.target.value }))
                }
              >
                <option>Materials & Supplies</option>
                <option>Labor Cost</option>
                <option>Equipment & Rental</option>
                <option>Transport & Logistics</option>
                <option>Other Project Expenses</option>
              </select>
              <select
                className={selectClass}
                value={expenseForm.currency}
                onChange={(e) =>
                  setExpenseForm((p) => ({
                    ...p,
                    currency: e.target.value as Currency,
                  }))
                }
              >
                <option>MMK</option>
                <option>USD</option>
              </select>
              <input
                className={inputClass}
                type="number"
                min="0.01"
                step="0.01"
                placeholder="Amount"
                value={expenseForm.amount}
                onChange={(e) =>
                  setExpenseForm((p) => ({ ...p, amount: e.target.value }))
                }
                required
              />
              <input
                className={`${inputClass} md:col-span-3`}
                placeholder="Expense description"
                value={expenseForm.description}
                onChange={(e) =>
                  setExpenseForm((p) => ({
                    ...p,
                    description: e.target.value,
                  }))
                }
                required
              />
              <div className="md:col-span-3">
                <button className={primary} type="submit">
                  <Plus size={14} /> Submit Expense
                </button>
              </div>
            </form>
            <div className={`${panel} overflow-x-auto`}>
              <table className="w-full min-w-[820px] text-left text-xs">
                <thead className="text-[10px] uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="p-3">Date</th>
                    <th className="p-3">Project</th>
                    <th className="p-3">Vendor</th>
                    <th className="p-3">Category</th>
                    <th className="p-3">Description</th>
                    <th className="p-3">Amount</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((exp) => (
                    <tr key={exp.id} className="border-t border-white/5">
                      <td className="p-3">{exp.date}</td>
                      <td className="p-3">{projectName(exp.projectId)}</td>
                      <td className="p-3">{exp.vendor}</td>
                      <td className="p-3">{exp.category}</td>
                      <td className="p-3">{exp.description}</td>
                      <td className="p-3 tabular-nums">
                        {money(exp.amount, exp.currency)}
                      </td>
                      <td className="p-3">
                        <select
                          className="rounded-lg border border-white/10 bg-[#0a1420] px-2 py-1 text-xs"
                          value={exp.status}
                          onChange={(e) =>
                            updateExpense(
                              exp.id,
                              e.target.value as Expense["status"]
                            )
                          }
                        >
                          <option>Pending</option>
                          <option>Approved</option>
                          <option>Paid</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {expenses.length === 0 && (
                <p className="p-8 text-center text-sm text-slate-500">
                  No expenses recorded yet.
                </p>
              )}
            </div>
          </>
        )}

        {tab === "Accounts" && (
          <div className={panel}>
            <h2 className="mb-1 font-semibold">Chart of Accounts</h2>
            <p className="mb-4 text-xs text-slate-500">
              Standard project accounting accounts used by journal entries
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-left text-xs">
                <thead className="text-[10px] uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="p-3">Code</th>
                    <th className="p-3">Account Name</th>
                    <th className="p-3">Type</th>
                    <th className="p-3">Normal Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((a) => (
                    <tr key={a.code} className="border-t border-white/5">
                      <td className="p-3 font-mono">{a.code}</td>
                      <td className="p-3 font-medium">{a.name}</td>
                      <td className="p-3 text-slate-300">{a.type}</td>
                      <td className="p-3 text-slate-400">{a.normal}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "Reports" && (
          <div className="grid gap-4 md:grid-cols-2">
            {(["MMK", "USD"] as Currency[]).map((c) => (
              <div key={c} className={`${panel} space-y-3`}>
                <h2 className="font-semibold">Financial Summary · {c}</h2>
                <div className="flex justify-between border-b border-white/5 py-2 text-xs">
                  <span className="text-slate-400">Total Project Budget</span>
                  <span className="tabular-nums font-medium">
                    {money(totals[c].budget, c)}
                  </span>
                </div>
                <div className="flex justify-between border-b border-white/5 py-2 text-xs">
                  <span className="text-slate-400">Paid Revenue</span>
                  <span className="tabular-nums font-medium text-emerald-300">
                    {money(totals[c].revenue, c)}
                  </span>
                </div>
                <div className="flex justify-between border-b border-white/5 py-2 text-xs">
                  <span className="text-slate-400">Open Receivables</span>
                  <span className="tabular-nums font-medium text-cyan-200">
                    {money(totals[c].receivable, c)}
                  </span>
                </div>
                <div className="flex justify-between border-b border-white/5 py-2 text-xs">
                  <span className="text-slate-400">
                    Approved / Paid Expenses
                  </span>
                  <span className="tabular-nums font-medium text-amber-200">
                    {money(totals[c].expense, c)}
                  </span>
                </div>
                <div className="flex justify-between py-2 text-sm font-semibold">
                  <span>Net Cash Indicator</span>
                  <span className="tabular-nums">
                    {money(totals[c].net, c)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}