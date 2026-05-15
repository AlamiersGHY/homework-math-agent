# Tech Debt Tracker

This file tracks known deferred work and risks. Items here are not current MVP blockers unless their status says otherwise.

| ID | Type | Description | Impact | Decision | Target Phase | Status |
| --- | --- | --- | --- | --- | --- | --- |
| TD-001 | Evals | Eval runner is not implemented yet; eval cases are currently static JSON. | Agent behavior cannot be automatically scored yet. | Resolved by `scripts/run_evals.py` and `.\scripts\eval.ps1` for deterministic classification/visualization behavior. | Phase 1 | closed |
| TD-002 | Scripts | Project-level `dev`, `test`, `eval`, `check`, and `release-check` commands do not exist yet. | Agents must still use app-local commands until wrappers are added. | Resolved by wrappers for local dev, tests, evals, checks, browser QA, release validation, mock API smoke, and optional live LLM smoke. Live OCR remains credential-gated rather than a missing base wrapper. | Phase 1 | closed |
| TD-003 | Apps | `apps/web` and `apps/api` were placeholders and not runnable yet. | Resolved by the initial Next.js and FastAPI scaffold. | Keep app-level READMEs current as commands evolve. | Phase 1 | closed |
| TD-004 | README | Root README described the project as foundation-stage before scaffold. | Resolved by the scaffold status refresh. | Keep README synchronized at milestone boundaries. | Phase 1 | closed |
| TD-005 | Dependencies | `npm audit --omit=dev` reports 2 moderate findings through Next/PostCSS after initial install. | Should be reviewed before public demo or deployment; current scaffold is still runnable. | Do not force downgrade Next during scaffold; revisit during release check or dependency update. | Phase 1 | open |
| TD-006 | Provider | Real DeepSeek live smoke has not run because no local API key is configured yet. | Code path is tested with mock/fake providers, but real provider auth/network behavior is not verified locally. | Real OpenAI-compatible LLM smoke passed with local `.env`; remaining provider gap is live Doubao OCR after credentials are added. | Phase 1 | closed |
| TD-007 | Verification | Running `npm run typecheck` in parallel with `npm run build` can race on generated `.next/types` files. | Parallel verification may produce a false negative even when code and build are valid. | Resolved by `.\scripts\check.ps1`, which clears `.next` before typecheck and runs frontend checks sequentially. | Phase 1 | closed |
| TD-008 | RAG | PDF ingestion, retrieval, citation display, preferences, and memory are accepted next-stage scope but not implemented in planner Phase 1. | Planner can indicate intent, but it does not yet retrieve documents, cite sources, or persist memory. | `ADR-009` now proposes the retrieval/citation strategy; next step is API contract + implementation for document ingestion and citation-safe chat. | Phase 4.2 | in_progress |

## Status Values

- `open`: known and not started.
- `in_progress`: actively being addressed.
- `deferred`: intentionally moved to a later phase.
- `closed`: resolved.
