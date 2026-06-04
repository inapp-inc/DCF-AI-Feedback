# Design: seed-backend-processing-02

## Technical approach
- Accept submission payload, validate schema, and store raw + normalized answers.
- Invoke Hugging Face inference endpoint through adapter abstraction.
- Persist topic, sentiment, urgency, explainability, and provider metadata.
- Route high urgency and legal-sensitive outputs to supervisor/legal queue.

## Constraints
- Inference provider is Hugging Face only for demo.
- AI output remains advisory and never applies automated consequences.

## Risks and rollback
- Risk: external inference errors or latency spikes.
- Rollback: switch to deterministic fallback labels and keep queue routing active.
