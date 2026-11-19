/**
 * ApexiveAI Shared BIM Core
 * Canonical cross-discipline project schema and browser persistence adapters.
 * Units: meters. This is an application-native schema, not an IFC implementation.
 */

export const BIM_CORE_FORMAT = "ApexiveAI-BIM-Project" as const;
export const BIM_CORE_VERSION = 1 as const;
export const BIM_PROJECT_STORAGE_KEY = "apexiveai-bim-project-v1";

export type Discipline = "Architecture" | "Structure" | "MEP";
export type BIMLevel = {
  id: string;
  name: string;
  elevation: number;
  height: number;
};
export type BIMGrid = {
  id: string;
  name: string;
  axis: "X" | "Z";
  position: number;
};
export type BIMElement = {
  id: string;
  sourceId: string;
  discipline: Discipline;
  category: string;
  name: string;
  levelId: string | null;
  visible: boolean;
  transform: { x: number; y: number; z: number; rotationY: number };
  dimensions: { length: number; width: number; height: number };
  material: string | null;
  color: string | null;
  relationships: { hostId?: string; connectedTo?: string[] };
  properties: Record<string, unknown>;
};
export type BIMAuditEntry = {
  id: string;
  action:
    | "project-created"
    | "legacy-imported"
    | "element-updated"
    | "level-added"
    | "grid-added"
    | "project-saved"
    | "project-imported";
  message: string;
  timestamp: string;
};
export type BIMProject = {
  format: typeof BIM_CORE_FORMAT;
  schemaVersion: typeof BIM_CORE_VERSION;
  project: {
    id: string;
    name: string;
    units: "meters";
    createdAt: string;
    updatedAt: string;
  };
  levels: BIMLevel[];
  grids: BIMGrid[];
  elements: BIMElement[];
  auditTrail: BIMAuditEntry[];
};

export const LEGACY_STORAGE_KEYS = {
  Architecture: "apexiveai-architecture-model-v1",
  Structure: "apexiveai-structure-model-v1",
  MEP: "apexiveai-mep-model-v1",
} as const;

const now = () => new Date().toISOString();
const id = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const num = (value: unknown, fallback = 0) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;
const str = (value: unknown, fallback = "") =>
  typeof value === "string" ? value : fallback;
const bool = (value: unknown, fallback = true) =>
  typeof value === "boolean" ? value : fallback;

