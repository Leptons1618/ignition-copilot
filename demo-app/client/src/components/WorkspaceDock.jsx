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
    <section className="t-surface border-b t-border-s px-4 py-2 shrink-0">
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setExpanded(e => !e)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold t-text-2 t-bg-alt hover:t-surface-h transition-colors px-2.5 py-1.5 rounded-md cursor-pointer"
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
                <div className="flex items-center gap-1 text-[10px] t-text-m uppercase tracking-wider mb-1">
                  <Tag size={10} />
                  {provider}
                  <span className="t-text-m">({providerTags.length})</span>
                </div>
              )}
              <div className="flex flex-wrap gap-1">
                {providerTags.map(tag => {
                  const name = tag.split('/').pop();
                  return (
                    <div
                      key={tag}
                      title={tag}
                      className="group inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md t-bg-alt border t-border-s t-text-2 hover:t-border transition-colors"
                    >
                      <span className="font-mono truncate max-w-[180px]">{name}</span>
                      <button
                        onClick={() => onRemoveTag(tag)}
                        className="t-text-m hover:t-err opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
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
