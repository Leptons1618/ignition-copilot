> Updated: 2026-02-16. Canonical run/test workflow: scripts/README.md

# Ignition Perspective Module Reference

## Overview
Perspective is Ignition's web-based visualization module. It runs in any modern browser and supports mobile devices.

## View Types
- **Page**: Full-screen view accessible via URL
- **Popup**: Modal dialog overlay
- **Docked View**: Pinned to screen edges (navigation, toolbars)

## Key Components

### Display Components
- **Label**: Display text or tag values
- **Value Display**: Formatted value with units
- **LED Display**: Status indicator light
- **Gauge**: Circular/linear gauge
- **Sparkline**: Mini inline chart

### Chart Components
- **XY Chart**: Time series charts, scatter plots, bar charts
  - Series types: line, scatter, bar, area, step
  - Multiple axes and series
  - Zooming and panning
  - Real-time updates via tag bindings
- **Pie Chart**: Distribution visualization
- **Status Chart**: Timeline of states
- **Power Chart**: Advanced historian chart with tag browser

### Input Components
- **Numeric Entry**: Number input with validation
- **Text Field**: Text input
- **Toggle Switch**: Boolean toggle
- **Dropdown**: Selection from options
- **Slider**: Range selector
- **Button**: Clickable action trigger

### Container Components
- **Flex Container**: Flexbox layout
- **Column Container**: Vertical stacking
- **Coordinate Container**: Absolute positioning
- **Tab Container**: Tabbed views
- **Carousel**: Rotating content

### Navigation
- **Menu Tree**: Hierarchical navigation
- **Breadcrumb**: Path navigation
- **Tab Strip**: Tab-style navigation

## Bindings
Bindings connect component properties to data sources:
- **Tag Binding**: Direct link to an Ignition tag
- **Indirect Tag Binding**: Dynamic tag path from another property
- **Expression Binding**: Calculated value using expression language
- **Query Binding**: SQL query result
- **Property Binding**: Link to another component property
- **Transform**: Modify bound values (script, expression, map)

## Session Properties
- `session.props.auth.user.userName` - Current user
- `session.props.auth.user.roles` - User roles
- Custom session properties for app state

## Perspective Scripting
```python
# Navigate to a view
system.perspective.navigate("/views/dashboard")

# Open popup
system.perspective.openPopup("myPopup", "/views/detail", params={"tagPath": path})

# Send notification
system.perspective.sendMessage("showAlert", {"message": "Motor stopped"})

# Print view
system.perspective.print("myPrinter")
```

## URL Parameters
Access URL parameters in views:
- `{view.params.paramName}` in bindings
- `self.view.params['paramName']` in scripts

## Perspective Project Setup
1. Create a new Perspective Page Configuration
2. Set primary view (e.g., /views/main)
3. Add docked views for navigation
4. Configure authentication (if needed)
5. Deploy via Gateway /web/project-name

## Performance Tips
1. Use indirect bindings for dynamic tag paths
2. Minimize number of tag subscriptions per view
3. Use tag groups for historian queries
4. Lazy-load heavy views in tabs
5. Use session events for global state management

## Creating Views Programmatically
Views are stored as JSON in the project directory:
`data/projects/{project}/com.inductiveautomation.perspective/views/{path}/view.json`

A minimal view JSON:
```json
{
  "custom": {},
  "params": {},
  "root": {
    "type": "ia.container.flex",
    "children": [
      {
        "type": "ia.display.label",
        "props": {
          "text": "Hello World"
        }
      }
    ]
  }
}
```
