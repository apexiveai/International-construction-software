"use client";

import { useCallback, useRef, useState } from "react";
import {
  Ruler, Building2, Cuboid, Layers3, Box, Cpu,
  Settings2, Search, Cloud,
  ChevronDown, FilePlus2, PanelRight, Grid3X3,
  FileText, Calculator, Wallet, ClipboardList,
  HardHat, Package, Handshake,
  Network, Bot,
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
import EngineeringExtensionsStudio from "@/components/EngineeringExtensionsStudio";
import DigitalTwinAIStudio from "@/components/DigitalTwinAIStudio";
import DockableWorkspace from "@/components/DockableWorkspace";

const modules = [
  { id: "cad", name: "CAD Drafting", icon: Ruler, engine: "APEXIVEAI 2D CAD ENGINE" },
  { id: "bim", name: "BIM Core", icon: Building2, engine: "SHARED BIM DATA CORE" },
  { id: "3d", name: "3D Studio", icon: Cuboid, engine: "THREE.JS 3D VIEWPORT" },
  { id: "architecture", name: "Architecture", icon: Layers3, engine: "ARCHITECTURE DESIGN STUDIO" },
  { id: "structure", name: "Structure", icon: Box, engine: "STRUCTURAL ENGINEERING STUDIO" },
  { id: "mep", name: "MEP Engineering", icon: Cpu, engine: "MEP ENGINEERING STUDIO" },
  { id: "civil", name: "Civil & Infrastructure", icon: Grid3X3, engine: "CIVIL INFRASTRUCTURE STUDIO" },
  { id: "analysis", name: "Analysis & Simulation", icon: Cpu, engine: "ENGINEERING ANALYSIS ENGINE" },
  { id: "visualization", name: "Visualization", icon: Cuboid, engine: "REAL-TIME VISUALIZATION STUDIO" },
  { id: "digital-twin", name: "Digital Twin & Assets", icon: Network, engine: "DIGITAL TWIN & ASSET LIFECYCLE" },
  { id: "ai-assistant", name: "AI Engineering Assistant", icon: Bot, engine: "AI ENGINEERING ASSISTANT" },
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
    case "civil": return <EngineeringExtensionsStudio initial="civil" />;
    case "analysis": return <EngineeringExtensionsStudio initial="analysis" />;
    case "visualization": return <EngineeringExtensionsStudio initial="visualization" />;
    case "digital-twin": return <DigitalTwinAIStudio initial="twin" />;
    case "ai-assistant": return <DigitalTwinAIStudio initial="ai" />;
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
  const [suiteMenuOpen, setSuiteMenuOpen] = useState(false);
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const moduleSelectorRef = useRef<((moduleId: ModuleId) => void) | null>(null);
  const registerModuleSelector = useCallback((select: ((moduleId: ModuleId) => void) | null) => {
    moduleSelectorRef.current = select;
  }, []);
  const active = modules.find((module) => module.id === activeModule) ?? modules[0];
  const ActiveIcon = active.icon;

  const contextualTabs: Record<string, string[]> = {
    cad: ["Drafting", "Modify", "Annotation", "Layers", "View", "Output"],
    bim: ["Model", "Views", "Families", "Coordination", "Schedule"],
    "3d": ["Scene", "Mesh", "Materials", "Lights", "Camera", "Render"],
    architecture: ["Design", "Walls", "Openings", "Rooms", "Documentation"],
    structure: ["Members", "Loads", "Analysis", "Details", "Reports"],
    mep: ["Systems", "Routes", "Equipment", "Loads", "Coordination"],
  };
  const ribbonTabs = contextualTabs[activeModule] ?? ["Home", "Create", "Edit", "View", "Publish"];

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

        <div className="suite-switcher">
          <button
            className={`suite-switcher-button ${suiteMenuOpen ? "open" : ""}`}
            type="button"
            aria-haspopup="menu"
            aria-expanded={suiteMenuOpen}
            onClick={() => setSuiteMenuOpen((open) => !open)}
          >
            <ActiveIcon size={16} />
            <span>ENGINEERING SUITE</span>
            <ChevronDown size={14} />
          </button>

          {suiteMenuOpen && (
            <div className="suite-menu" role="menu">
              {modules.map((module) => {
                const Icon = module.icon;
                return (
                  <button
                    key={module.id}
                    type="button"
                    role="menuitem"
                    className={`suite-menu-item ${activeModule === module.id ? "selected" : ""}`}
                    onClick={() => {
                      setActiveModule(module.id);
                      moduleSelectorRef.current?.(module.id);
                      setSuiteMenuOpen(false);
                    }}
                  >
                    <Icon size={16} />
                    <span>{module.name}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="top-divider" />

        <div className="workspace-switcher">
          <button
            className={`project-context ${workspaceMenuOpen ? "open" : ""}`}
            type="button"
            aria-haspopup="menu"
            aria-expanded={workspaceMenuOpen}
            onClick={() => setWorkspaceMenuOpen((open) => !open)}
          >
            <Building2 size={17} />
            <span>Workspace</span>
            <span>/</span>
            <strong>Untitled Project</strong>
            <ChevronDown size={14} />
          </button>
          {workspaceMenuOpen && (
            <div className="workspace-menu" role="menu">
              <button type="button" role="menuitem" className="workspace-menu-item selected">
                <Building2 size={15} />
                <span>Untitled Project</span>
              </button>
              <button type="button" role="menuitem" className="workspace-menu-item">
                <FilePlus2 size={15} />
                <span>New Project</span>
              </button>
            </div>
          )}
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

      <section className="workspace">
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
            <div className="context-ribbon-tabs" role="tablist" aria-label="Contextual tool ribbon">
              {ribbonTabs.map((tab, index) => (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={index === 0}
                  className={`context-ribbon-tab ${index === 0 ? "active" : ""}`}
                >
                  {tab}
                </button>
              ))}
            </div>
            <button className="editor-tool" type="button">
              <Grid3X3 size={16} />
              Workspace
            </button>
            <button className="editor-tool" type="button">
              <PanelRight size={16} />
              Properties
            </button>
          </div>

          <DockableWorkspace
            modules={modules}
            selectedModule={activeModule}
            onSelectedModuleChange={setActiveModule}
            onRegisterModuleSelector={registerModuleSelector}
            renderModule={(moduleId) => <ActiveModuleView moduleId={moduleId} />}
          />
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
