"use client";

import { useState } from "react";
import {
  Ruler, Building2, Cuboid, Layers3, Box, Cpu,
  FolderOpen, Compass, Settings2, Search, Cloud,
  ChevronDown, FilePlus2, PanelRight, Grid3X3,
  Workflow, FileText, Calculator, Wallet, ClipboardList,
  HardHat, Package, Handshake,
} from "lucide-react";

import CadEditor from "@/components/CadEditor";
import ModelViewport from "@/components/ModelViewport";
import ArchitectureStudio from "@/components/ArchitectureStudio";
import StructureStudio from "@/components/StructureStudio";
import MEPStudio from "@/components/MEPStudio";
import BIMCoreStudio from "@/components/BIMCoreStudio";
import ConstructionDocumentationStudio from "@/components/ConstructionDocumentationStudio";
import QuantityCostStudio from "@/components/QuantityCostStudio";
import ProjectFinanceStudio from "@/components/ProjectFinanceStudio";
import ProjectManagementStudio from "@/components/ProjectManagementStudio";
import ConstructionOperationsStudio from "@/components/ConstructionOperationsStudio";
import ProcurementInventoryStudio from "@/components/ProcurementInventoryStudio";
import SubcontractorContractStudio from "@/components/SubcontractorContractStudio";

const modules = [
  { id: "cad", name: "CAD Drafting", icon: Ruler, engine: "APEXIVEAI 2D CAD ENGINE" },
  { id: "bim", name: "BIM Core", icon: Building2, engine: "SHARED BIM DATA CORE" },
  { id: "3d", name: "3D Studio", icon: Cuboid, engine: "THREE.JS 3D VIEWPORT" },
  { id: "architecture", name: "Architecture", icon: Layers3, engine: "ARCHITECTURE DESIGN STUDIO" },
  { id: "structure", name: "Structure", icon: Box, engine: "STRUCTURAL ENGINEERING STUDIO" },
  { id: "mep", name: "MEP Engineering", icon: Cpu, engine: "MEP ENGINEERING STUDIO" },
  { id: "documentation", name: "Construction Docs", icon: FileText, engine: "CONSTRUCTION DOCUMENTATION" },
  { id: "quantity-cost", name: "Quantity & Cost", icon: Calculator, engine: "BIM QUANTITY & COST ESTIMATION" },
  { id: "project-management", name: "Project Management", icon: ClipboardList, engine: "ENTERPRISE PROJECT MANAGEMENT" },
  { id: "project-finance", name: "Project Finance", icon: Wallet, engine: "PROJECT FINANCE WORKSPACE" },
  { id: "site-operations", name: "Site Operations", icon: HardHat, engine: "CONSTRUCTION SITE OPERATIONS" },
  { id: "procurement", name: "Procurement & Inventory", icon: Package, engine: "PROCUREMENT & INVENTORY" },
  { id: "contracts", name: "Subcontractor Contracts", icon: Handshake, engine: "CONTRACT MANAGEMENT" },
] as const;

type ModuleId = (typeof modules)[number]["id"];

function ActiveModuleView({ moduleId }: { moduleId: ModuleId }) {
  switch (moduleId) {
    case "cad": return <CadEditor />;
    case "bim": return <BIMCoreStudio />;
    case "3d": return <ModelViewport />;
    case "architecture": return <ArchitectureStudio />;
    case "structure": return <StructureStudio />;
    case "mep": return <MEPStudio />;
    case "documentation": return <ConstructionDocumentationStudio />;
    case "quantity-cost": return <QuantityCostStudio />;
    case "project-management": return <ProjectManagementStudio />;
    case "project-finance": return <ProjectFinanceStudio />;
    case "site-operations": return <ConstructionOperationsStudio />;
    case "procurement": return <ProcurementInventoryStudio />;
    case "contracts": return <SubcontractorContractStudio />;
    default: return <CadEditor />;
  }
}

export default function Home() {
  const [activeModule, setActiveModule] = useState<ModuleId>("cad");
  const active = modules.find((module) => module.id === activeModule) ?? modules[0];
  const ActiveIcon = active.icon;

  return (
    <main className="application">
      <header className="topbar">
        <div className="brand">
          <div className="brand-symbol">A</div>
          <div className="brand-name">
            <strong>APEXIVE<span>AI</span></strong>
            <small>DESIGN & ENGINEERING</small>
          </div>
        </div>

        <div className="top-divider" />

        <div className="project-context">
          <Building2 size={17} />
          <span>Workspace</span>
          <span>/</span>
          <strong>Untitled Project</strong>
          <ChevronDown size={14} />
        </div>

        <div className="topbar-spacer" />

        <div className="cloud-status">
          <span className="live-dot" />
          Local Workspace
        </div>

        <button className="top-icon" type="button" aria-label="Search"><Search size={18} /></button>
        <button className="top-icon" type="button" aria-label="Settings"><Settings2 size={18} /></button>
        <button className="profile-button" type="button">BH</button>
      </header>

      <nav className="module-nav">
        <div className="nav-label">ENGINEERING SUITE</div>

        {modules.map((module) => {
          const Icon = module.icon;
          return (
            <button
              key={module.id}
              type="button"
              className={`module-item ${activeModule === module.id ? "selected" : ""}`}
              onClick={() => setActiveModule(module.id)}
              aria-current={activeModule === module.id ? "page" : undefined}
            >
              <Icon size={17} />
              <span>{module.name}</span>
            </button>
          );
        })}

        <div className="nav-divider" />

        <button className="module-item" type="button" onClick={() => setActiveModule("documentation")}>
          <FolderOpen size={17} />
          <span>Project Files</span>
        </button>
        <button className="module-item" type="button" onClick={() => setActiveModule("procurement")}>
          <Compass size={17} />
          <span>Marketplace / Suppliers</span>
        </button>
      </nav>

      <section className="workspace">
        <div className="workspace-header">
          <div>
            <div className="breadcrumb">ENGINEERING <span>/</span> {active.name.toUpperCase()}</div>
            <h1>{active.name} Workspace</h1>
            <p>Professional engineering design, modeling and construction management environment.</p>
          </div>

          <div className="header-actions">
            <button className="secondary-action" type="button">
              <FilePlus2 size={16} />
              New Project
            </button>
            <button className="primary-action" type="button">
              <Cloud size={16} />
              Publish
            </button>
          </div>
        </div>

        <div className="document-tabs">
          <div className="document-tab active">
            <ActiveIcon size={15} />
            Untitled Project
            <span className="unsaved-dot" />
          </div>
          <button className="new-tab" type="button" aria-label="New tab">+</button>
          <div className="document-tab-spacer" />
          <span className="document-meta">APEXIVEAI ENGINEERING SUITE</span>
        </div>

        <div className="editor">
          <div className="editor-toolbar">
            <div className="toolbar-section">
              <span className="engine-indicator">
                <span className="live-dot" />
                {active.engine}
              </span>
            </div>
            <div className="toolbar-section">
              <button className="editor-tool" type="button">
                <Grid3X3 size={16} />
                Workspace
              </button>
              <button className="editor-tool" type="button">
                <PanelRight size={16} />
                Properties
              </button>
            </div>
          </div>

          <ActiveModuleView moduleId={activeModule} />
        </div>

        <footer className="application-footer">
          <span>APEXIVEAI CAD & BIM SUITE</span>
          <span>VERSION 0.3.0</span>
          <span>ENGINEERING PLATFORM</span>
          <span>© APEXIVEAI</span>
        </footer>
      </section>
    </main>
  );
}
