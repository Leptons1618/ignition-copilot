# Scenario 1: Fault Detection and Escalation

## Objective
Demonstrate AI-powered real-time monitoring and intelligent fault detection as the motor progresses through normal operation to critical failure.

## Prerequisites
- Ignition Gateway running
- MCP server connected
- Motor in NORMAL state (reset if needed)

## Scenario Steps

### 1. Start Clean
**Human Action:**
```
"What is the current status of MotorM12?"
```

**Expected AI Response:**
- Reports motor is running normally
- Temperature around 45°C
- All systems operational
- No alarms active

### 2. Begin Simulation
**Human Action:**
```
"Start the MotorM12 simulator"
```

**Expected AI Response:**
- Confirms simulator started
- Explains the fault progression sequence
- May mention timeline: NORMAL → FAN_FAIL → OVERHEAT → TRIP

### 3. Early Detection (Time: ~25 seconds)
**Human Action:**
```
"Analyze the motor temperature trend over the last minute"
```

**Expected AI Response:**
- Shows temperature is rising
- Identifies trend is increasing
- May note fan current is decreasing
- **Intelligent insight**: Correlates fan degradation with temperature rise

### 4. Pattern Recognition (Time: ~45 seconds)
**Human Action:**
```
"Compare the temperature and fan current trends"
```

**Expected AI Response:**
- Shows inverse correlation
- Fan current decreasing while temperature increasing
- **Predictive insight**: Suggests cooling system issue developing
- May predict alarm activation timeframe

### 5. Alarm Activation (Time: ~85 seconds when temp reaches 85°C)
**Human Action:**
```
"Check if there are any active alarms"
```

**Expected AI Response:**
- Reports temperature alarm active
- Shows alarm priority (High)
- Indicates motor has tripped
- References fault reason

### 6. Post-Incident Analysis
**Human Action:**
```
"Diagnose what happened to the motor"
```

**Expected AI Response:**
- Identifies root cause: Cooling fan failure
- Shows evidence from historical data
- Explains progression: Fan degraded → Cooling reduced → Temperature rose → Trip
- Demonstrates AI understood the causal chain

## Key Demonstration Points

### 1. **Early Warning Capability**
AI can detect developing issues before critical failure:
- Spotted fan degradation in FAN_FAIL state
- Predicted temperature rise trajectory
- Provided advance warning (40+ seconds before trip)

### 2. **Correlation Analysis**
AI connects multiple data points:
- Fan current trend
- Temperature trend
- Load changes
- Timing of state transitions

### 3. **Contextual Understanding**
AI doesn't just report values, it understands significance:
- "Fan current dropping" → "Cooling system failing"
- "Temperature rising" → "Motor at risk"
- Combined → "Predict imminent trip"

### 4. **Natural Language Interface**
No need to:
- Know exact tag paths
- Write SQL queries
- Navigate complex dashboards
- Operations can ask questions in plain English

## Expected Timeline
```
Time  | State      | Temp | Fan  | AI Capability Demonstrated
------|------------|------|------|---------------------------
0s    | NORMAL     | 45°C | 8.5A | Baseline status reporting
20s   | FAN_FAIL   | 47°C | 7.5A | Pattern detection begins
30s   | FAN_FAIL   | 51°C | 6.5A | Early warning - trend analysis
40s   | OVERHEAT   | 56°C | 5.5A | Predictive alert - alarm imminent
60s   | OVERHEAT   | 70°C | 3.5A | Critical warning - recommend action
85s   | TRIP       | 85°C | 2.0A | Root cause analysis
```

## Variations to Try

### Variation A: Predictive Questions
```
"When will the temperature alarm activate?"
"How fast is the temperature rising?"
"What's the rate of fan degradation?"
```

### Variation B: Comparative Analysis
```
"Show me temperature vs fan current for the last 2 minutes"
"Is there a correlation between load and temperature?"
```

### Variation C: Operational Queries
```
"Is it safe to keep running?"
"Should I shut down the motor now or wait?"
"What will happen if I don't intervene?"
```

## Success Criteria

✅ AI detected fan degradation before alarm
✅ AI predicted temperature alarm activation
✅ AI explained root cause correctly
✅ AI provided actionable insights
✅ All queries answered in natural language
✅ Historical data used for analysis

## Business Value Demonstrated

1. **Faster Response**: 40-60 second warning vs instant trip
2. **Better Decisions**: Understand root cause, not just symptoms
3. **Lower Training**: No need to teach complex SCADA navigation
4. **Knowledge Capture**: AI explains what's happening, educates operators

## Clean Up
```
"Reset the MotorM12 simulator"
```

Motor returns to NORMAL state, ready for next scenario.
