"""
Project Indexer for Ignition Projects
Builds structured indexes of views, scripts, tags, and dependencies
"""

import json
import logging
from pathlib import Path
from typing import Dict, List, Any, Set
from datetime import datetime

try:
    from mcp.types import TextContent
except ImportError:
    # For standalone usage
    TextContent = None

logger = logging.getLogger(__name__)


class ProjectIndexer:
    """Indexes Ignition projects for AI-assisted operations"""

    def __init__(self, project_path: str, tags_json_path: str = None):
        self.project_path = Path(project_path)
        self.tags_json_path = Path(tags_json_path) if tags_json_path else None
        self.index_path = self.project_path / "ai-index"
        
        # In-memory indexes
        self.views_index = []
        self.scripts_index = []
        self.tags_index = []
        self.dependencies = {
            "tag_to_view": {},
            "view_to_script": {},
            "view_to_view": {},
            "script_to_tag": {}
        }

    def build_full_index(self) -> Dict[str, Any]:
        """Build complete index of the project"""
        logger.info(f"Building index for project: {self.project_path}")
        
        # Create index directory
        self.index_path.mkdir(exist_ok=True)
        
        # Index each component
        self.index_views()
        self.index_scripts()
        self.index_tags()
        self.build_dependencies()
        
        # Save indexes
        self.save_indexes()
        
        return {
            "views_count": len(self.views_index),
            "scripts_count": len(self.scripts_index),
            "tags_count": len(self.tags_index),
            "indexed_at": datetime.utcnow().isoformat()
        }

    def index_views(self):
        """Index all Perspective views"""
        views_dir = self.project_path / "views"
        if not views_dir.exists():
            logger.warning(f"Views directory not found: {views_dir}")
            return
        
        for view_json in views_dir.rglob("view.json"):
            try:
                view_data = self._parse_view(view_json)
                if view_data:
                    self.views_index.append(view_data)
            except Exception as e:
                logger.error(f"Error indexing view {view_json}: {e}")

    def _parse_view(self, view_json_path: Path) -> Dict[str, Any]:
        """Parse a single view.json file"""
        with open(view_json_path, 'r', encoding='utf-8') as f:
            view = json.load(f)
        
        # Calculate relative path
        rel_path = view_json_path.parent.relative_to(self.project_path / "views")
        view_path = str(rel_path).replace('\\', '/')
        
        components = []
        tags_used = set()
        scripts_used = set()
        embedded_views = set()
        navigation_targets = set()
        
        # Recursively extract components and bindings
        self._extract_from_component(view.get('root', {}), components, tags_used, 
                                     scripts_used, embedded_views, navigation_targets)
        
        # Build structure signature
        structure_sig = [comp['type'] for comp in components[:10]]
        
        return {
            "view_path": view_path,
            "file_path": str(view_json_path.relative_to(self.project_path)),
            "root_container": view.get('root', {}).get('type', 'unknown'),
            "components": components,
            "tags_used": sorted(list(tags_used)),
            "scripts_used": sorted(list(scripts_used)),
            "embedded_views": sorted(list(embedded_views)),
            "navigation_targets": sorted(list(navigation_targets)),
            "structure_signature": structure_sig
        }

    def _extract_from_component(self, comp: Dict, components: List, tags: Set, 
                                scripts: Set, embedded: Set, nav: Set, path: str = "root"):
        """Recursively extract data from component tree"""
        if not isinstance(comp, dict):
            return
        
        comp_type = comp.get('type', 'unknown')
        comp_id = comp.get('meta', {}).get('name', f'unnamed_{len(components)}')
        
        # Extract bindings
        bindings = []
        props = comp.get('props', {})
        for key, value in props.items():
            if isinstance(value, dict) and value.get('binding'):
                binding = value['binding']
                if binding.get('type') == 'tag':
                    tag_path = binding.get('config', {}).get('path', '')
                    if tag_path:
                        tags.add(tag_path)
                        bindings.append(tag_path)
        
        # Extract event scripts
        events = comp.get('events', {})
        for event_name, event_config in events.items():
            if isinstance(event_config, dict):
                script_text = event_config.get('script', '')
                if 'project.' in script_text or 'shared.' in script_text:
                    # Simple extraction - could be improved with AST parsing
                    for token in script_text.split():
                        if token.startswith('project.') or token.startswith('shared.'):
                            scripts.add(token.split('(')[0])
        
        # Check for embedded views
        if comp_type == 'ia.display.view':
            view_path = props.get('path', {})
            if isinstance(view_path, str):
                embedded.add(view_path)
        
        # Check for navigation
        if 'navigate' in str(comp).lower():
            # Simplified - should parse navigation config properly
            pass
        
        components.append({
            "id": comp_id,
            "type": comp_type,
            "path": path,
            "bindings": bindings
        })
        
        # Recurse into children
        children = comp.get('children', [])
        for i, child in enumerate(children):
            self._extract_from_component(child, components, tags, scripts, embedded, nav, 
                                        f"{path}.children[{i}]")

    def index_scripts(self):
        """Index all project scripts"""
        scripts_dir = self.project_path / "ignition" / "script-python"
        if not scripts_dir.exists():
            # Try alternate location
            scripts_dir = self.project_path / "scripts"
        
        if not scripts_dir.exists():
            logger.warning(f"Scripts directory not found")
            return
        
        for script_file in scripts_dir.rglob("*.py"):
            try:
                script_data = self._parse_script(script_file)
                if script_data:
                    self.scripts_index.append(script_data)
            except Exception as e:
                logger.error(f"Error indexing script {script_file}: {e}")

    def _parse_script(self, script_path: Path) -> Dict[str, Any]:
        """Parse a Python script file"""
        with open(script_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Calculate script path (project.module.function)
        rel_path = script_path.relative_to(script_path.parent.parent)
        script_name = str(rel_path).replace('\\', '.').replace('/', '.').replace('.py', '')
        
        functions = []
        tag_paths = []
        system_calls = []
        
        # Simple regex-based extraction (could use AST for better accuracy)
        import re
        
        # Find function definitions
        func_pattern = r'def\s+(\w+)\s*\((.*?)\)'
        for match in re.finditer(func_pattern, content):
            func_name = match.group(1)
            params = [p.strip().split('=')[0].strip() for p in match.group(2).split(',') if p.strip()]
            functions.append({
                "name": func_name,
                "parameters": params,
                "calls": []
            })
        
        # Find system calls
        system_pattern = r'system\.(\w+\.\w+)'
        for match in re.finditer(system_pattern, content):
            system_calls.append(f"system.{match.group(1)}")
        
        # Find tag paths in strings
        tag_pattern = r'\[(default|.*?)\][^\]]*'
        for match in re.finditer(tag_pattern, content):
            tag_paths.append(match.group(0))
        
        return {
            "script_path": script_name,
            "file_path": str(script_path.relative_to(self.project_path)),
            "functions": functions,
            "system_calls": sorted(list(set(system_calls))),
            "tag_paths": sorted(list(set(tag_paths))),
            "used_in_views": []  # Will be populated in dependency building
        }

    def index_tags(self):
        """Index tags from exported JSON"""
        if not self.tags_json_path or not self.tags_json_path.exists():
            logger.warning("Tags JSON not found, skipping tag indexing")
            return
        
        with open(self.tags_json_path, 'r', encoding='utf-8') as f:
            tags_data = json.load(f)
        
        self._process_tag_folder(tags_data)

    def _process_tag_folder(self, folder: Dict, parent_path: str = "[default]"):
        """Recursively process tag folder structure"""
        if not isinstance(folder, dict):
            return
        
        tags = folder.get('tags', [])
        for tag in tags:
            tag_path = f"{parent_path}/{tag.get('name', '')}"
            tag_type = tag.get('tagType', 'AtomicTag')
            
            tag_info = {
                "path": tag_path,
                "type": tag_type,
                "datatype": tag.get('dataType', 'Unknown')
            }
            
            # UDT specific info
            if tag_type == 'UdtInstance':
                tag_info['udt'] = tag.get('typeId', '')
                tag_info['members'] = []
                # Process UDT members
                if 'parameters' in tag:
                    for param in tag['parameters']:
                        tag_info['members'].append({
                            "name": param.get('name', ''),
                            "datatype": param.get('dataType', '')
                        })
            
            # Alarm info
            alarms = tag.get('alarms', [])
            if alarms:
                tag_info['alarms'] = [a.get('name', '') for a in alarms]
            
            self.tags_index.append(tag_info)
        
        # Process subfolders
        folders = folder.get('tagFolders', [])
        for subfolder in folders:
            folder_name = subfolder.get('name', '')
            self._process_tag_folder(subfolder, f"{parent_path}/{folder_name}")

    def build_dependencies(self):
        """Build dependency graph between views, tags, and scripts"""
        # Tag to view mapping
        for view in self.views_index:
            for tag in view['tags_used']:
                if tag not in self.dependencies['tag_to_view']:
                    self.dependencies['tag_to_view'][tag] = []
                self.dependencies['tag_to_view'][tag].append(view['view_path'])
        
        # View to script mapping
        for view in self.views_index:
            for script in view['scripts_used']:
                if view['view_path'] not in self.dependencies['view_to_script']:
                    self.dependencies['view_to_script'][view['view_path']] = []
                self.dependencies['view_to_script'][view['view_path']].append(script)
        
        # View to view mapping (embedded views)
        for view in self.views_index:
            for embedded in view['embedded_views']:
                if view['view_path'] not in self.dependencies['view_to_view']:
                    self.dependencies['view_to_view'][view['view_path']] = []
                self.dependencies['view_to_view'][view['view_path']].append(embedded)
        
        # Script to tag mapping
        for script in self.scripts_index:
            for tag in script.get('tag_paths', []):
                if script['script_path'] not in self.dependencies['script_to_tag']:
                    self.dependencies['script_to_tag'][script['script_path']] = []
                self.dependencies['script_to_tag'][script['script_path']].append(tag)
        
        # Update script usage in views
        for script in self.scripts_index:
            script['used_in_views'] = []
            for view_path, scripts in self.dependencies['view_to_script'].items():
                if script['script_path'] in scripts:
                    script['used_in_views'].append(view_path)

    def save_indexes(self):
        """Save all indexes to disk"""
        # Save views index
        with open(self.index_path / "views.json", 'w', encoding='utf-8') as f:
            json.dump(self.views_index, f, indent=2)
        
        # Save scripts index
        with open(self.index_path / "scripts.json", 'w', encoding='utf-8') as f:
            json.dump(self.scripts_index, f, indent=2)
        
        # Save tags index
        with open(self.index_path / "tags.json", 'w', encoding='utf-8') as f:
            json.dump(self.tags_index, f, indent=2)
        
        # Save dependencies
        with open(self.index_path / "dependencies.json", 'w', encoding='utf-8') as f:
            json.dump(self.dependencies, f, indent=2)
        
        # Save metadata
        metadata = {
            "indexed_at": datetime.utcnow().isoformat(),
            "project_path": str(self.project_path),
            "views_count": len(self.views_index),
            "scripts_count": len(self.scripts_index),
            "tags_count": len(self.tags_index)
        }
        with open(self.index_path / "metadata.json", 'w', encoding='utf-8') as f:
            json.dump(metadata, f, indent=2)
        
        logger.info(f"Saved indexes to {self.index_path}")

    def query_tag_usage(self, tag_path: str) -> List[str]:
        """Find all views using a specific tag"""
        return self.dependencies['tag_to_view'].get(tag_path, [])

    def query_script_usage(self, script_path: str) -> List[str]:
        """Find all views using a specific script"""
        return [
            view for view, scripts in self.dependencies['view_to_script'].items()
            if script_path in scripts
        ]

    def find_similar_views(self, view_path: str, limit: int = 5) -> List[Dict]:
        """Find views with similar structure"""
        target_view = next((v for v in self.views_index if v['view_path'] == view_path), None)
        if not target_view:
            return []
        
        target_sig = set(target_view['structure_signature'])
        
        similarities = []
        for view in self.views_index:
            if view['view_path'] == view_path:
                continue
            
            view_sig = set(view['structure_signature'])
            similarity = len(target_sig & view_sig) / max(len(target_sig | view_sig), 1)
            similarities.append((view, similarity))
        
        similarities.sort(key=lambda x: x[1], reverse=True)
        return [{"view": v[0], "similarity": v[1]} for v in similarities[:limit]]


TOOL_NAMES = [
    "index_project",
    "query_tag_usage",
    "query_script_usage",
    "find_similar_views",
    "get_view_details",
    "list_udt_instances"
]


def create_indexing_tools(client, config) -> List[Dict]:
    """Create MCP tool definitions for project indexing"""
    return [
        {
            "name": "index_project",
            "description": "Build or rebuild complete index of Ignition project including views, scripts, tags, and dependencies",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "project_path": {
                        "type": "string",
                        "description": "Path to Ignition project directory"
                    },
                    "tags_json_path": {
                        "type": "string",
                        "description": "Path to exported tags JSON file (optional)"
                    }
                },
                "required": ["project_path"]
            }
        },
        {
            "name": "query_tag_usage",
            "description": "Find all views that use a specific tag path",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "tag_path": {
                        "type": "string",
                        "description": "Full tag path (e.g., [default]Pump01/Status)"
                    },
                    "project_path": {
                        "type": "string",
                        "description": "Path to indexed project"
                    }
                },
                "required": ["tag_path", "project_path"]
            }
        },
        {
            "name": "query_script_usage",
            "description": "Find all views that use a specific project script",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "script_path": {
                        "type": "string",
                        "description": "Script path (e.g., project.pump.formatStatus)"
                    },
                    "project_path": {
                        "type": "string",
                        "description": "Path to indexed project"
                    }
                },
                "required": ["script_path", "project_path"]
            }
        },
        {
            "name": "find_similar_views",
            "description": "Find views with similar component structure to a target view",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "view_path": {
                        "type": "string",
                        "description": "Path to view (e.g., Pump/PumpView)"
                    },
                    "project_path": {
                        "type": "string",
                        "description": "Path to indexed project"
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Maximum number of similar views to return",
                        "default": 5
                    }
                },
                "required": ["view_path", "project_path"]
            }
        },
        {
            "name": "get_view_details",
            "description": "Get detailed information about a specific view including components, bindings, and dependencies",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "view_path": {
                        "type": "string",
                        "description": "Path to view (e.g., Pump/PumpView)"
                    },
                    "project_path": {
                        "type": "string",
                        "description": "Path to indexed project"
                    }
                },
                "required": ["view_path", "project_path"]
            }
        },
        {
            "name": "list_udt_instances",
            "description": "List all instances of a specific UDT type",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "udt_type": {
                        "type": "string",
                        "description": "UDT type name (e.g., Pump)"
                    },
                    "project_path": {
                        "type": "string",
                        "description": "Path to indexed project"
                    }
                },
                "required": ["udt_type", "project_path"]
            }
        }
    ]


