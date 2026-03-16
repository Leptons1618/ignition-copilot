# AI Development Context (Phase Prep)

This document captures the current implementation context for upcoming AI-focused development phases.

## Current LLM strategy

- Runtime provider selection is now configurable in Settings:
  - `none` (not configured)
  - `ollama` (local)
  - `openai`
  - `google`
  - `anthropic`
  - `openai-compatible`
- Provider runtime sync path:
  - Settings UI -> `/api/config/services` -> `routes/config.js` -> `services/ollama.js`
- Config secrets behavior:
  - `ignitionPass` and `llmApiKey` are masked in API responses.
  - Both are not persisted to disk by service-config writer.

## Setup assistant flow

- Setup status API: `GET /api/config/setup/status`
- Setup checklist update API: `POST /api/config/setup/checklist`
- Setup verification API: `POST /api/config/setup/verify`
- Manual checklist flags currently tracked:
  - `ignitionScriptsInstalled`
  - `mcpConfigured`

## Containerized stack

- `frontend`: `demo-app/client` built to nginx (port 3000)
- `backend`: Express API + chat/orchestration (port 3001)
- `mcp-server`: Python stdio MCP process
- `ollama` optional profile: `local-llm`
- Compose file: `docker-compose.yml`

## RAG notes

- Embeddings are normalized and cosine scoring uses normalized dot product.
- Embedding generation is parallelized with bounded concurrency.
- Search supports options (`topK`, `minScore`, `maxChars`) and logs slow requests.
- Current bottleneck risk remains embedding model/API latency.

## Logging model

- Backend request logger: `server/middleware/logger.js`
- Frontend logger batches to `/api/logs/events`
- Event Log UI can switch between frontend and backend sources.

## Testing baseline (Playwright)

- Config location: `demo-app/client/playwright.config.js`
- E2E tests location: `demo-app/client/tests/e2e/settings-setup.spec.js`
- Current tests focus on setup wizard behavior and verification flow with mocked API responses.

## Recommended next-phase tasks

1. Add MCP health endpoint and wire it into setup verification.
2. Add provider-specific model auto-discovery and model recommendations.
3. Add richer RAG indexing strategies (doc metadata filters, per-topic index).
4. Add full stack integration Playwright tests against real backend in CI.
5. Add persistent setup progress per user/profile (not just runtime config file).
