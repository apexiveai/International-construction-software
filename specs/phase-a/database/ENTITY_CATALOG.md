
# ApexiveAI Entity Catalog

Version: 1.0
Status: Architecture Draft

## 1. Identity & Organization

### User
Represents an authenticated human or service identity.

Important fields:
- id: UUID
- email: unique
- full_name
- is_active
- created_at
- updated_at

### Organization
Represents a legal or business tenant.

Important fields:
- id: UUID
- name
- slug: unique
- legal_name
- registration_number
- country_code
- default_currency
- status
- created_at
- updated_at

### Membership
Connects a User to an Organization.

Important fields:
- id: UUID
- organization_id
- user_id
- role_id
- membership_status
- joined_at

Constraint:
Unique organization_id + user_id.

### Role
Defines a named access role within a defined scope.

Important fields:
- id: UUID
- organization_id: nullable for platform roles
- name
- scope
- is_system_role

### Permission
Defines a specific action on a resource.

Examples:
- project.read
- project.update
- bim.model.create
- bim.element.update
- document.publish
- finance.payment.approve

### RolePermission
Connects roles to permissions.

Constraint:
Unique role_id + permission_id.

## 2. Workspace & Project

### Workspace
Represents a working environment inside an organization.

Important fields:
- id: UUID
- organization_id
- name
- slug
- status
- created_at

### WorkspaceMember
Connects users to workspaces.

Important fields:
- id: UUID
- workspace_id
- user_id
- role_id
- status

### Project
Represents a construction or engineering project.

Important fields:
- id: UUID
- organization_id
- workspace_id
- project_code
- name
- project_type
- lifecycle_status
- start_date
- planned_end_date
- actual_end_date
- created_by
- created_at
- updated_at

Constraint:
Unique organization_id + project_code.

### ProjectMember
Connects a user to a project.

Important fields:
- id: UUID
- project_id
- user_id
- role_id
- status

## 3. Storage & Documents

### StoredFile
Represents a managed file object.

Important fields:
- id: UUID
- organization_id
- project_id: nullable
- original_filename
- storage_provider
- storage_key
- media_type
- file_size
- checksum_sha256
- uploaded_by
- created_at

### FileVersion
Represents an immutable file version.

Important fields:
- id: UUID
- stored_file_id
- version_number
- storage_key
- checksum_sha256
- file_size
- created_by
- created_at

### Document
Represents a logical business document.

Important fields:
- id: UUID
- organization_id
- project_id
- document_number
- title
- document_type
- lifecycle_status
- current_revision_id

### DocumentRevision
Represents a controlled document revision.

Important fields:
- id: UUID
- document_id
- revision_code
- file_version_id
- revision_note
- created_by
- created_at

## 4. CAD Domain

### CADDocument
Represents a native CAD drawing document.

Important fields:
- id: UUID
- project_id
- name
- drawing_units
- coordinate_system_id
- current_revision_id

### CADDrawing
Represents a drawing sheet or drawing view.

Important fields:
- id: UUID
- cad_document_id
- name
- scale
- paper_size
- orientation

### CADLayer
Represents a named CAD layer.

Important fields:
- id: UUID
- cad_document_id
- name
- color
- line_type
- line_weight
- is_visible
- is_locked

### CADObject
Represents a drawing object.

Important fields:
- id: UUID
- cad_document_id
- layer_id
- object_type
- geometry_reference
- properties
- external_id

## 5. Geometry Domain

### GeometryAsset
Represents a stored geometry payload or derived artifact.

Important fields:
- id: UUID
- organization_id
- project_id
- geometry_format
- storage_key
- checksum_sha256
- bounding_box
- coordinate_system_id
- created_at

### GeometryRepresentation
Connects a domain object to a geometry asset.

Important fields:
- id: UUID
- geometry_asset_id
- owner_type
- owner_id
- representation_type
- lod
- is_primary

Note:
The polymorphic owner relationship must be validated
by the application service. It is not a normal foreign key.

### GeometryProcessingJob
Represents an asynchronous geometry task.

