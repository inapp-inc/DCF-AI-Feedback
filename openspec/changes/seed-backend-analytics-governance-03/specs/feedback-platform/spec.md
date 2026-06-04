# Feedback Platform Specification Delta

## Requirements

### Requirement: Analytics service for dashboard rendering
The backend MUST provide aggregate endpoints consumable directly by in-page Chart.js dashboards.

#### Scenario: Filtered analytics query
- **Given** analytics data exists
- **When** role and date filters are requested
- **Then** API returns scoped aggregates with consistent metric keys

### Requirement: Admin governance controls
The backend SHALL allow privileged users to adjust trigger/config values with audit records.

#### Scenario: Config change audit
- **Given** an admin updates a threshold
- **When** the update succeeds
- **Then** a corresponding audit event records actor, old value, and new value
