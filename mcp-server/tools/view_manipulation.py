"""
View manipulation tools for safe Ignition Perspective view editing
Follows best practices from NEWFEATURE.md
"""

import json
import logging
from pathlib import Path
from typing import Dict, List, Any
from datetime import datetime
import shutil

logger = logging.getLogger(__name__)


class ViewManipulator:
    """Safe manipulation of Perspective views"""

    def __init__(self, project_path: str):
        self.project_path = Path(project_path)
        self.views_path = self.project_path / "views"
        self.backup_path = self.project_path / "ai-backups"
        self.backup_path.mkdir(exist_ok=True)

    def create_view_from_template(self, template_view: str, new_view_name: str, 
                                  modifications: Dict[str, Any] = None) -> Dict[str, Any]:
        """Create a new view based on an existing template"""
        # Load template
        template_path = self.views_path / template_view / "view.json"
        if not template_path.exists():
            raise ValueError(f"Template view not found: {template_view}")
        
        with open(template_path, 'r', encoding='utf-8') as f:
            template_data = json.load(f)
        
        # Apply modifications
        if modifications:
            template_data = self._apply_modifications(template_data, modifications)
        
        # Create new view directory
        new_view_path = self.views_path / new_view_name
        new_view_path.mkdir(parents=True, exist_ok=True)
        
        # Save new view
        new_view_file = new_view_path / "view.json"
        with open(new_view_file, 'w', encoding='utf-8') as f:
            json.dump(template_data, f, indent=2)
        
        # Create resource.json
        resource_data = {
            "scope": "G",
            "version": 1,
            "restricted": False,
            "overridable": True,
            "files": ["view.json"],
            "attributes": {
                "lastModification": {
                    "actor": "AI Assistant",
                    "timestamp": datetime.utcnow().isoformat() + "Z"
                },
                "lastModificationSignature": "AI-generated"
            }
        }
        with open(new_view_path / "resource.json", 'w', encoding='utf-8') as f:
            json.dump(resource_data, f, indent=2)
        
        logger.info(f"Created new view: {new_view_name} from template {template_view}")
        return {"view_path": str(new_view_file), "status": "created"}

    def _apply_modifications(self, view_data: Dict, mods: Dict) -> Dict:
        """Apply modifications to view data"""
        # Tag replacements
        if 'tag_replacements' in mods:
            view_data = self._replace_tags(view_data, mods['tag_replacements'])
        
        # Property updates
        if 'property_updates' in mods:
            view_data = self._update_properties(view_data, mods['property_updates'])
        
        # Component additions
        if 'add_components' in mods:
            view_data = self._add_components(view_data, mods['add_components'])
        
        return view_data

    def _replace_tags(self, data: Any, replacements: Dict[str, str]) -> Any:
        """Recursively replace tag paths in view data"""
        if isinstance(data, dict):
            result = {}
            for key, value in data.items():
                if key == 'path' and isinstance(value, str):
                    # Check if this is a tag binding path
                    for old_tag, new_tag in replacements.items():
                        if old_tag in value:
                            value = value.replace(old_tag, new_tag)
                result[key] = self._replace_tags(value, replacements)
            return result
        elif isinstance(data, list):
            return [self._replace_tags(item, replacements) for item in data]
        else:
            return data

    def _update_properties(self, view_data: Dict, updates: Dict) -> Dict:
        """Update component properties"""
        # Navigate to root component
        root = view_data.get('root', {})
        props = root.get('props', {})
        
        for prop_path, new_value in updates.items():
            keys = prop_path.split('.')
            target = props
            for key in keys[:-1]:
                target = target.setdefault(key, {})
            target[keys[-1]] = new_value
        
        return view_data

    def _add_components(self, view_data: Dict, components: List[Dict]) -> Dict:
        """Add new components to view"""
        root = view_data.get('root', {})
        children = root.setdefault('children', [])
        
        for comp in components:
            children.append(comp)
        
        return view_data

    def modify_view(self, view_path: str, modifications: Dict[str, Any], 
                   create_backup: bool = True) -> Dict[str, Any]:
        """Safely modify an existing view"""
        view_file = self.views_path / view_path / "view.json"
        
        if not view_file.exists():
            raise ValueError(f"View not found: {view_path}")
        
        # Create backup
        if create_backup:
            self._backup_view(view_path)
        
        # Load current view
        with open(view_file, 'r', encoding='utf-8') as f:
            view_data = json.load(f)
        
        # Apply modifications
        modified_data = self._apply_modifications(view_data, modifications)
        
        # Validate JSON structure
        try:
            json.dumps(modified_data)
        except Exception as e:
            raise ValueError(f"Invalid JSON after modifications: {e}")
        
        # Save modified view
        with open(view_file, 'w', encoding='utf-8') as f:
            json.dump(modified_data, f, indent=2)
        
        logger.info(f"Modified view: {view_path}")
        return {"view_path": str(view_file), "status": "modified"}

    def _backup_view(self, view_path: str):
        """Create a timestamped backup of a view"""
        source = self.views_path / view_path
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        backup_name = f"{view_path.replace('/', '_')}_{timestamp}"
        backup_dest = self.backup_path / backup_name
        
        shutil.copytree(source, backup_dest)
        logger.info(f"Backed up view to: {backup_dest}")

    def add_component_to_view(self, view_path: str, component_type: str, 
                             properties: Dict, position: str = "end") -> Dict[str, Any]:
        """Add a component to an existing view"""
        view_file = self.views_path / view_path / "view.json"
        
        with open(view_file, 'r', encoding='utf-8') as f:
            view_data = json.load(f)
        
        # Create component structure
        component = {
            "type": component_type,
            "props": properties,
            "meta": {
                "name": f"{component_type.split('.')[-1]}_{datetime.utcnow().timestamp()}"
            }
        }
        
        # Add to root children
        root = view_data.get('root', {})
        children = root.setdefault('children', [])
        
        if position == "start":
            children.insert(0, component)
        else:
            children.append(component)
        
        # Save
        with open(view_file, 'w', encoding='utf-8') as f:
            json.dump(view_data, f, indent=2)
        
        return {"status": "component_added", "component_type": component_type}

    def validate_view(self, view_path: str) -> Dict[str, Any]:
        """Validate view structure and bindings"""
        view_file = self.views_path / view_path / "view.json"
        
        if not view_file.exists():
            return {"valid": False, "errors": ["View file not found"]}
        
        errors = []
        warnings = []
        
        try:
            with open(view_file, 'r', encoding='utf-8') as f:
                view_data = json.load(f)
        except json.JSONDecodeError as e:
            return {"valid": False, "errors": [f"Invalid JSON: {e}"]}
        
        # Check required structure
        if 'root' not in view_data:
            errors.append("Missing 'root' element")
        
        # Check for broken bindings (simplified)
        bindings = self._collect_bindings(view_data)
        for binding in bindings:
            if not binding.get('config', {}).get('path'):
                warnings.append(f"Binding missing path: {binding}")
        
        return {
            "valid": len(errors) == 0,
            "errors": errors,
            "warnings": warnings,
            "binding_count": len(bindings)
        }

    def _collect_bindings(self, data: Any, bindings: List = None) -> List:
        """Recursively collect all bindings from view data"""
        if bindings is None:
            bindings = []
        
        if isinstance(data, dict):
            if data.get('binding'):
                bindings.append(data['binding'])
            for value in data.values():
                self._collect_bindings(value, bindings)
        elif isinstance(data, list):
            for item in data:
                self._collect_bindings(item, bindings)
        
        return bindings


