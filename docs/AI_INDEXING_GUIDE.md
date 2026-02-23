# AI-Assisted Project Indexing and View Manipulation

## Overview

This implementation integrates the AI indexing schema and view manipulation capabilities described in `NEWFEATURE.md` and `IGNITION_INDEXING_SCHEMA.md` into the Ignition Copilot MCP server.

## New Capabilities

### 1. Project Indexing
- **Automated extraction** of views, scripts, tags, and dependencies
- **Structured indexes** stored in JSON format for fast querying
- **Dependency graph** tracking relationships between components
- **Semantic search** foundation for AI-assisted operations

### 2. View Manipulation
- **Safe view creation** from templates with automatic backup
- **Component addition** and modification with validation
- **Tag replacement** across view bindings
- **Property updates** with structure preservation

## Architecture

```
┌─────────────────────────────────────────────────┐
│         Ignition Project                        │
│  ├── views/ (Perspective views)                 │
│  ├── scripts/ (Project scripts)                 │
│  └── tags.json (Exported tags)                  │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│         Project Indexer                         │
│  - Parses views, scripts, tags                  │
│  - Extracts components, bindings                │
│  - Builds dependency graph                      │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│         AI Index (ai-index/)                    │
│  ├── views.json (View catalog)                  │
│  ├── scripts.json (Script catalog)              │
│  ├── tags.json (Tag catalog)                    │
│  ├── dependencies.json (Relationship graph)     │
│  └── metadata.json (Index metadata)             │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│         MCP Tools                               │
│  - index_project                                │
│  - query_tag_usage                              │
│  - query_script_usage                           │
│  - find_similar_views                           │
│  - create_view_from_template                    │
│  - modify_view                                  │
│  - add_component_to_view                        │
│  - validate_view                                │
└─────────────────────────────────────────────────┘
```

## Components

### 1. `tools/project_indexer.py`
Main indexing engine that:
- Scans Perspective views and extracts component hierarchy
- Parses project scripts for functions and dependencies
- Processes exported tag JSON
- Builds comprehensive dependency graph
- Provides query methods for tag usage, script usage, and similar views

**Key Classes:**
- `ProjectIndexer`: Core indexing engine

**MCP Tools:**
- `index_project`: Build/rebuild complete index
- `query_tag_usage`: Find views using specific tags
- `query_script_usage`: Find views using specific scripts
- `find_similar_views`: Find structurally similar views
- `get_view_details`: Get detailed view information
- `list_udt_instances`: List all instances of a UDT type

### 2. `tools/view_manipulation.py`
Safe view editing tools that:
- Create new views from templates
- Modify existing views with automatic backup
- Add components to views
- Replace tag bindings
- Update component properties
- Validate view structure

**Key Classes:**
- `ViewManipulator`: Safe view editing engine

**MCP Tools:**
- `create_view_from_template`: Create new view from existing template
- `modify_view`: Modify existing view with backup
- `add_component_to_view`: Add component to view
- `validate_view`: Validate view structure and bindings
- `clone_view`: Create exact copy of a view

### 3. `index_project.py`
Standalone CLI tool for project indexing:
```bash
# Index a project
python index_project.py --project /path/to/project --tags tags.json

# Query tag usage
python index_project.py --project /path/to/project --query tag --path "[default]Pump01/Status"

# Find similar views
python index_project.py --project /path/to/project --query similar --view Pump/PumpView --limit 5
```

## Usage Examples

### Index a Project

```python
from tools.project_indexer import ProjectIndexer

indexer = ProjectIndexer(
    project_path="C:/Program Files/Inductive Automation/Ignition/data/projects/MyProject",
    tags_json_path="tags.json"
)

result = indexer.build_full_index()
print(f"Indexed {result['views_count']} views, {result['scripts_count']} scripts, {result['tags_count']} tags")
```

### Query Tag Usage

```python
views = indexer.query_tag_usage("[default]Pump01/Status")
print(f"Tag used in views: {views}")
```

### Find Similar Views

```python
similar = indexer.find_similar_views("Pump/PumpView", limit=5)
for item in similar:
    print(f"{item['view']['view_path']}: {item['similarity']:.2%} similar")
```

### Create View from Template

