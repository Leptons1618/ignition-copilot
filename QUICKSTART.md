> Updated: 2026-02-16. Canonical run/test workflow: scripts/README.md

# Quickstart

## 1) Install dependencies

```powershell
pwsh ./scripts/setup.ps1
```

## 2) Start services

```powershell
npm --prefix demo-app run build
pwsh ./scripts/run-all.ps1
```

This starts:

- Demo API + frontend (`demo-app`)
- MCP server (`mcp-server`)

## 3) Verify services

```powershell
pwsh ./scripts/status.ps1
pwsh ./scripts/smoke.ps1
```

## 4) Run full checks

```powershell
pwsh ./scripts/test-all.ps1
```

## 5) Demo entry points

- Open `http://localhost:3001`
- Use tabs: `Demo Guide`, `AI Chat`, `Dashboard`, `Scenarios`, `System`

## Troubleshooting

- If MCP server fails: confirm `mcp-server/config.json` credentials.
- If API fails: confirm Ignition Gateway is running and reachable.
- If build fails: run `pwsh ./scripts/setup.ps1` again.
- Check runtime logs: `scripts/.logs`.

## Stop services

```powershell
pwsh ./scripts/stop-all.ps1
```
