# Feedback Platform Specification Delta

## Purpose
Record design-phase deltas that convert BRD + mockup intent into implementation-ready architecture boundaries and contracts.

## Requirements

### Requirement: Trigger orchestration is contract-driven
The platform SHALL process trigger events through a versioned API contract with idempotent ingestion behavior.

#### Scenario: Duplicate trigger event replay
- **Given** the same event payload is retried by iFamilyNet
- **When** `/triggers/events` receives the replay
- **Then** the platform records duplicate handling and does not create duplicate survey instances

### Requirement: Submission processing remains human-governed
The platform SHALL expose AI inference outputs as recommendations with explicit routes and explainability, never direct consequences.

#### Scenario: Urgent attorney submission
- **Given** an attorney submission with high urgency or ICWA/ICPC indicators
- **When** AI inference completes
- **Then** the recommendation route is legal/supervisor queue
- **And** a human reviewer is required before any consequential action

### Requirement: Queue operations are role-scoped and auditable
The platform SHALL enforce supervisor/admin authorization for queue operations and produce immutable audit events for each status transition.

#### Scenario: Queue resolution
- **Given** a supervisor resolves a queue item
- **When** status changes to resolved
- **Then** the action includes actor identity, timestamp, and reason in the audit stream

### Requirement: UI must align with admin-panel guidelines
The platform SHALL implement feedback and administrative UIs using the design guidelines of the admin panel from the mockup as the primary visual reference.

#### Scenario: Style and interaction consistency
- **Given** any new feedback platform screen
- **When** reviewed for design conformance
- **Then** it uses admin-panel-aligned layout, components, and interaction conventions

### Requirement: UI theme must align to demo token system
The platform SHALL implement UI styles using the token and global-style conventions from `/Users/mahalingam/Downloads/DCF-Intake/demo` as the baseline theme contract.

#### Scenario: Token-based style validation
- **Given** a screen or component is implemented
- **When** theme conformance is reviewed
- **Then** palette, typography, navigation states, and control states match the demo token/style semantics
