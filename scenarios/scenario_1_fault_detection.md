> Updated: 2026-02-16. Canonical run/test workflow: scripts/README.md

# Scenario 1: Fault Detection

## Goal

Detect an emerging motor issue from live values and trends.

## Steps

1. Start simulation (`SimulatorEnabled=true`).
2. Ask AI Chat:
   - "Read MotorM12 and detect anomalies."
3. Open Charts and inspect temperature/current trend.

## Expected outcome

- AI identifies abnormal temperature behavior.
- Operator gets immediate checks/recommendations.