Important fields:
- id: UUID
- project_id
- source_file_id
- job_type
- status
- progress
- error_code
- error_message
- started_at
- finished_at

## 6. BIM Domain

### BIMModel
Represents a logical BIM model.

Important fields:
- id: UUID
- project_id
- name
- discipline
- lifecycle_status
- current_version_id
- created_by

### BIMModelVersion
Represents an immutable model revision.

Important fields:
- id: UUID
- model_id
- version_number
- source_file_id
- geometry_asset_id
- checksum_sha256
- processing_status
- created_by
- created_at

Constraint:
Unique model_id + version_number.

### BIMLevel
Represents a building level or storey.

Important fields:
- id: UUID
- model_id
- name
- elevation
- elevation_unit
- sort_order

### BIMGrid
Represents a model grid axis or grid line.

Important fields:
- id: UUID
- model_id
- name
- axis_type
- geometry_reference
- coordinate

### BIMElementType
Represents a reusable element type or family type.

Important fields:
- id: UUID
- organization_id
- discipline
- category
- family_name
- type_name
- definition_version

### BIMElement
Represents an individual model element instance.

Important fields:
- id: UUID
- model_id
- element_type_id
- level_id
- external_id
- ifc_guid
- name
- category
- lifecycle_status
- geometry_reference
- created_at
- updated_at

### BIMParameterDefinition
Defines a typed parameter.

Important fields:
- id: UUID
- organization_id
- parameter_key
- display_name
- data_type
- unit
- discipline
- is_required

### BIMElementParameter
Stores a value for an element parameter.

Important fields:
- id: UUID
- element_id
- parameter_definition_id
- value_text
- value_number
- value_boolean
- value_json

Constraint:
Unique element_id + parameter_definition_id.

### BIMMaterial
Represents a material definition.

Important fields:
- id: UUID
- organization_id
- material_code
- name
- manufacturer
- physical_properties

### BIMElementMaterial
Connects elements to materials.

Important fields:
- id: UUID
- element_id
- material_id
- layer_order
- thickness
- quantity_basis

### BIMRelationship
Represents an explicit relationship between BIM elements.

Important fields:
- id: UUID
- source_element_id
- target_element_id
- relationship_type
- properties

### BIMElementRevision
Stores a historical element snapshot.

Important fields:
- id: UUID
- element_id
- revision_number
- snapshot
- changed_by
- change_note
- created_at

## 7. Engineering Domains

Architecture:
- ArchitecturalSpace
- WallAssembly
- DoorConfiguration
- WindowConfiguration
- RoomBoundary

Structure:
- StructuralMember
- StructuralConnection
- Reinforcement
- StructuralLoad
- StructuralAnalysisCase

MEP:
- MEPSystem
- MEPComponent
- MEPConnection
- MEPConnector
- MEPFlowProperty

Civil:
- CivilAlignment
- TerrainSurface
- RoadAssembly
- DrainageNetwork
- SiteGrading

Analysis:
- AnalysisCase
- AnalysisRun
- AnalysisResult
- AnalysisArtifact

All discipline entities must reference the shared
BIM model and/or BIM element identity where applicable.

## 8. Construction Domains

Quantity & Cost:
- MeasurementRule
- QuantityTakeoff
- QuantityItem
- CostCode
- Estimate
- EstimateLine
- BillOfQuantities

Procurement:
- Supplier
- MaterialCatalog
- Warehouse
- InventoryItem
- PurchaseRequest
- PurchaseOrder
- PurchaseOrderLine
- GoodsReceipt
- StockMovement

Finance:
- ProjectBudget
- BudgetLine
- FinancialCommitment
- PaymentRequest
- Payment
- FinancialAccount
- FinancialTransaction

Site Operations:
- WorkPackage
- DailySiteReport
- ProgressRecord
- Inspection
- SafetyIncident
- SiteIssue

## 9. Collaboration & Governance

- Comment
- Discussion
- ApprovalWorkflow
- ApprovalStep
- Notification
- AuditEvent
- DomainEvent
- WebhookDelivery

All approval and audit records must preserve
the identity of the actor and the time of the action.
