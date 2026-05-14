# ADR-004: Planning Workflow

Status: accepted

## Context

The project uses lightweight SDD to reduce repeated manual coordination during AI Coding. The user often starts with a fuzzy product, UI, or engineering idea and expects the Agent to help clarify, research, recommend, and turn it into an executable plan.

Existing workflow documents cover task completion, testing, release checks, and feedback handling, but they do not define the earlier step: turning an unclear idea into a concise plan. Without a formal route, Agents may either over-ask the user, skip planning, or produce long documents that are too costly to read.

## Decision

The project will use `docs/02-workflow/planning-workflow.md` as the standard workflow for fuzzy requirement planning.

The durable rules are:

- Triggering is routed through `AGENTS.md`; the workflow file itself is not a trigger.
- The workflow is lightly automatic for non-trivial unclear requirements, UI ideas, product improvements, and planning requests.
- The Agent reads local SDD and code context first before asking questions or using external references.
- User involvement is kept low: ask at most 1-3 high-impact questions.
- Planning output starts with a short solution card before any detailed execution plan.
- Sub-agents are not used by default; they are only suggested for complex research, parallel comparison, or explicit user requests.
- Planning state belongs in `docs/04-logs/active.md`; completed delivery summaries belong in `docs/04-logs/completed.md`.
- Long-term constraints belong in ADRs. Ordinary task details should not be recorded as ADRs.

## Consequences

Agents should not rely on planning documents to self-trigger. They must follow the routing rules in `AGENTS.md`.

Planning output should be easier for the user to scan, because the first visible artifact is a compact solution card.

The project avoids adding a separate feature brief directory for now. This keeps the SDD system lighter, but requires Agents to keep `active.md`, `completed.md`, and ADRs cleanly separated.

If future work shows that `completed.md` becomes too long or unclear, a later ADR may introduce a milestone index or feature brief system.
