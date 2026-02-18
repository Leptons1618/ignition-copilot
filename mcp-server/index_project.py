#!/usr/bin/env python3
"""
Standalone CLI tool for indexing Ignition projects
Can be run independently or integrated into workflows
"""

import argparse
import json
import logging
from pathlib import Path
import sys

# Add parent directory to path to import project_indexer
sys.path.insert(0, str(Path(__file__).parent))

from tools.project_indexer import ProjectIndexer


def setup_logging(verbose: bool = False):
    """Configure logging"""
    level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(
        level=level,
        format='%(asctime)s - %(levelname)s - %(message)s'
    )


def main():
    parser = argparse.ArgumentParser(
        description='Index Ignition projects for AI-assisted operations',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Index a project with tags
  python index_project.py --project C:\\IgnitionData\\projects\\MyProject --tags tags.json

  # Query tag usage
  python index_project.py --project C:\\IgnitionData\\projects\\MyProject --query tag --path "[default]Pump01/Status"

  # Find similar views
  python index_project.py --project C:\\IgnitionData\\projects\\MyProject --query similar --view Pump/PumpView
        """
    )
    
    parser.add_argument('--project', required=True, help='Path to Ignition project directory')
    parser.add_argument('--tags', help='Path to exported tags JSON file')
    parser.add_argument('--output', help='Output directory for index (default: <project>/ai-index)')
    parser.add_argument('--verbose', '-v', action='store_true', help='Verbose output')
    
    # Query operations
    parser.add_argument('--query', choices=['tag', 'script', 'similar', 'view', 'udts'], 
                       help='Query the index')
    parser.add_argument('--path', help='Tag or script path for query')
    parser.add_argument('--view', help='View path for query')
    parser.add_argument('--udt', help='UDT type name for query')
    parser.add_argument('--limit', type=int, default=5, help='Limit for similar view results')
    
    # Rebuild option
    parser.add_argument('--rebuild', action='store_true', help='Force rebuild of index')
    
    args = parser.parse_args()
    
    setup_logging(args.verbose)
    logger = logging.getLogger(__name__)
    
    # Initialize indexer
    indexer = ProjectIndexer(args.project, args.tags)
    
    # Check if index exists
    index_exists = (indexer.index_path / "metadata.json").exists()
    
    # Build or rebuild index if needed
    if args.rebuild or not index_exists:
        logger.info("Building project index...")
        result = indexer.build_full_index()
        print(json.dumps(result, indent=2))
        
        if not args.query:
            return 0
    
    # Handle queries
    if args.query:
        # Load existing index
        if not index_exists and not args.rebuild:
            logger.error("Index not found. Run with --rebuild to create it.")
            return 1
        
        # Load indexes
        with open(indexer.index_path / "views.json", 'r') as f:
            indexer.views_index = json.load(f)
        with open(indexer.index_path / "scripts.json", 'r') as f:
            indexer.scripts_index = json.load(f)
        with open(indexer.index_path / "tags.json", 'r') as f:
            indexer.tags_index = json.load(f)
        with open(indexer.index_path / "dependencies.json", 'r') as f:
            indexer.dependencies = json.load(f)
        
        if args.query == 'tag':
            if not args.path:
                logger.error("--path required for tag query")
                return 1
            views = indexer.query_tag_usage(args.path)
            print(json.dumps({"tag": args.path, "used_in_views": views}, indent=2))
        
        elif args.query == 'script':
            if not args.path:
                logger.error("--path required for script query")
                return 1
            views = indexer.query_script_usage(args.path)
            print(json.dumps({"script": args.path, "used_in_views": views}, indent=2))
        
        elif args.query == 'similar':
            if not args.view:
                logger.error("--view required for similar query")
                return 1
            similar = indexer.find_similar_views(args.view, args.limit)
            print(json.dumps({"view": args.view, "similar_views": similar}, indent=2))
        
        elif args.query == 'view':
            if not args.view:
                logger.error("--view required for view query")
                return 1
            view = next((v for v in indexer.views_index if v['view_path'] == args.view), None)
            if view:
                print(json.dumps(view, indent=2))
            else:
                logger.error(f"View not found: {args.view}")
                return 1
        
        elif args.query == 'udts':
            if not args.udt:
                logger.error("--udt required for UDT query")
                return 1
            instances = [t for t in indexer.tags_index 
                        if t.get('type') == 'UdtInstance' and t.get('udt', '').endswith(args.udt)]
            print(json.dumps({"udt_type": args.udt, "instances": instances}, indent=2))
    
    return 0


if __name__ == '__main__':
    sys.exit(main())