def handle_indexing_operation(name: str, arguments: Dict[str, Any]) -> List:
    """Handle indexing tool operations"""
    from mcp.types import TextContent
    
    try:
        project_path = arguments.get('project_path')
        
        if name == "index_project":
            tags_path = arguments.get('tags_json_path')
            indexer = ProjectIndexer(project_path, tags_path)
            result = indexer.build_full_index()
            return [TextContent(type="text", text=json.dumps(result, indent=2))]
        
        # Load existing index for query operations
        index_path = Path(project_path) / "ai-index"
        
        if name == "query_tag_usage":
            with open(index_path / "dependencies.json", 'r') as f:
                deps = json.load(f)
            tag_path = arguments['tag_path']
            views = deps['tag_to_view'].get(tag_path, [])
            return [TextContent(type="text", text=json.dumps({"tag": tag_path, "views": views}, indent=2))]
        
        elif name == "query_script_usage":
            with open(index_path / "dependencies.json", 'r') as f:
                deps = json.load(f)
            script_path = arguments['script_path']
            views = [v for v, scripts in deps['view_to_script'].items() if script_path in scripts]
            return [TextContent(type="text", text=json.dumps({"script": script_path, "views": views}, indent=2))]
        
        elif name == "find_similar_views":
            with open(index_path / "views.json", 'r') as f:
                views = json.load(f)
            indexer = ProjectIndexer(project_path)
            indexer.views_index = views
            similar = indexer.find_similar_views(arguments['view_path'], arguments.get('limit', 5))
            return [TextContent(type="text", text=json.dumps(similar, indent=2))]
        
        elif name == "get_view_details":
            with open(index_path / "views.json", 'r') as f:
                views = json.load(f)
            view = next((v for v in views if v['view_path'] == arguments['view_path']), None)
            if view:
                return [TextContent(type="text", text=json.dumps(view, indent=2))]
            else:
                return [TextContent(type="text", text=json.dumps({"error": "View not found"}))]
        
        elif name == "list_udt_instances":
            with open(index_path / "tags.json", 'r') as f:
                tags = json.load(f)
            udt_type = arguments['udt_type']
            instances = [t for t in tags if t.get('type') == 'UdtInstance' and t.get('udt', '').endswith(udt_type)]
            return [TextContent(type="text", text=json.dumps(instances, indent=2))]
        
        return [TextContent(type="text", text=json.dumps({"error": "Unknown operation"}))]
    
    except Exception as e:
        logger.error(f"Error in {name}: {e}")
        return [TextContent(type="text", text=json.dumps({"error": str(e)}))]
