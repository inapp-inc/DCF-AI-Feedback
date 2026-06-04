# Design: seed-backend-analytics-governance-03

## Technical approach
- Build aggregation queries for response rate, score trends, urgency counts, and queue SLA.
- Provide filtered analytics payloads for role, office, date range, and case type.
- Add config endpoints with audit write-through.
- Add asynchronous export job endpoints with metadata/result links.

## Constraints
- Analytics remain local-demo scale and optimized for SQLite.
- Admin and audit endpoints require privileged role profile.

## Risks and rollback
- Risk: expensive aggregates under larger data volumes.
- Rollback: disable high-cardinality dimensions and serve summary aggregates only.
