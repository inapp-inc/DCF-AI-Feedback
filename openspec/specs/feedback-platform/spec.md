# Feedback Platform Specification

## Purpose
Provide a centralized, role-segregated feedback platform integrated with iFamilyNet event hooks, with AI-assisted classification, triage, analytics, and human-reviewed operational actions.

## Requirements

### Requirement: Role-segregated feedback intake
The system MUST expose separate feedback experiences for Mandated Reporters, Volunteers, Attorneys, and Foster Parents with strict access controls.

#### Scenario: User can only access their role section
- **Given** an authenticated user with one role claim
- **When** they open the feedback portal
- **Then** they see only their role-specific section
- **And** cross-role routes are denied and audited

### Requirement: Event-driven trigger orchestration
The system MUST generate surveys/forms from iFamilyNet events for 51A, volunteer events, legal milestones, placement milestones, and case closure.

#### Scenario: Mandated Reporter trigger dispatch
- **Given** a 51A filing event exists
- **When** the configured trigger window is reached
- **Then** a secure single-use survey link is dispatched
- **And** duplicate submissions are prevented

### Requirement: AI processing with human-in-the-loop
The system MUST run NLP classification, sentiment, urgency detection, and routing recommendations while requiring human approval for consequential actions.

#### Scenario: High urgency feedback
- **Given** a submitted form with high-urgency language
- **When** AI processing completes
- **Then** a supervisor queue recommendation is created
- **And** no automatic punitive or adjudicative action is taken

### Requirement: Compliance and privacy protection
The system MUST enforce PII protection, privilege tagging for attorney submissions, retention policy, and immutable audit trails.

#### Scenario: Attorney submission intake
- **Given** an attorney milestone form is submitted
- **When** the payload enters the pipeline
- **Then** privilege tags are applied before shared analytics access
- **And** audit events are written for submit, classify, route, and review

### Requirement: Operational reporting and exports
The system MUST provide aggregated dashboards, filtered views, and CSV/PDF exports with no PII leakage in aggregate views.

#### Scenario: Supervisor dashboard filter and export
- **Given** a supervisor opens the dashboard
- **When** filters are applied by office, date range, and user group
- **Then** results return within target latency
- **And** exports preserve privacy constraints

### Requirement: Dedicated DCF admin application
The system MUST provide a dedicated administrative frontend for DCF admins to monitor survey completion status, perform analytics, and configure survey forms by user group.

#### Scenario: Admin monitors completion and configures forms
- **Given** an authenticated admin user
- **When** they open the administrative platform
- **Then** they can view completion status by survey type, office, and date range
- **And** they can edit and publish form templates for MR, VOL, ATT, and FP surveys

### Requirement: Feedback UI design guideline alignment
The feedback platform UI SHALL follow the visual and interaction guidelines established by the admin panel in the provided mockup, including layout structure, component hierarchy, and interaction patterns.

#### Scenario: UI guideline conformance
- **Given** a feedback platform screen is implemented
- **When** compared against admin-panel mockup guidelines
- **Then** spacing, typography, card/table patterns, and control behavior are consistent with the admin panel style system

### Requirement: Demo theme token conformance
The feedback and admin UIs MUST conform to the demo theme baseline from `/Users/mahalingam/Downloads/DCF-Intake/demo`, including tokenized colors, typography, controls, and interaction feedback.

#### Scenario: Theme baseline compliance
- **Given** a UI view in either platform
- **When** validated against demo theme guidelines
- **Then** it uses tokenized palette groups (navy/teal/coral/amber/green), `Outfit` typography baseline, and consistent card/chip/input/button states with aligned hover/active behavior

### Requirement: Public token survey completion (demo)
The system MUST allow respondents to complete surveys via expiring single-use tokens without staff authentication.

#### Scenario: Valid token fill and submit
- **Given** a valid survey token
- **When** the respondent opens `/survey/{token}` and submits answers
- **Then** the submission is processed with optional AI opt-out
- **And** an acknowledgement message is returned

### Requirement: Demo trigger scheduler
The system MUST enqueue trigger jobs from iFamilyNet events and dispatch surveys when `fire_at` is reached.

#### Scenario: Accepted event creates scheduled job
- **Given** a new trigger event is ingested
- **When** the demo scheduler runs
- **Then** a form instance and dispatch link exist at or after `fire_at`

### Requirement: Demo notifications
The system MUST log dispatch and reminder notifications to a demo sink and expose them to admins.

### Requirement: Generative operational reports (demo)
The system MUST generate draft weekly/monthly/quarterly reports via Hugging Face with human review status.
