#!/usr/bin/env python3
"""
Test suite for AI indexing and view manipulation features
"""

import json
import sys
from pathlib import Path
import tempfile
import shutil

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

from tools.project_indexer import ProjectIndexer
from tools.view_manipulation import ViewManipulator


def create_test_project():
    """Create a minimal test project structure"""
    temp_dir = Path(tempfile.mkdtemp(prefix="ignition_test_"))
    
    # Create project structure
    views_dir = temp_dir / "views" / "Test" / "TestView"
    views_dir.mkdir(parents=True)
    
    # Create a simple view.json
    view_data = {
        "type": "View",
        "version": "8.1.0",
        "root": {
            "type": "ia.container.flex",
            "meta": {"name": "root"},
            "props": {
                "direction": "column"
            },
            "children": [
                {
                    "type": "ia.display.label",
                    "meta": {"name": "StatusLabel"},
                    "props": {
                        "text": {
                            "binding": {
                                "type": "tag",
                                "config": {
                                    "path": "[default]TestTag/Status"
                                }
                            }
                        }
                    }
                }
            ]
        }
    }
    
    with open(views_dir / "view.json", 'w') as f:
        json.dump(view_data, f, indent=2)
    
    # Create resource.json
    resource_data = {
        "scope": "G",
        "version": 1,
        "files": ["view.json"]
    }
    
    with open(views_dir / "resource.json", 'w') as f:
        json.dump(resource_data, f, indent=2)
    
    # Create a simple tags.json
    tags_data = {
        "name": "default",
        "tagType": "Provider",
        "tags": [
            {
                "name": "TestTag",
                "tagType": "Folder",
                "tags": [
                    {
                        "name": "Status",
                        "tagType": "AtomicTag",
                        "dataType": "Boolean",
                        "value": True
                    }
                ]
            }
        ]
    }
    
    with open(temp_dir / "tags.json", 'w') as f:
        json.dump(tags_data, f, indent=2)
    
    return temp_dir


def test_project_indexing():
    """Test project indexing functionality"""
    print("Testing project indexing...")
    
    # Create test project
    project_dir = create_test_project()
    
    try:
        # Initialize indexer
        indexer = ProjectIndexer(
            str(project_dir),
            str(project_dir / "tags.json")
        )
        
        # Build index
        result = indexer.build_full_index()
        
        print(f"✓ Index built: {result['views_count']} views, {result['tags_count']} tags")
        
        # Verify index files were created
        assert (project_dir / "ai-index" / "views.json").exists()
        assert (project_dir / "ai-index" / "tags.json").exists()
        assert (project_dir / "ai-index" / "dependencies.json").exists()
        assert (project_dir / "ai-index" / "metadata.json").exists()
        print("✓ Index files created")
        
        # Test tag query
        views = indexer.query_tag_usage("[default]TestTag/Status")
        assert len(views) > 0
        print(f"✓ Tag query works: found {len(views)} views using tag")
        
        # Test view details
        with open(project_dir / "ai-index" / "views.json", 'r') as f:
            views_index = json.load(f)
        assert len(views_index) > 0
        assert views_index[0]['view_path'] == "Test/TestView"
        assert len(views_index[0]['tags_used']) > 0
        print("✓ View indexing works correctly")
        
        print("✓ All indexing tests passed!\n")
        return True
        
    finally:
        # Cleanup
        shutil.rmtree(project_dir)


def test_view_manipulation():
    """Test view manipulation functionality"""
    print("Testing view manipulation...")
    
    # Create test project
    project_dir = create_test_project()
    
    try:
        manipulator = ViewManipulator(str(project_dir))
        
        # Test view validation
        validation = manipulator.validate_view("Test/TestView")
        assert validation['valid']
        print("✓ View validation works")
        
        # Test view cloning
        result = manipulator.create_view_from_template(
            "Test/TestView",
            "Test/ClonedView"
        )
        assert (project_dir / "views" / "Test" / "ClonedView" / "view.json").exists()
        print("✓ View cloning works")
        
        # Test component addition
        result = manipulator.add_component_to_view(
            "Test/TestView",
            "ia.display.label",
            {"text": "New Label"}
        )
        print("✓ Component addition works")
        
        # Test view modification with tag replacement
        result = manipulator.modify_view(
            "Test/TestView",
            {
                "tag_replacements": {
                    "[default]TestTag/Status": "[default]TestTag2/Status"
                }
            }
        )
        
        # Verify backup was created
        backup_files = list((project_dir / "ai-backups").glob("*"))
        assert len(backup_files) > 0
        print("✓ View modification and backup works")
        
        # Verify modification was applied
        with open(project_dir / "views" / "Test" / "TestView" / "view.json", 'r') as f:
            modified_view = json.load(f)
        binding_path = modified_view['root']['children'][0]['props']['text']['binding']['config']['path']
        assert "[default]TestTag2/Status" in binding_path
        print("✓ Tag replacement works correctly")
        
        print("✓ All manipulation tests passed!\n")
        return True
        
    finally:
        # Cleanup
        shutil.rmtree(project_dir)


def test_integration():
    """Test integration between indexing and manipulation"""
    print("Testing integration...")
    
    project_dir = create_test_project()
    
    try:
        # Index the project
        indexer = ProjectIndexer(str(project_dir), str(project_dir / "tags.json"))
        indexer.build_full_index()
        
        # Create a new view from template
        manipulator = ViewManipulator(str(project_dir))
        manipulator.create_view_from_template(
            "Test/TestView",
            "Test/NewView",
            {
                "tag_replacements": {
                    "[default]TestTag": "[default]NewTag"
                }
            }
        )
        
        # Rebuild index
        indexer.build_full_index()
        
        # Verify new view is in index
        with open(project_dir / "ai-index" / "views.json", 'r') as f:
            views = json.load(f)
        
        view_paths = [v['view_path'] for v in views]
        assert "Test/NewView" in view_paths
        print("✓ New view appears in rebuilt index")
        
        # Find similar views
        similar = indexer.find_similar_views("Test/TestView")
        assert len(similar) > 0
        print(f"✓ Found {len(similar)} similar views")
        
        print("✓ All integration tests passed!\n")
        return True
        
    finally:
        # Cleanup
        shutil.rmtree(project_dir)


def main():
    """Run all tests"""
    print("=" * 60)
    print("AI Indexing and View Manipulation Test Suite")
    print("=" * 60)
    print()
    
    tests = [
        ("Project Indexing", test_project_indexing),
        ("View Manipulation", test_view_manipulation),
        ("Integration", test_integration)
    ]
    
    passed = 0
    failed = 0
    
    for name, test_func in tests:
        try:
            if test_func():
                passed += 1
        except Exception as e:
            print(f"✗ {name} failed: {e}")
            import traceback
            traceback.print_exc()
            failed += 1
    
    print("=" * 60)
    print(f"Results: {passed} passed, {failed} failed")
    print("=" * 60)
    
    return 0 if failed == 0 else 1


if __name__ == '__main__':
    sys.exit(main())
