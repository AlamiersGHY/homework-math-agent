# Agentic RAG Prototype Handoff

This document is an intermediate handoff note for the next development stage of Math Agent. It captures the user's current product direction before the formal SDD files are updated.

The purpose is to help the next AI agent understand the intended shift, enrich the SDD deliberately, and then execute the next phase of development.

## 1. Core Idea

The project is preparing to move beyond a narrow local MVP demo into an exploratory "Agentic RAG Prototype" stage.

The user does not want a manual workbench where students must explicitly choose every tool. The desired experience is a chat-first intelligent course assistant that can autonomously decide which capabilities to use based on the question, uploaded course material, user preferences, and learning context.

The agent should be able to decide:

- Whether to retrieve from uploaded PDFs, textbooks, lecture notes, or course knowledge.
- Whether to cite reliable sources.
- Whether to generate 2D/3D visualizations.
- Whether to ask a clarifying question first.
- Whether OCR, plotting, retrieval, memory, or answer-mode adjustment is needed.
- Whether to answer directly, guide step by step, or only give hints.
- Whether to remember user preferences, weak points, learning style, or course focus.
- Whether to recommend examples, exercises, review points, or next actions.

Suggested name for this stage:

> Agentic RAG Prototype / Intelligent Course Assistant Prototype

The goal is fast implementation of key capabilities, with room to iterate. The user currently values rapid capability growth more than a very narrow MVP boundary.

## 2. Product Direction Shift

The previous MVP emphasis was:

- Text chat.
- Answer-mode control.
- OCR confirmation.
- 2D/3D visualization.
- Local sessions.
- Lightweight service pipeline.

The next-stage emphasis is:

- Reliable answers grounded in course material.
- PDF/textbook/lecture-note upload and retrieval.
- Source attribution and citation safety.
- Autonomous planning for tool use.
- User preference and style management.
- Lightweight long-term memory.
- A course-assistant feel rather than a generic math chatbot.

One-sentence target:

> The user asks naturally; the agent automatically retrieves reliable course material, decides whether visualization or clarification is needed, and answers in the user's preferred style with citations and useful follow-up.

## 3. Necessary Core Capabilities

### 3.1 PDF / Textbook / Lecture-Note RAG

This is one of the most important capabilities for the next stage.

The system should support:

- Uploading PDFs or course materials.
- Extracting text content.
- Chunking by page, section, heading, paragraph, or fixed-size fallback.
- Storing document metadata:
  - document id
  - filename
  - page number
  - section title
  - chunk text
  - chunk summary
  - embedding or retrieval index reference
- Automatically retrieving relevant chunks for a user question.
- Answering with source attribution.
- Clearly saying when uploaded material does not contain reliable support.

Minimum viable version:

- PDF text extraction.
- Chunk storage in SQLite or local persistence.
- Simple embedding retrieval, keyword retrieval, or hybrid retrieval.
- Top-k retrieval result return.
- Citation display in answers.

### 3.2 Agent Policy / Planner

This is the core of the agentic experience.

The backend should have a planner service that runs before answer generation and emits a structured plan. This should not be free-form text. It should be machine-readable JSON or a Pydantic schema.

Example plan:

```json
{
  "question_type": "visualization",
  "needs_retrieval": true,
  "needs_plot": true,
  "needs_clarification": false,
  "answer_mode": "guided",
  "retrieval_scope": "uploaded_course_materials",
  "plot_type": "surface3d",
  "memory_action": "record_weak_point",
  "reason": "The question involves a triple integral region, so course-material retrieval and a 3D visualization are useful."
}
```

The planner should decide:

- Question type: concept, computation, proof, visualization, mixed, OCR-derived problem, or off-topic.
- Whether RAG is needed.
- Whether plotting is needed.
- Whether clarification is needed.
- Whether user profile or memory should be used.
- Which answer mode to use.
- Whether to generate follow-up suggestions.

### 3.3 Automatic Tool Execution

The plan should drive the pipeline, not merely be displayed.

Recommended flow:

```text
user input
-> load profile/session context
-> planner generates structured plan
-> retrieval service if needed
-> plot service if needed
-> clarification response if needed
-> compose answer prompt
-> stream answer
-> return citations / plot / metadata
-> persist memory updates
```

Tool-like capabilities include:

- Retrieval.
- Plotting.
- OCR.
- Memory/profile.
- Session history.
- Answer-mode resolution.

### 3.4 Reliable Citations and Source Display

The main value of RAG is reliability, not merely adding more context.

The system should support:

- Citing textbook, PDF, page, section, or chunk.
- Showing where a statement came from.
- Differentiating retrieved evidence from general model reasoning.
- Avoiding fabricated document names, page numbers, or citations.

Suggested answer source format:

```text
References:
[1] Mathematical Analysis Notes.pdf, p. 42, Limit Definition
[2] Calculus Textbook.pdf, p. 86, Uniform Continuity
```

The UI can show a collapsible citation/source area under the answer.

