
"""
ApexiveAI CAD & BIM Suite
Official Product Module Registry

This file is the executable module catalog for the platform.
Keep module identifiers stable after the first production release.
"""

from dataclasses import dataclass
from enum import StrEnum
from typing import Iterable


class ProductLayer(StrEnum):
    PLATFORM = "platform"
    AUTHORING = "authoring"
    ENGINEERING = "engineering"
    INTEROPERABILITY = "interoperability"
    CONSTRUCTION = "construction"
    COLLABORATION = "collaboration"
    ENTERPRISE = "enterprise"


class RuntimeTarget(StrEnum):
    DESKTOP = "desktop"
    WEB = "web"
    BACKEND = "backend"
    WORKER = "worker"
    SHARED = "shared"


class ModuleStatus(StrEnum):
    PLANNED = "planned"
    FOUNDATION = "foundation"
    IN_DEVELOPMENT = "in_development"
    BETA = "beta"
    GA = "ga"


@dataclass(frozen=True, slots=True)
class ProductModule:
    key: str
    name: str
    layer: ProductLayer
    targets: tuple[RuntimeTarget, ...]
    description: str
    dependencies: tuple[str, ...] = ()
    status: ModuleStatus = ModuleStatus.PLANNED


MODULES: tuple[ProductModule, ...] = (
    # Platform foundation
    ProductModule(
        key="identity",
        name="Identity & Access",
        layer=ProductLayer.PLATFORM,
        targets=(RuntimeTarget.BACKEND, RuntimeTarget.WEB, RuntimeTarget.DESKTOP),
        description="Authentication, sessions, users, roles and access control.",
        status=ModuleStatus.FOUNDATION,
    ),
    ProductModule(
        key="organizations",
        name="Organizations & Tenancy",
        layer=ProductLayer.PLATFORM,
        targets=(RuntimeTarget.BACKEND, RuntimeTarget.WEB),
        description="Organizations, memberships, tenants and isolation.",
        dependencies=("identity",),
        status=ModuleStatus.FOUNDATION,
    ),
    ProductModule(
        key="licensing",
        name="Licensing & Entitlements",
        layer=ProductLayer.PLATFORM,
        targets=(RuntimeTarget.BACKEND, RuntimeTarget.WEB, RuntimeTarget.DESKTOP),
        description="Product licenses, subscriptions, seats and feature entitlements.",
        dependencies=("identity", "organizations"),
    ),
    ProductModule(
        key="projects",
        name="Project Workspace",
        layer=ProductLayer.PLATFORM,
        targets=(RuntimeTarget.BACKEND, RuntimeTarget.WEB, RuntimeTarget.DESKTOP),
        description="Project lifecycle, project members and project configuration.",
        dependencies=("organizations",),
        status=ModuleStatus.FOUNDATION,
    ),
    ProductModule(
        key="storage",
        name="File & Object Storage",
        layer=ProductLayer.PLATFORM,
        targets=(RuntimeTarget.BACKEND, RuntimeTarget.WORKER),
        description="Managed files, versions, metadata and storage policies.",
        dependencies=("organizations", "projects"),
    ),
    ProductModule(
        key="audit",
        name="Audit & Compliance",
        layer=ProductLayer.PLATFORM,
        targets=(RuntimeTarget.BACKEND, RuntimeTarget.WORKER),
        description="Immutable business event history and compliance records.",
        dependencies=("identity", "organizations"),
    ),

    # Authoring
    ProductModule(
        key="cad_2d",
        name="CAD Studio",
        layer=ProductLayer.AUTHORING,
        targets=(RuntimeTarget.DESKTOP, RuntimeTarget.BACKEND),
        description="2D drafting, dimensions, layers, blocks and drawing sheets.",
        dependencies=("projects", "storage"),
    ),
    ProductModule(
        key="geometry_3d",
        name="3D Geometry Engine",
        layer=ProductLayer.AUTHORING,
        targets=(RuntimeTarget.DESKTOP, RuntimeTarget.WORKER),
        description="Geometry kernel integration, transforms and spatial operations.",
        dependencies=("projects",),
    ),
    ProductModule(
        key="bim_core",
        name="BIM Core",
        layer=ProductLayer.AUTHORING,
        targets=(RuntimeTarget.BACKEND, RuntimeTarget.DESKTOP, RuntimeTarget.WORKER),
        description="BIM objects, properties, spatial hierarchy and model revisions.",
        dependencies=("projects", "storage", "geometry_3d"),
        status=ModuleStatus.FOUNDATION,
    ),
    ProductModule(
        key="architecture",
        name="Architecture Studio",
        layer=ProductLayer.AUTHORING,
        targets=(RuntimeTarget.DESKTOP, RuntimeTarget.BACKEND),
        description="Architectural elements, spaces, doors, windows and assemblies.",
        dependencies=("bim_core", "cad_2d"),
    ),
    ProductModule(
        key="visualization",
        name="Visualization Studio",
        layer=ProductLayer.AUTHORING,
        targets=(RuntimeTarget.DESKTOP, RuntimeTarget.WORKER),
        description="Materials, lighting, rendering, cameras and presentations.",
        dependencies=("geometry_3d", "bim_core"),
    ),

    # Engineering
    ProductModule(
        key="structure",
        name="Structural Engineering",
        layer=ProductLayer.ENGINEERING,
        targets=(RuntimeTarget.DESKTOP, RuntimeTarget.BACKEND, RuntimeTarget.WORKER),
        description="Structural members, connections, reinforcement and analysis.",
        dependencies=("bim_core", "geometry_3d"),
    ),
    ProductModule(
        key="mep",
        name="MEP Engineering",
        layer=ProductLayer.ENGINEERING,
        targets=(RuntimeTarget.DESKTOP, RuntimeTarget.BACKEND),
        description="Mechanical, electrical, plumbing and system networks.",
        dependencies=("bim_core", "geometry_3d"),
    ),
    ProductModule(
        key="civil",
        name="Civil & Infrastructure",
        layer=ProductLayer.ENGINEERING,
        targets=(RuntimeTarget.DESKTOP, RuntimeTarget.BACKEND, RuntimeTarget.WORKER),
        description="Terrain, roads, grading, drainage and infrastructure models.",
        dependencies=("bim_core", "geometry_3d"),
    ),
    ProductModule(
        key="analysis",
        name="Engineering Analysis",
        layer=ProductLayer.ENGINEERING,
        targets=(RuntimeTarget.DESKTOP, RuntimeTarget.WORKER),
        description="Structural, energy and engineering simulation workflows.",
        dependencies=("bim_core", "structure", "mep"),
    ),

    # Interoperability
    ProductModule(
        key="ifc",
        name="IFC Interoperability",
        layer=ProductLayer.INTEROPERABILITY,
        targets=(RuntimeTarget.BACKEND, RuntimeTarget.WORKER),
        description="IFC import, export, validation and mapping.",
        dependencies=("bim_core", "storage"),
    ),
    ProductModule(
        key="cad_exchange",
        name="CAD File Exchange",
        layer=ProductLayer.INTEROPERABILITY,
        targets=(RuntimeTarget.BACKEND, RuntimeTarget.WORKER),
        description="DWG, DXF and other supported CAD exchange workflows.",
        dependencies=("cad_2d", "storage"),
    ),
    ProductModule(
        key="coordination",
        name="Model Coordination",
        layer=ProductLayer.INTEROPERABILITY,
        targets=(RuntimeTarget.WEB, RuntimeTarget.DESKTOP, RuntimeTarget.BACKEND),
        description="Federated models, clashes, BCF issues and reviews.",
        dependencies=("bim_core", "ifc", "projects"),
    ),

    # Documentation and construction
    ProductModule(
        key="documentation",
        name="Documentation Studio",
        layer=ProductLayer.CONSTRUCTION,
        targets=(RuntimeTarget.DESKTOP, RuntimeTarget.BACKEND),
        description="Sheets, schedules, annotations and drawing publication.",
        dependencies=("cad_2d", "bim_core", "storage"),
    ),
    ProductModule(
        key="quantity_cost",
        name="Quantity & Cost",
        layer=ProductLayer.CONSTRUCTION,
        targets=(RuntimeTarget.WEB, RuntimeTarget.BACKEND, RuntimeTarget.WORKER),
        description="Quantity takeoff, BOQ, estimation and cost planning.",
        dependencies=("bim_core", "projects"),
    ),
    ProductModule(
        key="procurement",
        name="Procurement & Inventory",
        layer=ProductLayer.CONSTRUCTION,
        targets=(RuntimeTarget.WEB, RuntimeTarget.BACKEND),
        description="Suppliers, purchasing, materials and inventory.",
        dependencies=("quantity_cost", "projects"),
    ),
    ProductModule(
        key="finance",
        name="Project Finance",
        layer=ProductLayer.CONSTRUCTION,
        targets=(RuntimeTarget.WEB, RuntimeTarget.BACKEND),
        description="Budgets, commitments, payments and financial reporting.",
        dependencies=("projects", "procurement"),
    ),
    ProductModule(
        key="site_operations",
        name="Construction Site Operations",
        layer=ProductLayer.CONSTRUCTION,
        targets=(RuntimeTarget.WEB, RuntimeTarget.DESKTOP, RuntimeTarget.BACKEND),
        description="Site progress, inspections, safety and daily reports.",
        dependencies=("projects", "documentation"),
    ),

    # Collaboration
    ProductModule(
        key="collaboration",
        name="Collaboration Hub",
        layer=ProductLayer.COLLABORATION,
        targets=(RuntimeTarget.WEB, RuntimeTarget.DESKTOP, RuntimeTarget.BACKEND),
        description="Comments, reviews, approvals, notifications and discussions.",
        dependencies=("identity", "projects", "storage"),
    ),
    ProductModule(
        key="digital_twin",
        name="Digital Twin & Asset Lifecycle",
        layer=ProductLayer.COLLABORATION,
        targets=(RuntimeTarget.WEB, RuntimeTarget.BACKEND, RuntimeTarget.WORKER),
        description="Asset data, operations and lifecycle information.",
        dependencies=("bim_core", "ifc", "collaboration"),
    ),

    # Enterprise
    ProductModule(
        key="administration",
        name="Enterprise Administration",
        layer=ProductLayer.ENTERPRISE,
        targets=(RuntimeTarget.WEB, RuntimeTarget.BACKEND),
        description="Tenant administration, policies and organization settings.",
        dependencies=("identity", "organizations", "licensing", "audit"),
    ),
    ProductModule(
        key="integration",
        name="Integration & API Platform",
        layer=ProductLayer.ENTERPRISE,
        targets=(RuntimeTarget.BACKEND, RuntimeTarget.WORKER),
        description="Public APIs, webhooks, external integrations and SDK access.",
        dependencies=("identity", "projects", "audit"),
    ),
)


