
# Data Ownership & Domain Boundaries

## 1. Ownership Matrix

| Domain | Owns | Must Not Own |
|---|---|---|
| Identity | Users, sessions, credentials | Project engineering data |
| Organizations | Tenants, memberships | CAD geometry |
| Projects | Project lifecycle and membership | BIM element internals |
| Storage | File objects and file versions | Document approval rules |
| CAD | Drawing objects and layers | BIM element identity |
| Geometry | Geometry assets and operations | Commercial project finance |
| BIM Core | Models, elements, relationships | Geometry kernel implementation |
| Architecture | Architectural domain attributes | Shared identity |
| Structure | Structural domain attributes | Shared project ownership |
| MEP | MEP systems and connections | CAD file storage |
| Quantity & Cost | Measurements and estimates | Supplier inventory balances |
| Procurement | Suppliers and purchasing | BIM geometry |
| Finance | Budgets and financial transactions | Engineering calculations |
| Site Operations | Site progress and inspections | User credentials |
| Collaboration | Comments and workflows | Domain-owned business records |
| Audit | Historical event records | Mutable domain state |

## 2. Ownership Path

All organization-owned data must be traceable to
an Organization.

All project-owned data must be traceable through
the Project's Organization.

A user must have valid access at the relevant scope.

## 3. Cross-Domain Integration

Example:

BIM Element
    -> Quantity Takeoff
    -> Quantity Item
    -> Estimate Line
    -> Purchase Request
    -> Purchase Order
    -> Goods Receipt
    -> Inventory Movement

The Quantity domain owns quantity records.
The Procurement domain owns purchase records.
The Finance domain owns payment and accounting records.

Do not duplicate authoritative values across domains.

## 4. Shared Identifier Policy

Use stable UUID identifiers across APIs.

A domain may store a reference to another domain's
entity ID.

Where domains are deployed in the same PostgreSQL
database, foreign keys should be used for authoritative
relationships when practical.

Cross-service references must be validated through
the owning service.

## 5. Event Policy

Events are used for integration, not as a replacement
for authoritative domain records.

Examples:
- bim.model.version.created
- bim.element.updated
- document.revision.published
- quantity.takeoff.completed
- procurement.purchase_order.approved
- finance.payment.completed

Events must have:
- event_id
- event_type
- occurred_at
- organization_id
- project_id when applicable
- actor_id when applicable
- aggregate_id
- schema_version
- payload

Events must be versioned and safely retryable.
