import React, { useState } from 'react';
import { Copy, Check, FileCode } from 'lucide-react';

const LANG_LABELS = {
  python: 'Python',
  jython: 'Jython',
  javascript: 'JavaScript',
  js: 'JavaScript',
  json: 'JSON',
  sql: 'SQL',
  xml: 'XML',
  yaml: 'YAML',
  bash: 'Bash',
  shell: 'Shell',
  groovy: 'Groovy',
  java: 'Java',
};

export default function CodeBlock({ code, language = '' }) {
  const [copied, setCopied] = useState(false);
  const lang = (language || '').toLowerCase().trim();
  const label = LANG_LABELS[lang] || (lang ? lang.charAt(0).toUpperCase() + lang.slice(1) : 'Code');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div className="rounded-lg overflow-hidden border border-gray-700 my-2 group">
      <div className="flex items-center justify-between px-3 py-1.5 bg-gray-800 border-b border-gray-700">
        <span className="inline-flex items-center gap-1.5 text-xs text-gray-400">
          <FileCode size={12} />
          {label}
        </span>
        <button
          onClick={handleCopy}
          className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-200 transition-colors"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="p-3 bg-gray-900 text-gray-100 text-xs leading-relaxed overflow-x-auto">
        <code>{code}</code>
      </pre>
    </div>
  );
}
