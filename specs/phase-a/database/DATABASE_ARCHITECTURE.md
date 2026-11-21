
# ApexiveAI CAD & BIM Suite
# Database Architecture Specification

Version: 1.0
Status: Architecture Draft
Database Target: PostgreSQL
Primary Key Strategy: UUID
Default Encoding: UTF-8

---

## 1. Purpose

This document defines the target logical data architecture for
ApexiveAI CAD & BIM Suite.

It is the authoritative database design reference for:
- Identity and organization management
- Project workspaces
- CAD drawings
- BIM models and elements
- Geometry and parametric data
- Engineering disciplines
- Documentation
- Construction operations
- Procurement and inventory
- Project finance
- Collaboration and audit

This document describes the target architecture.
It does not imply that every entity has already been implemented.

## 2. Database Principles

### 2.1 Tenant Isolation

Every tenant-owned business record must have a verifiable
ownership path to an Organization.

Project-owned records must be reachable through:

Organization -> Project -> Domain Record

The API must enforce access permissions at the server.

Client-supplied organization IDs must never be trusted
without membership and authorization checks.

### 2.2 Domain Ownership

Each application domain owns its own database tables.

A domain must not directly modify another domain's
internal records.

Cross-domain changes must use:
- Domain services
- Explicit application interfaces
- Controlled database transactions
- Domain events for asynchronous workflows

### 2.3 Primary Keys

Use UUID primary keys for externally addressable
business entities.

Use database-generated bigint IDs only for internal
high-volume records when justified by performance tests.

### 2.4 Timestamps

Business entities should use:
- created_at
- updated_at

Immutable event records should use:
- occurred_at
- recorded_at

Store timestamps in UTC.
Render them in the user's selected timezone.

### 2.5 Soft Deletion

Do not physically delete critical business records
when historical or financial integrity is required.

Use lifecycle states or archived_at where appropriate.

Examples:
- Projects
- BIM Models
- Documents
- Contracts
- Purchase Orders
- Financial Transactions

Temporary processing data may have retention-based deletion.

### 2.6 JSON Fields

JSONB is appropriate for:
- Flexible external metadata
- Imported source properties
- Extensible application settings
- Non-critical vendor-specific attributes

JSONB must not replace normalized relational tables
for core business relationships.

### 2.7 File Storage

Do not store large CAD, BIM, IFC, DWG, DXF,
rendering or geometry files as database blobs.

Store file objects in managed storage.

PostgreSQL stores:
- File ID
- Object key
- Original filename
- Media type
- File size
- Checksum
- Version
- Ownership
- Access metadata

### 2.8 Geometry

The database stores geometry metadata and references.

Large geometry payloads and derived meshes are stored
in specialized geometry artifacts.

Use a geometry kernel for geometric calculations.
Do not implement a geometry kernel using JSON fields.

## 3. Logical Domains

### A. Identity & Tenant

- User
- Organization
- Membership
- Role
- Permission
- RolePermission
- Workspace
- WorkspaceMember
- License
- LicenseAssignment
- Entitlement

### B. Project Workspace

- Project
- ProjectMember
- ProjectSetting
- ProjectPhase
- ProjectLocation
- ProjectDiscipline

### C. Storage & Documents

- StoredFile
- FileVersion
- FileAccessGrant
- Document
- DocumentRevision
- DocumentFolder
- DocumentApproval

### D. CAD

- CADDocument
- CADDrawing
- CADLayer
- CADBlockDefinition
- CADObject
- CADConstraint
- CADDimension
- CADReference

### E. Geometry

- GeometryAsset
- GeometryRepresentation
- GeometryOperation
- CoordinateSystem
- SpatialReference
- GeometryProcessingJob

### F. BIM Core

- BIMModel
- BIMModelVersion
- BIMLevel
- BIMGrid
- BIMElement
- BIMElementType
- BIMParameterDefinition
- BIMElementParameter
- BIMMaterial
- BIMElementMaterial
- BIMRelationship
- BIMElementRevision

### G. Engineering