def get_module_registry() -> dict[str, ProductModule]:
    """Return modules indexed by stable module key."""
    return {module.key: module for module in MODULES}


def validate_registry(modules: Iterable[ProductModule] = MODULES) -> None:
    """Validate unique keys, valid dependencies and acyclic dependencies."""
    items = tuple(modules)
    registry = {module.key: module for module in items}

    if len(registry) != len(items):
        raise ValueError("Duplicate module key detected.")

    for module in items:
        if not module.key or not module.name:
            raise ValueError("Module key and name are required.")

        for dependency in module.dependencies:
            if dependency not in registry:
                raise ValueError(
                    f"Unknown dependency '{dependency}' in '{module.key}'."
                )

            if dependency == module.key:
                raise ValueError(
                    f"Module '{module.key}' cannot depend on itself."
                )

    visiting: set[str] = set()
    visited: set[str] = set()

    def visit(key: str) -> None:
        if key in visiting:
            raise ValueError(f"Circular module dependency detected at '{key}'.")

        if key in visited:
            return

        visiting.add(key)

        for dependency in registry[key].dependencies:
            visit(dependency)

        visiting.remove(key)
        visited.add(key)

    for key in registry:
        visit(key)


def dependency_order() -> tuple[str, ...]:
    """Return a valid dependency-first module order."""
    validate_registry()

    registry = get_module_registry()
    visited: set[str] = set()
    result: list[str] = []

    def visit(key: str) -> None:
        if key in visited:
            return

        for dependency in registry[key].dependencies:
            visit(dependency)

        visited.add(key)
        result.append(key)

    for key in registry:
        visit(key)

    return tuple(result)


def modules_by_layer() -> dict[str, tuple[ProductModule, ...]]:
    """Group the product modules by architecture layer."""
    result: dict[str, list[ProductModule]] = {}

    for module in MODULES:
        result.setdefault(module.layer.value, []).append(module)

    return {
        layer: tuple(modules)
        for layer, modules in result.items()
    }


validate_registry()
