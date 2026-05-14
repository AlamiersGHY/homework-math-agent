# AGENTS.md

This file is the entry protocol for AI agents working in this project.

The project uses a lightweight SDD structure. Documentation is not a passive archive; it is the shared operating context for product intent, architecture, workflow, decisions, and current progress.

`AGENTS.md` is the global constitution and routing layer. It should explain how agents work in this repository, not duplicate detailed product scope, technical design, API contracts, or implementation plans.

## Core Principles

- Do not infer project scope from memory or prior conversation. The source of truth for product scope is `docs/00-product/scope.md`.
- Do not infer architecture from convention alone. The source of truth for system shape and code layout is `docs/01-architecture/`.
- Keep changes scoped to the current task.
- Prefer existing project decisions and patterns over new abstractions.
- Do not introduce new dependencies, frameworks, providers, state management patterns, directory conventions, or deployment assumptions without checking the relevant docs and decisions.
- When documentation and code disagree, treat it as a project state issue: resolve it deliberately or record the mismatch instead of silently drifting.

## Startup Protocol

Before doing non-trivial work, the agent must:

1. Read this file.
2. Read `docs/INDEX.md`.
3. Read `docs/04-logs/active.md`.
4. Read only the files listed under `Relevant Docs` in `docs/04-logs/active.md`, unless the task clearly requires additional context.
5. If making architectural, product, data model, API, routing, state management, dependency, testing, or deployment decisions, check `docs/03-decisions/` before proposing or making changes.

Do not scan the entire `docs/` directory by default. Use the documentation structure deliberately.

If a referenced SDD file does not exist yet, do not invent broad behavior from memory. For broad work, create or propose the minimal missing document first. For narrow work, state the missing context and proceed conservatively.

## Mandatory Context Routing

Use this routing table to decide which documents must be read for a task:

- Product behavior, feature scope, priorities, or exclusions: read `docs/00-product/scope.md`.
- Product direction, user value, or positioning: read `docs/00-product/vision.md`.
- Architecture, service boundaries, or system flow: read `docs/01-architecture/system-overview.md`.
- Directory placement or code ownership: read `docs/01-architecture/directory-rules.md`.
- API request/response shape: read `docs/01-architecture/api-contracts.md`.
- Fuzzy requirements, UI ideas, product improvements, feature planning, or solution design requests: read `docs/02-workflow/planning-workflow.md`.
- Task completion expectations: read `docs/02-workflow/definition-of-done.md`.
- Testing or evaluation expectations: read `docs/02-workflow/testing-strategy.md`.
- User feedback, bug reports, behavior complaints, or post-test findings: read `docs/02-workflow/feedback-loop.md`.
- Agent behavior, answer policy, classification, OCR flow, visualization triggers, or similar behavior changes: read the relevant files in `evals/`.
- Durable choices that may affect future work: read `docs/03-decisions/`.

The `Relevant Docs` section in `docs/04-logs/active.md` should be treated as the task-specific reading list.

Use the planning workflow when the user gives a broad or unclear idea such as "I want a feature but have not fully designed it", "help me design this UI", "plan this requirement", or "what should this feature look like". Do not use the full planning workflow for small bug fixes, copy edits, already-approved plans, or narrow implementation changes that do not affect long-term direction.

## Project Knowledge Map

- `README.md`: human-facing project overview, setup, and basic usage.
- `AGENTS.md`: AI-facing global work protocol.
- `docs/INDEX.md`: documentation router and reading guide.
- `docs/00-product/`: product intent, scope, priorities, and roadmap.
- `docs/01-architecture/`: system structure, code organization, technical standards, and API contracts.
- `docs/02-workflow/`: planning workflow, task workflow, definition of done, testing expectations, feedback handling, and release process.
- `docs/03-decisions/`: accepted or proposed decisions. Accepted decisions override ad hoc suggestions unless explicitly revised.
- `docs/04-logs/active.md`: current task state, relevant docs, progress, next steps, blockers, and exit checklist.
- `docs/04-logs/completed.md`: concise milestone history.
- `docs/04-logs/tech-debt-tracker.md`: known deferred work, risks, and cleanup items.
- `evals/`: behavior evaluation cases for agent classification, answer policy, OCR flow, visualization triggers, and related product behavior.
- `references/`: external references only, such as screenshots, articles, API docs, design notes, course materials, or research materials.
- `scripts/`: repeatable automation commands for setup, testing, evaluation, linting, or release.
- Implementation directories: source code must live in the locations defined by `docs/01-architecture/directory-rules.md`.
- `tests/`: automated tests not colocated inside a specific app/package.

