import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import CodeBlock from './CodeBlock.jsx';
import { TAG_PATH_REGEX } from '../../lib/constants.js';
import { Plus } from 'lucide-react';

/**
 * Rich Markdown renderer for chat messages.
 * Supports: GFM tables, code blocks with syntax labels + copy, clickable tag paths.
 */
export default function MarkdownRenderer({ text, onAddTag }) {
  return (
    <div className="prose prose-sm max-w-none prose-headings:t-text prose-p:t-text-2 prose-li:t-text-2 prose-strong:t-text prose-a:t-accent prose-code:t-bg-alt prose-code:t-text prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:before:content-[''] prose-code:after:content-[''] prose-table:text-sm prose-th:text-left prose-th:px-3 prose-th:py-1.5 prose-td:px-3 prose-td:py-1.5">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ node, inline, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            const codeText = String(children).replace(/\n$/, '');
            if (!inline && (match || codeText.includes('\n'))) {
              return <CodeBlock code={codeText} language={match?.[1] || ''} />;
            }
            return <code className={className} {...props}>{children}</code>;
          },
          p({ children }) {
            return <p>{renderTagPaths(children, onAddTag)}</p>;
          },
          li({ children }) {
            return <li>{renderTagPaths(children, onAddTag)}</li>;
          },
        }}
      >
        {text || ''}
      </ReactMarkdown>
    </div>
  );
}

function renderTagPaths(children, onAddTag) {
  if (!onAddTag) return children;
  return React.Children.map(children, child => {
    if (typeof child !== 'string') return child;
    const parts = [];
    let last = 0;
    const regex = new RegExp(TAG_PATH_REGEX.source, 'g');
    let m;
    while ((m = regex.exec(child)) !== null) {
      if (m.index > last) parts.push(child.slice(last, m.index));
      const tagPath = m[0];
      parts.push(
        <button
          key={m.index}
          onClick={() => onAddTag(tagPath)}
          className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded t-accent-soft border t-accent-border t-accent text-xs font-mono hover:opacity-80 transition-colors not-prose cursor-pointer"
          title="Add to workspace"
        >
          {tagPath}
          <Plus size={10} />
        </button>
      );
      last = regex.lastIndex;
    }
    if (last < child.length) parts.push(child.slice(last));
    return parts.length > 0 ? parts : child;
  });
}
