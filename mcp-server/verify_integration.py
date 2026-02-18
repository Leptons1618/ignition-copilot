#!/usr/bin/env python3
"""
Verify the new AI features are properly integrated
"""

import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

def verify_structure():
    """Verify all new files and modules are present"""
    print("Verifying AI Features Integration...")
    print("=" * 60)
    
    checks = []
    
    # Check files exist
    files = [
        "tools/project_indexer.py",
        "tools/view_manipulation.py",
        "index_project.py",
        "test_ai_features.py"
    ]
    
    for file in files:
        exists = Path(file).exists()
        checks.append(exists)
        status = "✓" if exists else "✗"
        print(f"{status} {file}")
    
    print()
    
    # Check imports work
    print("Checking imports...")
    try:
        from tools.project_indexer import ProjectIndexer, TOOL_NAMES as INDEXING_TOOLS
        print(f"✓ ProjectIndexer class imported")
        print(f"  - {len(INDEXING_TOOLS)} indexing tools defined")
        checks.append(True)
    except Exception as e:
        print(f"✗ Failed to import ProjectIndexer: {e}")
        checks.append(False)
    
    try:
        from tools.view_manipulation import ViewManipulator, TOOL_NAMES as VIEW_TOOLS
        print(f"✓ ViewManipulator class imported")
        print(f"  - {len(VIEW_TOOLS)} view tools defined")
        checks.append(True)
    except Exception as e:
        print(f"✗ Failed to import ViewManipulator: {e}")
        checks.append(False)
    
    print()
    
    # Check tool definitions
    print("Checking tool definitions...")
    try:
        from tools.project_indexer import create_indexing_tools
        tools = create_indexing_tools(None, {})
        print(f"✓ {len(tools)} indexing tools created:")
        for tool in tools:
            print(f"  - {tool['name']}")
        checks.append(True)
    except Exception as e:
        print(f"✗ Failed to create indexing tools: {e}")
        checks.append(False)
    
    print()
    
    try:
        from tools.view_manipulation import create_view_tools
        tools = create_view_tools(None, {})
        print(f"✓ {len(tools)} view manipulation tools created:")
        for tool in tools:
            print(f"  - {tool['name']}")
        checks.append(True)
    except Exception as e:
        print(f"✗ Failed to create view tools: {e}")
        checks.append(False)
    
    print()
    print("=" * 60)
    
    passed = sum(checks)
    total = len(checks)
    
    print(f"Verification: {passed}/{total} checks passed")
    
    if passed == total:
        print("✓ All AI features properly integrated!")
        return 0
    else:
        print("✗ Some checks failed")
        return 1

if __name__ == '__main__':
    sys.exit(verify_structure())
