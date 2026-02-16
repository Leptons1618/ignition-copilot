import React from 'react';
import Collapsible from '../ui/Collapsible.jsx';
import Badge from '../ui/Badge.jsx';
import {
  FolderTree, Eye, PencilLine, Search, LineChart, Bell, BookOpen,
  Server, HeartPulse, FilePlus2, Settings, FileSearch, Wrench,
} from 'lucide-react';

const TOOL_ICON_MAP = {
  browse_tags: FolderTree,
  read_tags: Eye,
  write_tag: PencilLine,
  search_tags: Search,
  query_history: LineChart,
  get_active_alarms: Bell,
  query_alarm_journal: BookOpen,
  get_system_info: Server,
  get_asset_health: HeartPulse,
  create_tag: FilePlus2,
  get_tag_config: Settings,
  search_docs: FileSearch,
};

export default function ToolCallCard({ toolCall }) {
  const Icon = TOOL_ICON_MAP[toolCall.tool] || Wrench;
  const isError = toolCall.result?.error || toolCall.status === 'error';
  const isRunning = toolCall.status === 'running';

  const statusBadge = isRunning
    ? <Badge color="info">Running</Badge>
    : isError
    ? <Badge color="error">Error</Badge>
    : <Badge color="success">OK</Badge>;

  const argsStr = toolCall.args ? Object.entries(toolCall.args)
    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
    .join(', ') : '';

  return (
    <Collapsible
      title={
        <span className="inline-flex items-center gap-1.5">
          <Icon size={12} className="text-gray-500" />
          <span className="font-mono">{toolCall.tool}</span>
          {argsStr && <span className="text-gray-400 truncate max-w-[200px]">({argsStr})</span>}
        </span>
      }
      badge={statusBadge}
      className={isError ? 'border-red-200' : isRunning ? 'border-blue-200 animate-pulse' : 'border-gray-200'}
    >
      {toolCall.result && (
        <pre className="p-2 bg-gray-50 text-xs text-gray-600 overflow-x-auto max-h-56 overflow-y-auto">
          {JSON.stringify(toolCall.result, null, 2)}
        </pre>
      )}
      {isRunning && (
        <div className="p-3 text-xs text-gray-500">Executing...</div>
      )}
    </Collapsible>
  );
}
