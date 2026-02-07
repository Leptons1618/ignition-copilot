# Scenario 2: Root Cause Analysis

## Objective
Demonstrate AI-powered diagnostic capabilities and root cause determination after a fault has occurred.

## Prerequisites
- Ignition Gateway running
- MCP server connected
- Motor has completed a fault cycle (TRIP state)

## Scenario Setup

### Option A: Use Previous Fault
If you just completed Scenario 1, the motor should be in TRIP state.

### Option B: Create Fresh Fault
```
1. "Reset the MotorM12 simulator"
2. "Start the MotorM12 simulator"
3. Wait ~90 seconds for complete fault progression
4. Verify motor is tripped
```

## Scenario Steps

### 1. Initial Investigation
**Human Action:**
```
"What's wrong with MotorM12?"
```

**Expected AI Response:**
- Reports motor is not running
- Identifies active alarm
- Shows elevated temperature
- Notes TRIP state

**Observation**: AI immediately recognizes abnormal condition

### 2. Root Cause Diagnosis
**Human Action:**
```
"Diagnose the motor issue and tell me what caused the trip"
```

**Expected AI Response:**
- **Root Cause Identified**: Cooling fan failure
- **Evidence Presented**:
  - Fan current dropped from 8.5A to ~2A
  - Temperature rose from 45°C to 85°C
  - Correlation between fan degradation and temp rise
- **Failure Mode**: Inadequate cooling led to thermal overload
- **Fault Progression**: Shows state machine sequence

**Observation**: AI performed multi-factor analysis automatically

### 3. Historical Evidence
**Human Action:**
```
"Show me the historical data that proves it was a cooling failure"
```

**Expected AI Response:**
- Queries last hour of historian data
- Presents timeline:
  - Normal period: Fan steady at 8.5A, temp stable
  - Degradation period: Fan declining, temp rising
  - Failure period: Fan critical, temp exceeded limit
- Shows rate of change calculations
- Demonstrates cause-and-effect timing

**Observation**: AI uses historian data as evidence

### 4. Comparative Analysis
**Human Action:**
```
"Compare the temperature and fan current trends to show me the correlation"
```

**Expected AI Response:**
- Side-by-side trend comparison
- Statistical correlation
- **Key Insight**: Inverse relationship (fan down, temp up)
- Timeline alignment showing causal relationship

**Observation**: AI identifies patterns humans might miss

### 5. "Five Whys" Investigation
**Human Action:**
```
"Why did the motor trip?"
```
**AI Response**: "Temperature exceeded 85°C"

```
"Why did temperature get so high?"
```
**AI Response**: "Inadequate cooling"

```
"Why was cooling inadequate?"
```
**AI Response**: "Cooling fan degraded"

```
"Why did the fan degrade?"
```
**AI Response**: "Simulated bearing wear in demo scenario. In production, check for: bearing failure, motor winding issues, power supply problems"

**Observation**: AI supports investigative questioning

### 6. What-If Analysis
**Human Action:**
```
"If the fan had been at 6A instead of 2A when it tripped, would the motor have failed?"
```

**Expected AI Response:**
- Analyzes relationship between fan current and cooling capacity
- Estimates temperature at different fan levels
- **Insight**: May suggest 6A would still have been marginal
- Demonstrates understanding of system dynamics

**Observation**: AI can reason about hypotheticals

## Key Demonstration Points

### 1. **Multi-Source Data Integration**
AI combined:
- Current tag values
- Historical trends
- Alarm data
- System state
- Fault messages

### 2. **Causal Reasoning**
AI understands:
- Fan failure → Reduced cooling
- Reduced cooling → Temperature rise
- Temperature rise → Alarm trigger
- Alarm trigger → Protective trip

Not just correlation, but causation.

### 3. **Evidence-Based Conclusions**
AI doesn't guess:
- Points to specific data
- Shows timeline of events
- Calculates rates of change
- Proves conclusions with evidence

### 4. **Context Awareness**
AI knows:
- Normal operating parameters
- Alarm setpoints
- Expected behavior
- System design intent

## Advanced Queries to Try

### Technical Deep-Dive
```
"What was the rate of temperature rise during the overheat phase?"
"Calculate the time from fan failure to trip"
"Show me the exact moment when temperature started accelerating"
```

### Operational Perspective
```
"Could this have been prevented?"
"What warning signs did we have?"
"How much advance notice did we get?"
```

### Maintenance Planning
```
"What component failed?"
"What should maintenance inspect?"
"Is this likely to happen again?"
```

## Success Criteria

✅ AI correctly identified cooling failure as root cause
✅ AI provided historical evidence
✅ AI explained causal chain
✅ AI answered follow-up questions correctly
✅ AI distinguished correlation from causation
✅ Diagnosis matches actual simulation logic

## Comparison to Traditional Approach

### Without AI:
1. Operator sees trip alarm
2. Checks multiple screens/trends
3. Calls engineer for interpretation
4. Engineer queries historian database
5. Engineer analyzes trends manually
6. Engineer writes report
7. **Time**: 30-60 minutes

### With AI:
1. Operator asks "What happened?"
2. AI analyzes all data sources
3. AI presents diagnosis with evidence
4. **Time**: 30 seconds

**Time Savings**: 60-120x faster

## Business Value

1. **Faster MTTR**: Minutes instead of hours to diagnose
2. **Better Decisions**: Evidence-based, not guesswork
3. **Knowledge Transfer**: Junior operators get expert-level insights
4. **Consistency**: Same analysis quality every time
5. **Documentation**: AI explanation serves as incident report

## Clean Up
```
"Reset the MotorM12 simulator to prepare for the next demonstration"
```

## Next Scenario
Proceed to [Scenario 3: Predictive Maintenance](scenario_3_predictive.md)
