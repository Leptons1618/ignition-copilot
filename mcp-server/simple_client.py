"""
Simple Ignition Client — lightweight wrapper for direct testing.
Uses the same WebDev endpoints as IgnitionClient but with minimal overhead.
"""

import requests
import json
from typing import List, Dict, Any, Optional
import warnings

warnings.filterwarnings('ignore', message='Unverified HTTPS request')


class SimpleIgnitionClient:
    """Lightweight Ignition client matching the WebDev endpoint contract."""

    def __init__(self, url: str, username: str, password: str,
                 project: str = 'ignition-copilot'):
        self.url = url.rstrip('/')
        self.project = project
        self.session = requests.Session()
        self.session.auth = (username, password)
        self.session.verify = False

    def _ep(self, resource: str) -> str:
        return f"{self.url}/system/webdev/{self.project}/{resource}"

    # ---- Tag Browse -------------------------------------------------- #

    def browse_tags(self, path: str = '[default]', recursive: bool = False) -> List[Dict]:
        try:
            r = self.session.get(self._ep('tag_browse'), params={
                'path': path, 'recursive': str(recursive).lower()
            }, timeout=10)
            data = r.json()
            return data.get('tags', []) if data.get('success') else []
        except Exception:
            return []

    # ---- Tag Read ---------------------------------------------------- #

    def read_tag(self, tag_path: str) -> Dict:
        results = self.read_tags([tag_path])
        return results[0] if results else {
            'path': tag_path, 'value': None, 'quality': 'Error',
            'error': 'No result'
        }

    def read_tags(self, tag_paths: List[str]) -> List[Dict]:
        try:
            r = self.session.get(self._ep('tag_read'), params={
                'paths': ','.join(tag_paths)
            }, timeout=10)
            data = r.json()
            if data.get('success'):
                return data.get('results', [])
        except Exception:
            pass
        return [{'path': p, 'value': None, 'quality': 'Error'} for p in tag_paths]

    # ---- Tag Write --------------------------------------------------- #

    def write_tag(self, tag_path: str, value: Any) -> Dict:
        results = self.write_tags([tag_path], [value])
        return results[0] if results else {'path': tag_path, 'success': False}

    def write_tags(self, tag_paths: List[str], values: List[Any]) -> List[Dict]:
        writes = [{'path': p, 'value': v} for p, v in zip(tag_paths, values)]
        try:
            r = self.session.post(self._ep('tag_write'),
                                  json={'writes': writes},
                                  headers={'Content-Type': 'application/json'},
                                  timeout=10)
            data = r.json()
            return data.get('results', [])
        except Exception:
            return [{'path': p, 'success': False} for p in tag_paths]

    # ---- Tag Search -------------------------------------------------- #

    def search_tags(self, pattern: str = '*', root: str = '[default]',
                    tag_type: str = '', max_results: int = 200) -> List[Dict]:
        try:
            r = self.session.get(self._ep('tag_search'), params={
                'root': root, 'pattern': pattern,
                'tagType': tag_type, 'max': str(max_results)
            }, timeout=10)
            data = r.json()
            return data.get('matches', []) if data.get('success') else []
        except Exception:
            return []

    # ---- Tag Config -------------------------------------------------- #

    def get_tag_config(self, tag_path: str) -> Dict:
        try:
            r = self.session.get(self._ep('tag_config'), params={
                'path': tag_path
            }, timeout=10)
            data = r.json()
            return data.get('config', {}) if data.get('success') else {}
        except Exception:
            return {}

    def create_tag(self, base_path: str, name: str,
                   tag_type: str = 'AtomicTag', data_type: str = 'Float8',
                   value: Any = 0) -> Dict:
        try:
            r = self.session.post(self._ep('tag_config'), json={
                'basePath': base_path, 'name': name,
                'tagType': tag_type, 'dataType': data_type, 'value': value
            }, headers={'Content-Type': 'application/json'}, timeout=10)
            return r.json()
        except Exception as e:
            return {'success': False, 'error': str(e)}

    # ---- Tag Delete -------------------------------------------------- #

    def delete_tags(self, paths: List[str]) -> List[Dict]:
        try:
            r = self.session.post(self._ep('tag_delete'),
                                  json={'paths': paths},
                                  headers={'Content-Type': 'application/json'},
                                  timeout=10)
            return r.json().get('results', [])
        except Exception:
            return [{'path': p, 'success': False} for p in paths]

    # ---- Historian --------------------------------------------------- #

    def query_history(self, paths: List[str], start_time: str = '-1h',
                      end_time: str = '', return_size: int = 500) -> Dict:
        try:
            r = self.session.post(self._ep('history_query'), json={
                'paths': paths, 'startTime': start_time,
                'endTime': end_time, 'returnSize': return_size
            }, headers={'Content-Type': 'application/json'}, timeout=30)
            data = r.json()
            return data.get('data', {}) if data.get('success') else {}
        except Exception:
            return {}

    # ---- Alarms ------------------------------------------------------ #

    def get_active_alarms(self, source: str = '', priority: str = '') -> List[Dict]:
        try:
            params = {}
            if source:
                params['source'] = source
            if priority:
                params['priority'] = priority
            r = self.session.get(self._ep('alarm_active'), params=params, timeout=10)
            data = r.json()
            return data.get('alarms', []) if data.get('success') else []
        except Exception:
            return []

    def query_alarm_journal(self, start_time: str = '-24h',
                            source: str = '*', max_results: int = 500) -> List[Dict]:
        try:
            r = self.session.post(self._ep('alarm_journal'), json={
                'startTime': start_time, 'source': source, 'max': max_results
            }, headers={'Content-Type': 'application/json'}, timeout=30)
            data = r.json()
            return data.get('events', []) if data.get('success') else []
        except Exception:
            return []

    # ---- System Info ------------------------------------------------- #

    def get_system_info(self) -> Dict:
        try:
            r = self.session.get(self._ep('system_info'), timeout=10)
            data = r.json()
            return data.get('info', {}) if data.get('success') else {}
        except Exception:
            return {}

    # ---- Connection -------------------------------------------------- #

    def test_connection(self) -> bool:
        try:
            r = self.session.get(self.url, timeout=5)
            return r.status_code == 200
        except Exception:
            return False


# ====================================================================== #
#  Quick self-test
# ====================================================================== #
if __name__ == "__main__":
    with open('config.json') as f:
        config = json.load(f)

    client = SimpleIgnitionClient(
        config['ignition']['gateway_url'],
        config['ignition']['username'],
        config['ignition']['password'],
        config['ignition'].get('project', 'ignition-copilot')
    )

    print("Testing Ignition connection...")
    if client.test_connection():
        print("[OK] Connected to Ignition Gateway")

        # Browse root
        print("\nBrowsing [default]...")
        tags = client.browse_tags('[default]')
        for t in tags[:10]:
            print(f"  {t.get('name', '?')}  ({t.get('tagType', '?')})")

        # Read a system tag
        print("\nReading system tag...")
        result = client.read_tag("[System]Gateway/SystemName")
        print(f"  SystemName = {result.get('value')}  quality={result.get('quality')}")

        # Search
        print("\nSearching for *Temp*...")
        matches = client.search_tags('*Temp*')
        for m in matches[:5]:
            print(f"  {m.get('path')}")

    else:
        print("[FAIL] Cannot connect to Ignition Gateway")
