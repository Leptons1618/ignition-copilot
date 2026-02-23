# AI-Powered Project Indexing & View Manipulation - Quick Start

## Overview

The Ignition Copilot now includes advanced AI-assisted features for:
- **Automatic project indexing** - Extract and catalog all views, scripts, tags, and dependencies
- **Intelligent querying** - Find tag usage, script dependencies, and similar views
- **Safe view manipulation** - Create, modify, and clone views with automatic backup
- **Template-based generation** - Generate new views from existing patterns

## Quick Start

### 1. Index Your Project

```bash
cd mcp-server
python index_project.py --project "C:\Program Files\Inductive Automation\Ignition\data\projects\MyProject" --tags "../tags.json"
```

This creates an `ai-index/` directory with:
- `views.json` - Catalog of all views with components and bindings
- `scripts.json` - Catalog of project scripts
- `tags.json` - Catalog of tags from exported JSON
- `dependencies.json` - Relationship graph between all components
- `metadata.json` - Index metadata and statistics

### 2. Query the Index

#### Find which views use a specific tag:
```bash
python index_project.py --project "C:\...\MyProject" --query tag --path "[default]Pump01/Status"
```

#### Find which views use a specific script:
```bash
python index_project.py --project "C:\...\MyProject" --query script --path "project.pump.formatStatus"
```

#### Find views similar to a target view:
```bash
python index_project.py --project "C:\...\MyProject" --query similar --view "Pump/PumpView" --limit 5
```

#### Get detailed view information:
```bash
python index_project.py --project "C:\...\MyProject" --query view --view "Pump/PumpView"
```

#### List all instances of a UDT:
```bash
python index_project.py --project "C:\...\MyProject" --query udts --udt "Pump"
```

### 3. Use via MCP Tools

All functionality is available through MCP tools in the server:

```python
# Available MCP tools:
- index_project
- query_tag_usage
- query_script_usage
- find_similar_views
- get_view_details
- list_udt_instances
- create_view_from_template
- modify_view
- add_component_to_view
- validate_view
- clone_view
```

## Common Use Cases

### Create Multiple Views from Template

AI can now generate multiple views from a single template, automatically replacing tag paths:

```python
# Example: Create pump views for Pump01-Pump10
for i in range(1, 11):
    create_view_from_template(
        template_view="Pump/PumpTemplate",
        new_view_name=f"Pump/Pump{i:02d}View",
        tag_replacements={
            "[default]PumpTemplate": f"[default]Pump{i:02d}"
        }
    )
```

### Add Alarm Indicator to All Motor Views

Find all motor views and add alarm indicators:

```python
# Find views using motor tags
motor_views = query_views_by_tag_pattern("Motor*")

# Add alarm component to each
for view in motor_views:
    add_component_to_view(
        view_path=view,
        component_type="ia.display.alarm-status-table",
        properties={"alarmPath": view.replace("Motor", "[default]Motor")}
    )
```

### Analyze Impact of Tag Changes

Before renaming a tag, see what will be affected:

```python
affected_views = query_tag_usage("[default]OldTagName")
affected_scripts = query_script_with_tag("[default]OldTagName")

print(f"Renaming this tag will affect {len(affected_views)} views and {len(affected_scripts)} scripts")
```

## Architecture

```
Ignition Project
    ↓
Project Indexer (scans and extracts)
    ↓
AI Index (structured data)
    ↓
MCP Tools (AI-accessible operations)
    ↓
View Manipulator (safe editing)
    ↓
Updated Project (with automatic backups)
```

## Safety Features

1. **Automatic Backups** - Every view modification creates a timestamped backup
2. **JSON Validation** - All changes validated before writing
3. **Metadata Preservation** - Resource IDs and metadata never modified
4. **Read-Only Indexing** - Indexing never modifies source files
5. **Error Recovery** - Detailed error logging for troubleshooting

## Testing

Run the test suite to validate functionality:

```bash
cd mcp-server
python test_ai_features.py
```

Tests cover:
- Project indexing
- View manipulation
- Tag replacement
- Component addition
- Backup creation
- Integration scenarios

## Next Steps

1. **Export your tags** from Ignition Designer (Tag Browser → Export → JSON)
2. **Index your project** using the CLI tool
3. **Explore the indexes** to understand your project structure
4. **Try queries** to find relationships
5. **Use MCP tools** for AI-assisted operations

## Examples Included

See `docs/AI_INDEXING_GUIDE.md` for:
- Detailed API documentation
- Python code examples
- Best practices
- Troubleshooting guide
- Extension instructions

## Integration with Existing Features

The AI indexing works seamlessly with existing Copilot features:
- **Tag operations** can use index to find affected views
- **Historian queries** can identify views displaying data
- **Alarm tools** can find views with alarm bindings
- **Dashboard generation** can use templates from index

## Requirements

- Python 3.8+
- Ignition Gateway (running or accessible project files)
- Exported tags.json from Designer
- Project files accessible via filesystem

## Limitations

Current version:
- Views must be in standard Perspective format
- Scripts must be Python (Jython)
- Tags must be exported to JSON
- Modifications require filesystem access

Future enhancements planned:
- Real-time index updates
- Semantic search with embeddings
- AI-powered view generation
- Automated refactoring tools

## Support

For issues or questions:
1. Check `docs/AI_INDEXING_GUIDE.md`
2. Review test examples in `test_ai_features.py`
3. Check logs in `ignition_mcp.log`
4. Validate project structure matches expected format