export function createEmptyBIMProject(
  name = "Untitled Engineering Project",
  timestamp = ""
): BIMProject {
  return {
    format: BIM_CORE_FORMAT,
    schemaVersion: BIM_CORE_VERSION,
    project: {
      id: "bim-project-default",
      name,
      units: "meters",
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    levels: [
      {
        id: "bim-level-00",
        name: "Level 00 - Ground",
        elevation: 0,
        height: 3.2,
      },
    ],
    grids: [],
    elements: [],
    auditTrail: timestamp
      ? [
          {
            id: "audit-initial",
            action: "project-created",
            message: "BIM project created",
            timestamp,
          },
        ]
      : [],
  };
}

function commonElement(
  discipline: Discipline,
  raw: Record<string, unknown>
): BIMElement {
  const sourceId = str(raw.id, id("legacy-element"));
  const category = str(raw.kind, "generic");
  const x = num(raw.x);
  const y = num(raw.y, num(raw.elevation));
  const z = num(raw.z);
  const rotation = num(raw.rotation);
  const width =
    discipline === "Architecture"
      ? num(raw.thickness, num(raw.width))
      : num(raw.width, num(raw.thickness));
  const height = num(raw.height);
  const length =
    discipline === "Architecture"
      ? num(raw.width, num(raw.length))
      : num(raw.length, num(raw.width));
  const properties = { ...raw };
  delete properties.id;
  delete properties.name;
  delete properties.visible;
  return {
    id: `${discipline.toLowerCase()}:${sourceId}`,
    sourceId,
    discipline,
    category,
    name: str(raw.name, `${discipline} ${category}`),
    levelId: str(raw.levelId) || null,
    visible: bool(raw.visible),
    transform: { x, y, z, rotationY: rotation },
    dimensions: { length, width, height },
    material: str(raw.material) || null,
    color: str(raw.color) || null,
    relationships: {
      ...(str(raw.hostWallId)
        ? { hostId: `architecture:${str(raw.hostWallId)}` }
        : {}),
    },
    properties,
  };
}

export function normalizeLegacyDocument(
  discipline: Discipline,
  rawDocument: unknown
): {
  elements: BIMElement[];
  levels: BIMLevel[];
  grids: BIMGrid[];
  warnings: string[];
} {
  const warnings: string[] = [];
  if (!isRecord(rawDocument) || !Array.isArray(rawDocument.elements)) {
    return {
      elements: [],
      levels: [],
      grids: [],
      warnings: [`${discipline}: unsupported or empty legacy document`],
    };
  }
  const rawElements = rawDocument.elements.filter(isRecord);
  const elements: BIMElement[] = [];
  const grids: BIMGrid[] = [];
  for (const raw of rawElements) {
    if (discipline === "Structure" && raw.kind === "grid") {
      grids.push({
        id: `structure:${str(raw.id, id("grid"))}`,
        name: str(raw.name, "Structural Grid"),
        axis: "X",
        position: num(raw.x),
      });
      continue;
    }
    elements.push(commonElement(discipline, raw));
  }
  const levels: BIMLevel[] = [];
  if (discipline === "Architecture" && Array.isArray(rawDocument.levels)) {
    for (const item of rawDocument.levels.filter(isRecord)) {
      levels.push({
        id: str(item.id, id("level")),
        name: str(item.name, "Level"),
        elevation: num(item.elevation),
        height: num(item.height, 3.2),
      });
    }
  }
  if (discipline !== "Architecture" && levels.length === 0) {
    const elevations = [
      ...new Set(
        elements.map((item) => item.transform.y).filter(Number.isFinite)
      ),
    ].sort((a, b) => a - b);
    if (elevations.length) {
      levels.push(
        ...elevations.map((elevation, index) => ({
          id: `${discipline.toLowerCase()}-derived-level-${index}`,
          name: `${discipline} Level ${index + 1}`,
          elevation,
          height: 3.2,
        }))
      );
    }
  }
  if (!elements.length && !levels.length && !grids.length) {
    warnings.push(`${discipline}: no importable model records found`);
  }
  return { elements, levels, grids, warnings };
}

export function importLegacyBrowserModels(project: BIMProject): {
  project: BIMProject;
  imported: Record<Discipline, number>;
  warnings: string[];
} {
  const next = structuredClone(project);
  const imported: Record<Discipline, number> = {
    Architecture: 0,
    Structure: 0,
    MEP: 0,
  };
  const warnings: string[] = [];
  const known = new Set(next.elements.map((item) => item.id));
  for (const discipline of ["Architecture", "Structure", "MEP"] as const) {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEYS[discipline]);
    if (!raw) continue;
    try {
      const parsed: unknown = JSON.parse(raw);
      const normalized = normalizeLegacyDocument(discipline, parsed);
      warnings.push(...normalized.warnings);
      for (const element of normalized.elements) {
        if (known.has(element.id)) continue;
        known.add(element.id);
        next.elements.push(element);
        imported[discipline] += 1;
      }
      for (const level of normalized.levels) {
        if (!next.levels.some((item) => item.id === level.id)) {
          next.levels.push(level);
        }
      }
      for (const grid of normalized.grids) {
        if (!next.grids.some((item) => item.id === grid.id)) {
          next.grids.push(grid);
        }
      }
    } catch {
      warnings.push(`${discipline}: saved legacy data could not be parsed`);
    }
  }
  const stamp = now();
  const total = imported.Architecture + imported.Structure + imported.MEP;
  if (total) {
    next.auditTrail.unshift({
      id: id("audit"),
      action: "legacy-imported",
      message: `Imported ${total} elements from existing discipline workspaces`,
      timestamp: stamp,
    });
  }
  next.project.updatedAt = stamp;
  return { project: next, imported, warnings };
}

