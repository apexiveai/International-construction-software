
# DB-ADR-001: Primary Database Strategy

Status: Accepted as proposed
Date: 2026-11-20

## Context

ApexiveAI CAD & BIM Suite requires a database architecture
for multi-tenant engineering and construction workflows.

The platform must support:
- Transactional business data
- Complex project relationships
- BIM metadata
- Engineering data
- Version management
- Financial integrity
- Large external file references

## Decision

Use PostgreSQL as the primary system of record.

Use:
- UUID identifiers for business entities
- Relational foreign keys for authoritative relationships
- JSONB for controlled extensible metadata
- Managed object storage for large files
- Background processing for expensive imports and exports

## Geometry Decision

Do not store complete geometry meshes in ordinary
relational JSON fields.

Store geometry artifacts separately and reference
them from the database.

Use a dedicated geometry kernel for geometric operations.

## Migration Decision

Existing Django models remain the initial foundation.

New target entities are introduced incrementally.

No destructive database replacement is allowed
without an approved migration and backup plan.

## Consequences

Benefits:
- Strong transactional integrity
- Clear tenant ownership
- Flexible BIM metadata
- Managed file lifecycle
- Future scaling options

Trade-offs:
- More explicit domain design is required
- File processing needs background workers
- Large geometry requires a separate processing strategy