### 3.5 Preferences and Style Management

The user does not want to manually control every tool, but does want high-level default preferences.

Preferences may include:

- Default answer mode:
  - automatic
  - direct answer
  - step-by-step guidance
  - hints only
- Answer style:
  - rigorous
  - intuitive
  - exam-focused
  - Socratic
  - custom
- Automatic feature toggles:
  - automatic retrieval
  - automatic visualization
  - automatic citations
  - automatic practice suggestions
- Custom instructions:
  - "For proof questions, first give the proof idea rather than the full proof."
  - "Explain in Chinese by default, but preserve important English mathematical terms."

### 3.6 Lightweight Memory

The first memory implementation should be lightweight and pragmatic.

It can store:

- User default style.
- Commonly used course or document focus.
- Recent learning topics.
- Weak points.
- Commonly selected answer modes.
- Custom instructions.
- Recent session summaries.

Memory injected into prompts must be bounded and curated. It should not grow without limit or pollute unrelated answers.

## 4. UI Direction

### 4.1 Overall Principle

The UI should remain chat-first.

The user should mostly see:

- Chat input.
- Answer content.
- Automatically generated citations.
- Automatically generated plots.
- A lightweight settings entry.
- Brief agent-decision hints when helpful.

The UI should not require the user to manually select retrieval, plotting, citation, OCR, and other tools every turn.

### 4.2 Suggested UI Modules

#### Main Chat Area

Keep the current main chat experience and enhance it with:

- Answer body.
- LaTeX rendering.
- Citation/source display.
- Plot attachments.
- Follow-up chips.
- Brief autonomous-decision notes.

Example phrasing:

```text
I checked your uploaded Mathematical Analysis Notes and generated a 3D sketch because this problem involves a triple-integral region.
```

#### Source / Citation Area

Under an answer, show:

- Source title.
- Page number.
- Section title if available.
- Snippet summary.
- Optional expand-to-view original chunk.

#### Visualization Area

When the planner determines that visualization is useful, automatically show a plot.

Important scenarios:

- Triple integrals.
- Surfaces.
- Integration regions.
- Function graphs.
- Spatial-geometry explanations.

#### Settings Panel

Keep this lightweight.

Potential settings:

- Default answer mode.
- Automatic RAG.
- Automatic visualization.
- Citation strictness.
- Answer style.
- Custom instructions.

#### Materials Entry

The product needs a way to upload course material.

Minimum UI:

- Upload PDF.
- Show material list.
- Show processing status.
- Delete material.
- Enable/disable a material.

Avoid building a complex knowledge-base dashboard, annotation system, or full document editor at first.

## 5. Suggested Phase Plan

### Phase 1: Agent Planner Skeleton

Goal:

Make the agent able to decide what should happen.

Deliverables:

- Add backend planner service.
- Generate a structured plan before chat answer generation.
- Include:
  - question_type
  - needs_retrieval
  - needs_plot
  - needs_clarification
  - answer_mode
  - memory_action
  - reason
- Return the plan in chat SSE metadata.
- Add deterministic tests/evals for typical question types.

Completion standard:

- Triple-integral or spatial-region questions set `needs_plot=true`.
- Concept explanation questions set `needs_retrieval=true`.
- Proof questions tend toward guided/hint behavior.
- Ordinary or off-topic input does not force tools.

### Phase 2: PDF Ingestion + Retrieval v1

Goal:

Allow uploaded course materials to be searched.

Deliverables:

- PDF upload API.
- Text extraction.
- Chunking.
- Document/chunk metadata storage.
- Simple retrieval service.
- Chat pipeline can receive retrieved chunks.

Completion standard:

- Uploaded PDFs can be queried.
- Retrieval results include filename, page number, and text snippet.
- Empty retrieval returns empty results without fabrication.
- Basic tests cover ingestion and retrieval.

### Phase 3: Retrieval-Augmented Answering with Citations

Goal:

Make answers actually use retrieved course material.

Deliverables:

- Wire retrieval into chat service.
- Add retrieved context to prompt.
- Generate citation-aware answers.
- Show citations in the frontend.
- Add evals for citation safety.

Completion standard:

- Concept questions can cite uploaded material.
- Answers can distinguish retrieved evidence from general reasoning.
- Missing material support does not create fake page numbers or filenames.
- Frontend clearly displays sources.

### Phase 4: Automatic Tool Execution

Goal:

Planner decisions should call tools automatically.

Deliverables:

- If `needs_plot=true`, call plot service.
- If `needs_retrieval=true`, call retrieval service.
- If `needs_clarification=true`, return a clarification-first response.
- Return tool results in metadata.

Completion standard:

- Triple-integral/spatial-surface questions automatically attach a 3D or region visualization when supported.
- Course-concept questions automatically retrieve material.
- Underspecified questions can ask clarifying questions.
- The user does not need to manually operate tools.

### Phase 5: Preferences + Memory

Goal:

Make the agent adapt to user defaults and learning context.

Deliverables:

- Store user preferences.
- Add settings panel.
- Support custom instructions.
- Add lightweight memory/profile service.
- Inject bounded profile context into prompts.

Completion standard:

- User can set default style.
- User can enable/disable automatic retrieval and visualization.
- Agent remembers preferences.
- Different styles visibly change answers.

### Phase 6: Course Assistant Polish

Goal:

Make the experience feel more like a real course assistant.

Optional enhancements:

- Generate similar practice questions.
- Summarize weak knowledge points.
- Generate chapter summaries from uploaded material.
- Give layered proof hints.
- Recommend review points from recent sessions.
- Add reranking or retrieved-context summarization.

Completion standard:

- The user can continue learning around a textbook or course packet.
- The agent combines material, visualizations, hints, and memory naturally.
- The UI remains simple and chat-first.

## 6. Boundary Planning

### Allowed Next-Phase Expansion

Allowed:

- PDF RAG.
- Local document storage.
- Embeddings or retrieval dependencies.
- Agent planner.
- Automatic tool invocation.
- User preferences.
- Lightweight memory.
- Citation UI.
- RAG and planner evals.

### Not First Priority

Not first priority:

- Full knowledge-base management platform.
- Multi-user account system.
- Cloud sync.
- Large-scale problem bank.
- Complete personalized learning-path system.
- Complex permission system.
- Professional document annotation editor.
- Full CAS.
- Heavy multi-agent framework.

### Risk Areas

Be careful about:

- Fabricated citations.
- Overcomplicated workbench UI.
- Free-form planner output that cannot be validated.
- Provider logic placed directly in route handlers.
- Retrieval failure blocking ordinary answer generation.
- Unbounded memory growth.
- Introducing heavy orchestration frameworks without a new ADR.

## 7. Recommended Architecture

### Backend Services

Suggested new or expanded services:

```text
services/
  agent_policy_service.py
  retrieval_service.py
  document_service.py
  memory_service.py
  profile_service.py

providers/
  embedding.py
  document_parser.py
  retrieval.py
```

### Possible Data Models

Potential tables/entities:

```text
documents
  id
  filename
  content_type
  created_at
  status

document_chunks
  id
  document_id
  page_number
  section_title
  chunk_index
  text
  summary
  embedding_ref

retrieval_events
  id
  session_id
  message_id
  query
  chunk_ids
  created_at

user_profiles
  id
  answer_style
  default_answer_mode
  auto_retrieval
  auto_visualization
  custom_instruction

memory_items
  id
  profile_id
  type
  content
  confidence
  created_at
  updated_at
```

### Possible API Additions

Potential API endpoints:

```text
POST /documents/upload
GET /documents
DELETE /documents/{id}
POST /documents/{id}/reindex

GET /profile
POST /profile

POST /chat/stream
# Extend metadata with planner, retrieved_sources, citations, memory_updates, plot_suggestion.
```

## 8. Tests and Evals

Add or extend evals for:

- Planner decisions:
  - triple integral -> needs_plot
  - course concept explanation -> needs_retrieval
  - proof question -> guided/hint
  - underspecified question -> clarification
- Retrieval:
  - uploaded material can produce relevant chunks
  - missing material returns no fabricated source
- Citations:
  - citations must come from retrieved chunks
  - filename/page metadata must be real
- Preferences:
  - style settings affect answer behavior
- Memory:
  - preferences can be saved
  - unrelated short-term details are not stored as long-term memory

## 9. Definition of Done for Next-Phase Work

For each next-phase development unit:

- SDD is updated when behavior, contracts, or durable direction changes.
- `active.md` reflects current progress and next step.
- API contracts are updated when metadata or endpoints change.
- ADRs are added for durable provider/storage/orchestration decisions.
- Evals are added for planner, RAG, citation, or memory behavior.
- Backend tests pass.
- Frontend typecheck/build passes when UI changes.
- Existing chat/OCR/plot/session behavior is not broken.
- New dependencies are justified and documented.
- RAG implementation verifies citation safety.
- Planner implementation has a fallback for invalid structured output.

## 10. Suggested Prompt for the Next AI Agent

Use this prompt when handing off development:

```text
Please follow AGENTS.md startup protocol. Read docs/INDEX.md and docs/04-logs/active.md, then read AGENTIC_RAG_HANDOFF.md at the project root.

First, integrate the Agentic RAG Prototype direction into the formal SDD as needed: ADR, active.md, API contracts, testing/eval docs, and roadmap/scope if appropriate.

Then begin Phase 1: implement backend Agent Policy Planner v1. The planner should classify incoming math questions and emit structured decisions for retrieval, plotting, clarification, answer mode, and memory usage. Wire planner output into chat stream metadata without requiring full PDF RAG yet. Add deterministic tests/evals for concept, proof, computation, and visualization cases.

Keep the UI chat-first. Do not turn the product into a manual tool workbench.
```