TOOL_NAMES = [
    "create_view_from_template",
    "modify_view",
    "add_component_to_view",
    "validate_view",
    "list_view_templates",
    "clone_view"
]


def create_view_tools(client, config) -> List[Dict]:
    """Create MCP tool definitions for view manipulation"""
    return [
        {
            "name": "create_view_from_template",
            "description": "Create a new Perspective view based on an existing template view",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "project_path": {"type": "string", "description": "Path to Ignition project"},
                    "template_view": {"type": "string", "description": "Path to template view (e.g., Pump/PumpView)"},
                    "new_view_name": {"type": "string", "description": "Name for new view"},
                    "tag_replacements": {
                        "type": "object",
                        "description": "Map of old tag paths to new tag paths"
                    },
                    "property_updates": {
                        "type": "object",
                        "description": "Properties to update in new view"
                    }
                },
                "required": ["project_path", "template_view", "new_view_name"]
            }
        },
        {
            "name": "modify_view",
            "description": "Modify an existing Perspective view with safety checks and backup",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "project_path": {"type": "string"},
                    "view_path": {"type": "string", "description": "Path to view to modify"},
                    "modifications": {
                        "type": "object",
                        "description": "Modifications to apply (tag_replacements, property_updates, add_components)"
                    },
                    "create_backup": {"type": "boolean", "default": True}
                },
                "required": ["project_path", "view_path", "modifications"]
            }
        },
        {
            "name": "add_component_to_view",
            "description": "Add a new component to an existing view",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "project_path": {"type": "string"},
                    "view_path": {"type": "string"},
                    "component_type": {"type": "string", "description": "Component type (e.g., ia.display.label)"},
                    "properties": {"type": "object", "description": "Component properties"},
                    "position": {"type": "string", "enum": ["start", "end"], "default": "end"}
                },
                "required": ["project_path", "view_path", "component_type", "properties"]
            }
        },
        {
            "name": "validate_view",
            "description": "Validate view structure and bindings",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "project_path": {"type": "string"},
                    "view_path": {"type": "string"}
                },
                "required": ["project_path", "view_path"]
            }
        },
        {
            "name": "clone_view",
            "description": "Create an exact copy of a view with a new name",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "project_path": {"type": "string"},
                    "source_view": {"type": "string"},
                    "new_view_name": {"type": "string"}
                },
                "required": ["project_path", "source_view", "new_view_name"]
            }
        }
    ]


