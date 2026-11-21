"use client";

import {
  type DragEvent,
  type PointerEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ArrowDownToLine,
  ArrowUpToLine,
  Grip,
  Maximize2,
  Minimize2,
  PanelBottom,
  PanelLeft,
  PanelRight,
  PanelTop,
  Plus,
  RotateCcw,
  Split,
  Ungroup,
  X,
} from "lucide-react";

export type WorkspaceModule<T extends string> = {
  id: T;
  name: string;
};

type DockZone = "left" | "right" | "top" | "bottom" | "center" | "floating";

type DockGroup<T extends string> = {
  id: string;
  modules: T[];
  active: T;
  zone: DockZone;
  size: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

type Interaction =
  | {
      type: "move";
      groupId: string;
      offsetX: number;
      offsetY: number;
      width: number;
      height: number;
    }
  | {
      type: "resize";
      firstId: string;
      secondId: string;
      axis: "x" | "y";
      start: number;
      firstSize: number;
      secondSize: number;
      available: number;
    };

type DockableWorkspaceProps<T extends string> = {
  modules: readonly WorkspaceModule<T>[];
  renderModule: (moduleId: T) => ReactNode;
  selectedModule: T;
  onSelectedModuleChange: (moduleId: T) => void;
  onRegisterModuleSelector: (select: ((moduleId: T) => void) | null) => void;
};

const moduleDragType = "application/x-apexive-module";
const groupDragType = "application/x-apexive-group";
const dockOptions = [
  { zone: "left", Icon: PanelLeft, label: "Dock left" },
  { zone: "right", Icon: PanelRight, label: "Dock right" },
  { zone: "top", Icon: PanelTop, label: "Dock top" },
  { zone: "bottom", Icon: PanelBottom, label: "Dock bottom" },
  { zone: "center", Icon: Split, label: "Move to center" },
] as const;

export default function DockableWorkspace<T extends string>({
  modules,
  renderModule,
  selectedModule,
  onSelectedModuleChange,
  onRegisterModuleSelector,
}: DockableWorkspaceProps<T>) {
  const [groups, setGroups] = useState<DockGroup<T>[]>(() => [{
    id: "panel-1",
    modules: [selectedModule],
    active: selectedModule,
    zone: "center",
    size: 1,
    x: 48,
    y: 80,
    width: 620,
    height: 420,
  }]);
  const [hiddenModules, setHiddenModules] = useState<T[]>([]);
  const [focusedGroupId, setFocusedGroupId] = useState("panel-1");
  const [maximizedGroupId, setMaximizedGroupId] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const interactionRef = useRef<Interaction | null>(null);
  const groupNumberRef = useRef(1);

  useEffect(() => {
    const handlePointerMove = (event: globalThis.PointerEvent) => {
      const interaction = interactionRef.current;
      if (!interaction) return;
      if (interaction.type === "move") {
        const x = Math.max(8, Math.min(
          event.clientX - interaction.offsetX,
          window.innerWidth - interaction.width - 8,
        ));
        const y = Math.max(8, Math.min(
          event.clientY - interaction.offsetY,
          window.innerHeight - interaction.height - 8,
        ));
        setGroups((current) => current.map((group) =>
          group.id === interaction.groupId ? { ...group, x, y } : group,
        ));
        return;
      }

      const coordinate = interaction.axis === "x" ? event.clientX : event.clientY;
      const total = interaction.firstSize + interaction.secondSize;
      const delta = ((coordinate - interaction.start) / interaction.available) * total;
      const minimum = total * 0.16;
      const firstSize = Math.max(minimum, Math.min(total - minimum, interaction.firstSize + delta));
      setGroups((current) => current.map((group) => {
        if (group.id === interaction.firstId) return { ...group, size: firstSize };
        if (group.id === interaction.secondId) return { ...group, size: total - firstSize };
        return group;
      }));
    };
    const handlePointerUp = () => {
      interactionRef.current = null;
    };
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, []);

  const getModule = (id: string | null) => modules.find((module) => module.id === id);
  const closeMenus = (target: HTMLElement) => {
    let menu = target.closest("details");
    while (menu) {
      menu.open = false;
      menu = menu.parentElement?.closest("details") ?? null;
    }
  };

  const selectModule = useCallback((moduleId: T) => {
    const containingGroup = groups.find((group) => group.modules.includes(moduleId));
    if (containingGroup) {
      setGroups((current) => current.map((group) =>
        group.id === containingGroup.id ? { ...group, active: moduleId } : group,
      ));
      setFocusedGroupId(containingGroup.id);
    } else {
      const target = groups.find((group) => group.id === focusedGroupId && group.zone !== "floating")
        ?? groups.find((group) => group.zone !== "floating");
      if (target) {
        setGroups((current) => current.map((group) =>
          group.id === target.id
            ? { ...group, modules: [...group.modules, moduleId], active: moduleId }
            : group,
        ));
        setFocusedGroupId(target.id);
      } else {
        groupNumberRef.current += 1;
        const id = `panel-${groupNumberRef.current}`;
        setGroups((current) => [...current, {
          id, modules: [moduleId], active: moduleId, zone: "center", size: 1,
          x: 48, y: 80, width: 620, height: 420,
        }]);
        setFocusedGroupId(id);
      }
    }
    setHiddenModules((current) => current.filter((id) => id !== moduleId));
    onSelectedModuleChange(moduleId);
  }, [focusedGroupId, groups, onSelectedModuleChange]);

  useEffect(() => {
    onRegisterModuleSelector(selectModule);
    return () => onRegisterModuleSelector(null);
  }, [onRegisterModuleSelector, selectModule]);

  const moveModule = (moduleId: T, zone: DockZone) => {
    groupNumberRef.current += 1;
    const id = `panel-${groupNumberRef.current}`;
    setGroups((current) => {
      const next = current.flatMap((group) => {
        if (!group.modules.includes(moduleId)) return [group];
        const remaining = group.modules.filter((id) => id !== moduleId);
        if (remaining.length === 0) return [];
        return [{
          ...group,
          modules: remaining,
          active: group.active === moduleId ? remaining[0] : group.active,
        }];
      });
      return [...next, {
        id, modules: [moduleId], active: moduleId, zone, size: 1,
        x: 48, y: 80, width: 620, height: 420,
      }];
    });
    setFocusedGroupId(id);
    onSelectedModuleChange(moduleId);
  };

  const addToGroup = (groupId: string, moduleId: T) => {
    setGroups((current) => {
      const source = current.find((group) => group.modules.includes(moduleId));
      if (source?.id === groupId) {
        return current.map((group) => group.id === groupId ? { ...group, active: moduleId } : group);
      }
      const moved = current.flatMap((group) => {
        if (!group.modules.includes(moduleId)) return [group];
        const remaining = group.modules.filter((id) => id !== moduleId);
        if (remaining.length === 0) return [];
        return [{
          ...group,
          modules: remaining,
          active: group.active === moduleId ? remaining[0] : group.active,
        }];
      });
      return moved.map((group) => group.id === groupId
        ? { ...group, modules: [...group.modules, moduleId], active: moduleId }
        : group);
    });
    setHiddenModules((current) => current.filter((id) => id !== moduleId));
    setFocusedGroupId(groupId);
    onSelectedModuleChange(moduleId);
  };

  const splitModule = (moduleId: T, zone: DockZone = "center") => {
    const alreadyVisible = groups.some((group) => group.modules.includes(moduleId));
    if (alreadyVisible) {
      moveModule(moduleId, zone);
      return;
    }
    groupNumberRef.current += 1;
    const id = `panel-${groupNumberRef.current}`;
    setGroups((current) => [...current, {
      id, modules: [moduleId], active: moduleId, zone, size: 1,
      x: 48, y: 80, width: 620, height: 420,
    }]);
    setFocusedGroupId(id);
    setHiddenModules((current) => current.filter((item) => item !== moduleId));
    onSelectedModuleChange(moduleId);
  };

  const hideModule = (group: DockGroup<T>) => {
    const remaining = group.modules.filter((id) => id !== group.active);
    setGroups((current) => remaining.length
      ? current.map((item) => item.id === group.id
        ? { ...item, modules: remaining, active: remaining[0] }
        : item)
      : current.filter((item) => item.id !== group.id));
    setHiddenModules((current) => current.includes(group.active) ? current : [...current, group.active]);
    setMaximizedGroupId((current) => current === group.id ? null : current);
    const fallback = groups.find((item) => item.id !== group.id);
    if (fallback) onSelectedModuleChange(fallback.active);
    else if (remaining.length) onSelectedModuleChange(remaining[0]);
  };

  const resetLayout = () => {
    const first = modules[0]?.id;
    if (!first) return;
    groupNumberRef.current = 1;
    setGroups([{
      id: "panel-1", modules: [first], active: first, zone: "center", size: 1,
      x: 48, y: 80, width: 620, height: 420,
    }]);
    setHiddenModules([]);
    setFocusedGroupId("panel-1");
    setMaximizedGroupId(null);
    onSelectedModuleChange(first);
  };

  const handleDrop = (event: DragEvent<HTMLElement>, zone?: DockZone, targetGroupId?: string) => {
    event.preventDefault();
    setDragging(false);
    const moduleId = getModule(event.dataTransfer.getData(moduleDragType))?.id;
    const groupId = event.dataTransfer.getData(groupDragType);
    if (targetGroupId && moduleId) {
      addToGroup(targetGroupId, moduleId);
    } else if (targetGroupId && groupId && groupId !== targetGroupId) {
      const source = groups.find((group) => group.id === groupId);
      if (!source) return;
      setGroups((current) => current
        .filter((group) => group.id !== groupId)
        .map((group) => group.id === targetGroupId
          ? {
              ...group,
              modules: [...group.modules, ...source.modules.filter((id) => !group.modules.includes(id))],
              active: source.active,
            }
          : group));
    } else if (zone && moduleId) {
      moveModule(moduleId, zone);
    } else if (zone && groupId) {
      setGroups((current) => current.map((group) =>
        group.id === groupId ? { ...group, zone } : group,
      ));
    }
  };

  const beginMove = (event: PointerEvent<HTMLButtonElement>, group: DockGroup<T>) => {
    event.preventDefault();
    setFocusedGroupId(group.id);
    interactionRef.current = {
      type: "move",
      groupId: group.id,
      offsetX: event.clientX - group.x,
      offsetY: event.clientY - group.y,
      width: group.width,
      height: group.height,
    };
  };

  const beginResize = (
    event: PointerEvent<HTMLDivElement>,
    first: DockGroup<T>,
    second: DockGroup<T>,
    axis: "x" | "y",
    available: number,
  ) => {
    event.preventDefault();
    interactionRef.current = {
      type: "resize",
      firstId: first.id,
      secondId: second.id,
      axis,
      start: axis === "x" ? event.clientX : event.clientY,
      firstSize: first.size,
      secondSize: second.size,
      available,
    };
  };

  const renderGroup = (group: DockGroup<T>, floating = false) => {
    const activeModule = getModule(group.active);
    if (!activeModule) return null;
    const canSplit = modules.some((module) =>
      !groups.some((item) => item.modules.includes(module.id)),
    );
    return (
      <section
        key={group.id}
        className={`dock-panel ${focusedGroupId === group.id ? "focused" : ""} ${floating ? "floating-panel" : ""} ${floating && maximizedGroupId === group.id ? "maximized-floating" : ""}`}
        style={floating ? maximizedGroupId === group.id ? {
          left: 8, top: 8, width: "calc(100vw - 16px)", height: "calc(100vh - 16px)",
        } : {
          left: group.x,
          top: group.y,
          width: group.width,
          height: group.height,
          maxWidth: `calc(100vw - ${group.x}px - 8px)`,
        } : { flexGrow: group.size }}
        aria-label={`${activeModule.name} panel`}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => handleDrop(event, undefined, group.id)}
        onPointerDown={() => {
          setFocusedGroupId(group.id);
          onSelectedModuleChange(group.active);
        }}
      >
        <header className="dock-panel-header">
          <button
            type="button"
            className="dock-control dock-move"
            aria-label={floating ? `Move ${activeModule.name} floating window` : `Drag ${activeModule.name} panel`}
            draggable={!floating}
            onPointerDown={floating ? (event) => beginMove(event, group) : undefined}
            onDragStart={(event) => {
              event.dataTransfer.setData(groupDragType, group.id);
              event.dataTransfer.effectAllowed = "move";
              setDragging(true);
            }}
            onDragEnd={() => setDragging(false)}
          >
            <Grip size={14} />
          </button>
          <div className="dock-panel-tabs" role="tablist" aria-label={`${activeModule.name} tabs`}>
            {group.modules.map((moduleId) => {
              const entry = getModule(moduleId);
              if (!entry) return null;
              return (
                <button
                  type="button"
                  role="tab"
                  aria-selected={group.active === moduleId}
                  className={`dock-panel-tab ${group.active === moduleId ? "active" : ""}`}
                  key={moduleId}
                  draggable
                  onClick={() => {
                    setGroups((current) => current.map((item) =>
                      item.id === group.id ? { ...item, active: moduleId } : item,
                    ));
                    setFocusedGroupId(group.id);
                    onSelectedModuleChange(moduleId);
                  }}
                  onDragStart={(event) => {
                    event.dataTransfer.setData(moduleDragType, moduleId);
                    event.dataTransfer.effectAllowed = "move";
                    setDragging(true);
                  }}
                  onDragEnd={() => setDragging(false)}
                  title="Drag to dock or group this module"
                >
                  {entry.name}
                </button>
              );
            })}
          </div>
          <div className="dock-panel-actions">
            <details className="dock-menu">
              <summary className="dock-control" aria-label={`Dock ${activeModule.name}`}>Dock</summary>
              <div className="dock-menu-popover">
                {dockOptions.map(({ zone, Icon, label }) => (
                  <button
                    type="button"
                    key={zone}
                    onClick={(event) => {
                      closeMenus(event.currentTarget);
                      setGroups((current) => current.map((item) =>
                        item.id === group.id ? { ...item, zone } : item,
                      ));
                    }}
                  >
                    <Icon size={14} />{label}
                  </button>
                ))}
              </div>
            </details>
            <button
              type="button"
              className="dock-control"
              aria-label={floating ? "Dock floating window" : "Float panel"}
              title={floating ? "Dock window" : "Float panel"}
              onClick={() => setGroups((current) => current.map((item) => {
                if (item.id !== group.id) return item;
                if (floating) return { ...item, zone: "center" };
                const width = Math.min(item.width, window.innerWidth - 16);
                const x = Math.max(8, window.innerWidth - width - 16);
                const height = Math.min(item.height, window.innerHeight - 16);
                const y = Math.max(120, Math.min(item.y, window.innerHeight - height - 8));
                return { ...item, zone: "floating", x, y, width, height };
              }))}
            >
              {floating ? <ArrowDownToLine size={14} /> : <ArrowUpToLine size={14} />}
            </button>
            <details className="dock-menu">
              <summary className="dock-control" aria-label="Panel actions">•••</summary>
              <div className="dock-menu-popover dock-menu-right">
                <details className="dock-submenu">
                  <summary><Split size={14} />Split view</summary>
                  <div className="dock-menu-popover">
                    {modules.filter((module) => !groups.some((item) => item.modules.includes(module.id))).map((module) => (
                      <button type="button" key={module.id} onClick={(event) => {
                        closeMenus(event.currentTarget);
                        splitModule(module.id);
                      }}>
                        <Plus size={14} />{module.name}
                      </button>
                    ))}
                    {!canSplit && <span className="dock-menu-empty">All modules are already open</span>}
                  </div>
                </details>
                <details className="dock-submenu">
                  <summary><Ungroup size={14} />Group as tab</summary>
                  <div className="dock-menu-popover">
                    {modules.filter((module) => !group.modules.includes(module.id)).map((module) => (
                      <button type="button" key={module.id} onClick={(event) => {
                        closeMenus(event.currentTarget);
                        addToGroup(group.id, module.id);
                      }}>
                        <Plus size={14} />{module.name}
                      </button>
                    ))}
                    {group.modules.length === modules.length && <span className="dock-menu-empty">All modules are in this tab group</span>}
                  </div>
                </details>
                <button
                  type="button"
                  onClick={(event) => {
                    closeMenus(event.currentTarget);
                    setMaximizedGroupId((current) => current === group.id ? null : group.id);
                  }}
                >
                  {maximizedGroupId === group.id ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                  {maximizedGroupId === group.id ? "Restore panel" : "Maximize panel"}
                </button>
                <button type="button" onClick={(event) => {
                  closeMenus(event.currentTarget);
                  hideModule(group);
                }}><X size={14} />Hide module</button>
              </div>
            </details>
          </div>
        </header>
        <div className="dock-panel-content" key={group.active}>
          {renderModule(group.active)}
        </div>
      </section>
    );
  };

  const visibleGroups = maximizedGroupId
    ? groups.filter((group) => group.id === maximizedGroupId && group.zone !== "floating")
    : groups.filter((group) => group.zone !== "floating");
  const floatingGroups = groups.filter((group) => group.zone === "floating");
  const zoneGroups: DockZone[] = ["left", "right", "top", "bottom", "center"];
  const resizeAvailable = (zone: DockZone, axis: "x" | "y") => {
    const region = document.querySelector<HTMLElement>(`[data-dock-region="${zone}"]`);
    return region ? (axis === "x" ? region.clientWidth : region.clientHeight) : 1;
  };

  return (
    <div className="dockable-workspace">
      <div className="dock-workspace-toolbar">
        <div className="dock-workspace-label"><span className="dock-live-dot" />Dockable workspace</div>
        <details className="dock-menu">
          <summary className="dock-toolbar-button"><Plus size={14} />Split view</summary>
          <div className="dock-menu-popover dock-menu-right">
            {modules.filter((module) => !groups.some((group) => group.modules.includes(module.id))).map((module) => (
              <button type="button" key={module.id} onClick={(event) => {
                closeMenus(event.currentTarget);
                splitModule(module.id);
              }}>
                <Plus size={14} />{module.name}
              </button>
            ))}
            {!modules.some((module) => !groups.some((group) => group.modules.includes(module.id))) && (
              <span className="dock-menu-empty">All modules are already open</span>
            )}
          </div>
        </details>
        <details className="dock-menu">
          <summary className="dock-toolbar-button">Hidden ({hiddenModules.length})</summary>
          <div className="dock-menu-popover dock-menu-right">
            {hiddenModules.map((moduleId) => {
              const entry = getModule(moduleId);
              return entry ? (
                <button type="button" key={moduleId} onClick={(event) => {
                  closeMenus(event.currentTarget);
                  selectModule(moduleId);
                }}>
                  <Plus size={14} />{entry.name}
                </button>
              ) : null;
            })}
            {!hiddenModules.length && <span className="dock-menu-empty">No hidden modules</span>}
          </div>
        </details>
        <button type="button" className="dock-toolbar-button" onClick={resetLayout}>
          <RotateCcw size={14} />Reset layout
        </button>
      </div>

      <div className={`dock-layout ${dragging ? "drag-active" : ""} ${maximizedGroupId ? "maximized" : ""} ${groups.some((group) => group.zone === "left") ? "left-docked" : ""} ${groups.some((group) => group.zone === "right") ? "right-docked" : ""} ${groups.some((group) => group.zone === "top") ? "top-docked" : ""} ${groups.some((group) => group.zone === "bottom") ? "bottom-docked" : ""}`}>
        {zoneGroups.map((zone) => {
          const regionGroups = maximizedGroupId
            ? []
            : visibleGroups.filter((group) => group.zone === zone);
          const horizontal = zone === "top" || zone === "bottom" || zone === "center";
          return (
            <div
              key={zone}
              className={`dock-region dock-region-${zone} ${regionGroups.length ? "occupied" : "empty"} ${dragging ? "drop-ready" : ""}`}
              data-dock-region={zone}
              style={{ gridArea: zone }}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => handleDrop(event, zone)}
            >
              {regionGroups.length ? regionGroups.map((group, index) => (
                <div className="dock-group-slot" key={group.id} style={{ flexGrow: group.size }}>
                  {renderGroup(group)}
                  {index < regionGroups.length - 1 && (
                    <div
                      className={`dock-resizer ${horizontal ? "horizontal" : "vertical"}`}
                      role="separator"
                      aria-label="Resize adjacent panels"
                      aria-orientation={horizontal ? "vertical" : "horizontal"}
                      onPointerDown={(event) => beginResize(
                        event,
                        group,
                        regionGroups[index + 1],
                        horizontal ? "x" : "y",
                        resizeAvailable(zone, horizontal ? "x" : "y"),
                      )}
                    />
                  )}
                </div>
              )) : dragging && (
                <span className="dock-drop-hint">
                  {zone === "center" ? "Drop to split center" : `Dock ${zone}`}
                </span>
              )}
            </div>
          );
        })}
        {maximizedGroupId && visibleGroups[0] && (
          <div className="dock-maximized-layer">{renderGroup(visibleGroups[0])}</div>
        )}
      </div>

      {floatingGroups.map((group) => renderGroup(group, true))}
    </div>
  );
}
