import React, { useState } from 'react';
import { FolderOpen, Trash2, ChartLine, MessageSquarePlus, X, Tag, ChevronUp, ChevronDown } from 'lucide-react';
import Button from './ui/Button.jsx';
import Badge from './ui/Badge.jsx';

function groupByProvider(tags) {
  const groups = {};
  for (const tag of tags) {
    const parts = tag.split('/');
    const provider = parts.length > 1 ? parts[1] : 'default';
    if (!groups[provider]) groups[provider] = [];
    groups[provider].push(tag);
  }
  return groups;
}

export default function WorkspaceDock({ tags, onRemoveTag, onClear, onOpenCharts, onOpenChat }) {
  const [expanded, setExpanded] = useState(true);
  const groups = groupByProvider(tags);

  return (
    <section className="bg-white border-b border-gray-200 px-4 py-2 shrink-0">
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setExpanded(e => !e)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors px-2.5 py-1.5 rounded-md"
        >
          <FolderOpen size={14} />
          Workspace
          <Badge color={tags.length > 0 ? 'info' : 'neutral'}>{tags.length}</Badge>
          {tags.length > 0 && (expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
        </button>

        <div className="flex items-center gap-1.5 ml-auto">
          <Button
            variant="primary"
            size="xs"
            onClick={() => onOpenCharts(tags)}
            disabled={tags.length === 0}
          >
            <ChartLine size={13} />
            Charts
          </Button>
          <Button
            variant="secondary"
            size="xs"
            onClick={() => onOpenChat(tags)}
            disabled={tags.length === 0}
          >
            <MessageSquarePlus size={13} />
            Chat
          </Button>
          <Button
            variant="ghost"
            size="xs"
            onClick={onClear}
            disabled={tags.length === 0}
          >
            <Trash2 size={13} />
            Clear
          </Button>
        </div>
      </div>

      {expanded && tags.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {Object.entries(groups).map(([provider, providerTags]) => (
            <div key={provider}>
              {Object.keys(groups).length > 1 && (
                <div className="flex items-center gap-1 text-[10px] text-gray-400 uppercase tracking-wider mb-1">
                  <Tag size={10} />
                  {provider}
                  <span className="text-gray-300">({providerTags.length})</span>
                </div>
              )}
              <div className="flex flex-wrap gap-1">
                {providerTags.map(tag => {
                  const name = tag.split('/').pop();
                  return (
                    <div
                      key={tag}
                      title={tag}
                      className="group inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-gray-50 border border-gray-200 text-gray-700 hover:border-gray-300 transition-colors"
                    >
                      <span className="font-mono truncate max-w-[180px]">{name}</span>
                      <button
                        onClick={() => onRemoveTag(tag)}
                        className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
