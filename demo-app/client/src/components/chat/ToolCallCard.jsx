import React from 'react';
import Collapsible from '../ui/Collapsible.jsx';
import Badge from '../ui/Badge.jsx';
import {
  FolderTree, Eye, PencilLine, Search, LineChart, Bell, BookOpen,
  Server, HeartPulse, FilePlus2, Settings, FileSearch, Wrench, ClipboardList, CheckCircle2, RotateCcw,
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
  plan_project_changes: ClipboardList,
  apply_project_changes: CheckCircle2,
  revert_project_changes: RotateCcw,
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
          <Icon size={12} className="t-text-m" />
          <span className="font-mono">{toolCall.tool}</span>
          {argsStr && <span className="t-text-m truncate max-w-[200px]">({argsStr})</span>}
        </span>
      }
      badge={statusBadge}
      className={isError ? 't-err-border' : isRunning ? 't-accent-border animate-pulse' : 't-border-s'}
    >
      {toolCall.result && (
        <pre className="p-2 t-bg-alt text-xs t-text-2 overflow-x-auto max-h-56 overflow-y-auto">
          {JSON.stringify(toolCall.result, null, 2)}
        </pre>
      )}
      {isRunning && (
        <div className="p-3 text-xs t-text-m">Executing...</div>
      )}
    </Collapsible>
  );
}
