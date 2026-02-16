> Updated: 2026-02-16. Canonical run/test workflow: scripts/README.md

# Ignition Alarm System Reference

## Alarm Configuration
Alarms are configured on tags to monitor values against thresholds.

### Alarm Modes
- **Above Value**: Triggers when value > setpoint
- **Below Value**: Triggers when value < setpoint
- **Between Values**: Triggers when value is between two setpoints
- **Outside Values**: Triggers when value is outside of a range
- **On Change**: Triggers on any value change
- **On Condition**: Triggers on boolean true/false
- **Bit Pattern**: Triggers on specific bit states

### Alarm Priorities
- **Diagnostic**: Informational, lowest severity
- **Low**: Minor operational issue
- **Medium**: Moderate concern, should be addressed
- **High**: Significant issue, prompt action needed
- **Critical**: Safety or production critical, immediate action required

### Alarm States
- **Active/Unacknowledged**: Alarm is active and no operator has acknowledged it
- **Active/Acknowledged**: Alarm is active but operator acknowledged it
- **Clear/Unacknowledged**: Alarm condition cleared but operator hasn't acknowledged
- **Clear/Acknowledged**: Alarm is fully cleared

## Alarm Scripting

### system.alarm.queryStatus()
Query currently active alarms. Returns AlarmQueryResults iterable.
```python
alarms = system.alarm.queryStatus()
for alarm in alarms:
    print(alarm.getSource())      # Tag path
    print(alarm.getPriority())    # Critical, High, Medium, Low
    print(alarm.getState())       # ActiveUnacked, ActiveAcked, etc.
    print(alarm.getName())        # Alarm name
    print(alarm.getDisplayPath()) # Display path for operator
```

### system.alarm.queryJournal(startDate, endDate)
Query alarm history from the alarm journal.
```python
from java.util import Date
journal = system.alarm.queryJournal(
    startDate=Date(Date().getTime() - 86400000),  # 24 hours ago
    endDate=Date()
)
for event in journal:
    print(event.getSource(), event.getPriority())
```

### system.alarm.acknowledge(alarmIds, notes)
Acknowledge active alarms.

## Alarm Pipeline
Alarm pipelines define how alarms are escalated:
1. Notification block: Send email/SMS
2. Delay block: Wait for acknowledgement
3. Escalation: Send to next person/group
4. Roster: Define notification groups

## Best Practices
1. Use appropriate alarm priorities - not everything is Critical
2. Configure alarm deadbands to prevent chattering
3. Set up alarm shelving for maintenance periods
4. Use alarm pipelines for escalation
5. Review alarm journal regularly for patterns
6. Follow ISA-18.2 / IEC 62682 alarm management standards
7. Target: <1 alarm per operator per 10 minutes
8. Configure alarm notes for operators to document actions
