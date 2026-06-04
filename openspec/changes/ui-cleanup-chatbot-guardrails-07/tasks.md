# Tasks: ui-cleanup-chatbot-guardrails-07

## BRD reference removal

- [x] Remove `· MR-01`, `· VOL-01`, `· FP-01`, `· ATT-01`, `· FP-07` codes from `TRIGGERS[*].subtitle` in `IFamilyNetPage.tsx`.
- [x] Remove `brdRef: string` from the `PlacementMilestone` TypeScript type.
- [x] Remove `brdRef` values from `INITIAL_PLACEMENT_MILESTONES` data array.
- [x] Remove "BRD ref" column header and `{m.brdRef}` data cell from placement milestones table.
- [x] Remove "BRD ref" column header and `brd` field + cell from legal milestones table.
- [x] Update closure card subtitle to display `"N question(s) · vN"` format.
- [x] Verify TypeScript compiles clean after type change.

## Chatbot generic rebranding

- [x] Rename `DCF_PROCESS_KNOWLEDGE` constant to `PROCESS_KNOWLEDGE` in `surveyChatService.ts`.
- [x] Replace all "DCF" occurrences in `GROUP_CONTEXT` values with "the agency".
- [x] Replace all "DCF" occurrences in `buildSystemPrompt` with generic equivalents.
- [x] Replace all "DCF" occurrences in Likert, options, and text helper LLM prompt strings.
- [x] Replace all "DCF" occurrences in deterministic fallback suggestion text.
- [x] Rewrite `getSurveyWelcome` fallback string and LLM prompt to be organisation-agnostic.
- [x] Replace hardcoded crisis-line number with generic emergency services guidance.
- [x] Verify zero "DCF" occurrences remain in `surveyChatService.ts`.

## Chatbot scope enforcement and anti-manipulation guardrails

- [x] Add `STRICT SCOPE BOUNDARY` block at the top of `buildSystemPrompt` output, listing forbidden topic categories and fixed refusal string.
- [x] Add `ANTI-MANIPULATION RULES` block covering: rewards/incentives, conditional bargains, roleplay/persona requests, authority claims, hypothetical framings, incremental persuasion, flattery/urgency, user-turn override attempts.
- [x] Verify TypeScript compiles clean after prompt changes.
