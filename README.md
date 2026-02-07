# Ignition MCP Smart Operations Demo

An end-to-end demonstration project showcasing intelligent monitoring, diagnostics, automation, and AI-assisted operational workflows on top of Ignition SCADA using Model Context Protocol (MCP).

## Project Purpose

This project demonstrates how modern AI capabilities can be integrated with industrial automation systems to create intelligent operational assistants. By combining Ignition's robust SCADA platform with MCP-powered AI agents, we showcase:

- **Intelligent Monitoring**: Real-time awareness of plant conditions with contextual understanding
- **Predictive Diagnostics**: AI-assisted root cause analysis and fault prediction
- **Automated Workflows**: Smart responses to operational events
- **Faster Development**: AI-powered troubleshooting and configuration assistance

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     MCP Client (Claude/AI)                   │
│                  Intelligent Operations Agent                │
└────────────────────────────┬────────────────────────────────┘
                             │ MCP Protocol
┌────────────────────────────▼────────────────────────────────┐
│                   Ignition MCP Server                        │
│  - Tag Read/Write                                            │
│  - Historical Queries                                        │
│  - Alarm Management                                          │
│  - System Analysis                                           │
└────────────────────────────┬────────────────────────────────┘
                             │ Gateway Network/Web Services
┌────────────────────────────▼────────────────────────────────┐
│                    Ignition Gateway                          │
│  ┌──────────────────────────────────────────────────┐       │
│  │  Tag Provider (default)                          │       │
│  │  └─ DemoPlant                                    │       │
│  │     └─ MotorM12 (Simulated Asset)               │       │
│  │        - Process Values (Temp, Speed, Load)      │       │
│  │        - Alarms & Faults                         │       │
│  │        - Control Signals                         │       │
│  │        - Historian Data                          │       │
│  └──────────────────────────────────────────────────┘       │
│  ┌──────────────────────────────────────────────────┐       │
│  │  Gateway Timer Script (Plant Simulator)          │       │
│  │  - Deterministic state machine                   │       │
│  │  - NORMAL → FAN_FAIL → OVERHEAT → TRIP          │       │
│  └──────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────┘
```

## What Is Being Demonstrated

### 1. Realistic Industrial Simulation
- Motor asset with temperature, vibration, load monitoring
- Cooling system with fan degradation scenario
- Deterministic fault progression for repeatable demos
- Historian-enabled trending and analysis

### 2. MCP-Powered Intelligence Layer
- Natural language interaction with industrial systems
- Context-aware operational assistance
- Historical data analysis and pattern recognition
- Automated diagnostic workflows

### 3. Smart Operational Scenarios
- **Fault Detection**: AI identifies developing issues before critical failure
- **Root Cause Analysis**: Intelligent correlation of symptoms to causes
- **Predictive Maintenance**: Trend analysis suggests interventions
- **Guided Recovery**: Step-by-step assistance for operators
- **Knowledge Transfer**: System explains behavior and reasoning

## Key Concepts and Benefits

### For Operations Teams
- **Faster Response**: AI assistant provides instant context and recommendations
- **Better Decisions**: Historical analysis supports root cause determination
- **Reduced Downtime**: Predictive insights enable proactive interventions
- **Knowledge Retention**: AI captures and shares operational expertise

### For Engineering Teams
- **Rapid Troubleshooting**: AI helps navigate complex tag structures
- **Configuration Assistance**: Natural language queries for system setup
- **Documentation**: Auto-generated insights about system behavior
- **Testing Support**: AI-driven scenario validation

### For Management
- **Lower Training Costs**: AI assists new operators in real-time
- **Improved Reliability**: Proactive fault management
- **Data-Driven Insights**: Better understanding of operational patterns
- **Scalability**: Same AI approach works across multiple assets

## Quick Start

### Prerequisites
- Ignition Gateway 8.1+ installed and running
- Python 3.8+ installed
- Network access to Ignition Gateway

### Installation

1. **Import Tag Structure**
   ```bash
   # Import tags.json into Ignition Designer
   # File → Import Tags → Select tags.json
   ```

2. **Install Gateway Timer Script**
   ```bash
   # In Ignition Designer:
   # Project → Scripts → Gateway Events → Timer Scripts
   # Create new fixed-rate timer (1000ms)
   # Copy content from syntheticDataGen.py
   ```

3. **Install MCP Server**
   ```bash
   cd mcp-server
   pip install -r requirements.txt
   ```

4. **Configure Connection**
   ```bash
   # Edit mcp-server/config.json
   # Set your Ignition Gateway URL and credentials
   ```

5. **Start MCP Server**
   ```bash
   python ignition_mcp_server.py
   ```

### Running a Demo

1. **Start Simulation**
   - Set tag `[default]DemoPlant/MotorM12/SimulatorEnabled` to `true`
   - Watch temperature and fan current in trend

2. **Observe Fault Progression**
   - Time 0-20s: Normal operation
   - Time 20-40s: Fan degradation begins
   - Time 40+: Overheat condition develops
   - ~85°C: Trip alarm activates

3. **Use AI Assistant** (via MCP Client)
   ```
   "What is the current status of MotorM12?"
   "Why did the temperature alarm activate?"
   "Show me the temperature trend for the last hour"
   "What should I do to recover the motor?"
   ```

4. **Reset Simulation**
   - Set tag `[default]DemoPlant/MotorM12/ResetAlarm` to `true`
   - System returns to NORMAL state

## Project Structure

```
ignition-copilot/
├── README.md                          # This file
├── SETUP_GUIDE.md                     # Detailed installation steps
├── WALKTHROUGH.md                     # How the system was built
├── tags.json                          # Ignition tag structure export
├── syntheticDataGen.py               # Gateway timer simulation script
├── mcp-server/
│   ├── ignition_mcp_server.py        # Main MCP server implementation
│   ├── ignition_client.py            # Ignition API wrapper
│   ├── config.json                   # Server configuration
│   ├── requirements.txt              # Python dependencies
│   └── tools/
│       ├── tag_operations.py         # Tag read/write tools
│       ├── historian.py              # Historical query tools
│       ├── alarms.py                 # Alarm management tools
│       └── diagnostics.py            # AI diagnostic workflows
├── scenarios/
│   ├── scenario_1_fault_detection.md
│   ├── scenario_2_root_cause.md
│   ├── scenario_3_predictive.md
│   └── scenario_4_recovery.md
└── docs/
    ├── tag_structure.md              # Tag documentation
    ├── mcp_api_reference.md          # MCP server API docs
    └── extending.md                  # How to add features
```

## Next Steps

1. Review [SETUP_GUIDE.md](SETUP_GUIDE.md) for detailed installation
2. Read [WALKTHROUGH.md](WALKTHROUGH.md) to understand implementation
3. Try the demonstration scenarios in `scenarios/`
4. Explore extending the system using `docs/extending.md`

## Support and Contribution

This is a demonstration project. For production use:
- Implement proper security and authentication
- Add error handling and validation
- Scale tag structure to real assets
- Implement proper historian configuration
- Add user management and audit logging

## License

MIT License - See LICENSE file for details
