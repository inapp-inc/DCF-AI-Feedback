# Feedback Platform Specification Delta

## Requirements

### Requirement: Inference-backed submission processing
The backend MUST process each free-text submission through inference and store explainable outputs.

#### Scenario: Completed inference payload
- **Given** a valid submission
- **When** inference processing succeeds
- **Then** topic, sentiment, urgency, and route recommendation are retrievable

### Requirement: Priority routing
High urgency or legal-sensitive results SHALL be routed to a supervisor/legal queue.

#### Scenario: Urgent text
- **Given** urgency is high
- **When** processing completes
- **Then** a queue item is created with priority high or critical
