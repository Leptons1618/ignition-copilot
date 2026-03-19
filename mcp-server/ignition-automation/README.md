# Ignition WebDev Automation Helpers

This folder contains generated endpoint scripts you can paste into Ignition Designer.

## Generate files

From repository root:

```bash
python mcp-server/generate_webdev_resources.py
```

Optional project name and output folder:

```bash
python mcp-server/generate_webdev_resources.py \
  --project ignition-copilot \
  --output-dir mcp-server/ignition-automation/webdev-resources
```

## In Ignition Designer

1. Open your project.
2. Under Web Dev, create one resource per file name:
   - tag_browse
   - tag_read
   - tag_write
   - tag_search
   - tag_config
   - tag_delete
   - history_query
   - alarm_active
   - alarm_journal
   - system_info
   - script_exec
3. Paste each generated file body into the matching resource.
4. Save and publish the project.

## Validate endpoints

```bash
cd mcp-server
python test_endpoints.py
```

Successful output should show endpoint tests passing for all resources.
