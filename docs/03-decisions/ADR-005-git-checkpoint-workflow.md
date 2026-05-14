# ADR-005: Git Checkpoint Workflow

Status: accepted

## Context

The project is intended to move through short, high-intensity AI Coding cycles. Without regular local commits, completed deliverable units can blend together, making it harder to review, roll back, or understand what changed.

At the same time, automatic commits must not encourage half-finished work, include generated artifacts, or accidentally capture unrelated user changes.

## Decision

After a complete deliverable unit reaches `Done` or `Done with Risk`, the Agent should create a local Git checkpoint commit automatically unless the user explicitly asks not to commit.

A deliverable unit is complete only after:

- implementation or documentation changes are finished for the current scope
- relevant verification has passed, or remaining risk is recorded
- SDD state has been synchronized when required
- the work can be described as one coherent unit

Before committing, the Agent must inspect Git status and stage only files that belong to the completed unit. Ignored caches, dependency folders, local environments, secrets, build outputs, and unrelated user changes must not be committed.

If unrelated changes are present and cannot be safely separated, the Agent should not force a commit. It should report the situation and leave the worktree unchanged.

## Consequences

Each completed unit should leave behind a reviewable local commit.

The final response should mention the commit hash when a checkpoint commit was created.

The Agent should still avoid committing during planning-only conversation, incomplete work, `Blocked`, or `Needs Decision` states.