export type BIMValidationResult =
  | { valid: true; errors: []; value: BIMProject }
  | { valid: false; errors: string[]; value?: never };

export function validateBIMProject(input: unknown): BIMValidationResult {
  const errors: string[] = [];

  if (!isRecord(input)) {
    return { valid: false, errors: ["Project must be a JSON object"] };
  }

  if (input.format !== BIM_CORE_FORMAT) {
    errors.push(`format must be ${BIM_CORE_FORMAT}`);
  }
  if (input.schemaVersion !== BIM_CORE_VERSION) {
    errors.push(`unsupported schemaVersion: ${String(input.schemaVersion)}`);
  }
  if (!isRecord(input.project) || typeof input.project.name !== "string") {
    errors.push("project.name is required");
  }
  if (!Array.isArray(input.levels)) errors.push("levels must be an array");
  if (!Array.isArray(input.grids)) errors.push("grids must be an array");
  if (!Array.isArray(input.elements)) {
    errors.push("elements must be an array");
  }
  if (!Array.isArray(input.auditTrail)) {
    errors.push("auditTrail must be an array");
  }

  if (Array.isArray(input.elements)) {
    const ids = new Set<string>();
    for (const [index, item] of input.elements.entries()) {
      if (
        !isRecord(item) ||
        typeof item.id !== "string" ||
        !["Architecture", "Structure", "MEP"].includes(
          String(item.discipline)
        ) ||
        !isRecord(item.transform) ||
        !isRecord(item.dimensions)
      ) {
        errors.push(`elements[${index}] has an invalid BIM element shape`);
        continue;
      }
      if (ids.has(item.id)) errors.push(`duplicate element id: ${item.id}`);
      ids.add(item.id);
    }
  }

  if (errors.length > 0) return { valid: false, errors };
  return { valid: true, errors: [], value: input as unknown as BIMProject };
}

export function addAudit(
  project: BIMProject,
  action: BIMAuditEntry["action"],
  message: string
): BIMProject {
  const stamp = now();
  return {
    ...project,
    project: { ...project.project, updatedAt: stamp },
    auditTrail: [
      { id: id("audit"), action, message, timestamp: stamp },
      ...project.auditTrail,
    ].slice(0, 500),
  };
}

export function saveBIMProject(project: BIMProject): BIMProject {
  const saved = addAudit(
    project,
    "project-saved",
    "Project saved to this browser's local storage"
  );
  localStorage.setItem(BIM_PROJECT_STORAGE_KEY, JSON.stringify(saved));
  return saved;
}

export function loadBIMProject(): BIMProject | null {
  const raw = localStorage.getItem(BIM_PROJECT_STORAGE_KEY);
  if (!raw) return null;
  const parsed: unknown = JSON.parse(raw);
  const validation = validateBIMProject(parsed);
  if (!validation.valid) throw new Error(validation.errors.join("; "));
  return validation.value;
}

export function downloadBIMProject(project: BIMProject): void {
  const blob = new Blob([JSON.stringify(project, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${
    project.project.name
      .trim()
      .replace(/[^a-z0-9-_]+/gi, "-")
      .toLowerCase() || "apexiveai-bim-project"
  }.bim.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function addProjectLevel(
  project: BIMProject,
  name: string,
  elevation: number,
  height: number
): BIMProject {
  const level: BIMLevel = {
    id: id("bim-level"),
    name: name.trim(),
    elevation,
    height,
  };
  return addAudit(
    { ...project, levels: [...project.levels, level] },
    "level-added",
    `Added level ${level.name}`
  );
}

export function addProjectGrid(
  project: BIMProject,
  name: string,
  axis: "X" | "Z",
  position: number
): BIMProject {
  const grid: BIMGrid = {
    id: id("bim-grid"),
    name: name.trim(),
    axis,
    position,
  };
  return addAudit(
    { ...project, grids: [...project.grids, grid] },
    "grid-added",
    `Added ${axis} grid ${name}`
  );
}