## Documentation Roles

The SDD documents have distinct responsibilities:

- Product docs explain why the project exists and what should or should not be built.
- Architecture docs explain how the system is shaped and how code should be organized.
- Workflow docs explain how work should be performed and completed.
- Decision records explain why durable choices were made.
- Logs explain what is happening now, what was completed, and what remains unresolved.
- Evals define expected behavior for agent-like features that cannot be fully validated by ordinary unit tests.

Do not duplicate the same information across multiple documents. Prefer linking or referencing the canonical document.

## Task Lifecycle

For every non-trivial task, follow this lifecycle.

### 1. Orient

- Read `docs/04-logs/active.md`.
- Identify the current phase, current goal, relevant docs, progress, blockers, and next step.
- Read the relevant docs listed there.
- Check existing ADRs if the task may affect long-term project direction.
- If no active task is recorded, create or propose a clear `active.md` entry before making broad changes.

### 2. Execute

- Keep changes scoped to the task.
- Prefer existing project patterns over introducing new abstractions.
- Update contracts, schemas, tests, evals, and docs alongside implementation when they are part of the same behavior.
- Do not hardcode external provider behavior directly inside route handlers or UI components; use the provider/service boundaries defined by architecture docs.
- If a new durable decision is needed, record it as a proposed ADR or state that an ADR should be added.

### 3. Verify

- Use the testing expectations in `docs/02-workflow/testing-strategy.md`.
- Check `docs/02-workflow/definition-of-done.md` before considering the task complete.
- For agent behavior changes, add or update relevant eval cases.
- If verification cannot be run, explain why and record the remaining risk.

### 4. Sync

Before the final response for a non-trivial task, update or propose updates to the relevant SDD state:

- `docs/04-logs/active.md` for current progress, next steps, blockers, and exit checklist.
- `docs/04-logs/completed.md` if a meaningful milestone was completed.
- `docs/04-logs/tech-debt-tracker.md` if work was deferred or a known risk remains.
- `docs/03-decisions/` if a durable architectural, product, workflow, or deployment decision was made.

A task is not complete if the implementation is done but the relevant SDD state is stale.

### 5. Checkpoint

After a complete deliverable unit reaches `Done` or `Done with Risk`, create a local Git checkpoint commit automatically unless the user explicitly asks not to commit.

Before committing:

- Inspect `git status`.
- Stage only files that belong to the completed unit.
- Do not commit ignored caches, dependency folders, local environments, secrets, build outputs, or unrelated user changes.
- If unrelated changes cannot be safely separated, do not force a commit; report the blocker instead.

Do not create automatic commits for planning-only conversation, incomplete work, `Blocked`, or `Needs Decision` states.

## Decision Rules

Use ADRs for decisions that are likely to affect future work, including:

- framework or library choices
- data model changes
- API contract changes
- authentication or permission behavior
- routing or navigation structure
- state management approach
- directory conventions
- testing strategy
- deployment or release process
- external provider choices for LLM, OCR, plotting, storage, or retrieval

ADR files should live in `docs/03-decisions/` and use this basic shape:

```md
# ADR-XXX: Title

Status: proposed | accepted | superseded

## Context

## Decision

## Consequences
```

Accepted ADRs are binding until superseded by a later ADR.

## Scope Control

Do not expand the project scope based on convenience, model capability, or assumed best practice.

When a task appears to require scope expansion:

1. Check `docs/00-product/scope.md`.
2. Check relevant ADRs.
3. If still unclear, propose the smallest viable change and mark it as a product decision.

Do not implement optional or future-phase work unless it is explicitly moved into the current scope.

## Dependency Control

Before adding a new dependency:

1. Check whether an existing dependency or standard library feature can solve the problem.
2. Check relevant architecture docs and ADRs.
3. Explain why the dependency is necessary.
4. Update implementation docs or ADRs if the dependency changes project direction.

## Testing and Evals

Ordinary tests and behavior evals serve different purposes:

- Unit tests validate deterministic logic.
- API tests validate request/response behavior.
- Integration tests validate cross-service flow.
- Evals validate agent behavior, classification, answer policy, visualization triggers, and other qualitative behaviors.

Do not rely only on manual inspection for agent behavior once an eval case can reasonably cover it.

## Final Response Expectations

When finishing a task, report:

- what changed
- what was verified
- what was not verified, if anything
- any remaining risk or follow-up recorded in SDD state
- the Git checkpoint commit hash, if a commit was created

Keep the response concise and grounded in files changed or decisions made.
