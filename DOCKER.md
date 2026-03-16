# Docker Usage

This stack includes:

- `frontend` (nginx serving React build, exposed on `:3000`)
- `backend` (Express API, exposed on `:3001`)
- `mcp-server` (Python MCP stdio service)
- optional `ollama` profile (`:11434`)

## 1) Build and run full stack

```bash
docker compose up --build -d
```

Open app UI: `http://localhost:3000`

## 2) Local LLM mode (Ollama in compose)

```bash
docker compose --profile local-llm up --build -d
```

Then set in Settings:

- Provider: `Local LLM (Ollama)`
- Base URL: `http://ollama:11434` (if backend accesses via compose network) or `http://host.docker.internal:11434`
- Model: e.g. `llama3.2:3b`

## 3) API provider mode

Use `.env` or shell exports:

```bash
LLM_PROVIDER=openai
LLM_BASE_URL=https://api.openai.com
LLM_API_KEY=your_api_key
LLM_MODEL=gpt-4o-mini
```

Supported provider values:

- `none`
- `ollama`
- `openai`
- `google`
- `anthropic`
- `openai-compatible`

## 4) Manual prerequisites checklist

You still need to do these manually:

1. Ensure Ignition Gateway is running and reachable.
2. Import/deploy required WebDev scripts in your Ignition project.
3. Configure `mcp-server/config.json` for your environment.

After manual setup, open the app Settings and run:

- `Verify` (setup verification)
- `Run Connection Test`

Mark manual checklist items in the Settings UI after confirming each step.

## Notes

- Runtime app data persists via `demo-app/server/data` bind mount.
- Linux compatibility for host access is handled by `host.docker.internal:host-gateway`.
- `mcp-server` in compose runs as stdio service with a keepalive pipe.
