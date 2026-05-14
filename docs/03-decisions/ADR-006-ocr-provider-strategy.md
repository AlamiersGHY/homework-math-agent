# ADR-006: OCR Provider Strategy

Status: accepted

## Context

OCR is part of the MVP input loop: users should upload a math problem image, review editable recognized text, and then confirm it into the chat workflow.

The project needs a real-provider path for demo readiness without locking the product to one paid OCR vendor. Previous discussion considered Doubao Vision for low-friction MVP OCR and Mathpix for stronger professional math OCR. Mathpix currently requires setup/billing that the user does not want to accept for this MVP.

## Decision

Use a replaceable OCR provider boundary with this priority:

- `mock`: default for automated tests, local development without keys, and deterministic demos.
- `doubao_vision`: preferred real OCR provider for this MVP once local credentials are configured.
- `mathpix`: future professional OCR adapter path, not the active MVP provider.

The frontend must call only the backend `POST /ocr/recognize` API. OCR provider credentials belong in local environment variables and must not be committed.

The OCR workflow must always return editable text first. Recognized text must not automatically enter chat until the user confirms it.

## Consequences

- The MVP can be developed and tested without any live OCR key.
- Live OCR smoke tests can run once the user adds Doubao credentials to `apps/api/.env`.
- Mathpix can be added later behind the same provider interface if higher math OCR accuracy becomes worth the setup and cost.
- Provider failures should degrade to structured errors or mock fallback according to local configuration, not break the whole learning loop.