def handle_view_operation(name: str, arguments: Dict[str, Any]) -> List:
    """Handle view manipulation operations"""
    from mcp.types import TextContent
    
    try:
        project_path = arguments['project_path']
        manipulator = ViewManipulator(project_path)
        
        if name == "create_view_from_template":
            mods = {}
            if 'tag_replacements' in arguments:
                mods['tag_replacements'] = arguments['tag_replacements']
            if 'property_updates' in arguments:
                mods['property_updates'] = arguments['property_updates']
            
            result = manipulator.create_view_from_template(
                arguments['template_view'],
                arguments['new_view_name'],
                mods if mods else None
            )
            return [TextContent(type="text", text=json.dumps(result, indent=2))]
        
        elif name == "modify_view":
            result = manipulator.modify_view(
                arguments['view_path'],
                arguments['modifications'],
                arguments.get('create_backup', True)
            )
            return [TextContent(type="text", text=json.dumps(result, indent=2))]
        
        elif name == "add_component_to_view":
            result = manipulator.add_component_to_view(
                arguments['view_path'],
                arguments['component_type'],
                arguments['properties'],
                arguments.get('position', 'end')
            )
            return [TextContent(type="text", text=json.dumps(result, indent=2))]
        
        elif name == "validate_view":
            result = manipulator.validate_view(arguments['view_path'])
            return [TextContent(type="text", text=json.dumps(result, indent=2))]
        
        elif name == "clone_view":
            result = manipulator.create_view_from_template(
                arguments['source_view'],
                arguments['new_view_name']
            )
            return [TextContent(type="text", text=json.dumps(result, indent=2))]
        
        return [TextContent(type="text", text=json.dumps({"error": "Unknown operation"}))]
    
    except Exception as e:
        logger.error(f"Error in {name}: {e}")
        return [TextContent(type="text", text=json.dumps({"error": str(e)}))]
