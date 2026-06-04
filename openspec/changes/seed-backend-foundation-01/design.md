# Design: seed-backend-foundation-01

## Technical approach
- Persist templates, form instances, links, and trigger events in SQLite.
- Use signed opaque token with one-time consume state.
- Enforce role-based route access from static demo identity map.
- Maintain append-only audit events for all state transitions.

## Constraints
- Local demo only; no deployment topology.
- All externally visible contracts remain OpenAPI-defined.

## Risks and rollback
- Risk: token replay and accidental duplicate form handling.
- Rollback: disable token issuance and revert to internal instance testing endpoints only.
