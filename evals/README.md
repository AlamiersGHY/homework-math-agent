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

A lightweight deterministic runner exists at `scripts/run_evals.py` and is exposed through `.\scripts\eval.ps1`.

The runner currently checks non-LLM behavior that can be scored deterministically:

- question classification
- selected answer mode propagation
- visualization trigger expectations
- plot suggestion type
- Plotly preview generation for supported visualization cases

It does not grade free-form LLM answer text yet. The `must` and `must_not` fields remain human review anchors for prompt/output QA.
