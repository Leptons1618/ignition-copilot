"""
Ignition Gateway Client
Handles all communication with Ignition Gateway via WebDev endpoints.
Generic and agnostic — works with any tag provider, any tag structure.
"""

import requests
import json
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from urllib.parse import urljoin


class IgnitionClient:
    """Client for communicating with Ignition Gateway via WebDev REST endpoints."""

    def __init__(self, gateway_url: str, username: str, password: str,
                 verify_ssl: bool = False, timeout: int = 30,
                 project: str = 'ignition-copilot'):
        self.gateway_url = gateway_url.rstrip('/')
        self.project = project
        self.username = username
        self.password = password
        self.verify_ssl = verify_ssl
        self.timeout = timeout
        self.session = requests.Session()
        self.session.auth = (username, password)
        self.session.verify = verify_ssl

    # ------------------------------------------------------------------ #
    #  Internal helpers
    # ------------------------------------------------------------------ #

    def _webdev_url(self, resource: str) -> str:
        """Build full URL for a WebDev resource."""
        return f"{self.gateway_url}/system/webdev/{self.project}/{resource}"

    def _get(self, resource: str, params: Optional[Dict] = None) -> Any:
        """HTTP GET to a WebDev resource. Returns parsed JSON."""
        url = self._webdev_url(resource)
        resp = self.session.get(url, params=params or {}, timeout=self.timeout)
        resp.raise_for_status()
        return resp.json()

    def _post(self, resource: str, payload: Any) -> Any:
        """HTTP POST JSON to a WebDev resource. Returns parsed JSON."""
        url = self._webdev_url(resource)
        resp = self.session.post(
            url, json=payload,
            headers={'Content-Type': 'application/json'},
            timeout=self.timeout
        )
        resp.raise_for_status()
        return resp.json()

    # ------------------------------------------------------------------ #
    #  Tag Browse
    # ------------------------------------------------------------------ #

    def browse_tags(self, path: str = '[default]', recursive: bool = False) -> List[Dict[str, Any]]:
        """Browse tags at *path*. Returns list of tag entries."""
        data = self._get('tag_browse', {
            'path': path,
            'recursive': str(recursive).lower()
        })
        if data.get('success'):
            return data.get('tags', [])
        raise Exception(data.get('error', 'Browse failed'))

    # ------------------------------------------------------------------ #
    #  Tag Read
    # ------------------------------------------------------------------ #

    def read_tags(self, tag_paths: List[str]) -> List[Dict[str, Any]]:
        """Read current values for one or more tags."""
        data = self._get('tag_read', {'paths': ','.join(tag_paths)})
        if data.get('success'):
            return data.get('results', [])
        raise Exception(data.get('error', 'Read failed'))

    def read_tag(self, tag_path: str) -> Dict[str, Any]:
        """Read a single tag. Convenience wrapper."""
        results = self.read_tags([tag_path])
        return results[0] if results else {'path': tag_path, 'value': None, 'quality': 'Error'}

    # ------------------------------------------------------------------ #
    #  Tag Write
    # ------------------------------------------------------------------ #

    def write_tags(self, tag_paths: List[str], values: List[Any]) -> List[Dict[str, Any]]:
        """Write values to one or more tags."""
        if len(tag_paths) != len(values):
            raise ValueError("tag_paths and values must be the same length")
        writes = [{'path': p, 'value': v} for p, v in zip(tag_paths, values)]
        data = self._post('tag_write', {'writes': writes})
        if data.get('success') is not None:
            return data.get('results', [])
        raise Exception(data.get('error', 'Write failed'))

    def write_tag(self, tag_path: str, value: Any) -> Dict[str, Any]:
        """Write a single tag. Convenience wrapper."""
        results = self.write_tags([tag_path], [value])
        return results[0] if results else {'path': tag_path, 'success': False}

    # ------------------------------------------------------------------ #
    #  Tag Config (read / create)
    # ------------------------------------------------------------------ #

    def get_tag_config(self, tag_path: str) -> Dict[str, Any]:
        """Get configuration properties of a tag."""
        data = self._get('tag_config', {'path': tag_path})
        if data.get('success'):
            return data.get('config', {})
        raise Exception(data.get('error', 'Config read failed'))

    def create_tag(self, base_path: str, name: str, tag_type: str = 'AtomicTag',
                   data_type: str = 'Float8', value: Any = 0, **extra) -> Dict[str, Any]:
        """Create (or overwrite) a tag."""
        payload = {
            'basePath': base_path,
            'name': name,
            'tagType': tag_type,
            'dataType': data_type,
            'value': value,
            **extra
        }
        return self._post('tag_config', payload)

    # ------------------------------------------------------------------ #
    #  Tag Search
    # ------------------------------------------------------------------ #

    def search_tags(self, pattern: str = '*', root: str = '[default]',
                    tag_type: str = '', max_results: int = 200) -> List[Dict[str, Any]]:
        """Search for tags by name pattern (glob-style: * and ?)."""
        data = self._get('tag_search', {
            'root': root,
            'pattern': pattern,
            'tagType': tag_type,
            'max': str(max_results)
        })
        if data.get('success'):
            return data.get('matches', [])
        raise Exception(data.get('error', 'Search failed'))

    # ------------------------------------------------------------------ #
    #  Tag Delete
    # ------------------------------------------------------------------ #

    def delete_tags(self, paths: List[str]) -> List[Dict[str, Any]]:
        """Delete one or more tags."""
        data = self._post('tag_delete', {'paths': paths})
        return data.get('results', [])

    # ------------------------------------------------------------------ #
    #  Historian
    # ------------------------------------------------------------------ #

    def query_history(self, tag_paths: List[str],
                      start_time: Optional[str] = None,
                      end_time: Optional[str] = None,
                      return_size: int = 500) -> Dict[str, Any]:
        """
        Query historical data.

        *start_time* / *end_time* can be:
          - ISO string  "2026-02-08T00:00:00"
          - Relative     "-1h", "-30m", "-2d"
          - datetime     (converted to ISO)
          - None         (defaults handled server-side)
        """
        def _fmt(t):
            if t is None:
                return ''
            if isinstance(t, datetime):
                return t.strftime('%Y-%m-%dT%H:%M:%S')
            return str(t)

        payload = {
            'paths': tag_paths,
            'startTime': _fmt(start_time),
            'endTime': _fmt(end_time),
            'returnSize': return_size,
        }
        data = self._post('history_query', payload)
        if data.get('success'):
            return data.get('data', {})
        raise Exception(data.get('error', 'History query failed'))

    # ------------------------------------------------------------------ #
    #  Alarms
    # ------------------------------------------------------------------ #

    def get_active_alarms(self, source: str = '', priority: str = '',
                          state: str = '') -> List[Dict[str, Any]]:
        """Get currently active alarms with optional filters."""
        params = {}
        if source:
            params['source'] = source
        if priority:
            params['priority'] = priority
        if state:
            params['state'] = state
        data = self._get('alarm_active', params)
        if data.get('success'):
            return data.get('alarms', [])
        raise Exception(data.get('error', 'Alarm query failed'))

    def query_alarm_journal(self, start_time: str = '-24h',
                            source: str = '*', priority: str = '',
                            max_results: int = 500) -> List[Dict[str, Any]]:
        """Query alarm journal / history."""
        payload = {
            'startTime': start_time,
            'source': source,
            'priority': priority,
            'max': max_results,
        }
        data = self._post('alarm_journal', payload)
        if data.get('success'):
            return data.get('events', [])
        raise Exception(data.get('error', 'Alarm journal query failed'))

    # ------------------------------------------------------------------ #
    #  System Info
    # ------------------------------------------------------------------ #

    def get_system_info(self) -> Dict[str, Any]:
        """Get Ignition Gateway system information."""
        data = self._get('system_info')
        if data.get('success'):
            return data.get('info', {})
        raise Exception(data.get('error', 'System info failed'))

    # ------------------------------------------------------------------ #
    #  Script Execution (advanced / dev only)
    # ------------------------------------------------------------------ #

    def execute_expression(self, expression: str) -> Any:
        """Evaluate a tag expression on the gateway."""
        data = self._post('script_exec', {'expression': expression})
        if data.get('success'):
            return data.get('result')
        raise Exception(data.get('error', 'Expression failed'))

    # ------------------------------------------------------------------ #
    #  Connection test
    # ------------------------------------------------------------------ #

    def test_connection(self) -> bool:
        """Quick connectivity check that validates reachability, not auth success."""
        try:
            # StatusPing is the most reliable health endpoint on Ignition gateways.
            status_ping = f"{self.gateway_url}/StatusPing"
            resp = self.session.get(status_ping, timeout=self.timeout, allow_redirects=True)
            if resp.status_code < 500:
                return True

            # Fallback to root gateway check for older/edge deployments.
            root = self.session.get(self.gateway_url, timeout=self.timeout, allow_redirects=True)
            return root.status_code < 500
        except Exception:
            return False