```python
from tools.view_manipulation import ViewManipulator

manipulator = ViewManipulator("C:/Program Files/Inductive Automation/Ignition/data/projects/MyProject")

result = manipulator.create_view_from_template(
    template_view="Pump/PumpView",
    new_view_name="Pump/Pump02View",
    modifications={
        "tag_replacements": {
            "[default]Pump01": "[default]Pump02"
        }
    }
)
```

### Add Component to View

```python
result = manipulator.add_component_to_view(
    view_path="Pump/PumpView",
    component_type="ia.display.label",
    properties={
        "text": "Alarm Status",
        "style": {"fontSize": "16px"}
    }
)
```

### Validate View

```python
validation = manipulator.validate_view("Pump/PumpView")
if validation['valid']:
    print("View is valid")
else:
    print(f"Errors: {validation['errors']}")
```

## MCP Tool Integration

The new tools are automatically registered with the MCP server and available via the Model Context Protocol:

```json
{
  "name": "index_project",
  "description": "Build or rebuild complete index of Ignition project",
  "inputSchema": {
    "type": "object",
    "properties": {
      "project_path": {"type": "string"},
      "tags_json_path": {"type": "string"}
    },
    "required": ["project_path"]
  }
}
```

## Index Structure

### views.json
```json
{
  "view_path": "Pump/PumpView",
  "file_path": "views/Pump/PumpView/view.json",
  "root_container": "flex",
  "components": [
    {
      "id": "Label_1",
      "type": "ia.display.label",
      "path": "root.children[0]",
      "bindings": ["[default]Pump01/Status"]
    }
  ],
  "tags_used": ["[default]Pump01/Status", "[default]Pump01/Speed"],
  "scripts_used": ["project.pump.formatStatus"],
  "embedded_views": ["Common/AlarmIndicator"],
  "structure_signature": ["flex", "label", "icon", "alarm"]
}
```

### dependencies.json
```json
{
  "tag_to_view": {
    "[default]Pump01/Status": ["Pump/PumpView", "Main/Dashboard"]
  },
  "view_to_script": {
    "Pump/PumpView": ["project.pump.formatStatus"]
  },
  "view_to_view": {
    "Main/Dashboard": ["Pump/PumpView"]
  },
  "script_to_tag": {
    "project.pump.formatStatus": ["[default]Pump01/Status"]
  }
}
```

## Safety Features

1. **Automatic Backups**: All view modifications create timestamped backups in `ai-backups/`
2. **JSON Validation**: All modifications are validated before writing
3. **Structure Preservation**: Resource metadata and UUIDs are never modified
4. **Read-Only Mode**: Indexing operations never modify source files
5. **Error Handling**: Comprehensive error handling with detailed logging

## Integration with Existing Tools

The new tools integrate seamlessly with existing MCP capabilities:
- Tag operations can use index to find affected views
- Historian queries can identify views displaying specific data
- Alarm tools can find views with alarm bindings
- Diagnostic tools can analyze view dependencies

## Best Practices

1. **Index Regularly**: Rebuild index after major project changes
2. **Backup Before Modify**: Always enable backup when modifying views
3. **Validate After Changes**: Run validation after view modifications
4. **Use Templates**: Create new views from existing templates rather than from scratch
5. **Test in Development**: Test all modifications in development environment first

## Future Enhancements

Potential future additions:
- **Embedding generation** for semantic search
- **AI-powered view generation** from natural language
- **Automated refactoring** across multiple views
- **Impact analysis** for proposed changes
- **View comparison** and diff tools
- **Batch operations** for multiple views

## Troubleshooting

### Index Build Fails
- Verify project path is correct
- Check that views directory exists
- Ensure proper file permissions

### View Modification Fails
- Check view path format (e.g., "Pump/PumpView")
- Verify view exists before modification
- Review error logs in `ignition_mcp.log`

### Query Returns Empty Results
- Verify index is built: check for `ai-index/metadata.json`
- Rebuild index if stale: use `--rebuild` flag
- Check exact path format for tags and scripts

## Contributing

To extend the indexing or manipulation capabilities:
1. Add methods to `ProjectIndexer` or `ViewManipulator` classes
2. Register new tools in `create_indexing_tools()` or `create_view_tools()`
3. Add handlers in `handle_indexing_operation()` or `handle_view_operation()`
4. Update dispatch table in `ignition_mcp_server.py`
5. Test with standalone CLI tool before MCP integration
