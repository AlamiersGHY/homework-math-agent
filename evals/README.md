# Evals

This directory stores behavior evaluation cases for agent-like features. Evals are not unit tests; they describe expected qualitative behavior so agents do not rely only on memory or taste.

## Files

- `agent_cases.json`: question classification, answer mode policy, hint/direct-answer behavior, OCR-confirmed text behavior, and citation safety.
- `visual_cases.json`: visualization trigger behavior and expected plot type.

## Lightweight Case Shape

Eval cases should stay human-readable and machine-parseable.

Common fields:

```json
{
  "id": "agent-001",
  "title": "short human-readable name",
  "input": {
    "message": "user message",
    "answer_mode": "guided"
  },
  "expected": {},
  "must": [],
  "must_not": [],
  "notes": "optional rationale"
}
```

Rules:

- `id` must be stable.
- `expected` should contain structured expectations such as `question_type`, `answer_mode`, `should_visualize`, or `plot_type`.
- `must` lists behaviors the answer should include.
- `must_not` lists behaviors that would violate product scope or answer policy.
- Add or update eval cases before changing Agent behavior.

## Runner Status

No eval runner exists yet. Until one is implemented, these files act as the authoritative behavior examples for humans and agents. Runner work is tracked in `docs/04-logs/tech-debt-tracker.md`.
