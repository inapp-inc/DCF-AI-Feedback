# Feedback Platform Specification Delta

## Requirements

### Requirement: Template-driven form lifecycle
The backend MUST expose template and instance contracts for all feedback roles.

#### Scenario: Trigger to instance
- **Given** a valid trigger event
- **When** orchestration accepts it
- **Then** a form instance exists with role and expiry metadata

### Requirement: Dynamic link security
The backend MUST issue single-use time-bound links for form access and submission.

#### Scenario: Duplicate submission prevention
- **Given** a consumed token
- **When** another submit is attempted
- **Then** the request is rejected as duplicate
