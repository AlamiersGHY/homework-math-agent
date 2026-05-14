# Documentation Index

This file is the routing guide for project documentation. It helps humans and AI agents find the right source of truth without scanning every document.

## Read First

- `../AGENTS.md`: global AI work protocol.
- `04-logs/active.md`: current phase, task state, relevant docs, and next steps.

## Product

- `00-product/vision.md`: product positioning, target users, core value, and product principles.
- `00-product/scope.md`: source of truth for MVP scope, optional work, exclusions, and answer-mode behavior.
- `00-product/roadmap.md`: phased delivery plan from SDD foundation to deployable product.

## Architecture

- `01-architecture/system-overview.md`: MVP system shape, service boundaries, provider abstractions, and core data flows.
- `01-architecture/tech-stack.md`: formal MVP technology stack and non-choices.
- `01-architecture/directory-rules.md`: source of truth for code placement, app boundaries, and module ownership.
- `01-architecture/api-contracts.md`: first backend API contracts, including SSE chat, OCR recognition, and plot preview.
- `01-architecture/coding-standards.md`: lightweight frontend/backend implementation conventions for AI Coding.

## Workflow

- `02-workflow/definition-of-done.md`: completion checklist.
- `02-workflow/testing-strategy.md`: testing and eval expectations.
- `02-workflow/feedback-loop.md`: feedback triage, decision, execution, and recording workflow.
- `02-workflow/release-checklist.md`: release checklist.

## Decisions

- `03-decisions/README.md`: ADR index, usage guide, and supersession rules.
- `03-decisions/ADR-001-project-structure.md`: initial project structure decision.
- `03-decisions/ADR-002-mvp-architecture.md`: MVP architecture decision for SSE, SQLite, service pipeline, and provider boundaries.
- `03-decisions/ADR-003-tech-stack.md`: MVP tech stack decision for npm, venv/pip, Tailwind local components, fetch stream, and SQLAlchemy lightweight use.

## Logs

- `04-logs/active.md`: current working state.
- `04-logs/completed.md`: completed milestones.
- `04-logs/tech-debt-tracker.md`: deferred work, risks, target phase, and status.

## Evals

- `../evals/README.md`: eval purpose, lightweight schema, and maintenance rules.
- `../evals/agent_cases.json`: agent classification, answer policy, OCR, citation safety, and behavior cases.
- `../evals/visual_cases.json`: visualization trigger and plot-type behavior cases.

## Scripts

- `../scripts/README.md`: intended project-level automation command contract.
