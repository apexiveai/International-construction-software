
# ApexiveAI CAD & BIM Suite
# Architecture Rules

## 1. Architecture Style

The product uses a Hybrid Enterprise Architecture.

- Desktop: CAD, BIM, geometry and engineering authoring.
- Web: collaboration, project management, finance and administration.
- Backend: identity, domain APIs, authorization and business rules.
- Workers: file processing, geometry processing and long-running jobs.
- Shared data: common project and model identifiers.

## 2. Domain Ownership

Every business domain owns its own data and business rules.

A module must not directly modify another module's internal database tables.

Cross-domain operations must use:
- Explicit service interfaces
- Versioned API contracts
- Domain events where asynchronous processing is required

## 3. BIM Core Ownership

BIM Core owns:
- BIM model identity
- BIM element identity
- Spatial hierarchy
- Element properties
- Model revisions
- Model relationships

Discipline modules extend BIM information through controlled domain relationships.

## 4. Geometry Ownership

The Geometry Engine owns:
- Geometric representation
- Coordinate transformations
- Geometric calculations
- Bounding volumes
- Spatial queries
- Geometry validation

BIM Core must not become a geometry-kernel implementation.

## 5. File Ownership

The Storage domain owns:
- File identity
- Storage location
- File checksum
- File version metadata
- Access policy
- Retention metadata

Domain modules reference managed file records rather than implementing separate unmanaged file stores.

## 6. Tenant Isolation

Every organization-owned resource must have an organization ownership path.

Every project-owned resource must be reachable through its project ownership path.

Authorization must be checked on the server for every request.

Never trust organization IDs supplied by the client without verifying membership and permission.

## 7. API Rules

- All public APIs use /api/v1/.
- APIs must have explicit serializers and validation.
- Use pagination for collection endpoints.
- Use consistent error response structures.
- Avoid exposing internal database models.
- Long-running jobs must return job identifiers.
- Breaking changes require a new API version or an approved migration strategy.

## 8. Desktop Rules

The desktop application must not connect directly to production databases.

It communicates with platform services through authenticated APIs.

Local project caches must support synchronization and conflict detection.

## 9. Engineering Quality

Every domain must include:
- Unit tests
- Integration tests
- Permission tests
- Data integrity tests
- API contract tests

Critical engineering calculations require independent validation.