- ArchitecturalSpace
- StructuralMember
- StructuralConnection
- Reinforcement
- MEPSystem
- MEPComponent
- MEPConnection
- CivilAlignment
- TerrainSurface
- AnalysisCase
- AnalysisResult

### H. Documentation

- DrawingSheet
- SheetViewport
- Annotation
- Schedule
- ScheduleField
- PublishedDocument
- RevisionIssue

### I. Quantity & Cost

- MeasurementRule
- QuantityTakeoff
- QuantityItem
- CostCode
- CostItem
- Estimate
- EstimateLine
- BillOfQuantities

### J. Procurement & Inventory

- Supplier
- MaterialCatalog
- Warehouse
- InventoryItem
- PurchaseRequest
- PurchaseOrder
- PurchaseOrderLine
- GoodsReceipt
- StockMovement

### K. Project Finance

- ProjectBudget
- BudgetLine
- FinancialCommitment
- PaymentRequest
- Payment
- FinancialAccount
- FinancialTransaction

### L. Site Operations

- DailySiteReport
- WorkPackage
- ProgressRecord
- Inspection
- SafetyIncident
- SiteIssue

### M. Collaboration & Audit

- Comment
- Discussion
- ApprovalWorkflow
- ApprovalStep
- Notification
- AuditEvent
- DomainEvent
- WebhookDelivery

## 4. Core Relationships

Organization
  1 -> N Membership
  1 -> N Workspace

Workspace
  1 -> N WorkspaceMember
  1 -> N Project

Project
  1 -> N ProjectMember
  1 -> N CADDocument
  1 -> N BIMModel
  1 -> N Document
  1 -> N WorkPackage

BIMModel
  1 -> N BIMModelVersion
  1 -> N BIMLevel
  1 -> N BIMGrid
  1 -> N BIMElement

BIMElement
  N -> 1 BIMElementType
  N -> 1 BIMLevel
  1 -> N BIMElementParameter
  N -> N BIMMaterial
  N -> N BIMElement
  1 -> N BIMElementRevision
  1 -> N GeometryRepresentation

BIMModel
  1 -> N QuantityTakeoff
  1 -> N AnalysisCase

QuantityTakeoff
  1 -> N QuantityItem

Estimate
  1 -> N EstimateLine

PurchaseOrder
  1 -> N PurchaseOrderLine

Project
  1 -> N ProjectBudget
  1 -> N FinancialCommitment
  1 -> N PaymentRequest

## 5. Referential Integrity

Use foreign keys for authoritative relationships.

Use unique constraints for:
- Organization slug
- Organization membership
- Workspace membership
- Project code within organization
- Model version number within model
- IFC GUID within a model
- External object IDs within their source scope

Use check constraints for:
- Positive quantities
- Non-negative monetary values where applicable
- Valid date ranges
- Valid version numbers

## 6. Indexing Strategy

Index:
- Foreign keys used in filtering
- Organization ownership paths
- Project and model IDs
- Status and lifecycle fields
- Frequently queried timestamps
- External identifiers

Use composite indexes based on measured query patterns.

Use PostgreSQL GIN indexes for JSONB only when
actual query workloads justify them.

## 7. Concurrency

Use optimistic concurrency for editable documents
and BIM model revisions.

Use a version number or revision token.

Reject stale updates with HTTP 409 Conflict.

Critical financial operations must use transactions
and appropriate row locking.

## 8. Data Migration

Existing accounts, organizations, projects and BIM
tables are the initial foundation.

New domains must be introduced incrementally.

Never delete existing production data as part of
a routine schema migration.

Every production migration must have:
- A migration plan
- Backup verification
- Rollback or forward-recovery plan
- Data integrity checks

## 9. Future Scale

Initial deployment:
- PostgreSQL as system of record
- Managed file/object storage
- Background worker for processing

Future scale:
- Read replicas
- Partitioning for selected high-volume tables
- Dedicated search infrastructure
- Distributed job processing
- Event streaming where justified

Do not introduce distributed infrastructure
before measured requirements justify it.
